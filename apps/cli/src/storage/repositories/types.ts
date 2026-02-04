/**
 * Shared types for database repositories
 */

import type Database from "better-sqlite3";
import type { CognitiveCommit, Visual } from "../../models/types";

// Row type interfaces for SQLite results
export interface CommitRow {
  id: string;
  git_hash: string | null;
  started_at: string;
  closed_at: string;
  closed_by: string;
  parallel: number;
  files_read: string | null;
  files_changed: string | null;
  // Curation fields (v2)
  published: number;
  hidden: number;
  display_order: number;
  title: string | null;
  // Global mode field (v3)
  project_name: string | null;
  // Source agent (v5)
  source: string | null;
  // Sync metadata (v6)
  cloud_id: string | null;
  sync_status: string | null;
  cloud_version: number | null;
  local_version: number | null;
  last_synced_at: string | null;
  // Sentiment analysis (v9)
  rejection_count: number | null;
  approval_count: number | null;
  sentiment_label: string | null;
}

export interface SessionRow {
  id: string;
  commit_id: string;
  started_at: string;
  ended_at: string;
}

export interface TurnRow {
  id: string;
  session_id: string;
  role: string;
  content: string | null;
  timestamp: string;
  tool_calls: string | null;
  triggers_visual: number;
  model: string | null;
}

export interface VisualRow {
  id: string;
  commit_id: string;
  type: string;
  path: string;
  captured_at: string;
  caption: string | null;
  // Sync metadata (v6)
  cloud_id: string | null;
  sync_status: string | null;
  cloud_version: number | null;
  local_version: number | null;
  cloud_url: string | null;
}

// Statistics interface for commits
export interface CommitStats {
  totalCommits: number;
  totalSessions: number;
  totalTurns: number;
  projectCount: number;
  bySource: Record<string, number>;
  topProjects: { name: string; count: number }[];
  firstCommit: string | null;
  lastCommit: string | null;
}

// Search result interface for turns
export interface SearchResult {
  id: string;
  role: string;
  content: string;
  timestamp: string;
  session_id: string;
  commit_id: string;
  project_name: string | null;
}

// Base repository interface
export interface Repository {
  readonly db: Database.Database;
}

// Repository context interface for dependency injection
export interface RepositoryContext {
  readonly db: Database.Database;
}
