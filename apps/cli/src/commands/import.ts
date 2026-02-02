/**
 * Import command - Import Claude Code sessions into the database
 */

import { Command } from "commander";
import {
  loadConfig,
  isInitialized,
  ensureGlobalStorageDir,
  discoverAllClaudeProjects,
  getProjectNameFromClaudePath,
} from "../config";
import { CogCommitDB } from "../storage/db";
import { parseProject } from "../parser/index";
import { detectPrimaryProject } from "../utils/project";

export function registerImportCommand(program: Command): void {
  program
    .command("import")
    .description("Import Claude Code sessions into the database (defaults to all projects)")
    .option("-c, --claude-path <path>", "Claude project path to import from")
    .option("-g, --global", "Import all Claude Code projects (default)")
    .option("-p, --project", "Import only current project (requires init)")
    .option("--clear", "Clear existing commits before importing")
    .option("--redetect", "Re-run project detection on all existing commits")
    .action(async (options) => {
      try {
        let storagePath: string;
        let claudePaths: string[];

        if (options.project) {
          // Project mode - requires initialization
          const projectPath = process.cwd();

          if (!isInitialized(projectPath)) {
            console.error("Project not initialized. Run 'cogcommit init' first.");
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
        const db = new CogCommitDB(storagePath, { rawStoragePath: !options.project });

        // Handle --redetect: re-run project detection on existing commits
        if (options.redetect) {
          console.log("Re-detecting projects for existing commits...\n");

          const allCommits = db.commits.getAll();
          let updated = 0;
          const changes: { id: string; oldProject: string; newProject: string }[] = [];

          for (const commit of allCommits) {
            const oldProject = commit.projectName || "unknown";
            const newProject = detectPrimaryProject(
              commit.filesRead,
              commit.filesChanged,
              oldProject
            );

            if (newProject !== oldProject) {
              db.commits.updateProjectName(commit.id, newProject);
              changes.push({ id: commit.id, oldProject, newProject });
              updated++;
            }
          }

          console.log("─".repeat(40));
          console.log(`Scanned ${allCommits.length} commits`);
          console.log(`Updated ${updated} project assignments\n`);

          if (changes.length > 0) {
            console.log("Changes:");
            for (const change of changes.slice(0, 10)) {
              console.log(`  ${change.oldProject} → ${change.newProject}`);
            }
            if (changes.length > 10) {
              console.log(`  ... and ${changes.length - 10} more`);
            }
          }

          db.close();
          return;
        }

        // Optionally clear existing commits
        if (options.clear) {
          console.log("Clearing existing commits...");
          const existingCommits = db.commits.getAll();
          for (const commit of existingCommits) {
            db.commits.delete(commit.id);
          }
          console.log();
        }

        let totalImported = 0;
        let totalSkipped = 0;

        for (const claudePath of claudePaths) {
          const claudeProjectName = getProjectNameFromClaudePath(claudePath);
          console.log(`Importing: ${claudeProjectName}`);
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
            const existing = db.commits.get(commit.id) ||
              (commit.gitHash ? db.commits.getByGitHash(commit.gitHash) : null);

            if (existing) {
              skipped++;
              continue;
            }

            // Detect primary project from file operations (global mode)
            if (!options.project) {
              commit.projectName = detectPrimaryProject(
                commit.filesRead,
                commit.filesChanged,
                claudeProjectName  // Fall back to Claude directory name
              );
            }

            db.commits.insert(commit);
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
          console.log("Import complete! Run 'cogcommit dashboard --project' to view.");
        } else {
          console.log("Import complete! Run 'cogcommit dashboard' to view.");
        }
      } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        process.exit(1);
      }
    });
}
