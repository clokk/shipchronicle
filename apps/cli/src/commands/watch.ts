/**
 * Watch commands - watch, stop, status, capture
 */

import { Command } from "commander";
import * as path from "path";
import { spawn } from "child_process";
import {
  loadConfig,
  isInitialized,
  readDaemonPid,
  isDaemonRunning,
  removeDaemonPid,
  getStorageDir,
} from "../config";
import { TuhnrDB } from "../storage/db";
import { TuhnrDaemon } from "../daemon";
import { captureScreenshot } from "../daemon/capturer";
import { getBestCaptureUrl } from "../utils/server-detect";
import { getSyncQueue } from "../sync/queue";
import { isAuthenticated, getCurrentUser } from "../sync/client";
import { getSyncStatus } from "../sync";

export function registerWatchCommands(program: Command): void {
  program
    .command("watch")
    .description("Start watching for Claude sessions")
    .option("-p, --port <port>", "Dev server port override", parseInt)
    .option("-v, --verbose", "Show verbose output")
    .option("--no-capture", "Disable screenshot capture")
    .option("--no-sync", "Disable background cloud sync")
    .option("-f, --foreground", "Run in foreground (default is background)")
    .action(async (options) => {
      try {
        const projectPath = process.cwd();

        if (!isInitialized(projectPath)) {
          console.error("Project not initialized. Run 'tuhnr init' first.");
          process.exit(1);
        }

        if (isDaemonRunning(projectPath)) {
          const pid = readDaemonPid(projectPath);
          console.log(`Daemon already running (PID: ${pid})`);
          console.log("Use 'tuhnr stop' to stop it first.");
          process.exit(1);
        }

        if (options.foreground) {
          // Run in foreground
          console.log("Starting daemon in foreground (Ctrl+C to stop)...\n");

          // Set up sync queue if authenticated and sync enabled
          const db = new TuhnrDB(projectPath);
          const syncEnabled = isAuthenticated() && options.sync !== false;
          const syncQueue = syncEnabled ? getSyncQueue(db, { continuousSync: true, verbose: options.verbose }) : undefined;

          const daemon = new TuhnrDaemon(projectPath, {
            verbose: options.verbose,
            captureEnabled: options.capture !== false,
            syncQueue,
          });

          await daemon.start();

          const status = daemon.getStatus();
          console.log(`Watching: ${status.claudeProjectPath}`);
          console.log(`Commits captured so far: ${status.commitCount}`);
          if (syncEnabled) {
            console.log("Background sync: enabled");
          }
          console.log("\nListening for Claude Code sessions...");

          // Keep process alive
          await new Promise(() => {});
        } else {
          // Run in background using spawn
          const args = ["watch", "--foreground"];
          if (options.verbose) args.push("--verbose");
          if (options.capture === false) args.push("--no-capture");
          if (options.sync === false) args.push("--no-sync");
          if (options.port) args.push("--port", options.port.toString());

          const child = spawn(process.execPath, [process.argv[1], ...args], {
            detached: true,
            stdio: "ignore",
            cwd: projectPath,
          });

          child.unref();

          console.log(`Daemon started in background (PID: ${child.pid})`);
          console.log("Use 'tuhnr status' to check status");
          console.log("Use 'tuhnr stop' to stop the daemon");
        }
      } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  program
    .command("stop")
    .description("Stop the watch daemon")
    .action(async () => {
      try {
        const projectPath = process.cwd();

        if (!isInitialized(projectPath)) {
          console.error("Project not initialized.");
          process.exit(1);
        }

        const pid = readDaemonPid(projectPath);

        if (!pid) {
          console.log("No daemon running (no PID file found).");
          return;
        }

        if (!isDaemonRunning(projectPath)) {
          console.log("Daemon not running (stale PID file removed).");
          return;
        }

        // Send SIGTERM
        try {
          process.kill(pid, "SIGTERM");
          console.log(`Sent SIGTERM to daemon (PID: ${pid})`);

          // Wait for process to exit
          let attempts = 0;
          while (attempts < 10) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            try {
              process.kill(pid, 0);
              attempts++;
            } catch {
              // Process no longer exists
              break;
            }
          }

          // Clean up PID file if still exists
          removeDaemonPid(projectPath);
          console.log("Daemon stopped.");
        } catch (error) {
          console.error(`Failed to stop daemon: ${(error as Error).message}`);
          removeDaemonPid(projectPath);
          process.exit(1);
        }
      } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  program
    .command("status")
    .description("Show daemon status")
    .action(async () => {
      try {
        const projectPath = process.cwd();

        if (!isInitialized(projectPath)) {
          console.error("Project not initialized. Run 'tuhnr init' first.");
          process.exit(1);
        }

        const config = loadConfig(projectPath);
        const running = isDaemonRunning(projectPath);
        const pid = readDaemonPid(projectPath);

        console.log(`\nTuhnr Status`);
        console.log(`${"─".repeat(40)}`);
        console.log(`Project: ${config.projectName}`);
        console.log(`Status: ${running ? "Running" : "Stopped"}`);

        if (running && pid) {
          console.log(`PID: ${pid}`);
        }

        // Open DB to get stats
        const db = new TuhnrDB(projectPath);
        const commitCount = db.commits.getCount();
        const lastActivity = db.daemonState.getLastActivity();

        console.log(`\nStatistics:`);
        console.log(`  Commits captured: ${commitCount}`);

        if (lastActivity) {
          const lastDate = new Date(lastActivity);
          const ago = getTimeAgo(lastDate);
          console.log(`  Last activity: ${ago}`);
        } else {
          console.log(`  Last activity: Never`);
        }

        // Cloud Sync status
        const user = getCurrentUser();
        console.log(`\nCloud Sync:`);

        if (!user) {
          console.log("  Status: Not enabled");
          console.log("  Run 'tuhnr start' to enable cloud insights");
        } else {
          const syncState = getSyncStatus(db);

          if (user.isAnonymous) {
            console.log(`  Account: Anonymous (run 'tuhnr claim' to link GitHub)`);
          } else {
            console.log(`  Account: ${user.githubUsername}`);
          }

          console.log(`  Last sync: ${syncState.lastSyncAt ? getTimeAgo(new Date(syncState.lastSyncAt)) : "Never"}`);
          console.log(`  Synced: ${syncState.syncedCount} commits`);

          if (syncState.pendingCount > 0) {
            console.log(`  Pending: ${syncState.pendingCount} commits`);
          }
          if (syncState.errorCount > 0) {
            console.log(`  Errors: ${syncState.errorCount} commits (run 'tuhnr push --retry')`);
          }
        }

        db.close();

        console.log(`\nConfiguration:`);
        console.log(`  Claude path: ${config.claudeProjectPath}`);
        console.log(`  Dev server port: ${config.devServerPort || "auto-detect"}`);
        console.log(`  Capture enabled: ${config.captureEnabled}`);
        console.log(`  Storage: ${getStorageDir(projectPath)}`);
      } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  program
    .command("capture")
    .description("Manually capture a screenshot")
    .option("-u, --url <url>", "URL to capture (auto-detects dev server if not specified)")
    .option("-o, --output <path>", "Output file path")
    .action(async (options) => {
      try {
        const projectPath = process.cwd();

        if (!isInitialized(projectPath)) {
          console.error("Project not initialized. Run 'tuhnr init' first.");
          process.exit(1);
        }

        const config = loadConfig(projectPath);

        let url = options.url;
        if (!url) {
          url = await getBestCaptureUrl(projectPath, config.devServerPort);
          if (!url) {
            console.error("No dev server detected.");
            console.error("Start your dev server or specify URL with --url option.");
            process.exit(1);
          }
          console.log(`Detected dev server at: ${url}`);
        }

        console.log(`Capturing screenshot...`);

        const outputPath = options.output || path.join(
          getStorageDir(projectPath),
          "screenshots",
          `manual-${Date.now()}.png`
        );

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        const fs = require("fs");
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        await captureScreenshot(url, outputPath);

        console.log(`Screenshot saved: ${outputPath}`);

        // If daemon is running and we have a current commit, attach the visual
        if (isDaemonRunning(projectPath)) {
          const db = new TuhnrDB(projectPath);
          const currentCommitId = db.daemonState.getCurrentCommitId();
          if (currentCommitId) {
            db.visuals.create(currentCommitId, "screenshot", outputPath, "Manual capture");
            console.log(`Attached to commit: ${currentCommitId.substring(0, 8)}`);
          }
          db.close();
        }
      } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        process.exit(1);
      }
    });
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  }
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  }
  if (diffMins > 0) {
    return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  }
  return "Just now";
}
