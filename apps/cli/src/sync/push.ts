/**
 * Push local changes to cloud
 */

import { getAuthenticatedClient, getMachineId, loadAuthTokens, refreshTokenIfNeeded } from "./client";
import { TuhnrDB } from "../storage/db";
import type { CognitiveCommit } from "../models/types";
import type { SyncResult } from "./types";
import { v5 as uuidv5 } from "uuid";
import { COGCOMMIT_UUID_NAMESPACE, SYNC_BATCH_SIZE, SYNC_CONCURRENCY } from "../constants";
import { generateCommitTitle } from "../utils/title";
import { analyzeSentiment } from "../parser/sentiment";
import cliProgress from "cli-progress";
import { getUserUsage } from "@cogcommit/supabase";

/** Performance profiling for verbose mode */
interface PushProfile {
  auth: number;
  machineLookup: number;
  usageCheck: number;
  batches: Array<{
    batchNum: number;
    commits: number;
    commitsTime: number;
    sessions: number;
    sessionsTime: number;
    turns: number;
    turnsTime: number;
    total: number;
  }>;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export interface PushOptions {
  verbose?: boolean;
  force?: boolean;
  dryRun?: boolean;
  retry?: boolean;
}

/** Filter reason for commits */
type FilterReason =
  | "valid"
  | "no_user_prompts"
  | "warmup_pattern"
  | "single_short_message"
  | "empty_content";

/**
 * Check if a commit is valid for syncing (not warmup, has meaningful user prompts)
 * Returns the reason if filtered, or "valid" if it should be synced
 */
function getFilterReason(commit: CognitiveCommit): FilterReason {
  // Get all user messages
  const userMessages = commit.sessions.flatMap((s) =>
    s.turns.filter((t) => t.role === "user").map((t) => t.content || "")
  );

  // Filter out commits with no user prompts
  if (userMessages.length === 0) return "no_user_prompts";

  // Check all user messages for warmup indicators
  const warmupPatterns = [
    /warmup/i,
    /^test$/i,
    /^testing$/i,
    /^hello$/i,
    /^hi$/i,
    /^hey$/i,
  ];

  const firstMessage = userMessages[0] || "";

  // Filter out warmup commits (Claude Code internal or trivial)
  for (const pattern of warmupPatterns) {
    if (pattern.test(firstMessage.trim())) return "warmup_pattern";
  }

  // Filter out commits where the only user message is very short (likely warmup)
  if (userMessages.length === 1 && firstMessage.trim().length < 10) {
    return "single_short_message";
  }

  // Filter out commits with empty/whitespace-only content
  const hasSubstantiveContent = userMessages.some((msg) => msg.trim().length > 0);
  if (!hasSubstantiveContent) return "empty_content";

  return "valid";
}

function isValidCommit(commit: CognitiveCommit): boolean {
  return getFilterReason(commit) === "valid";
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
  db: TuhnrDB,
  options: PushOptions = {}
): Promise<SyncResult> {
  const result: SyncResult = {
    pushed: 0,
    pulled: 0,
    conflicts: 0,
    errors: [],
    filtered: 0,
    totalPending: 0,
  };

  // Performance profiling for verbose mode
  const profile: PushProfile = {
    auth: 0,
    machineLookup: 0,
    usageCheck: 0,
    batches: [],
  };

  // Refresh token if needed before starting
  let authStart = Date.now();
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
  profile.auth = Date.now() - authStart;

  // Handle --force: reset all commits to pending
  if (options.force) {
    const resetCount = db.commits.resetAllSyncStatus();
    console.log(`Reset ${resetCount} commits to pending status\n`);
  }

  // Get commits based on mode
  let pendingCommits: CognitiveCommit[];
  if (options.retry) {
    pendingCommits = db.commits.getBySyncStatus("error");
  } else {
    pendingCommits = db.commits.getPending();
  }

  // Track total before filtering
  result.totalPending = pendingCommits.length;

  // Analyze filter reasons with samples for debugging
  const filterStats: Record<FilterReason, { count: number; samples: string[] }> = {
    valid: { count: 0, samples: [] },
    no_user_prompts: { count: 0, samples: [] },
    warmup_pattern: { count: 0, samples: [] },
    single_short_message: { count: 0, samples: [] },
    empty_content: { count: 0, samples: [] },
  };

  for (const commit of pendingCommits) {
    const reason = getFilterReason(commit);
    filterStats[reason].count++;

    // Collect samples (first message preview) for debugging
    if (reason !== "valid" && filterStats[reason].samples.length < 3) {
      const firstUserMsg = commit.sessions
        .flatMap((s) => s.turns.filter((t) => t.role === "user"))
        .map((t) => t.content || "")[0] || "(empty)";
      const preview = firstUserMsg.substring(0, 50).replace(/\n/g, " ");
      filterStats[reason].samples.push(
        `${commit.projectName || "unknown"}: "${preview}${firstUserMsg.length > 50 ? "..." : ""}"`
      );
    }
  }

  // Filter out warmup and 0-turn commits (mark them as "filtered" so they don't reappear)
  const invalidCommits = pendingCommits.filter((c) => !isValidCommit(c));
  if (invalidCommits.length > 0) {
    for (const commit of invalidCommits) {
      db.commits.updateSyncStatus(commit.id, "filtered");
    }
    result.filtered = invalidCommits.length;
  }
  pendingCommits = pendingCommits.filter(isValidCommit);

  // Show filtering summary (always, not just verbose)
  if (result.totalPending && result.totalPending > 0) {
    console.log(`  Pending: ${result.totalPending} commits`);
    if (result.filtered && result.filtered > 0) {
      console.log(`  Filtered: ${result.filtered} (warmup/no user prompts)`);
    }
    console.log(`  To upload: ${pendingCommits.length} commits\n`);
  }

  // Show detailed filter breakdown in verbose mode
  if (options.verbose) {
    console.log("─── Filter Analysis ───\n");
    for (const [reason, data] of Object.entries(filterStats)) {
      if (reason === "valid") continue;
      if (data.count === 0) continue;
      console.log(`  ${reason}: ${data.count} commits`);
      for (const sample of data.samples) {
        console.log(`    • ${sample}`);
      }
    }
    console.log();
  }

  if (options.verbose) {
    console.log(`Found ${result.totalPending} pending commits`);
    if (result.filtered && result.filtered > 0) {
      console.log(`Filtered ${result.filtered} warmup/empty commits`);
    }
    console.log(`Pushing ${pendingCommits.length} valid commits`);
  }

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
  let usageStart = Date.now();
  const supabaseForUsage = getAuthenticatedClient();
  const usage = await getUserUsage(supabaseForUsage, tokens.user.id);
  profile.usageCheck = Date.now() - usageStart;

  // Sort pending commits by most recent first
  pendingCommits.sort((a, b) =>
    new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime()
  );

  // Calculate remaining slots
  const remainingSlots = Math.max(0, usage.commitLimit - usage.commitCount);

  if (pendingCommits.length > remainingSlots && usage.tier === "free") {
    if (remainingSlots === 0) {
      console.log(`\n  Cloud full (${usage.commitCount}/${usage.commitLimit} commits)`);
      console.log(`   Upgrade at tuhnr.com/pro for unlimited sync\n`);
      return result;
    }

    console.log(`\n  Syncing most recent ${remainingSlots} of ${pendingCommits.length} commits (free tier)`);
    pendingCommits = pendingCommits.slice(0, remainingSlots);
  }

  const supabase = getAuthenticatedClient();
  const machineIdString = getMachineId();
  const userId = tokens.user.id;

  // Get machine UUID from database
  let machineStart = Date.now();
  const { data: machineData } = await supabase
    .from("machines")
    .select("id")
    .eq("user_id", userId)
    .eq("machine_id", machineIdString)
    .single();

  const machineUuid = machineData?.id || null;
  profile.machineLookup = Date.now() - machineStart;

  // === BULK PUSH OPTIMIZATION ===
  // Batch by TURN COUNT (not commit count) for predictable payload sizes.
  // Supabase Pro tier — no disk I/O throttling needed.
  // Commits have high variance - one might have 10 turns, another 500

  const TARGET_TURNS_PER_BATCH = 3000;  // Target ~3000 turns per batch (RLS optimization reduces overhead)
  const MAX_COMMITS_PER_BATCH = 75;     // Fewer batches = fewer round trips
  const SESSION_BATCH_SIZE = 300;       // Larger payloads
  const TURN_BATCH_SIZE = 1500;         // Larger batches for RPC bulk upsert

  // Group commits into batches based on turn count
  function createTurnBasedBatches(commits: CognitiveCommit[]): CognitiveCommit[][] {
    const batches: CognitiveCommit[][] = [];
    let currentBatch: CognitiveCommit[] = [];
    let currentTurnCount = 0;

    for (const commit of commits) {
      const commitTurns = commit.sessions.reduce((sum, s) => sum + s.turns.length, 0);

      // Start new batch if this commit would exceed targets (unless batch is empty)
      if (currentBatch.length > 0 &&
          (currentTurnCount + commitTurns > TARGET_TURNS_PER_BATCH ||
           currentBatch.length >= MAX_COMMITS_PER_BATCH)) {
        batches.push(currentBatch);
        currentBatch = [];
        currentTurnCount = 0;
      }

      currentBatch.push(commit);
      currentTurnCount += commitTurns;
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  const commitBatches = createTurnBasedBatches(pendingCommits);

  if (options.verbose) {
    const batchSizes = commitBatches.map(b => {
      const turns = b.reduce((sum, c) => sum + c.sessions.reduce((s, sess) => s + sess.turns.length, 0), 0);
      return `${b.length}c/${turns}t`;
    });
    console.log(`Created ${commitBatches.length} batches: [${batchSizes.join(', ')}]`);
  }

  // Create progress bar based on commits
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
  let commitsProcessed = 0;

  let batchNum = 0;
  for (const commitBatch of commitBatches) {
    batchNum++;
    const batchProfile = {
      batchNum,
      commits: commitBatch.length,
      commitsTime: 0,
      sessions: 0,
      sessionsTime: 0,
      turns: 0,
      turnsTime: 0,
      total: 0,
    };
    const batchStart = Date.now();

    try {
      // Prepare all commit records for this batch
      const commitsStart = Date.now();
      const commitRecords = commitBatch.map((commit) => {
        const title = generateCommitTitle(commit);
        const allTurns = commit.sessions.flatMap((s) => s.turns);
        const promptCount = allTurns.filter((t) => t.role === "user").length;
        const sentiment = analyzeSentiment(allTurns);

        return {
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
          rejection_count: sentiment.rejectionCount,
          approval_count: sentiment.approvalCount,
          sentiment_label: sentiment.label,
          version: (commit.cloudVersion || 0) + 1,
          updated_at: new Date().toISOString(),
        };
      });

      // Upsert commits in chunks (RLS caching makes larger chunks safe)
      const COMMIT_CHUNK_SIZE = 25;
      for (let c = 0; c < commitRecords.length; c += COMMIT_CHUNK_SIZE) {
        const chunk = commitRecords.slice(c, c + COMMIT_CHUNK_SIZE);
        try {
          const { error: commitError } = await supabase
            .from("cognitive_commits")
            .upsert(chunk, { onConflict: "id" });

          if (commitError) {
            throw new Error(`Supabase error: ${commitError.message}`);
          }
        } catch (e) {
          throw new Error(`[commits phase] ${(e as Error).message}`);
        }
      }
      batchProfile.commitsTime = Date.now() - commitsStart;

      // Prepare all sessions and turns for this batch
      const sessionRecords: Array<{
        id: string;
        commit_id: string;
        started_at: string;
        ended_at: string;
        version: number;
        updated_at: string;
      }> = [];

      const turnRecords: Array<{
        id: string;
        session_id: string;
        role: string;
        content: string;
        timestamp: string;
        tool_calls: string | null;
        triggers_visual: boolean;
        model: string | null;
        has_rejection: boolean;
        has_approval: boolean;
        is_question: boolean;
        has_code_block: boolean;
        char_count: number;
        version: number;
        updated_at: string;
      }> = [];

      const now = new Date().toISOString();
      for (const commit of commitBatch) {
        const commitId = commit.cloudId || commit.id;
        for (const session of commit.sessions) {
          const sessionUuid = toUuid(session.id);
          sessionRecords.push({
            id: sessionUuid,
            commit_id: commitId,
            started_at: session.startedAt,
            ended_at: session.endedAt,
            version: 1,
            updated_at: now,
          });

          for (const turn of session.turns) {
            turnRecords.push({
              id: toUuid(turn.id),
              session_id: sessionUuid,
              role: turn.role,
              content: turn.content,
              timestamp: turn.timestamp,
              tool_calls: turn.toolCalls ? JSON.stringify(turn.toolCalls) : null,
              triggers_visual: turn.triggersVisualUpdate || false,
              model: turn.model || null,
              has_rejection: turn.hasRejection || false,
              has_approval: turn.hasApproval || false,
              is_question: turn.isQuestion || false,
              has_code_block: turn.hasCodeBlock || false,
              char_count: turn.charCount || 0,
              version: 1,
              updated_at: now,
            });
          }
        }
      }

      // Prepare all batches upfront
      const sessionBatches: Array<typeof sessionRecords> = [];
      for (let s = 0; s < sessionRecords.length; s += SESSION_BATCH_SIZE) {
        sessionBatches.push(sessionRecords.slice(s, s + SESSION_BATCH_SIZE));
      }

      // Throttled parallel upload helper with retry (max concurrent requests)
      const MAX_RETRIES = 2;
      const BASE_RETRY_DELAY_MS = 100;

      async function uploadWithRetry<T>(
        batch: T,
        uploadFn: (batch: T) => Promise<{ error: Error | null }>,
        retries = MAX_RETRIES
      ): Promise<{ error: Error | null }> {
        const result = await uploadFn(batch);
        if (result.error && retries > 0) {
          // Exponential backoff: 100ms, 200ms, 400ms...
          const delay = BASE_RETRY_DELAY_MS * Math.pow(2, MAX_RETRIES - retries);
          await new Promise((r) => setTimeout(r, delay));
          return uploadWithRetry(batch, uploadFn, retries - 1);
        }
        return result;
      }

      async function throttledUpload<T>(
        batches: T[],
        uploadFn: (batch: T) => Promise<{ error: Error | null }>
      ): Promise<void> {
        for (let i = 0; i < batches.length; i += SYNC_CONCURRENCY) {
          const chunk = batches.slice(i, i + SYNC_CONCURRENCY);
          const results = await Promise.all(
            chunk.map((batch) => uploadWithRetry(batch, uploadFn))
          );
          for (const { error } of results) {
            if (error) throw error;
          }
        }
      }

      // Upload sessions with throttling
      batchProfile.sessions = sessionRecords.length;
      const sessionsStart = Date.now();
      if (sessionBatches.length > 0) {
        try {
          await throttledUpload(sessionBatches, async (batch) => {
            const { error } = await supabase.from("sessions").upsert(batch, { onConflict: "id" });
            return { error };
          });
        } catch (e) {
          throw new Error(`[sessions phase] ${(e as Error).message}`);
        }
      }
      batchProfile.sessionsTime = Date.now() - sessionsStart;

      // Upload turns via RPC bulk function (bypasses per-row RLS)
      batchProfile.turns = turnRecords.length;
      const turnsStart = Date.now();
      if (turnRecords.length > 0) {
        try {
          for (let t = 0; t < turnRecords.length; t += TURN_BATCH_SIZE) {
            const batch = turnRecords.slice(t, t + TURN_BATCH_SIZE);
            const { error } = await supabase.rpc("bulk_upsert_turns", {
              p_turns: batch,
            });
            if (error) throw error;
          }
        } catch (e) {
          throw new Error(`[turns phase] ${(e as Error).message}`);
        }
      }
      batchProfile.turnsTime = Date.now() - turnsStart;

      batchProfile.total = Date.now() - batchStart;
      profile.batches.push(batchProfile);

      // Update progress after this commit batch is done
      commitsProcessed += commitBatch.length;
      progressBar?.update(Math.min(commitsProcessed, pendingCommits.length));

      // Update local sync metadata for all commits in batch
      for (const commit of commitBatch) {
        db.commits.updateSyncMetadata(commit.id, {
          cloudId: commit.cloudId || commit.id,
          syncStatus: "synced",
          cloudVersion: (commit.cloudVersion || 0) + 1,
          lastSyncedAt: now,
        });
        result.pushed++;
      }

    } catch (error) {
      // Batch failed - fall back to individual commit processing to save what we can
      const batchError = (error as Error).message;
      // Always show batch failures (important for debugging)
      console.log(`\nBatch ${batchNum} failed: ${batchError}`);
      console.log(`Falling back to individual processing for ${commitBatch.length} commits...`);

      // Process each commit individually to isolate problematic ones
      for (const commit of commitBatch) {
        // Re-check filter
        if (!isValidCommit(commit)) {
          db.commits.updateSyncStatus(commit.id, "filtered");
          result.filtered = (result.filtered || 0) + 1;
          commitsProcessed++;
          progressBar?.update(Math.min(commitsProcessed, pendingCommits.length));
          continue;
        }

        // Try individual upload
        try {
          const cloudData = await pushCommit(supabase, commit, userId, machineUuid);
          await pushSession(supabase, commit.sessions[0], cloudData.id);
          for (let s = 1; s < commit.sessions.length; s++) {
            await pushSession(supabase, commit.sessions[s], cloudData.id);
          }

          const now = new Date().toISOString();
          db.commits.updateSyncMetadata(commit.id, {
            cloudId: cloudData.id,
            syncStatus: "synced",
            cloudVersion: cloudData.version,
            lastSyncedAt: now,
          });
          result.pushed++;
        } catch (individualError) {
          // This specific commit failed
          const errMsg = (individualError as Error).message;
          // Only add unique errors to avoid spam
          if (result.errors.length < 10) {
            result.errors.push(`Commit ${commit.id.substring(0, 8)}: ${errMsg}`);
          } else if (result.errors.length === 10) {
            result.errors.push(`... and more (${commitBatch.length} total in batch)`);
          }
          db.commits.updateSyncStatus(commit.id, "error");
        }

        commitsProcessed++;
        progressBar?.update(Math.min(commitsProcessed, pendingCommits.length));
      }
    }
  }

  progressBar?.stop();

  // Record last sync time for status display
  if (result.pushed > 0) {
    db.daemonState.setLastSyncTime(new Date().toISOString());
  }

  // Print profiling summary in verbose mode
  if (options.verbose && profile.batches.length > 0) {
    console.log("\n─── Performance Profile ───\n");
    console.log(`  Auth:           ${formatMs(profile.auth)}`);
    console.log(`  Machine lookup: ${formatMs(profile.machineLookup)}`);
    console.log(`  Usage check:    ${formatMs(profile.usageCheck)}`);
    console.log();

    let totalCommitsTime = 0;
    let totalSessionsTime = 0;
    let totalTurnsTime = 0;
    let totalBatchTime = 0;

    for (const batch of profile.batches) {
      console.log(`  Batch ${batch.batchNum}: ${formatMs(batch.total)} (${batch.commits} commits, ${batch.sessions} sessions, ${batch.turns} turns)`);
      console.log(`    commits: ${formatMs(batch.commitsTime)}, sessions: ${formatMs(batch.sessionsTime)}, turns: ${formatMs(batch.turnsTime)}`);
      totalCommitsTime += batch.commitsTime;
      totalSessionsTime += batch.sessionsTime;
      totalTurnsTime += batch.turnsTime;
      totalBatchTime += batch.total;
    }

    console.log();
    console.log(`  Totals: commits=${formatMs(totalCommitsTime)}, sessions=${formatMs(totalSessionsTime)}, turns=${formatMs(totalTurnsTime)}`);
    console.log(`  Total batch time: ${formatMs(totalBatchTime)}`);
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
  // Auto-generate title from first user message if not set
  const title = generateCommitTitle(commit);

  // Collect all turns for analysis
  const allTurns = commit.sessions.flatMap((session) => session.turns);

  // Calculate prompt_count (user prompts only)
  const promptCount = allTurns.filter((t) => t.role === "user").length;

  // Analyze sentiment
  const sentiment = analyzeSentiment(allTurns);

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
        rejection_count: sentiment.rejectionCount,
        approval_count: sentiment.approvalCount,
        sentiment_label: sentiment.label,
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
      has_rejection: turn.hasRejection || false,
      has_approval: turn.hasApproval || false,
      is_question: turn.isQuestion || false,
      has_code_block: turn.hasCodeBlock || false,
      char_count: turn.charCount || 0,
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
  db: TuhnrDB,
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
