/**
 * Auth commands - login, logout, whoami
 */

import { Command } from "commander";
import {
  login,
  logout,
  isAuthenticated,
  getCurrentUser,
  isCloudAvailable,
} from "../sync";

export function registerAuthCommands(program: Command): void {
  program
    .command("login")
    .description("Login with GitHub to enable cloud sync")
    .action(async () => {
      try {
        if (!isCloudAvailable()) {
          console.error("Cloud sync is not configured.");
          console.error("Set TUHNR_SUPABASE_URL and TUHNR_SUPABASE_ANON_KEY environment variables.");
          process.exit(1);
        }

        if (isAuthenticated()) {
          const user = getCurrentUser();
          console.log(`Already logged in as ${user?.githubUsername}`);
          console.log("Use 'tuhnr logout' to switch accounts.");
          return;
        }

        console.log("Starting GitHub authentication...");
        const user = await login();
        console.log(`\nLogged in as ${user.githubUsername}`);
        console.log("\nYou can now sync your conversations:");
        console.log("  tuhnr push    # Push local commits to cloud");
        console.log("  tuhnr pull    # Pull commits from cloud");
        console.log("  tuhnr sync    # Bidirectional sync");
        console.log("\nTip: 'tuhnr start' handles login automatically.");
        console.log("You can also use 'tuhnr claim' to upgrade an anonymous account.");
        process.exit(0);
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
        console.log("Run 'tuhnr login' to authenticate with GitHub.");
        return;
      }

      const user = getCurrentUser();
      console.log(`Logged in as: ${user?.githubUsername}`);
      console.log(`User ID: ${user?.id}`);
    });
}
