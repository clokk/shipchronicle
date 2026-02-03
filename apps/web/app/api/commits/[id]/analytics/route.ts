import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getCommitAnalytics } from "@cogcommit/supabase/queries";

/**
 * Get analytics for a commit
 *
 * GET /api/commits/[id]/analytics
 *
 * Returns analytics data (total views, unique viewers, referrers, devices)
 * Only accessible by commit owner (enforced by RLS on commit_views table)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify user owns this commit
  const { data: commit, error: commitError } = await supabase
    .from("cognitive_commits")
    .select("id, user_id")
    .eq("id", id)
    .single();

  if (commitError || !commit) {
    return NextResponse.json({ error: "Commit not found" }, { status: 404 });
  }

  if (commit.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const analytics = await getCommitAnalytics(supabase, id);
    return NextResponse.json(analytics);
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
