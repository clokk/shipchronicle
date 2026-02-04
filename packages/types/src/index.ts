/**
 * Shared types for CogCommit
 * Used by both CLI and web applications
 */

// ============================================
// Core Types (from models/types.ts)
// ============================================

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

/** Sentiment label for cognitive commits */
export type SentimentLabel = "smooth" | "some-iteration" | "struggled";

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
  // Curation fields
  title?: string;
  published?: boolean;
  hidden?: boolean;
  displayOrder?: number;
  // Public sharing fields
  publicSlug?: string;
  publishedAt?: string;
  // Global mode field
  projectName?: string;
  // Source agent
  source?: ConversationSource;
  // Sync metadata
  cloudId?: string;
  syncStatus?: SyncStatus;
  cloudVersion?: number;
  localVersion?: number;
  lastSyncedAt?: string;
  // UI convenience field (computed)
  turnCount?: number;
  // Sentiment analysis fields
  rejectionCount?: number;
  approvalCount?: number;
  sentimentLabel?: SentimentLabel;
}

/**
 * Lightweight commit data for list views.
 * Contains only summary fields needed for sidebar display.
 * Full sessions/turns are fetched lazily via useCommitDetail.
 */
export interface CommitListItem {
  id: string;
  gitHash: string | null;
  startedAt: string;
  closedAt: string;
  closedBy: ClosedBy;
  parallel: boolean;
  // Curation fields
  title?: string;
  published?: boolean;
  hidden?: boolean;
  // Public sharing fields
  publicSlug?: string;
  publishedAt?: string;
  // Global mode field
  projectName?: string;
  // Source agent
  source?: ConversationSource;
  // Computed counts for display
  sessionCount: number;
  turnCount: number;
  // Sentiment analysis fields
  rejectionCount?: number;
  approvalCount?: number;
  sentimentLabel?: SentimentLabel;
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

// ============================================
// Cloud/Sync Types (from sync/types.ts)
// ============================================

export interface SyncMetadata {
  cloudId: string | null;
  syncStatus: SyncStatus;
  cloudVersion: number;
  localVersion: number;
  lastSyncedAt: string | null;
}

export interface CloudCommit {
  id: string;
  userId: string;
  projectId: string | null;
  originMachineId: string | null;
  gitHash: string | null;
  startedAt: string;
  closedAt: string;
  closedBy: string;
  parallel: boolean;
  filesRead: string[];
  filesChanged: string[];
  source: string;
  projectName: string | null;
  published: boolean;
  hidden: boolean;
  displayOrder: number;
  title: string | null;
  version: number;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CloudSession {
  id: string;
  commitId: string;
  startedAt: string;
  endedAt: string;
  version: number;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CloudTurn {
  id: string;
  sessionId: string;
  role: string;
  content: string | null;
  timestamp: string;
  toolCalls: string | null;
  triggersVisual: boolean;
  model: string | null;
  version: number;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CloudVisual {
  id: string;
  commitId: string;
  type: string;
  path: string;
  cloudUrl: string | null;
  capturedAt: string;
  caption: string | null;
  version: number;
  updatedAt: string;
  deletedAt: string | null;
}

export interface UserProfile {
  id: string;
  githubUsername: string;
  githubId: string;
  analyticsOptIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Machine {
  id: string;
  userId: string;
  machineId: string;
  name: string | null;
  lastSyncAt: string | null;
  syncCursor: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: UserProfile;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: number;
  errors: string[];
}

export interface SyncState {
  lastSyncAt: string | null;
  pendingCount: number;
  syncedCount: number;
  conflictCount: number;
  isOnline: boolean;
  isSyncing: boolean;
}

export interface ConflictInfo {
  localId: string;
  cloudId: string;
  localVersion: number;
  cloudVersion: number;
  localUpdatedAt: string;
  cloudUpdatedAt: string;
  resolution: "local" | "cloud" | "pending";
}

// ============================================
// Database Row Types (snake_case from Supabase)
// ============================================

/** Raw database row for commits table */
export interface DbCommit {
  id: string;
  user_id: string;
  project_id: string | null;
  origin_machine_id: string | null;
  git_hash: string | null;
  started_at: string;
  closed_at: string;
  closed_by: string;
  parallel: boolean;
  files_read: string[];
  files_changed: string[];
  source: string;
  project_name: string | null;
  published: boolean;
  hidden: boolean;
  display_order: number;
  title: string | null;
  // Public sharing fields
  public_slug: string | null;
  published_at: string | null;
  version: number;
  updated_at: string;
  deleted_at: string | null;
  prompt_count: number | null;
  // Sentiment analysis fields
  rejection_count: number | null;
  approval_count: number | null;
  sentiment_label: string | null;
}

/** Raw database row for sessions table */
export interface DbSession {
  id: string;
  commit_id: string;
  started_at: string;
  ended_at: string;
  version: number;
  updated_at: string;
  deleted_at: string | null;
}

/** Raw database row for turns table */
export interface DbTurn {
  id: string;
  session_id: string;
  role: string;
  content: string | null;
  timestamp: string;
  tool_calls: string | null;
  triggers_visual: boolean;
  model: string | null;
  version: number;
  updated_at: string;
  deleted_at: string | null;
}

// ============================================
// Quota Types
// ============================================

export type QuotaTier = "free" | "pro" | "enterprise";

export interface UsageData {
  commitCount: number;
  commitLimit: number;
  storageUsedBytes: number;
  storageLimitBytes: number;
  tier: QuotaTier;
}

export const FREE_TIER_LIMITS = {
  commits: 250,
  storageBytes: 50 * 1024 * 1024, // 50 MB
} as const;

/** Weekly summary analytics for dashboard header */
export interface WeeklySummaryStats {
  weeklyCommitCount: number;
  weeklyPromptCount: number;
  avgPromptsPerCommit: number;
}

// ============================================
// Share Analytics Types
// ============================================

/** Referrer breakdown for analytics */
export interface ReferrerStats {
  domain: string;
  count: number;
}

/** Device type breakdown for analytics */
export interface DeviceStats {
  type: "desktop" | "mobile" | "tablet";
  count: number;
}

/** Analytics data for a published commit */
export interface CommitAnalytics {
  totalViews: number;
  uniqueViewers: number;
  viewsToday: number;
  viewsThisWeek: number;
  topReferrers: ReferrerStats[];
  deviceBreakdown: DeviceStats[];
}
