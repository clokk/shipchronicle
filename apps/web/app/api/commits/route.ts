import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const project = searchParams.get("project");

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let query = supabase
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
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .eq("hidden", false)
    .order("closed_at", { ascending: false });

  if (project) {
    query = query.eq("project_name", project);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch commits:", error);
    return NextResponse.json({ error: "Failed to fetch commits" }, { status: 500 });
  }

  // Filter out 0-turn commits in application layer
  const commits = ((data as DbCommit[]) || []).filter((commit) => {
    const turnCount = commit.sessions?.reduce((sum, s) => sum + (s.turns?.length || 0), 0) || 0;
    return turnCount > 0;
  });

  return NextResponse.json({ commits });
}
