/**
 * Background sync queue for continuous sync
 */

import { EventEmitter } from "events";
import { AgentlogsDB } from "../storage/db";
import { pushToCloud, pushVisuals } from "./push";
import { pullFromCloud } from "./pull";
import { autoResolveConflicts, hasConflicts } from "./conflict";
import { isAuthenticated, loadAuthTokens } from "./client";
import type { SyncResult, SyncState } from "./types";

// Debounce interval for sync (ms)
const SYNC_DEBOUNCE_MS = 500;

// Retry interval on error (ms)
const RETRY_INTERVAL_MS = 30000;

// Max retries before giving up
const MAX_RETRIES = 3;

export interface SyncQueueOptions {
  verbose?: boolean;
  autoStart?: boolean;
  continuousSync?: boolean;
}

export class SyncQueue extends EventEmitter {
  private db: AgentlogsDB;
  private options: SyncQueueOptions;
  private syncTimeout: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isSyncing = false;
  private retryCount = 0;
  private lastSyncResult: SyncResult | null = null;

  constructor(db: AgentlogsDB, options: SyncQueueOptions = {}) {
    super();
    this.db = db;
    this.options = {
      verbose: false,
      autoStart: true,
      continuousSync: true,
      ...options,
    };

    if (this.options.autoStart && this.options.continuousSync) {
      this.start();
    }
  }

  /**
   * Start the sync queue
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.emit("started");

    if (this.options.verbose) {
      console.log("Sync queue started");
    }
  }

  /**
   * Stop the sync queue
   */
  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }

    this.emit("stopped");

    if (this.options.verbose) {
      console.log("Sync queue stopped");
    }
  }

  /**
   * Queue a sync operation (debounced)
   */
  queueSync(): void {
    if (!this.isRunning || !isAuthenticated()) return;

    // Clear existing timeout
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    // Debounce sync
    this.syncTimeout = setTimeout(() => {
      this.performSync();
    }, SYNC_DEBOUNCE_MS);
  }

  /**
   * Force an immediate sync
   */
  async syncNow(): Promise<SyncResult> {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }

    return this.performSync();
  }

  /**
   * Perform the actual sync
   */
  private async performSync(): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        pushed: 0,
        pulled: 0,
        conflicts: 0,
        errors: ["Sync already in progress"],
      };
    }

    if (!isAuthenticated()) {
      return {
        pushed: 0,
        pulled: 0,
        conflicts: 0,
        errors: ["Not authenticated"],
      };
    }

    this.isSyncing = true;
    this.emit("syncStarted");

    const result: SyncResult = {
      pushed: 0,
      pulled: 0,
      conflicts: 0,
      errors: [],
    };

    try {
      // Auto-resolve any existing conflicts first
      if (hasConflicts(this.db)) {
        const conflictResult = await autoResolveConflicts(this.db, {
          verbose: this.options.verbose,
        });
        result.conflicts += conflictResult.conflicts;
        result.errors.push(...conflictResult.errors);
      }

      // Pull first (to get latest from cloud)
      const pullResult = await pullFromCloud(this.db, {
        verbose: this.options.verbose,
      });
      result.pulled = pullResult.pulled;
      result.conflicts += pullResult.conflicts;
      result.errors.push(...pullResult.errors);

      // Then push local changes
      const pushResult = await pushToCloud(this.db, {
        verbose: this.options.verbose,
      });
      result.pushed = pushResult.pushed;
      result.conflicts += pushResult.conflicts;
      result.errors.push(...pushResult.errors);

      // Reset retry count on success
      if (result.errors.length === 0) {
        this.retryCount = 0;
      }

      this.lastSyncResult = result;
      this.emit("syncCompleted", result);

      if (this.options.verbose) {
        console.log(
          `Sync complete: ${result.pushed} pushed, ${result.pulled} pulled, ${result.conflicts} conflicts`
        );
      }
    } catch (error) {
      result.errors.push((error as Error).message);
      this.emit("syncError", error);

      // Retry on error
      this.retryCount++;
      if (this.retryCount < MAX_RETRIES && this.isRunning) {
        if (this.options.verbose) {
          console.log(
            `Sync failed, retrying in ${RETRY_INTERVAL_MS / 1000}s (attempt ${this.retryCount}/${MAX_RETRIES})`
          );
        }

        setTimeout(() => {
          if (this.isRunning) {
            this.performSync();
          }
        }, RETRY_INTERVAL_MS);
      }
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  /**
   * Get current sync state
   */
  getState(): SyncState {
    return {
      lastSyncAt: this.db.getLastSyncTime(),
      pendingCount: this.db.getCommitsBySyncStatus("pending").length,
      syncedCount: this.db.getCommitsBySyncStatus("synced").length,
      conflictCount: this.db.getCommitsBySyncStatus("conflict").length,
      isOnline: isAuthenticated(),
      isSyncing: this.isSyncing,
    };
  }

  /**
   * Get last sync result
   */
  getLastResult(): SyncResult | null {
    return this.lastSyncResult;
  }

  /**
   * Notify that a commit was created/updated
   */
  onCommitChanged(commitId: string): void {
    if (this.options.continuousSync) {
      this.queueSync();
    }
  }

  /**
   * Notify that a visual was captured
   */
  async onVisualCaptured(commitId: string, visualId: string): Promise<void> {
    if (!this.options.continuousSync || !isAuthenticated()) return;

    try {
      await pushVisuals(this.db, commitId, { verbose: this.options.verbose });
    } catch (error) {
      if (this.options.verbose) {
        console.error(`Failed to sync visual: ${(error as Error).message}`);
      }
    }
  }
}

/**
 * Create a singleton sync queue instance
 */
let syncQueueInstance: SyncQueue | null = null;

export function getSyncQueue(
  db: AgentlogsDB,
  options?: SyncQueueOptions
): SyncQueue {
  if (!syncQueueInstance) {
    syncQueueInstance = new SyncQueue(db, options);
  }
  return syncQueueInstance;
}

export function resetSyncQueue(): void {
  if (syncQueueInstance) {
    syncQueueInstance.stop();
    syncQueueInstance = null;
  }
}
