/**
 * Push local changes to cloud
 */

import { getAuthenticatedClient, getMachineId, loadAuthTokens } from "./client";
import { AgentlogsDB } from "../storage/db";
import type { CognitiveCommit } from "../models/types";
import type { SyncResult } from "./types";
import { v5 as uuidv5 } from "uuid";

// Namespace UUID for generating deterministic UUIDs from non-UUID strings
const AGENTLOGS_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

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
  return uuidv5(id, AGENTLOGS_NAMESPACE);
}

/**
 * Push pending local commits to cloud
 */
export async function pushToCloud(
  db: AgentlogsDB,
  options: { verbose?: boolean } = {}
): Promise<SyncResult> {
  const result: SyncResult = {
    pushed: 0,
    pulled: 0,
    conflicts: 0,
    errors: [],
  };

  const tokens = loadAuthTokens();
  if (!tokens) {
    result.errors.push("Not authenticated");
    return result;
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

  // Get pending commits
  const pendingCommits = db.getPendingCommits();

  if (options.verbose) {
    console.log(`Found ${pendingCommits.length} pending commits to push`);
  }

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
          db.updateSyncStatus(commit.id, "conflict");
          result.conflicts++;
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
      db.updateSyncMetadata(commit.id, {
        cloudId: cloudCommit.id,
        syncStatus: "synced",
        cloudVersion: cloudCommit.version,
        lastSyncedAt: new Date().toISOString(),
      });

      result.pushed++;

      if (options.verbose) {
        console.log(`Pushed commit ${commit.id.substring(0, 8)}`);
      }
    } catch (error) {
      result.errors.push(`Failed to push commit ${commit.id}: ${(error as Error).message}`);
      db.updateSyncStatus(commit.id, "error");
    }
  }

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
        title: commit.title,
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
  const BATCH_SIZE = 100;
  for (let i = 0; i < session.turns.length; i += BATCH_SIZE) {
    const batch = session.turns.slice(i, i + BATCH_SIZE).map((turn) => ({
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
  db: AgentlogsDB,
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
  const visuals = db.getVisuals(commitId);

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
      db.updateVisualCloudUrl(visual.id, urlData.publicUrl);

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
