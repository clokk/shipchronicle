/**
 * Commits Repository
 */

import type Database from "better-sqlite3";
import type { CognitiveCommit } from "../../models/types";
import type { CommitRow, CommitStats, RepositoryContext } from "./types";
import { SessionsRepository } from "./sessions";
import { VisualsRepository } from "./visuals";

export class CommitsRepository {
  private db: Database.Database;
  private sessionsRepo: SessionsRepository;
  private visualsRepo: VisualsRepository;

  constructor(context: RepositoryContext) {
    this.db = context.db;
    this.sessionsRepo = new SessionsRepository(context);
    this.visualsRepo = new VisualsRepository(context);
  }

  /**
   * Insert a cognitive commit
   */
  insert(commit: CognitiveCommit): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cognitive_commits
      (id, git_hash, started_at, closed_at, closed_by, parallel, files_read, files_changed, published, hidden, display_order, title, project_name, source, cloud_id, sync_status, cloud_version, local_version, last_synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      commit.id,
      commit.gitHash,
      commit.startedAt,
      commit.closedAt,
      commit.closedBy,
      commit.parallel ? 1 : 0,
      JSON.stringify(commit.filesRead),
      JSON.stringify(commit.filesChanged),
      commit.published ? 1 : 0,
      commit.hidden ? 1 : 0,
      commit.displayOrder || 0,
      commit.title || null,
      commit.projectName || null,
      commit.source || "claude_code",
      commit.cloudId || null,
      commit.syncStatus || "pending",
      commit.cloudVersion || 0,
      commit.localVersion || 1,
      commit.lastSyncedAt || null
    );

    // Insert sessions
    for (const session of commit.sessions) {
      this.sessionsRepo.insert(session, commit.id);
    }
  }

  /**
   * Get a cognitive commit by ID
   */
  get(id: string): CognitiveCommit | null {
    const row = this.db
      .prepare("SELECT * FROM cognitive_commits WHERE id = ?")
      .get(id) as CommitRow | undefined;

    if (!row) return null;

    return this.rowToCommit(row);
  }

  /**
   * Get a cognitive commit by git hash
   */
  getByGitHash(gitHash: string): CognitiveCommit | null {
    const row = this.db
      .prepare("SELECT * FROM cognitive_commits WHERE git_hash = ?")
      .get(gitHash) as CommitRow | undefined;

    if (!row) return null;

    return this.rowToCommit(row);
  }

  /**
   * Get a commit by cloud ID
   */
  getByCloudId(cloudId: string): CognitiveCommit | null {
    const row = this.db
      .prepare("SELECT * FROM cognitive_commits WHERE cloud_id = ?")
      .get(cloudId) as CommitRow | undefined;

    if (!row) return null;

    return this.rowToCommit(row);
  }

  /**
   * Get all cognitive commits
   */
  getAll(): CognitiveCommit[] {
    const rows = this.db
      .prepare("SELECT * FROM cognitive_commits ORDER BY closed_at DESC")
      .all() as CommitRow[];

    return rows.map((row) => this.rowToCommit(row));
  }

  /**
   * Get recent commits
   */
  getRecent(limit: number = 10): CognitiveCommit[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM cognitive_commits ORDER BY closed_at DESC LIMIT ?"
      )
      .all(limit) as CommitRow[];

    return rows.map((row) => this.rowToCommit(row));
  }

  /**
   * Get commit count
   */
  getCount(): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM cognitive_commits")
      .get() as { count: number };

    return row.count;
  }

  /**
   * Get distinct project names with commit counts
   */
  getDistinctProjects(): { name: string; count: number }[] {
    const rows = this.db
      .prepare(`
        SELECT project_name as name, COUNT(*) as count
        FROM cognitive_commits
        WHERE project_name IS NOT NULL
        GROUP BY project_name
        ORDER BY count DESC
      `)
      .all() as { name: string; count: number }[];

    return rows;
  }

  /**
   * Get commits filtered by project name
   */
  getByProject(projectName: string): CognitiveCommit[] {
    const rows = this.db
      .prepare("SELECT * FROM cognitive_commits WHERE project_name = ? ORDER BY closed_at DESC")
      .all(projectName) as CommitRow[];

    return rows.map((row) => this.rowToCommit(row));
  }

  /**
   * Get commits by sync status
   */
  getBySyncStatus(status: string): CognitiveCommit[] {
    const rows = this.db
      .prepare("SELECT * FROM cognitive_commits WHERE sync_status = ? ORDER BY closed_at DESC")
      .all(status) as CommitRow[];

    return rows.map((row) => this.rowToCommit(row));
  }

  /**
   * Get pending commits (not yet synced to cloud)
   */
  getPending(): CognitiveCommit[] {
    return this.getBySyncStatus("pending");
  }

  /**
   * Update project name for a commit (for redetection)
   */
  updateProjectName(id: string, projectName: string): boolean {
    const stmt = this.db.prepare(
      "UPDATE cognitive_commits SET project_name = ? WHERE id = ?"
    );
    const result = stmt.run(projectName, id);
    return result.changes > 0;
  }

  /**
   * Update a cognitive commit (for curation and sync)
   */
  update(
    id: string,
    updates: Partial<Pick<CognitiveCommit, "title" | "published" | "hidden" | "displayOrder" | "gitHash" | "closedBy">>
  ): boolean {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.title !== undefined) {
      fields.push("title = ?");
      values.push(updates.title || null);
    }
    if (updates.published !== undefined) {
      fields.push("published = ?");
      values.push(updates.published ? 1 : 0);
    }
    if (updates.hidden !== undefined) {
      fields.push("hidden = ?");
      values.push(updates.hidden ? 1 : 0);
    }
    if (updates.displayOrder !== undefined) {
      fields.push("display_order = ?");
      values.push(updates.displayOrder);
    }
    if (updates.gitHash !== undefined) {
      fields.push("git_hash = ?");
      values.push(updates.gitHash);
    }
    if (updates.closedBy !== undefined) {
      fields.push("closed_by = ?");
      values.push(updates.closedBy);
    }

    if (fields.length === 0) return false;

    // Also increment local version for sync tracking
    fields.push("local_version = local_version + 1");

    values.push(id);
    const stmt = this.db.prepare(
      `UPDATE cognitive_commits SET ${fields.join(", ")} WHERE id = ?`
    );
    const result = stmt.run(...values);
    return result.changes > 0;
  }

  /**
   * Delete a cognitive commit and all related data
   */
  delete(id: string): boolean {
    // Delete related data first
    this.sessionsRepo.deleteForCommit(id);
    this.visualsRepo.deleteForCommit(id);

    // Delete the commit
    const result = this.db
      .prepare("DELETE FROM cognitive_commits WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }

  /**
   * Bulk update commits (for batch publish)
   */
  bulkUpdate(
    ids: string[],
    updates: Partial<Pick<CognitiveCommit, "published" | "hidden">>
  ): number {
    let updated = 0;
    for (const id of ids) {
      if (this.update(id, updates)) {
        updated++;
      }
    }
    return updated;
  }

  /**
   * Update sync status for a commit
   */
  updateSyncStatus(id: string, status: string): boolean {
    const stmt = this.db.prepare(
      "UPDATE cognitive_commits SET sync_status = ?, local_version = local_version + 1 WHERE id = ?"
    );
    const result = stmt.run(status, id);
    return result.changes > 0;
  }

  /**
   * Update sync metadata for a commit
   */
  updateSyncMetadata(
    id: string,
    metadata: {
      cloudId?: string;
      syncStatus?: string;
      cloudVersion?: number;
      localVersion?: number;
      lastSyncedAt?: string;
    }
  ): boolean {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (metadata.cloudId !== undefined) {
      fields.push("cloud_id = ?");
      values.push(metadata.cloudId);
    }
    if (metadata.syncStatus !== undefined) {
      fields.push("sync_status = ?");
      values.push(metadata.syncStatus);
    }
    if (metadata.cloudVersion !== undefined) {
      fields.push("cloud_version = ?");
      values.push(metadata.cloudVersion);
    }
    if (metadata.localVersion !== undefined) {
      fields.push("local_version = ?");
      values.push(metadata.localVersion);
    }
    if (metadata.lastSyncedAt !== undefined) {
      fields.push("last_synced_at = ?");
      values.push(metadata.lastSyncedAt);
    }

    if (fields.length === 0) return false;

    values.push(id);
    const stmt = this.db.prepare(
      `UPDATE cognitive_commits SET ${fields.join(", ")} WHERE id = ?`
    );
    const result = stmt.run(...values);
    return result.changes > 0;
  }

  /**
   * Increment local version for a commit
   */
  incrementLocalVersion(id: string): boolean {
    const stmt = this.db.prepare(
      "UPDATE cognitive_commits SET local_version = local_version + 1 WHERE id = ?"
    );
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Reset all commits to pending status (for --force push)
   */
  resetAllSyncStatus(): number {
    const result = this.db
      .prepare(`
        UPDATE cognitive_commits
        SET sync_status = 'pending', cloud_id = NULL, cloud_version = 0, last_synced_at = NULL
      `)
      .run();

    return result.changes;
  }

  /**
   * Get commits before a specific date
   */
  getBeforeDate(beforeDate: string, projectName?: string): CognitiveCommit[] {
    let sql = "SELECT * FROM cognitive_commits WHERE closed_at < ?";
    const params: string[] = [beforeDate];

    if (projectName) {
      sql += " AND project_name = ?";
      params.push(projectName);
    }

    sql += " ORDER BY closed_at ASC";

    const rows = this.db.prepare(sql).all(...params) as CommitRow[];
    return rows.map((row) => this.rowToCommit(row));
  }

  /**
   * Get statistics about cognitive commits
   */
  getStats(projectName?: string): CommitStats {
    const whereClause = projectName ? "WHERE project_name = ?" : "";
    const params = projectName ? [projectName] : [];

    const commits = this.db
      .prepare(`SELECT COUNT(*) as count FROM cognitive_commits ${whereClause}`)
      .get(...params) as { count: number };

    const sessions = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM sessions s
         JOIN cognitive_commits c ON s.commit_id = c.id
         ${whereClause}`
      )
      .get(...params) as { count: number };

    const turns = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM turns t
         JOIN sessions s ON t.session_id = s.id
         JOIN cognitive_commits c ON s.commit_id = c.id
         ${whereClause}`
      )
      .get(...params) as { count: number };

    const bySource = this.db
      .prepare(
        `SELECT source, COUNT(*) as count FROM cognitive_commits
         ${whereClause}
         GROUP BY source`
      )
      .all(...params) as { source: string; count: number }[];

    const timeRange = this.db
      .prepare(
        `SELECT MIN(started_at) as first, MAX(closed_at) as last
         FROM cognitive_commits ${whereClause}`
      )
      .get(...params) as { first: string | null; last: string | null };

    return {
      totalCommits: commits.count,
      totalSessions: sessions.count,
      totalTurns: turns.count,
      projectCount: this.getDistinctProjects().length,
      bySource: Object.fromEntries(bySource.map((s) => [s.source, s.count])),
      topProjects: this.getDistinctProjects(),
      firstCommit: timeRange.first,
      lastCommit: timeRange.last,
    };
  }

  private rowToCommit(row: CommitRow): CognitiveCommit {
    const sessions = this.sessionsRepo.getForCommit(row.id);

    return {
      id: row.id,
      gitHash: row.git_hash,
      startedAt: row.started_at,
      closedAt: row.closed_at,
      closedBy: row.closed_by as CognitiveCommit["closedBy"],
      parallel: row.parallel === 1,
      filesRead: JSON.parse(row.files_read || "[]"),
      filesChanged: JSON.parse(row.files_changed || "[]"),
      sessions,
      // Curation fields
      title: row.title || undefined,
      published: row.published === 1,
      hidden: row.hidden === 1,
      displayOrder: row.display_order || 0,
      // Global mode field
      projectName: row.project_name || undefined,
      // Source agent (v5)
      source: (row.source as CognitiveCommit["source"]) || "claude_code",
      // Sync metadata (v6)
      cloudId: row.cloud_id || undefined,
      syncStatus: (row.sync_status as CognitiveCommit["syncStatus"]) || "pending",
      cloudVersion: row.cloud_version || 0,
      localVersion: row.local_version || 1,
      lastSyncedAt: row.last_synced_at || undefined,
    };
  }
}
