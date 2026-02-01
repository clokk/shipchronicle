import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface DbSession {
  turns: { id: string }[];
}

interface DbCommitWithSessions {
  project_name: string | null;
  sessions: DbSession[];
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all commits with session/turn counts to filter non-empty
  const { data, error } = await supabase
    .from("cognitive_commits")
    .select("project_name, sessions(turns(id))")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .eq("hidden", false)
    .not("project_name", "is", null);

  if (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }

  // Group by project name and count, filtering out 0-turn commits
  const projectCounts = new Map<string, number>();
  let totalCount = 0;

  for (const row of (data as DbCommitWithSessions[]) || []) {
    // Count turns across all sessions
    const turnCount = row.sessions?.reduce((sum, s) => sum + (s.turns?.length || 0), 0) || 0;
    if (turnCount === 0) continue; // Skip empty commits

    const name = row.project_name as string;
    projectCounts.set(name, (projectCounts.get(name) || 0) + 1);
    totalCount++;
  }

  // Convert to array and sort by count descending
  const projects = Array.from(projectCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ projects, totalCount });
}
