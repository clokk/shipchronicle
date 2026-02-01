/**
 * Cloud management commands
 */

import { Command } from "commander";
import { loadAuthTokens, getAuthenticatedClient } from "../sync/client";
import * as readline from "readline";

export function registerCloudCommands(program: Command): void {
  const cloud = program
    .command("cloud")
    .description("Cloud management commands");

  cloud
    .command("clear")
    .description("Delete all your data from the cloud (requires confirmation)")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (options) => {
      const tokens = loadAuthTokens();
      if (!tokens) {
        console.error("Not logged in. Run 'cogcommit login' first.");
        process.exit(1);
      }

      // Confirm unless --yes flag
      if (!options.yes) {
        const confirmed = await confirm(
          "This will permanently delete ALL your cloud data. Type 'yes' to confirm: "
        );
        if (!confirmed) {
          console.log("Aborted.");
          return;
        }
      }

      console.log("Clearing cloud data...");

      const supabase = getAuthenticatedClient();
      const userId = tokens.user.id;

      try {
        // Get commit IDs
        const { data: commits, error: fetchError } = await supabase
          .from("cognitive_commits")
          .select("id")
          .eq("user_id", userId);

        if (fetchError) {
          console.error(`Failed to fetch commits: ${fetchError.message}`);
          process.exit(1);
        }

        if (!commits || commits.length === 0) {
          console.log("No cloud data to delete.");
          return;
        }

        const commitIds = commits.map((c) => c.id);

        // Get session IDs for cascade delete
        const { data: sessions } = await supabase
          .from("sessions")
          .select("id")
          .in("commit_id", commitIds);

        if (sessions && sessions.length > 0) {
          const sessionIds = sessions.map((s) => s.id);

          // Delete turns
          const { error: turnsError } = await supabase
            .from("turns")
            .delete()
            .in("session_id", sessionIds);

          if (turnsError) {
            console.error(`Failed to delete turns: ${turnsError.message}`);
            process.exit(1);
          }

          // Delete sessions
          const { error: sessionsError } = await supabase
            .from("sessions")
            .delete()
            .in("commit_id", commitIds);

          if (sessionsError) {
            console.error(`Failed to delete sessions: ${sessionsError.message}`);
            process.exit(1);
          }
        }

        // Delete commits
        const { error: commitsError } = await supabase
          .from("cognitive_commits")
          .delete()
          .eq("user_id", userId);

        if (commitsError) {
          console.error(`Failed to delete commits: ${commitsError.message}`);
          process.exit(1);
        }

        console.log(`Deleted ${commits.length} commits from cloud.`);
      } catch (error) {
        console.error(`Cloud clear failed: ${(error as Error).message}`);
        process.exit(1);
      }
    });
}

async function confirm(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "yes");
    });
  });
}
