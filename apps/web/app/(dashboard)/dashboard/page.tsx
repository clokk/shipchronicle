import { createClient } from "@/lib/supabase/server";
import DashboardView from "@/components/DashboardView";
import type { CognitiveCommit, Session, Turn, ToolCall } from "@cogcommit/types";

interface ProjectListItem {
  name: string;
  count: number;
}

interface DbTurn {
  id: string;
  role: string;
  content: string | null;
  timestamp: string;
  model: string | null;
  tool_calls: string | null;
}

interface DbSession {
  id: string;
  started_at: string;
  ended_at: string;
  turns: DbTurn[];
}

interface DbCommit {
  id: string;
  git_hash: string | null;
  started_at: string;
  closed_at: string;
  closed_by: string;
  parallel: boolean;
  files_read: string[];
  files_changed: string[];
  title: string | null;
  project_name: string | null;
  source: string;
  sessions: DbSession[];
}

function transformTurn(dbTurn: DbTurn): Turn {
  let toolCalls: ToolCall[] | undefined;

  if (dbTurn.tool_calls) {
    try {
      const parsed = JSON.parse(dbTurn.tool_calls);
      toolCalls = parsed.map((tc: { id: string; name: string; input?: Record<string, unknown>; result?: string; isError?: boolean }) => ({
        id: tc.id,
        name: tc.name,
        input: tc.input || {},
        result: tc.result,
        isError: tc.isError,
      }));
    } catch {
      // Ignore parse errors
    }
  }

  return {
    id: dbTurn.id,
    role: dbTurn.role as "user" | "assistant",
    content: dbTurn.content || "",
    timestamp: dbTurn.timestamp,
    model: dbTurn.model || undefined,
    toolCalls,
  };
}

function transformSession(dbSession: DbSession): Session {
  return {
    id: dbSession.id,
    startedAt: dbSession.started_at,
    endedAt: dbSession.ended_at,
    turns: dbSession.turns.map(transformTurn),
  };
}

function transformCommit(dbCommit: DbCommit): CognitiveCommit {
  return {
    id: dbCommit.id,
    gitHash: dbCommit.git_hash,
    startedAt: dbCommit.started_at,
    closedAt: dbCommit.closed_at,
    closedBy: dbCommit.closed_by as "git_commit" | "session_end" | "explicit",
    parallel: dbCommit.parallel,
    filesRead: dbCommit.files_read || [],
    filesChanged: dbCommit.files_changed || [],
    title: dbCommit.title || undefined,
    projectName: dbCommit.project_name || undefined,
    source: dbCommit.source as CognitiveCommit["source"],
    sessions: dbCommit.sessions.map(transformSession),
    turnCount: dbCommit.sessions.reduce((sum, s) => sum + s.turns.length, 0),
  };
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userName =
    user?.user_metadata?.user_name ||
    user?.user_metadata?.preferred_username ||
    user?.email?.split("@")[0] ||
    "User";

  // Fetch all commits with full session/turn data
  const { data: commits, error } = await supabase
    .from("cognitive_commits")
    .select(
      `
      id,
      git_hash,
      started_at,
      closed_at,
      closed_by,
      parallel,
      files_read,
      files_changed,
      title,
      project_name,
      source,
      sessions (
        id,
        started_at,
        ended_at,
        turns (id, role, content, timestamp, model, tool_calls)
      )
    `
    )
    .eq("user_id", user?.id)
    .is("deleted_at", null)
    .eq("hidden", false)
    .order("closed_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch commits:", error);
  }

  // Transform commits and filter out 0-turn commits
  const allCommits = ((commits as DbCommit[]) || []).map(transformCommit);
  const typedCommits = allCommits.filter((c) => (c.turnCount ?? 0) > 0);

  // Build projects list from filtered commits
  const projectCounts = new Map<string, number>();

  for (const commit of typedCommits) {
    if (commit.projectName) {
      projectCounts.set(commit.projectName, (projectCounts.get(commit.projectName) || 0) + 1);
    }
  }

  // Convert to array and sort by count descending
  const projects: ProjectListItem[] = Array.from(projectCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const totalCount = typedCommits.length;

  return (
    <DashboardView
      commits={typedCommits}
      userName={userName}
      projects={projects}
      totalCount={totalCount}
    />
  );
}
