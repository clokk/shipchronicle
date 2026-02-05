/**
 * Sync commands - push, pull, sync
 */

import { Command } from "commander";
import { ensureGlobalStorageDir } from "../config";
import { TuhnrDB } from "../storage/db";
import {
  isAuthenticated,
  sync,
  getSyncStatus,
  pushToCloud,
  pullFromCloud,
} from "../sync";
import { importSessions } from "./import";

export function registerSyncCommands(program: Command): void {
  program
    .command("push")
    .description("Import Claude sessions and push to cloud")
    .option("-v, --verbose", "Show verbose output (disables progress bar)")
    .option("-f, --force", "Reset sync status and re-push all commits")
    .option("-n, --dry-run", "Show what would be pushed without pushing")
    .option("-r, --retry", "Retry previously failed commits")
    .option("--skip-import", "Skip automatic import (push existing commits only)")
    .action(async (options) => {
      const startTime = Date.now();

      try {
        if (!isAuthenticated()) {
          console.error("Not logged in. Run 'tuhnr login' first.");
          process.exit(1);
        }

        const storagePath = ensureGlobalStorageDir();
        const db = new TuhnrDB(storagePath, { rawStoragePath: true });

        // Step 1: Import from Claude Code (unless --skip-import)
        if (!options.skipImport) {
          console.log("─── Import ───\n");
          const importResult = await importSessions(db, { verbose: options.verbose });

          const totalFound = importResult.imported + importResult.skipped;
          console.log("─".repeat(40));
          console.log(`  Found: ${totalFound} commits across ${importResult.projectCount} projects`);
          console.log(`  New: ${importResult.imported} imported`);
          if (importResult.skipped > 0) {
            console.log(`  Duplicates: ${importResult.skipped} skipped`);
          }
          console.log();
        }

        // Step 2: Push to cloud
        console.log("─── Push ───\n");

        let result = await pushToCloud(db, {
          verbose: options.verbose,
          force: options.force,
          dryRun: options.dryRun,
          retry: options.retry,
        });

        // Auto-retry failed commits once
        if (!options.dryRun && result.errors.length > 0) {
          console.log(`\n─── Retry (${result.errors.length} errors) ───\n`);

          const retryResult = await pushToCloud(db, {
            verbose: options.verbose,
            retry: true, // Only retry errored commits
          });

          // Combine results
          result.pushed += retryResult.pushed;
          result.conflicts += retryResult.conflicts;
          // Only keep errors that still failed after retry
          result.errors = retryResult.errors;
        }

        db.close();

        if (!options.dryRun) {
          // Calculate elapsed time
          const elapsed = Date.now() - startTime;
          const minutes = Math.floor(elapsed / 60000);
          const seconds = ((elapsed % 60000) / 1000).toFixed(1);
          const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

          // Final result
          console.log("\n" + "─".repeat(40));
          console.log(`  Synced: ${result.pushed} commits to cloud`);
          if (result.conflicts > 0) {
            console.log(`  Conflicts: ${result.conflicts} (run 'tuhnr sync' to resolve)`);
          }
          if (result.errors.length > 0) {
            console.log(`  Errors: ${result.errors.length} (failed after retry)`);
            for (const err of result.errors) {
              console.log(`    - ${err}`);
            }
          }
          console.log(`  Time: ${timeStr}`);
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
          console.error("Not logged in. Run 'tuhnr login' first.");
          process.exit(1);
        }

        const storagePath = ensureGlobalStorageDir();
        const db = new TuhnrDB(storagePath, { rawStoragePath: true });

        console.log("Pulling from cloud...");
        const result = await pullFromCloud(db, { verbose: options.verbose });

        db.close();

        console.log(`\nPull complete:`);
        console.log(`  Pulled: ${result.pulled} commits`);
        if (result.conflicts > 0) {
          console.log(`  Conflicts: ${result.conflicts} (run 'tuhnr sync' to resolve)`);
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
        const db = new TuhnrDB(storagePath, { rawStoragePath: true });

        if (options.status) {
          const status = getSyncStatus(db);
          console.log("\nSync Status:");
          console.log(`  Authenticated: ${status.isOnline ? "Yes" : "No"}`);
          console.log(`  Last sync: ${status.lastSyncAt || "Never"}`);
          console.log(`  Pending: ${status.pendingCount} commits`);
          console.log(`  Synced: ${status.syncedCount} commits (in cloud)`);
          console.log(`  Filtered: ${status.filteredCount} commits (warmup/empty, not uploaded)`);
          if (status.errorCount > 0) {
            console.log(`  Errors: ${status.errorCount} commits`);
          }
          if (status.conflictCount > 0) {
            console.log(`  Conflicts: ${status.conflictCount} commits`);
          }
          db.close();
          return;
        }

        if (!isAuthenticated()) {
          console.error("Not logged in. Run 'tuhnr login' first.");
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
