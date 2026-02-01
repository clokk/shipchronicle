/**
 * Types for cloud sync functionality
 */

export type SyncStatus = "pending" | "synced" | "conflict" | "error";

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
