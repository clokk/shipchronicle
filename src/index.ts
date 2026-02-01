#!/usr/bin/env node
/**
 * Agentlogs CLI
 * Chronicle of shipping: explore how products evolve through human-AI collaboration
 */

import { Command } from "commander";
import * as path from "path";
import { spawn } from "child_process";
import { parseProject, getProjectInfo, discoverProjects } from "./parser/index";
import type { ParseResult, CognitiveCommit } from "./models/types";
import {
  initializeProject,
  loadConfig,
  isInitialized,
  readDaemonPid,
  isDaemonRunning,
  removeDaemonPid,
  getStorageDir,
  detectClaudeProjectPath,
  getGlobalStorageDir,
  ensureGlobalStorageDir,
  discoverAllClaudeProjects,
  getProjectNameFromClaudePath,
} from "./config";
import { AgentlogsDB } from "./storage/db";
import { AgentlogsDaemon } from "./daemon";
import { captureScreenshot } from "./daemon/capturer";
import { getBestCaptureUrl } from "./utils/server-detect";
import { startStudio } from "./studio";
import {
  login,
  logout,
  isAuthenticated,
  getCurrentUser,
  isCloudAvailable,
  sync,
  getSyncStatus,
  pushToCloud,
  pullFromCloud,
} from "./sync";

const program = new Command();

program
  .name("agentlogs")
  .description("Chronicle of shipping: parse Claude Code session logs")
  .version("0.1.0");

program
  .command("parse [projectPath]")
  .description("Parse Claude Code session logs and extract cognitive commits")
  .option("-s, --session <id>", "Parse specific session ID only")
  .option("-o, --output <format>", "Output format: json | pretty | summary", "pretty")
  .option("-v, --verbose", "Show verbose output")
  .action(async (projectPath: string | undefined, options) => {
    try {
      // Resolve project path
      let resolvedPath: string;

      if (!projectPath) {
        // Default to current directory's Claude project
        const cwd = process.cwd();
        const projectName = path.basename(cwd);
        resolvedPath = path.join(
          process.env.HOME || "",
          ".claude",
          "projects",
          `-Users-${process.env.USER}-${projectName}`
        );
      } else if (projectPath.startsWith("~")) {
        resolvedPath = projectPath.replace("~", process.env.HOME || "");
      } else {
        resolvedPath = path.resolve(projectPath);
      }

      if (options.verbose) {
        console.log(`Parsing project: ${resolvedPath}\n`);
      }

      const result = await parseProject(resolvedPath, {
        sessionId: options.session,
        verbose: options.verbose,
      });

      outputResult(result, options.output);
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("list")
  .description("List discovered Claude projects")
  .action(() => {
    const projects = discoverProjects();

    if (projects.length === 0) {
      console.log("No Claude projects found in ~/.claude/projects/");
      return;
    }

    console.log("Discovered Claude projects:\n");

    for (const projectPath of projects) {
      const info = getProjectInfo(projectPath);
      console.log(`  ${info.name}`);
      console.log(`    Path: ${info.path}`);
      console.log(`    Sessions: ${info.sessionFiles.length}`);
      console.log();
    }
  });

program
  .command("info <projectPath>")
  .description("Show info about a project")
  .action((projectPath: string) => {
    try {
      const resolvedPath = projectPath.startsWith("~")
        ? projectPath.replace("~", process.env.HOME || "")
        : path.resolve(projectPath);

      const info = getProjectInfo(resolvedPath);

      console.log(`Project: ${info.name}`);
      console.log(`Path: ${info.path}`);
      console.log(`Sessions: ${info.sessionFiles.length}`);
      console.log();

      if (info.sessionFiles.length > 0) {
        console.log("Session files:");
        for (const file of info.sessionFiles.slice(0, 10)) {
          console.log(`  - ${path.basename(file)}`);
        }
        if (info.sessionFiles.length > 10) {
          console.log(`  ... and ${info.sessionFiles.length - 10} more`);
        }
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

function outputResult(result: ParseResult, format: string): void {
  switch (format) {
    case "json":
      console.log(JSON.stringify(result, null, 2));
      break;

    case "summary":
      outputSummary(result);
      break;

    case "pretty":
    default:
      outputPretty(result);
      break;
  }
}

function outputSummary(result: ParseResult): void {
  console.log(`Project: ${result.project}`);
  console.log(`Cognitive Commits: ${result.cognitiveCommits.length}`);
  console.log(`Sessions: ${result.totalSessions}`);
  console.log(`Total Turns: ${result.totalTurns}`);

  if (result.parseErrors.length > 0) {
    console.log(`Parse Errors: ${result.parseErrors.length}`);
  }

  // Git commit stats
  const withHash = result.cognitiveCommits.filter((c) => c.gitHash);
  console.log(`Git Commits Captured: ${withHash.length}`);

  // Parallel work
  const parallel = result.cognitiveCommits.filter((c) => c.parallel);
  if (parallel.length > 0) {
    console.log(`Parallel Work Detected: ${parallel.length} commits`);
  }
}

function outputPretty(result: ParseResult): void {
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║  AGENTLOGS: ${result.project.padEnd(42)}║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  console.log(`📊 Summary`);
  console.log(`   Cognitive Commits: ${result.cognitiveCommits.length}`);
  console.log(`   Sessions Parsed: ${result.totalSessions}`);
  console.log(`   Total Turns: ${result.totalTurns}`);
  console.log();

  if (result.cognitiveCommits.length === 0) {
    console.log("No cognitive commits found.");
    return;
  }

  console.log(`📝 Cognitive Commits\n`);

  for (let i = 0; i < result.cognitiveCommits.length; i++) {
    const commit = result.cognitiveCommits[i];
    outputCommit(commit, i + 1);
  }

  if (result.parseErrors.length > 0) {
    console.log(`\n⚠️  Parse Errors (${result.parseErrors.length}):`);
    for (const error of result.parseErrors) {
      console.log(`   - ${error}`);
    }
  }
}

function outputCommit(commit: CognitiveCommit, index: number): void {
  const hash = commit.gitHash ? `[${commit.gitHash}]` : "[no commit]";
  const parallel = commit.parallel ? " ⚡ parallel" : "";

  console.log(`   ${index}. ${hash}${parallel}`);
  console.log(`      Closed by: ${commit.closedBy}`);
  console.log(`      Time: ${formatTimestamp(commit.startedAt)} → ${formatTimestamp(commit.closedAt)}`);

  // Sessions
  const totalTurns = commit.sessions.reduce((sum, s) => sum + s.turns.length, 0);
  console.log(`      Sessions: ${commit.sessions.length} (${totalTurns} turns)`);

  // Files
  if (commit.filesRead.length > 0) {
    console.log(`      Files read: ${commit.filesRead.length}`);
  }
  if (commit.filesChanged.length > 0) {
    console.log(`      Files changed: ${commit.filesChanged.length}`);
    for (const file of commit.filesChanged.slice(0, 5)) {
      console.log(`        - ${path.basename(file)}`);
    }
    if (commit.filesChanged.length > 5) {
      console.log(`        ... and ${commit.filesChanged.length - 5} more`);
    }
  }

  console.log();
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ============================================
// New Phase 2 Commands: init, watch, stop, status, capture
// ============================================

program
  .command("init")
  .description("Initialize agentlogs for this project")
  .option("-n, --name <name>", "Project name (defaults to directory name)")
  .option("-c, --claude-path <path>", "Claude project path (auto-detected if not specified)")
  .option("-p, --port <port>", "Dev server port", parseInt)
  .option("--no-capture", "Disable screenshot capture")
  .action(async (options) => {
    try {
      const projectPath = process.cwd();

      if (isInitialized(projectPath)) {
        console.log("Project already initialized.");
        const config = loadConfig(projectPath);
        console.log(`\nCurrent config:`);
        console.log(`  Project: ${config.projectName}`);
        console.log(`  Claude path: ${config.claudeProjectPath}`);
        console.log(`  Dev server port: ${config.devServerPort || "auto-detect"}`);
        console.log(`  Capture enabled: ${config.captureEnabled}`);
        return;
      }

      // Validate Claude project path
      const claudePath = options.claudePath || detectClaudeProjectPath(projectPath);
      if (!claudePath) {
        console.error("Could not detect Claude project path.");
        console.error("Please specify with --claude-path option.");
        console.error("\nHint: Claude projects are stored at ~/.claude/projects/");
        process.exit(1);
      }

      const config = initializeProject(projectPath, {
        projectName: options.name,
        claudeProjectPath: claudePath,
        devServerPort: options.port,
        captureEnabled: options.capture !== false,
      });

      console.log(`Initialized agentlogs for: ${config.projectName}`);
      console.log(`\nConfig created at: .agentlogs/config.json`);
      console.log(`\nSettings:`);
      console.log(`  Claude path: ${config.claudeProjectPath}`);
      console.log(`  Dev server port: ${config.devServerPort || "auto-detect"}`);
      console.log(`  Capture enabled: ${config.captureEnabled}`);
      console.log(`\nStorage directory: ${getStorageDir(projectPath)}`);
      console.log(`\nNext steps:`);
      console.log(`  1. Start your dev server`);
      console.log(`  2. Run: agentlogs watch`);
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("watch")
  .description("Start watching for Claude sessions")
  .option("-p, --port <port>", "Dev server port override", parseInt)
  .option("-v, --verbose", "Show verbose output")
  .option("--no-capture", "Disable screenshot capture")
  .option("-f, --foreground", "Run in foreground (default is background)")
  .action(async (options) => {
    try {
      const projectPath = process.cwd();

      if (!isInitialized(projectPath)) {
        console.error("Project not initialized. Run 'agentlogs init' first.");
        process.exit(1);
      }

      if (isDaemonRunning(projectPath)) {
        const pid = readDaemonPid(projectPath);
        console.log(`Daemon already running (PID: ${pid})`);
        console.log("Use 'agentlogs stop' to stop it first.");
        process.exit(1);
      }

      if (options.foreground) {
        // Run in foreground
        console.log("Starting daemon in foreground (Ctrl+C to stop)...\n");

        const daemon = new AgentlogsDaemon(projectPath, {
          verbose: options.verbose,
          captureEnabled: options.capture !== false,
        });

        await daemon.start();

        const status = daemon.getStatus();
        console.log(`Watching: ${status.claudeProjectPath}`);
        console.log(`Commits captured so far: ${status.commitCount}`);
        console.log("\nListening for Claude Code sessions...");

        // Keep process alive
        await new Promise(() => {});
      } else {
        // Run in background using spawn
        const args = ["watch", "--foreground"];
        if (options.verbose) args.push("--verbose");
        if (options.capture === false) args.push("--no-capture");
        if (options.port) args.push("--port", options.port.toString());

        const child = spawn(process.execPath, [__filename, ...args], {
          detached: true,
          stdio: "ignore",
          cwd: projectPath,
        });

        child.unref();

        console.log(`Daemon started in background (PID: ${child.pid})`);
        console.log("Use 'agentlogs status' to check status");
        console.log("Use 'agentlogs stop' to stop the daemon");
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
        console.error("Project not initialized. Run 'agentlogs init' first.");
        process.exit(1);
      }

      const config = loadConfig(projectPath);
      const running = isDaemonRunning(projectPath);
      const pid = readDaemonPid(projectPath);

      console.log(`\nAgentlogs Status`);
      console.log(`${"─".repeat(40)}`);
      console.log(`Project: ${config.projectName}`);
      console.log(`Status: ${running ? "Running" : "Stopped"}`);

      if (running && pid) {
        console.log(`PID: ${pid}`);
      }

      // Open DB to get stats
      const db = new AgentlogsDB(projectPath);
      const commitCount = db.getCommitCount();
      const lastActivity = db.getLastActivity();
      db.close();

      console.log(`\nStatistics:`);
      console.log(`  Commits captured: ${commitCount}`);

      if (lastActivity) {
        const lastDate = new Date(lastActivity);
        const ago = getTimeAgo(lastDate);
        console.log(`  Last activity: ${ago}`);
      } else {
        console.log(`  Last activity: Never`);
      }

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
        console.error("Project not initialized. Run 'agentlogs init' first.");
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
        const db = new AgentlogsDB(projectPath);
        const currentCommitId = db.getCurrentCommitId();
        if (currentCommitId) {
          db.createVisual(currentCommitId, "screenshot", outputPath, "Manual capture");
          console.log(`Attached to commit: ${currentCommitId.substring(0, 8)}`);
        }
        db.close();
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

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

// ============================================
// Phase 3: Studio Command
// ============================================

program
  .command("studio")
  .description("Start the web-based curation studio (defaults to all projects)")
  .option("-P, --project", "View only current project (requires init)")
  .option("-p, --port <port>", "Port to run on", parseInt)
  .option("--no-open", "Don't auto-open browser")
  .option("-g, --global", "View all Claude Code history (default)")
  .action(async (options) => {
    try {
      let storagePath: string;

      if (options.project) {
        // Project mode - require initialization
        const projectPath = process.cwd();

        if (!isInitialized(projectPath)) {
          console.error("Project not initialized. Run 'agentlogs init' first.");
          console.error("\nTip: Run without --project to see all your Claude history.");
          process.exit(1);
        }

        storagePath = projectPath;
      } else {
        // Global mode (default) - use global storage directory
        storagePath = ensureGlobalStorageDir();
        console.log("Starting studio...");
      }

      await startStudio(storagePath, {
        port: options.port,
        open: options.open !== false,
        global: !options.project,
      });
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("import")
  .description("Import Claude Code sessions into the database (defaults to all projects)")
  .option("-c, --claude-path <path>", "Claude project path to import from")
  .option("-g, --global", "Import all Claude Code projects (default)")
  .option("-p, --project", "Import only current project (requires init)")
  .option("--clear", "Clear existing commits before importing")
  .action(async (options) => {
    try {
      let storagePath: string;
      let claudePaths: string[];

      if (options.project) {
        // Project mode - requires initialization
        const projectPath = process.cwd();

        if (!isInitialized(projectPath)) {
          console.error("Project not initialized. Run 'agentlogs init' first.");
          console.error("\nTip: Run without --project to import all your Claude history.");
          process.exit(1);
        }

        storagePath = projectPath;
        const config = loadConfig(projectPath);
        claudePaths = [options.claudePath || config.claudeProjectPath];
      } else {
        // Global mode (default) - import from all Claude projects
        storagePath = ensureGlobalStorageDir();
        claudePaths = discoverAllClaudeProjects();

        console.log(`Found ${claudePaths.length} Claude Code projects\n`);

        if (claudePaths.length === 0) {
          console.log("No Claude Code projects found.");
          return;
        }
      }

      // Open database (global mode is default, project mode uses rawStoragePath: false)
      const db = new AgentlogsDB(storagePath, { rawStoragePath: !options.project });

      // Optionally clear existing commits
      if (options.clear) {
        console.log("Clearing existing commits...");
        const existingCommits = db.getAllCommits();
        for (const commit of existingCommits) {
          db.deleteCommit(commit.id);
        }
        console.log();
      }

      let totalImported = 0;
      let totalSkipped = 0;

      for (const claudePath of claudePaths) {
        const projectName = getProjectNameFromClaudePath(claudePath);
        console.log(`Importing: ${projectName}`);
        console.log(`  Path: ${claudePath}`);

        // Parse the sessions
        const result = await parseProject(claudePath, { verbose: false });

        if (result.cognitiveCommits.length === 0) {
          console.log("  No commits found\n");
          continue;
        }

        console.log(`  Found ${result.cognitiveCommits.length} commits, ${result.totalTurns} turns`);

        // Import commits
        let imported = 0;
        let skipped = 0;

        for (const commit of result.cognitiveCommits) {
          // Check if commit already exists
          const existing = db.getCommit(commit.id) ||
            (commit.gitHash ? db.getCommitByGitHash(commit.gitHash) : null);

          if (existing) {
            skipped++;
            continue;
          }

          // Set project name for global mode (default)
          if (!options.project) {
            commit.projectName = projectName;
          }

          db.insertCommit(commit);
          imported++;
        }

        console.log(`  Imported: ${imported}, Skipped: ${skipped}\n`);
        totalImported += imported;
        totalSkipped += skipped;
      }

      db.close();

      console.log("─".repeat(40));
      console.log(`Total imported: ${totalImported} commits`);
      if (totalSkipped > 0) {
        console.log(`Total skipped: ${totalSkipped} (already exist)`);
      }
      console.log();

      if (options.project) {
        console.log("Import complete! Run 'agentlogs studio --project' to view.");
      } else {
        console.log("Import complete! Run 'agentlogs studio' to view.");
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// ============================================
// Cloud Sync Commands
// ============================================

program
  .command("login")
  .description("Login with GitHub to enable cloud sync")
  .action(async () => {
    try {
      if (!isCloudAvailable()) {
        console.error("Cloud sync is not configured.");
        console.error("Set AGENTLOGS_SUPABASE_URL and AGENTLOGS_SUPABASE_ANON_KEY environment variables.");
        process.exit(1);
      }

      if (isAuthenticated()) {
        const user = getCurrentUser();
        console.log(`Already logged in as ${user?.githubUsername}`);
        console.log("Use 'agentlogs logout' to switch accounts.");
        return;
      }

      console.log("Starting GitHub authentication...");
      const user = await login();
      console.log(`\nLogged in as ${user.githubUsername}`);
      console.log("\nYou can now sync your conversations:");
      console.log("  agentlogs push    # Push local commits to cloud");
      console.log("  agentlogs pull    # Pull commits from cloud");
      console.log("  agentlogs sync    # Bidirectional sync");
    } catch (error) {
      console.error(`Login failed: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("logout")
  .description("Logout and clear stored credentials")
  .action(async () => {
    try {
      if (!isAuthenticated()) {
        console.log("Not logged in.");
        return;
      }

      const user = getCurrentUser();
      await logout();
      console.log(`Logged out from ${user?.githubUsername}`);
    } catch (error) {
      console.error(`Logout failed: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("whoami")
  .description("Show current logged-in user")
  .action(() => {
    if (!isAuthenticated()) {
      console.log("Not logged in.");
      console.log("Run 'agentlogs login' to authenticate with GitHub.");
      return;
    }

    const user = getCurrentUser();
    console.log(`Logged in as: ${user?.githubUsername}`);
    console.log(`User ID: ${user?.id}`);
  });

program
  .command("push")
  .description("Push local commits to cloud")
  .option("-v, --verbose", "Show verbose output")
  .action(async (options) => {
    try {
      if (!isAuthenticated()) {
        console.error("Not logged in. Run 'agentlogs login' first.");
        process.exit(1);
      }

      const storagePath = ensureGlobalStorageDir();
      const db = new AgentlogsDB(storagePath, { rawStoragePath: true });

      console.log("Pushing to cloud...");
      const result = await pushToCloud(db, { verbose: options.verbose });

      db.close();

      console.log(`\nPush complete:`);
      console.log(`  Pushed: ${result.pushed} commits`);
      if (result.conflicts > 0) {
        console.log(`  Conflicts: ${result.conflicts} (run 'agentlogs sync' to resolve)`);
      }
      if (result.errors.length > 0) {
        console.log(`  Errors: ${result.errors.length}`);
        for (const err of result.errors) {
          console.log(`    - ${err}`);
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
        console.error("Not logged in. Run 'agentlogs login' first.");
        process.exit(1);
      }

      const storagePath = ensureGlobalStorageDir();
      const db = new AgentlogsDB(storagePath, { rawStoragePath: true });

      console.log("Pulling from cloud...");
      const result = await pullFromCloud(db, { verbose: options.verbose });

      db.close();

      console.log(`\nPull complete:`);
      console.log(`  Pulled: ${result.pulled} commits`);
      if (result.conflicts > 0) {
        console.log(`  Conflicts: ${result.conflicts} (run 'agentlogs sync' to resolve)`);
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
      const db = new AgentlogsDB(storagePath, { rawStoragePath: true });

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
        console.error("Not logged in. Run 'agentlogs login' first.");
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

program
  .command("config")
  .description("View or update configuration")
  .argument("[key]", "Configuration key to get/set")
  .argument("[value]", "Value to set")
  .option("--list", "List all configuration values")
  .action(async (key: string | undefined, value: string | undefined, options) => {
    try {
      const home = process.env.HOME || "";
      const configPath = path.join(home, ".agentlogs", "settings.json");
      const fs = require("fs");

      // Load existing settings
      let settings: Record<string, unknown> = {};
      if (fs.existsSync(configPath)) {
        settings = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      }

      if (options.list || (!key && !value)) {
        console.log("\nAgentlogs Configuration:");
        console.log(`  storage: ${settings.storage || "local"}`);
        console.log(`  continuous-sync: ${settings.continuousSync || false}`);
        console.log(`  analytics-opt-in: ${settings.analyticsOptIn || false}`);
        return;
      }

      if (key && value) {
        // Set value
        const validKeys = ["storage", "continuous-sync", "analytics-opt-in"];
        if (!validKeys.includes(key)) {
          console.error(`Unknown configuration key: ${key}`);
          console.error(`Valid keys: ${validKeys.join(", ")}`);
          process.exit(1);
        }

        // Convert key to camelCase for storage
        const storageKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

        // Parse boolean values
        let parsedValue: unknown = value;
        if (value === "true") parsedValue = true;
        else if (value === "false") parsedValue = false;

        settings[storageKey] = parsedValue;

        // Ensure directory exists
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true });
        }

        fs.writeFileSync(configPath, JSON.stringify(settings, null, 2));
        console.log(`Set ${key} = ${value}`);
      } else if (key) {
        // Get value
        const storageKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        console.log(settings[storageKey] ?? "(not set)");
      }
    } catch (error) {
      console.error(`Config error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("analytics")
  .description("View analytics and manage opt-in")
  .option("--opt-in", "Opt in to aggregate analytics")
  .option("--opt-out", "Opt out of aggregate analytics")
  .action(async (options) => {
    try {
      const storagePath = ensureGlobalStorageDir();
      const db = new AgentlogsDB(storagePath, { rawStoragePath: true });

      if (options.optIn || options.optOut) {
        const home = process.env.HOME || "";
        const configPath = path.join(home, ".agentlogs", "settings.json");
        const fs = require("fs");

        let settings: Record<string, unknown> = {};
        if (fs.existsSync(configPath)) {
          settings = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        }

        settings.analyticsOptIn = options.optIn ? true : false;
        fs.writeFileSync(configPath, JSON.stringify(settings, null, 2));

        console.log(options.optIn
          ? "Opted in to aggregate analytics."
          : "Opted out of aggregate analytics."
        );
        db.close();
        return;
      }

      // Show local analytics
      const commitCount = db.getCommitCount();
      const projects = db.getDistinctProjects();
      const recentCommits = db.getRecentCommits(100);

      // Calculate stats
      let totalTurns = 0;
      let totalSessions = 0;
      const toolUsage: Record<string, number> = {};

      for (const commit of recentCommits) {
        totalSessions += commit.sessions.length;
        for (const session of commit.sessions) {
          totalTurns += session.turns.length;
          for (const turn of session.turns) {
            if (turn.toolCalls) {
              for (const call of turn.toolCalls) {
                toolUsage[call.name] = (toolUsage[call.name] || 0) + 1;
              }
            }
          }
        }
      }

      db.close();

      console.log("\nAgentlogs Analytics (Local)\n");
      console.log(`Total Commits: ${commitCount}`);
      console.log(`Projects: ${projects.length}`);
      console.log(`\nRecent Activity (last 100 commits):`);
      console.log(`  Sessions: ${totalSessions}`);
      console.log(`  Turns: ${totalTurns}`);
      console.log(`  Avg turns/commit: ${(totalTurns / Math.max(recentCommits.length, 1)).toFixed(1)}`);

      if (Object.keys(toolUsage).length > 0) {
        console.log(`\nTop Tools Used:`);
        const sortedTools = Object.entries(toolUsage)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        for (const [tool, count] of sortedTools) {
          console.log(`  ${tool}: ${count}`);
        }
      }

      console.log("\n---");
      console.log("Analytics are computed locally. No data is uploaded.");
      console.log("Run 'agentlogs analytics --opt-in' to help improve agentlogs.");
    } catch (error) {
      console.error(`Analytics error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program.parse();
