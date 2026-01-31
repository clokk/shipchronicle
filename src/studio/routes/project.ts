/**
 * Project API routes
 */

import { Hono } from "hono";
import { loadConfig } from "../../config";
import { AgentlogsDB } from "../../storage/db";

interface ProjectRouteOptions {
  global?: boolean;
}

export function createProjectRoutes(storagePath: string, options: ProjectRouteOptions = {}): Hono {
  const app = new Hono();
  const dbOptions = { rawStoragePath: options.global };

  // GET /api/project - Get project info and stats
  app.get("/", async (c) => {
    const db = new AgentlogsDB(storagePath, dbOptions);

    try {
      const commits = db.getAllCommits();
      const commitCount = commits.length;

      // Count total turns
      const totalTurns = commits.reduce((sum, commit) => {
        return sum + commit.sessions.reduce((s, session) => s + session.turns.length, 0);
      }, 0);

      // Get date range
      const dates = commits.flatMap((c) => [c.startedAt, c.closedAt]);
      const firstDate = dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : null;
      const lastDate = dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : null;

      // Get project name
      let projectName: string;
      if (options.global) {
        projectName = "All Claude History";
      } else {
        const config = loadConfig(storagePath);
        projectName = config.projectName;
      }

      return c.json({
        project: {
          name: projectName,
          path: storagePath,
          global: options.global || false,
        },
        stats: {
          commitCount,
          totalTurns,
          firstDate,
          lastDate,
        },
      });
    } finally {
      db.close();
    }
  });

  // GET /api/projects - Get list of distinct projects with counts (global mode only)
  app.get("/projects", async (c) => {
    if (!options.global) {
      return c.json({ projects: [] });
    }

    const db = new AgentlogsDB(storagePath, dbOptions);

    try {
      const projects = db.getDistinctProjects();
      const totalCount = db.getCommitCount();

      return c.json({
        projects,
        totalCount,
      });
    } finally {
      db.close();
    }
  });

  return app;
}
