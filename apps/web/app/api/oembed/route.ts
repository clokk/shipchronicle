import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getPublicCommit } from "@cogcommit/supabase/queries";

/**
 * oEmbed endpoint for CogCommit commits
 *
 * Supports URLs like:
 * - https://cogcommit.com/c/{slug}
 *
 * Query params:
 * - url: The URL to get oEmbed data for (required)
 * - format: Response format (json only, default)
 * - maxwidth: Max width for the embed
 * - maxheight: Max height for the embed
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const format = searchParams.get("format") || "json";
  const maxWidth = parseInt(searchParams.get("maxwidth") || "600", 10);
  const maxHeight = parseInt(searchParams.get("maxheight") || "400", 10);

  // Only JSON format supported
  if (format !== "json") {
    return NextResponse.json(
      { error: "Only JSON format is supported" },
      { status: 501 }
    );
  }

  if (!url) {
    return NextResponse.json(
      { error: "url parameter is required" },
      { status: 400 }
    );
  }

  // Parse the URL to extract the slug
  const urlObj = new URL(url);
  const pathMatch = urlObj.pathname.match(/^\/c\/([a-zA-Z0-9]+)$/);

  if (!pathMatch) {
    return NextResponse.json(
      { error: "Invalid CogCommit URL. Expected format: https://cogcommit.com/c/{slug}" },
      { status: 400 }
    );
  }

  const slug = pathMatch[1];
  const supabase = await createClient();

  try {
    const result = await getPublicCommit(supabase, slug);

    if (!result) {
      return NextResponse.json(
        { error: "Commit not found or not published" },
        { status: 404 }
      );
    }

    const { commit, author } = result;

    // Calculate embed dimensions
    const width = Math.min(maxWidth, 600);
    const height = Math.min(maxHeight, 400);

    // Get title
    const title = commit.title || getFirstUserMessage(commit) || "Untitled Conversation";

    // Build oEmbed response
    const oembedResponse = {
      version: "1.0",
      type: "rich",
      provider_name: "CogCommit",
      provider_url: "https://cogcommit.com",
      title,
      author_name: author.username,
      author_url: `https://cogcommit.com/u/${author.username}`,
      width,
      height,
      html: `<iframe src="https://cogcommit.com/embed/${slug}?view=card&theme=dark" width="${width}" height="200" frameborder="0" style="border-radius: 8px; overflow: hidden;"></iframe>`,
      thumbnail_url: `https://cogcommit.com/c/${slug}/opengraph-image`,
      thumbnail_width: 1200,
      thumbnail_height: 630,
    };

    return NextResponse.json(oembedResponse, {
      headers: {
        "Content-Type": "application/json+oembed",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("oEmbed error:", error);
    return NextResponse.json(
      { error: "Failed to fetch commit data" },
      { status: 500 }
    );
  }
}

function getFirstUserMessage(commit: {
  sessions?: Array<{ turns?: Array<{ role?: string; content?: string | null }> }>;
}): string | null {
  if (!commit.sessions) return null;
  for (const session of commit.sessions) {
    if (!session.turns) continue;
    for (const turn of session.turns) {
      if (turn.role === "user" && turn.content) {
        const content = turn.content.trim();
        return content.length > 100 ? content.substring(0, 100) + "..." : content;
      }
    }
  }
  return null;
}
