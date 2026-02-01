/**
 * Pull cloud changes to local
 */

import { getAuthenticatedClient, loadAuthTokens, getMachineId } from "./client";
import { AgentlogsDB } from "../storage/db";
import type { CognitiveCommit, Session, Turn } from "../models/types";
import type { SyncResult } from "./types";

/**
 * Pull commits from cloud that are newer than local
 */
export async function pullFromCloud(
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
  const userId = tokens.user.id;
  const machineId = getMachineId();

  try {
    // Get last sync cursor
    const lastSyncAt = db.getLastSyncTime() || "1970-01-01T00:00:00Z";

    if (options.verbose) {
      console.log(`Pulling commits updated since ${lastSyncAt}`);
    }

    // Fetch commits updated since last sync
    // Exclude commits that originated from this machine and haven't been modified elsewhere
    const { data: cloudCommits, error } = await supabase
      .from("cognitive_commits")
      .select(`
        *,
        sessions (
          *,
          turns (*)
        )
      `)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .gt("updated_at", lastSyncAt)
      .order("updated_at", { ascending: true });

    if (error) {
      result.errors.push(`Failed to fetch commits: ${error.message}`);
      return result;
    }

    if (options.verbose) {
      console.log(`Found ${cloudCommits?.length || 0} commits to pull`);
    }

    for (const cloudCommit of cloudCommits || []) {
      try {
        // Check if we have this commit locally
        const localCommit = db.getCommitByCloudId(cloudCommit.id);

        if (localCommit) {
          const localVersion = localCommit.localVersion || 1;
          const cloudVersion = localCommit.cloudVersion || 0;

          // Check for conflicts
          if (
            localCommit.syncStatus === "pending" &&
            localVersion > cloudVersion
          ) {
            // Local has unpushed changes
            if (cloudCommit.version > cloudVersion) {
              // Both have changes - conflict
              db.updateSyncStatus(localCommit.id, "conflict");
              result.conflicts++;
              continue;
            }
            // Only local has changes, skip pull
            continue;
          }

          // Cloud is newer, update local
          if (cloudCommit.version > cloudVersion) {
            await updateLocalCommit(db, localCommit.id, cloudCommit);
            result.pulled++;

            if (options.verbose) {
              console.log(`Updated commit ${localCommit.id.substring(0, 8)}`);
            }
          }
        } else {
          // New commit from cloud, create locally
          await createLocalCommit(db, cloudCommit);
          result.pulled++;

          if (options.verbose) {
            console.log(`Created commit ${cloudCommit.id.substring(0, 8)}`);
          }
        }
      } catch (error) {
        result.errors.push(
          `Failed to process commit ${cloudCommit.id}: ${(error as Error).message}`
        );
      }
    }

    // Update last sync time
    if (cloudCommits && cloudCommits.length > 0) {
      const lastUpdated = cloudCommits[cloudCommits.length - 1].updated_at;
      db.setLastSyncTime(lastUpdated);
    }

    // Pull deleted commits (soft deletes)
    await pullDeletedCommits(db, supabase, userId, lastSyncAt, options);
  } catch (error) {
    result.errors.push(`Pull failed: ${(error as Error).message}`);
  }

  return result;
}

/**
 * Create a new local commit from cloud data
 */
async function createLocalCommit(
  db: AgentlogsDB,
  cloudCommit: CloudCommitWithRelations
): Promise<void> {
  const commit: CognitiveCommit = {
    id: cloudCommit.id,
    gitHash: cloudCommit.git_hash,
    startedAt: cloudCommit.started_at,
    closedAt: cloudCommit.closed_at,
    closedBy: cloudCommit.closed_by as CognitiveCommit["closedBy"],
    parallel: cloudCommit.parallel,
    filesRead: cloudCommit.files_read || [],
    filesChanged: cloudCommit.files_changed || [],
    source: (cloudCommit.source as CognitiveCommit["source"]) || "claude_code",
    projectName: cloudCommit.project_name || undefined,
    published: cloudCommit.published,
    hidden: cloudCommit.hidden,
    displayOrder: cloudCommit.display_order,
    title: cloudCommit.title || undefined,
    sessions: (cloudCommit.sessions || []).map((s) => ({
      id: s.id,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      turns: (s.turns || []).map((t) => ({
        id: t.id,
        role: t.role as Turn["role"],
        content: t.content || "",
        timestamp: t.timestamp,
        toolCalls: t.tool_calls ? JSON.parse(t.tool_calls) : undefined,
        triggersVisualUpdate: t.triggers_visual || undefined,
        model: t.model || undefined,
      })),
    })),
    // Sync metadata
    cloudId: cloudCommit.id,
    syncStatus: "synced",
    cloudVersion: cloudCommit.version,
    localVersion: cloudCommit.version,
    lastSyncedAt: new Date().toISOString(),
  };

  db.insertCommit(commit);
}

/**
 * Update an existing local commit with cloud data
 */
async function updateLocalCommit(
  db: AgentlogsDB,
  localId: string,
  cloudCommit: CloudCommitWithRelations
): Promise<void> {
  // Update commit fields
  db.updateCommit(localId, {
    gitHash: cloudCommit.git_hash,
    closedBy: cloudCommit.closed_by as CognitiveCommit["closedBy"],
    published: cloudCommit.published,
    hidden: cloudCommit.hidden,
    displayOrder: cloudCommit.display_order,
    title: cloudCommit.title || undefined,
  });

  // Update sync metadata
  db.updateSyncMetadata(localId, {
    cloudId: cloudCommit.id,
    syncStatus: "synced",
    cloudVersion: cloudCommit.version,
    lastSyncedAt: new Date().toISOString(),
  });

  // Update sessions and turns
  for (const cloudSession of cloudCommit.sessions || []) {
    db.upsertSession(localId, {
      id: cloudSession.id,
      startedAt: cloudSession.started_at,
      endedAt: cloudSession.ended_at,
    });

    for (const cloudTurn of cloudSession.turns || []) {
      db.upsertTurn(cloudSession.id, {
        id: cloudTurn.id,
        role: cloudTurn.role,
        content: cloudTurn.content,
        timestamp: cloudTurn.timestamp,
        toolCalls: cloudTurn.tool_calls ? JSON.parse(cloudTurn.tool_calls) : undefined,
        triggersVisual: cloudTurn.triggers_visual,
        model: cloudTurn.model,
      });
    }
  }
}

/**
 * Pull soft-deleted commits from cloud
 */
async function pullDeletedCommits(
  db: AgentlogsDB,
  supabase: ReturnType<typeof getAuthenticatedClient>,
  userId: string,
  lastSyncAt: string,
  options: { verbose?: boolean }
): Promise<void> {
  const { data: deletedCommits, error } = await supabase
    .from("cognitive_commits")
    .select("id")
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .gt("deleted_at", lastSyncAt);

  if (error) {
    console.error(`Failed to fetch deleted commits: ${error.message}`);
    return;
  }

  for (const deleted of deletedCommits || []) {
    const localCommit = db.getCommitByCloudId(deleted.id);
    if (localCommit) {
      db.deleteCommit(localCommit.id);
      if (options.verbose) {
        console.log(`Deleted commit ${localCommit.id.substring(0, 8)}`);
      }
    }
  }
}

/**
 * Download visuals from cloud storage
 */
export async function pullVisuals(
  db: AgentlogsDB,
  commitId: string,
  options: { verbose?: boolean } = {}
): Promise<{ downloaded: number; errors: string[] }> {
  const result = { downloaded: 0, errors: [] as string[] };

  const tokens = loadAuthTokens();
  if (!tokens) {
    result.errors.push("Not authenticated");
    return result;
  }

  const supabase = getAuthenticatedClient();

  // Get visuals for commit that have cloud URLs but no local files
  const { data: cloudVisuals, error } = await supabase
    .from("visuals")
    .select("*")
    .eq("commit_id", commitId)
    .not("cloud_url", "is", null);

  if (error) {
    result.errors.push(`Failed to fetch visuals: ${error.message}`);
    return result;
  }

  const fs = await import("fs");
  const path = await import("path");

  for (const visual of cloudVisuals || []) {
    // Check if we already have the file locally
    if (fs.existsSync(visual.path)) {
      continue;
    }

    try {
      // Download from storage
      const { data, error: downloadError } = await supabase.storage
        .from("visuals")
        .download(visual.cloud_url.replace(/^.*\/visuals\//, ""));

      if (downloadError) {
        result.errors.push(`Download failed: ${downloadError.message}`);
        continue;
      }

      // Ensure directory exists
      const dir = path.dirname(visual.path);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write file
      const buffer = Buffer.from(await data.arrayBuffer());
      fs.writeFileSync(visual.path, buffer);

      result.downloaded++;

      if (options.verbose) {
        console.log(`Downloaded visual ${visual.id.substring(0, 8)}`);
      }
    } catch (error) {
      result.errors.push(
        `Failed to download visual ${visual.id}: ${(error as Error).message}`
      );
    }
  }

  return result;
}

// Type for cloud commit with relations
interface CloudCommitWithRelations {
  id: string;
  user_id: string;
  git_hash: string | null;
  started_at: string;
  closed_at: string;
  closed_by: string;
  parallel: boolean;
  files_read: string[];
  files_changed: string[];
  source: string;
  project_name: string | null;
  published: boolean;
  hidden: boolean;
  display_order: number;
  title: string | null;
  version: number;
  updated_at: string;
  deleted_at: string | null;
  sessions: Array<{
    id: string;
    started_at: string;
    ended_at: string;
    turns: Array<{
      id: string;
      role: string;
      content: string | null;
      timestamp: string;
      tool_calls: string | null;
      triggers_visual: boolean;
      model: string | null;
    }>;
  }>;
}
