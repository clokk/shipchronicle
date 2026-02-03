import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getPublicProfile } from "@cogcommit/supabase/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const supabase = await createClient();
  const { username } = await params;

  // Parse pagination params from URL
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);

  try {
    const result = await getPublicProfile(supabase, username, { limit, offset });

    if (!result) {
      return NextResponse.json(
        { error: "User not found or has no public commits" },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch public profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}
