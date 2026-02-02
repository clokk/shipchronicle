/**
 * Push local changes to cloud
 */

import { getAuthenticatedClient, getMachineId, loadAuthTokens, refreshTokenIfNeeded } from "./client";
import { CogCommitDB } from "../storage/db";
import type { CognitiveCommit } from "../models/types";
import type { SyncResult } from "./types";
import { v5 as uuidv5 } from "uuid";
import { COGCOMMIT_UUID_NAMESPACE, SYNC_BATCH_SIZE } from "../constants";
import { generateCommitTitle } from "../utils/title";
import cliProgress from "cli-progress";
import { getUserUsage } from "@cogcommit/supabase";

export interface PushOptions {
  verbose?: boolean;
  force?: boolean;
  dryRun?: boolean;
  retry?: boolean;
}

/**
 * Check if a commit is valid for syncing (not warmup, has turns)
 */
function isValidCommit(commit: CognitiveCommit): boolean {
  // Filter out 0-turn commits
  const totalTurns = commit.sessions.reduce((sum, s) => sum + s.turns.length, 0);
  if (totalTurns === 0) return false;

  // Filter out warmup commits (Claude Code internal)
  const firstUserMessage = commit.sessions[0]?.turns[0]?.content || "";
  if (firstUserMessage.toLowerCase().includes("warmup")) return false;

  return true;
}

/**
 * Convert a string to a valid UUID
 * If already a valid UUID, returns as-is; otherwise generates a deterministic UUID
 */
function toUuid(id: string): string {
  // Check if it's already a valid UUID (simple regex check)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    return id;
  }
  // Generate a deterministic UUID from the string
  return uuidv5(id, COGCOMMIT_UUID_NAMESPACE);
}

/**
 * Push pending local commits to cloud
 */
export async function pushToCloud(
  db: CogCommitDB,
  options: PushOptions = {}
): Promise<SyncResult> {
  const result: SyncResult = {
    pushed: 0,
    pulled: 0,
    conflicts: 0,
    errors: [],
  };

  // Refresh token if needed before starting
  const refreshed = await refreshTokenIfNeeded();
  if (!refreshed) {
    result.errors.push("Not authenticated or token refresh failed");
    return result;
  }

  const tokens = loadAuthTokens();
  if (!tokens) {
    result.errors.push("Not authenticated");
    return result;
  }

  // Handle --force: reset all commits to pending
  if (options.force) {
    const resetCount = db.commits.resetAllSyncStatus();
    console.log(`Reset ${resetCount} commits to pending status\n`);
  }

  // Get commits based on mode
  let pendingCommits: CognitiveCommit[];
  if (options.retry) {
    pendingCommits = db.commits.getBySyncStatus("error");
    if (options.verbose) {
      console.log(`Found ${pendingCommits.length} failed commits to retry`);
    }
  } else {
    pendingCommits = db.commits.getPending();
    if (options.verbose) {
      console.log(`Found ${pendingCommits.length} pending commits to push`);
    }
  }

  // Filter out warmup and 0-turn commits (mark them as synced so they don't reappear)
  const invalidCommits = pendingCommits.filter((c) => !isValidCommit(c));
  if (invalidCommits.length > 0) {
    for (const commit of invalidCommits) {
      db.commits.updateSyncStatus(commit.id, "synced");
    }
    if (options.verbose) {
      console.log(`Skipped ${invalidCommits.length} warmup/empty commits`);
    }
  }
  pendingCommits = pendingCommits.filter(isValidCommit);

  // Handle --dry-run: just show stats
  if (options.dryRun) {
    const sessionCount = pendingCommits.reduce((acc, c) => acc + c.sessions.length, 0);
    const turnCount = pendingCommits.reduce(
      (acc, c) => acc + c.sessions.reduce((s, sess) => s + sess.turns.length, 0),
      0
    );

    console.log("Dry run - would push:");
    console.log(`  ${pendingCommits.length} commits`);
    console.log(`  ${sessionCount} sessions`);
    console.log(`  ${turnCount} turns`);
    return result;
  }

  if (pendingCommits.length === 0) {
    return result;
  }

  // Check usage limits for free tier
  const supabaseForUsage = getAuthenticatedClient();
  const usage = await getUserUsage(supabaseForUsage, tokens.user.id);

  // Sort pending commits by most recent first
  pendingCommits.sort((a, b) =>
    new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime()
  );

  // Calculate remaining slots
  const remainingSlots = Math.max(0, usage.commitLimit - usage.commitCount);

  if (pendingCommits.length > remainingSlots && usage.tier === "free") {
    if (remainingSlots === 0) {
      console.log(`\n  Cloud full (${usage.commitCount}/${usage.commitLimit} commits)`);
      console.log(`   Upgrade at cogcommit.com/pro for unlimited sync\n`);
      return result;
    }

    console.log(`\n  Syncing most recent ${remainingSlots} of ${pendingCommits.length} commits (free tier)`);
    pendingCommits = pendingCommits.slice(0, remainingSlots);
  }

  const supabase = getAuthenticatedClient();
  const machineIdString = getMachineId();
  const userId = tokens.user.id;

  // Get machine UUID from database
  const { data: machineData } = await supabase
    .from("machines")
    .select("id")
    .eq("user_id", userId)
    .eq("machine_id", machineIdString)
    .single();

  const machineUuid = machineData?.id || null;

  // Create progress bar (unless verbose mode)
  const progressBar =
    !options.verbose && pendingCommits.length > 0
      ? new cliProgress.SingleBar(
          {
            format: "Pushing [{bar}] {percentage}% | {value}/{total} commits",
            barCompleteChar: "\u2588",
            barIncompleteChar: "\u2591",
            hideCursor: true,
          },
          cliProgress.Presets.shades_classic
        )
      : null;

  progressBar?.start(pendingCommits.length, 0);

  for (const commit of pendingCommits) {
    try {
      // Check for conflicts
      if (commit.cloudId) {
        const { data: cloudCommit } = await supabase
          .from("cognitive_commits")
          .select("version, updated_at")
          .eq("id", commit.cloudId)
          .single();

        if (cloudCommit && cloudCommit.version > (commit.cloudVersion || 0)) {
          // Conflict detected - cloud has newer version
          db.commits.updateSyncStatus(commit.id, "conflict");
          result.conflicts++;
          progressBar?.increment();
          continue;
        }
      }

      // Push commit to cloud
      const cloudCommit = await pushCommit(supabase, commit, userId, machineUuid);

      // Push sessions
      for (const session of commit.sessions) {
        await pushSession(supabase, session, cloudCommit.id);
      }

      // Update local sync metadata
      db.commits.updateSyncMetadata(commit.id, {
        cloudId: cloudCommit.id,
        syncStatus: "synced",
        cloudVersion: cloudCommit.version,
        lastSyncedAt: new Date().toISOString(),
      });

      result.pushed++;
      progressBar?.increment();

      if (options.verbose) {
        console.log(`Pushed commit ${commit.id.substring(0, 8)}`);
      }
    } catch (error) {
      result.errors.push(`Failed to push commit ${commit.id}: ${(error as Error).message}`);
      db.commits.updateSyncStatus(commit.id, "error");
      progressBar?.increment();
    }
  }

  progressBar?.stop();

  return result;
}

/**
 * Push a single commit to cloud
 */
async function pushCommit(
  supabase: ReturnType<typeof getAuthenticatedClient>,
  commit: CognitiveCommit,
  userId: string,
  machineUuid: string | null
): Promise<{ id: string; version: number }> {
  // Auto-generate title from first user message if not set
  const title = generateCommitTitle(commit);

  // Calculate prompt_count (user prompts only)
  const promptCount = commit.sessions.reduce(
    (sum, session) => sum + session.turns.filter(t => t.role === 'user').length,
    0
  );

  const { data, error } = await supabase
    .from("cognitive_commits")
    .upsert(
      {
        id: commit.cloudId || commit.id,
        user_id: userId,
        origin_machine_id: machineUuid,
        git_hash: commit.gitHash,
        started_at: commit.startedAt,
        closed_at: commit.closedAt,
        closed_by: commit.closedBy,
        parallel: commit.parallel,
        files_read: commit.filesRead,
        files_changed: commit.filesChanged,
        source: commit.source || "claude_code",
        project_name: commit.projectName,
        published: commit.published || false,
        hidden: commit.hidden || false,
        display_order: commit.displayOrder || 0,
        title,
        prompt_count: promptCount,
        version: (commit.cloudVersion || 0) + 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select("id, version")
    .single();

  if (error) {
    throw new Error(`Failed to push commit: ${error.message}`);
  }

  return data;
}

/**
 * Push a session and its turns to cloud
 */
async function pushSession(
  supabase: ReturnType<typeof getAuthenticatedClient>,
  session: CognitiveCommit["sessions"][0],
  cloudCommitId: string
): Promise<void> {
  // Convert session ID to UUID if needed
  const sessionUuid = toUuid(session.id);

  // Push session
  const { error: sessionError } = await supabase.from("sessions").upsert(
    {
      id: sessionUuid,
      commit_id: cloudCommitId,
      started_at: session.startedAt,
      ended_at: session.endedAt,
      version: 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (sessionError) {
    throw new Error(`Failed to push session: ${sessionError.message}`);
  }

  // Push turns in batches
  for (let i = 0; i < session.turns.length; i += SYNC_BATCH_SIZE) {
    const batch = session.turns.slice(i, i + SYNC_BATCH_SIZE).map((turn) => ({
      id: toUuid(turn.id),
      session_id: sessionUuid,
      role: turn.role,
      content: turn.content,
      timestamp: turn.timestamp,
      tool_calls: turn.toolCalls ? JSON.stringify(turn.toolCalls) : null,
      triggers_visual: turn.triggersVisualUpdate || false,
      model: turn.model,
      version: 1,
      updated_at: new Date().toISOString(),
    }));

    const { error: turnsError } = await supabase
      .from("turns")
      .upsert(batch, { onConflict: "id" });

    if (turnsError) {
      throw new Error(`Failed to push turns: ${turnsError.message}`);
    }
  }
}

/**
 * Push visuals to cloud storage
 */
export async function pushVisuals(
  db: CogCommitDB,
  commitId: string,
  options: { verbose?: boolean } = {}
): Promise<{ uploaded: number; errors: string[] }> {
  const result = { uploaded: 0, errors: [] as string[] };

  const tokens = loadAuthTokens();
  if (!tokens) {
    result.errors.push("Not authenticated");
    return result;
  }

  const supabase = getAuthenticatedClient();
  const visuals = db.visuals.getWithCloudInfo(commitId);

  for (const visual of visuals) {
    // Skip if already uploaded
    if (visual.cloudUrl) {
      continue;
    }

    try {
      // Read local file
      const fs = await import("fs");
      if (!fs.existsSync(visual.path)) {
        result.errors.push(`File not found: ${visual.path}`);
        continue;
      }

      const fileBuffer = fs.readFileSync(visual.path);
      const fileName = `${tokens.user.id}/${commitId}/${visual.id}.png`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("visuals")
        .upload(fileName, fileBuffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        result.errors.push(`Upload failed: ${uploadError.message}`);
        continue;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("visuals")
        .getPublicUrl(fileName);

      // Update visual record with cloud URL
      const { error: updateError } = await supabase
        .from("visuals")
        .upsert(
          {
            id: visual.id,
            commit_id: commitId,
            type: visual.type,
            path: visual.path,
            cloud_url: urlData.publicUrl,
            captured_at: visual.capturedAt,
            caption: visual.caption,
            version: 1,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

      if (updateError) {
        result.errors.push(`Failed to update visual record: ${updateError.message}`);
        continue;
      }

      // Update local record
      db.visuals.updateCloudUrl(visual.id, urlData.publicUrl);

      result.uploaded++;

      if (options.verbose) {
        console.log(`Uploaded visual ${visual.id.substring(0, 8)}`);
      }
    } catch (error) {
      result.errors.push(`Failed to upload visual ${visual.id}: ${(error as Error).message}`);
    }
  }

  return result;
}
