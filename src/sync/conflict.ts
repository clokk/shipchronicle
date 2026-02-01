/**
 * Conflict detection and resolution for sync
 */

import { AgentlogsDB } from "../storage/db";
import { getAuthenticatedClient, loadAuthTokens } from "./client";
import type { ConflictInfo, SyncResult } from "./types";

/**
 * Get all commits with conflicts
 */
export function getConflicts(db: AgentlogsDB): ConflictInfo[] {
  const conflictCommits = db.getCommitsBySyncStatus("conflict");

  return conflictCommits.map((commit) => ({
    localId: commit.id,
    cloudId: commit.cloudId || "",
    localVersion: commit.localVersion || 1,
    cloudVersion: commit.cloudVersion || 0,
    localUpdatedAt: commit.closedAt,
    cloudUpdatedAt: commit.lastSyncedAt || commit.closedAt,
    resolution: "pending" as const,
  }));
}

/**
 * Resolve a conflict by keeping local changes
 */
export async function resolveKeepLocal(
  db: AgentlogsDB,
  localId: string
): Promise<void> {
  const commit = db.getCommit(localId);
  if (!commit || commit.syncStatus !== "conflict") {
    throw new Error("Commit not found or not in conflict");
  }

  // Mark as pending to be pushed
  db.updateSyncStatus(localId, "pending");

  // Increment local version to ensure it wins
  db.incrementLocalVersion(localId);
}

/**
 * Resolve a conflict by accepting cloud changes
 */
export async function resolveKeepCloud(
  db: AgentlogsDB,
  localId: string
): Promise<void> {
  const tokens = loadAuthTokens();
  if (!tokens) {
    throw new Error("Not authenticated");
  }

  const commit = db.getCommit(localId);
  if (!commit || commit.syncStatus !== "conflict") {
    throw new Error("Commit not found or not in conflict");
  }

  if (!commit.cloudId) {
    throw new Error("No cloud ID for this commit");
  }

  const supabase = getAuthenticatedClient();

  // Fetch the cloud version
  const { data: cloudCommit, error } = await supabase
    .from("cognitive_commits")
    .select(`
      *,
      sessions (
        *,
        turns (*)
      )
    `)
    .eq("id", commit.cloudId)
    .single();

  if (error || !cloudCommit) {
    throw new Error("Failed to fetch cloud commit");
  }

  // Update local with cloud data
  db.updateCommit(localId, {
    gitHash: cloudCommit.git_hash,
    closedBy: cloudCommit.closed_by,
    published: cloudCommit.published,
    hidden: cloudCommit.hidden,
    displayOrder: cloudCommit.display_order,
    title: cloudCommit.title,
  });

  // Update sync metadata
  db.updateSyncMetadata(localId, {
    cloudId: cloudCommit.id,
    syncStatus: "synced",
    cloudVersion: cloudCommit.version,
    localVersion: cloudCommit.version, // Reset to cloud version
    lastSyncedAt: new Date().toISOString(),
  });
}

/**
 * Auto-resolve conflicts using last-write-wins
 * Compares updated_at timestamps and keeps the newer version
 */
export async function autoResolveConflicts(
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
  const conflicts = getConflicts(db);

  if (options.verbose) {
    console.log(`Auto-resolving ${conflicts.length} conflicts`);
  }

  for (const conflict of conflicts) {
    try {
      // Fetch cloud version
      const { data: cloudCommit, error } = await supabase
        .from("cognitive_commits")
        .select("version, updated_at")
        .eq("id", conflict.cloudId)
        .single();

      if (error) {
        result.errors.push(`Failed to fetch cloud commit: ${error.message}`);
        continue;
      }

      const localUpdatedAt = new Date(conflict.localUpdatedAt).getTime();
      const cloudUpdatedAt = new Date(cloudCommit.updated_at).getTime();

      if (cloudUpdatedAt > localUpdatedAt) {
        // Cloud is newer, accept cloud
        await resolveKeepCloud(db, conflict.localId);
        result.pulled++;
        if (options.verbose) {
          console.log(`Resolved ${conflict.localId.substring(0, 8)}: kept cloud`);
        }
      } else {
        // Local is newer or equal, keep local
        await resolveKeepLocal(db, conflict.localId);
        result.pushed++;
        if (options.verbose) {
          console.log(`Resolved ${conflict.localId.substring(0, 8)}: kept local`);
        }
      }
    } catch (error) {
      result.errors.push(
        `Failed to resolve conflict ${conflict.localId}: ${(error as Error).message}`
      );
      result.conflicts++;
    }
  }

  return result;
}

/**
 * Get conflict count
 */
export function getConflictCount(db: AgentlogsDB): number {
  return db.getCommitsBySyncStatus("conflict").length;
}

/**
 * Check if there are any conflicts
 */
export function hasConflicts(db: AgentlogsDB): boolean {
  return getConflictCount(db) > 0;
}
