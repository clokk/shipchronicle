/**
 * Cloud sync module for Tuhnr
 *
 * Provides:
 * - GitHub OAuth authentication
 * - Push/pull sync with Supabase backend
 * - Conflict detection and resolution
 * - Background continuous sync
 * - Visual (screenshot) sync
 */

// Types
export * from "./types";

// Client
export {
  getSupabaseClient,
  getAuthenticatedClient,
  isAuthenticated,
  getCurrentUser,
  isCloudAvailable,
  getMachineId,
  loadAuthTokens,
  saveAuthTokens,
  clearAuthTokens,
  resetClient,
} from "./client";

// Auth
export {
  login,
  logout,
  refreshTokenIfNeeded,
  signInAnonymously,
  ensureAuthenticated,
  claimAccount,
} from "./auth";

// Push
export { pushToCloud, pushVisuals } from "./push";

// Pull
export { pullFromCloud, pullVisuals } from "./pull";

// Conflict
export {
  getConflicts,
  resolveKeepLocal,
  resolveKeepCloud,
  autoResolveConflicts,
  getConflictCount,
  hasConflicts,
} from "./conflict";

// Queue
export {
  SyncQueue,
  SyncQueueOptions,
  getSyncQueue,
  resetSyncQueue,
} from "./queue";

// Visual sync
export {
  uploadVisual,
  downloadVisual,
  getVisual,
  syncVisualsForCommit,
  cleanupVisualCache,
  getVisualSyncStatus,
} from "./visual-sync";

/**
 * High-level sync function
 * Performs a full bidirectional sync
 */
export async function sync(
  db: import("../storage/db").TuhnrDB,
  options: { verbose?: boolean } = {}
): Promise<import("./types").SyncResult> {
  const { pushToCloud } = await import("./push");
  const { pullFromCloud } = await import("./pull");
  const { autoResolveConflicts, hasConflicts } = await import("./conflict");

  const result: import("./types").SyncResult = {
    pushed: 0,
    pulled: 0,
    conflicts: 0,
    errors: [],
  };

  // Auto-resolve conflicts first
  if (hasConflicts(db)) {
    const conflictResult = await autoResolveConflicts(db, options);
    result.conflicts += conflictResult.conflicts;
    result.errors.push(...conflictResult.errors);
  }

  // Pull first
  const pullResult = await pullFromCloud(db, options);
  result.pulled = pullResult.pulled;
  result.conflicts += pullResult.conflicts;
  result.errors.push(...pullResult.errors);

  // Then push
  const pushResult = await pushToCloud(db, options);
  result.pushed = pushResult.pushed;
  result.conflicts += pushResult.conflicts;
  result.errors.push(...pushResult.errors);

  return result;
}

/**
 * Get sync status summary
 */
export function getSyncStatus(
  db: import("../storage/db").TuhnrDB
): import("./types").SyncState {
  const { isAuthenticated: checkAuth } = require("./client");

  return {
    lastSyncAt: db.daemonState.getLastSyncTime(),
    pendingCount: db.commits.getBySyncStatus("pending").length,
    syncedCount: db.commits.getBySyncStatus("synced").length,
    filteredCount: db.commits.getBySyncStatus("filtered").length,
    conflictCount: db.commits.getBySyncStatus("conflict").length,
    errorCount: db.commits.getBySyncStatus("error").length,
    isOnline: checkAuth(),
    isSyncing: false,
  };
}
