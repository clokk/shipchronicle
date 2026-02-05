/**
 * Sync API routes
 */

import { Hono } from "hono";
import { TuhnrDB } from "../../storage/db";
import type { SyncState } from "../../sync/types";
import { isAuthenticated } from "../../sync/client";

interface SyncRouteOptions {
  global?: boolean;
}

export function createSyncRoutes(storagePath: string, options: SyncRouteOptions = {}): Hono {
  const app = new Hono();
  const dbOptions = { rawStoragePath: options.global };

  // GET /api/sync/status - Get sync state
  app.get("/status", async (c) => {
    const db = new TuhnrDB(storagePath, dbOptions);

    try {
      const commits = db.commits.getAll();
      const lastSyncTime = db.daemonState.getLastSyncTime();

      // Note: syncStatus comes from DB which may include "filtered" even though
      // the CognitiveCommit type doesn't declare it (stored via updateSyncStatus)
      const state: SyncState = {
        lastSyncAt: lastSyncTime,
        pendingCount: commits.filter(commit => commit.syncStatus === "pending" || !commit.syncStatus).length,
        syncedCount: commits.filter(commit => commit.syncStatus === "synced").length,
        filteredCount: commits.filter(commit => (commit.syncStatus as string) === "filtered").length,
        conflictCount: commits.filter(commit => commit.syncStatus === "conflict").length,
        errorCount: commits.filter(commit => commit.syncStatus === "error").length,
        isOnline: isAuthenticated(),
        isSyncing: false, // Can't determine from DB alone - would need shared state with daemon
      };

      return c.json({ syncState: state });
    } finally {
      db.close();
    }
  });

  return app;
}
