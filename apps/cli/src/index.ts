#!/usr/bin/env node
/**
 * CogCommit CLI
 * Document your AI-assisted development with cognitive commits
 */

import { Command } from "commander";
import {
  registerParseCommands,
  registerInitCommand,
  registerWatchCommands,
  registerStudioCommand,
  registerImportCommand,
  registerAuthCommands,
  registerSyncCommands,
  registerConfigCommands,
  registerCloudCommands,
} from "./commands";

const program = new Command();

program
  .name("cogcommit")
  .description("Document your AI-assisted development with cognitive commits")
  .version("0.1.0");

// Register all commands
registerParseCommands(program);
registerInitCommand(program);
registerWatchCommands(program);
registerStudioCommand(program);
registerImportCommand(program);
registerAuthCommands(program);
registerSyncCommands(program);
registerConfigCommands(program);
registerCloudCommands(program);

program.parse();
