/**
 * Sync commands - push, pull, sync
 */

import { Command } from "commander";
import { ensureGlobalStorageDir } from "../config";
import { CogCommitDB } from "../storage/db";
import {
  isAuthenticated,
  sync,
  getSyncStatus,
  pushToCloud,
  pullFromCloud,
} from "../sync";

export function registerSyncCommands(program: Command): void {
  program
    .command("push")
    .description("Push local commits to cloud")
    .option("-v, --verbose", "Show verbose output (disables progress bar)")
    .option("-f, --force", "Reset sync status and re-push all commits")
    .option("-n, --dry-run", "Show what would be pushed without pushing")
    .option("-r, --retry", "Retry previously failed commits")
    .action(async (options) => {
      try {
        if (!isAuthenticated()) {
          console.error("Not logged in. Run 'cogcommit login' first.");
          process.exit(1);
        }

        const storagePath = ensureGlobalStorageDir();
        const db = new CogCommitDB(storagePath, { rawStoragePath: true });

        if (!options.dryRun) {
          console.log("Pushing to cloud...");
        }

        const result = await pushToCloud(db, {
          verbose: options.verbose,
          force: options.force,
          dryRun: options.dryRun,
          retry: options.retry,
        });

        db.close();

        if (!options.dryRun) {
          console.log(`\nPush complete:`);
          console.log(`  Pushed: ${result.pushed} commits`);
          if (result.conflicts > 0) {
            console.log(`  Conflicts: ${result.conflicts} (run 'cogcommit sync' to resolve)`);
          }
          if (result.errors.length > 0) {
            console.log(`  Errors: ${result.errors.length}`);
            for (const err of result.errors) {
              console.log(`    - ${err}`);
            }
          }
        }
      } catch (error) {
        console.error(`Push failed: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  program
    .command("pull")
    .description("Pull commits from cloud")
    .option("-v, --verbose", "Show verbose output")
    .action(async (options) => {
      try {
        if (!isAuthenticated()) {
          console.error("Not logged in. Run 'cogcommit login' first.");
          process.exit(1);
        }

        const storagePath = ensureGlobalStorageDir();
        const db = new CogCommitDB(storagePath, { rawStoragePath: true });

        console.log("Pulling from cloud...");
        const result = await pullFromCloud(db, { verbose: options.verbose });

        db.close();

        console.log(`\nPull complete:`);
        console.log(`  Pulled: ${result.pulled} commits`);
        if (result.conflicts > 0) {
          console.log(`  Conflicts: ${result.conflicts} (run 'cogcommit sync' to resolve)`);
        }
        if (result.errors.length > 0) {
          console.log(`  Errors: ${result.errors.length}`);
          for (const err of result.errors) {
            console.log(`    - ${err}`);
          }
        }
      } catch (error) {
        console.error(`Pull failed: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  program
    .command("sync")
    .description("Bidirectional sync with cloud")
    .option("-v, --verbose", "Show verbose output")
    .option("--status", "Show sync status without syncing")
    .action(async (options) => {
      try {
        const storagePath = ensureGlobalStorageDir();
        const db = new CogCommitDB(storagePath, { rawStoragePath: true });

        if (options.status) {
          const status = getSyncStatus(db);
          console.log("\nSync Status:");
          console.log(`  Authenticated: ${status.isOnline ? "Yes" : "No"}`);
          console.log(`  Last sync: ${status.lastSyncAt || "Never"}`);
          console.log(`  Pending: ${status.pendingCount} commits`);
          console.log(`  Synced: ${status.syncedCount} commits`);
          if (status.conflictCount > 0) {
            console.log(`  Conflicts: ${status.conflictCount} commits`);
          }
          db.close();
          return;
        }

        if (!isAuthenticated()) {
          console.error("Not logged in. Run 'cogcommit login' first.");
          db.close();
          process.exit(1);
        }

        console.log("Syncing with cloud...");
        const result = await sync(db, { verbose: options.verbose });

        db.close();

        console.log(`\nSync complete:`);
        console.log(`  Pushed: ${result.pushed} commits`);
        console.log(`  Pulled: ${result.pulled} commits`);
        if (result.conflicts > 0) {
          console.log(`  Conflicts: ${result.conflicts} (could not auto-resolve)`);
        }
        if (result.errors.length > 0) {
          console.log(`  Errors: ${result.errors.length}`);
          for (const err of result.errors) {
            console.log(`    - ${err}`);
          }
        }
      } catch (error) {
        console.error(`Sync failed: ${(error as Error).message}`);
        process.exit(1);
      }
    });
}
