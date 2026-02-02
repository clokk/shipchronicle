import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { CommitListItem, ClosedBy, ConversationSource } from "@cogcommit/types";

interface DbCommitListRow {
  id: string;
  git_hash: string | null;
  started_at: string;
  closed_at: string;
  closed_by: string;
  parallel: boolean;
  title: string | null;
  hidden: boolean;
  project_name: string | null;
  source: string;
  prompt_count: number | null;
  sessions: { id: string }[];
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

  try {
    // Fetch summary fields + prompt_count directly (no need to fetch turns)
    let query = supabase
      .from("cognitive_commits")
      .select(
        `
        id, git_hash, started_at, closed_at, closed_by,
        title, project_name, source, parallel, hidden, prompt_count,
        sessions!inner (id)
      `
      )
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .eq("hidden", false)
      .order("closed_at", { ascending: false });

    if (project) {
      query = query.eq("project_name", project);
    }

    const { data: rawCommits, error } = await query;

    if (error) {
      console.error("Failed to fetch commits list:", error);
      return NextResponse.json({ error: "Failed to fetch commits" }, { status: 500 });
    }

    // Transform to lightweight format and filter
    const commits: CommitListItem[] = [];

    for (const raw of (rawCommits as DbCommitListRow[]) || []) {
      const sessionCount = raw.sessions?.length || 0;
      const turnCount = raw.prompt_count || 0;

      // Filter out 0-turn commits
      if (turnCount === 0) continue;

      commits.push({
        id: raw.id,
        gitHash: raw.git_hash,
        startedAt: raw.started_at,
        closedAt: raw.closed_at,
        closedBy: raw.closed_by as ClosedBy,
        parallel: raw.parallel,
        title: raw.title || undefined,
        hidden: raw.hidden,
        projectName: raw.project_name || undefined,
        source: raw.source as ConversationSource,
        sessionCount,
        turnCount,
      });
    }

    return NextResponse.json(
      { commits },
      {
        headers: {
          "Cache-Control": "private, max-age=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("Failed to fetch commits list:", error);
    return NextResponse.json({ error: "Failed to fetch commits" }, { status: 500 });
  }
}
