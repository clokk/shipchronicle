/**
 * Output types for Agentlogs
 * Represents the structured cognitive commit data
 */

export type ClosedBy = "git_commit" | "session_end" | "explicit";

/** Source agent/tool that the conversation was imported from */
export type ConversationSource =
  | "claude_code"
  | "cursor"
  | "antigravity"
  | "codex"
  | "opencode";

/** Sync status for cloud sync */
export type SyncStatus = "pending" | "synced" | "conflict" | "error";

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

export interface Turn {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  model?: string;
  toolCalls?: ToolCall[];
  triggersVisualUpdate?: boolean;
}

export interface Session {
  id: string;
  label?: string;
  startedAt: string;
  endedAt: string;
  turns: Turn[];
}

export interface CognitiveCommit {
  id: string;
  gitHash: string | null;
  startedAt: string;
  closedAt: string;
  closedBy: ClosedBy;
  sessions: Session[];
  parallel: boolean;
  filesRead: string[];
  filesChanged: string[];
  // Curation fields (Phase 3)
  title?: string;
  published?: boolean;
  hidden?: boolean;
  displayOrder?: number;
  // Global mode field
  projectName?: string;
  // Source agent (v5)
  source?: ConversationSource;
  // Sync metadata (v6)
  cloudId?: string;
  syncStatus?: SyncStatus;
  cloudVersion?: number;
  localVersion?: number;
  lastSyncedAt?: string;
}

export interface ParseResult {
  project: string;
  projectPath: string;
  cognitiveCommits: CognitiveCommit[];
  totalSessions: number;
  totalTurns: number;
  parseErrors: string[];
}

export interface ProjectInfo {
  name: string;
  path: string;
  sessionFiles: string[];
}

export interface Visual {
  id: string;
  commitId: string;
  type: "screenshot" | "video" | "vercel_preview";
  path: string;
  capturedAt: string;
  caption?: string;
  cloudUrl?: string;
}
