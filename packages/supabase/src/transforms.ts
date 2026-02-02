/**
 * Transform functions for converting between database and frontend types
 * Database uses snake_case, frontend uses camelCase
 */

import type {
  CognitiveCommit,
  Session,
  Turn,
  ToolCall,
  DbCommit,
  DbSession,
  DbTurn,
  ClosedBy,
  ConversationSource,
  SyncStatus,
} from "@cogcommit/types";

/**
 * Transform a database commit row to frontend CognitiveCommit
 */
export function transformCommit(
  db: DbCommit,
  sessions?: Session[]
): CognitiveCommit {
  return {
    id: db.id,
    gitHash: db.git_hash,
    startedAt: db.started_at,
    closedAt: db.closed_at,
    closedBy: db.closed_by as ClosedBy,
    sessions: sessions ?? [],
    parallel: db.parallel,
    filesRead: db.files_read || [],
    filesChanged: db.files_changed || [],
    title: db.title ?? undefined,
    published: db.published,
    hidden: db.hidden,
    displayOrder: db.display_order,
    projectName: db.project_name ?? undefined,
    source: db.source as ConversationSource | undefined,
    cloudId: db.id,
    syncStatus: "synced" as SyncStatus,
    cloudVersion: db.version,
    localVersion: db.version,
    lastSyncedAt: db.updated_at,
  };
}

/**
 * Transform a database session row to frontend Session
 */
export function transformSession(db: DbSession, turns?: Turn[]): Session {
  return {
    id: db.id,
    startedAt: db.started_at,
    endedAt: db.ended_at,
    turns: turns ?? [],
  };
}

/**
 * Transform a database turn row to frontend Turn
 */
export function transformTurn(db: DbTurn): Turn {
  let toolCalls: ToolCall[] | undefined;

  if (db.tool_calls) {
    try {
      toolCalls = JSON.parse(db.tool_calls);
    } catch {
      toolCalls = undefined;
    }
  }

  return {
    id: db.id,
    role: db.role as "user" | "assistant",
    content: db.content || "",
    timestamp: db.timestamp,
    model: db.model ?? undefined,
    toolCalls,
    triggersVisualUpdate: db.triggers_visual,
  };
}

/**
 * Transform a complete commit with nested sessions and turns
 */
export interface DbCommitWithRelations extends DbCommit {
  sessions?: (DbSession & {
    turns?: DbTurn[];
  })[];
}

export function transformCommitWithRelations(
  db: DbCommitWithRelations
): CognitiveCommit {
  const sessions: Session[] =
    db.sessions?.map((dbSession) => {
      const turns: Turn[] = dbSession.turns?.map(transformTurn) ?? [];
      return transformSession(dbSession, turns);
    }) ?? [];

  const commit = transformCommit(db, sessions);

  // Use stored prompt_count if available, fallback to calculation for old data
  if (db.prompt_count != null) {
    commit.turnCount = db.prompt_count;
  } else {
    commit.turnCount = sessions.reduce(
      (sum, s) => sum + s.turns.filter((t) => t.role === "user").length,
      0
    );
  }

  return commit;
}

/**
 * Convert frontend CognitiveCommit to database format (for inserts/updates)
 */
export function toDbCommit(
  commit: Partial<CognitiveCommit>,
  userId: string
): Partial<DbCommit> {
  const result: Partial<DbCommit> = {
    user_id: userId,
  };

  if (commit.id !== undefined) result.id = commit.id;
  if (commit.gitHash !== undefined) result.git_hash = commit.gitHash;
  if (commit.startedAt !== undefined) result.started_at = commit.startedAt;
  if (commit.closedAt !== undefined) result.closed_at = commit.closedAt;
  if (commit.closedBy !== undefined) result.closed_by = commit.closedBy;
  if (commit.parallel !== undefined) result.parallel = commit.parallel;
  if (commit.filesRead !== undefined) result.files_read = commit.filesRead;
  if (commit.filesChanged !== undefined)
    result.files_changed = commit.filesChanged;
  if (commit.title !== undefined) result.title = commit.title || null;
  if (commit.published !== undefined) result.published = commit.published;
  if (commit.hidden !== undefined) result.hidden = commit.hidden;
  if (commit.displayOrder !== undefined)
    result.display_order = commit.displayOrder;
  if (commit.projectName !== undefined)
    result.project_name = commit.projectName || null;
  if (commit.source !== undefined) result.source = commit.source || "unknown";

  return result;
}

/**
 * Convert frontend Session to database format
 */
export function toDbSession(
  session: Partial<Session>,
  commitId: string
): Partial<DbSession> {
  const result: Partial<DbSession> = {
    commit_id: commitId,
  };

  if (session.id !== undefined) result.id = session.id;
  if (session.startedAt !== undefined) result.started_at = session.startedAt;
  if (session.endedAt !== undefined) result.ended_at = session.endedAt;

  return result;
}

/**
 * Convert frontend Turn to database format
 */
export function toDbTurn(
  turn: Partial<Turn>,
  sessionId: string
): Partial<DbTurn> {
  const result: Partial<DbTurn> = {
    session_id: sessionId,
  };

  if (turn.id !== undefined) result.id = turn.id;
  if (turn.role !== undefined) result.role = turn.role;
  if (turn.content !== undefined) result.content = turn.content || null;
  if (turn.timestamp !== undefined) result.timestamp = turn.timestamp;
  if (turn.model !== undefined) result.model = turn.model || null;
  if (turn.toolCalls !== undefined) {
    result.tool_calls = turn.toolCalls
      ? JSON.stringify(turn.toolCalls)
      : null;
  }
  if (turn.triggersVisualUpdate !== undefined) {
    result.triggers_visual = turn.triggersVisualUpdate;
  }

  return result;
}
