import { createClient } from "@/lib/supabase/server";
import { getPublicCommit } from "@cogcommit/supabase/queries";
import { notFound } from "next/navigation";
import Link from "next/link";
import EmbedCardView from "./EmbedCardView";
import EmbedSummaryView from "./EmbedSummaryView";
import EmbedFullView from "./EmbedFullView";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    view?: "card" | "full" | "summary";
    theme?: "dark" | "light" | "auto";
    height?: string;
    showAuthor?: string;
  }>;
}

export default async function EmbedPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { view = "card", theme = "dark", height, showAuthor = "true" } = await searchParams;

  const supabase = await createClient();
  const result = await getPublicCommit(supabase, slug);

  if (!result) {
    notFound();
  }

  const { commit, author } = result;
  const showAuthorBool = showAuthor !== "false";
  const heightPx = height ? parseInt(height, 10) : undefined;

  // Theme class
  const themeClass = theme === "light" ? "embed-light" : "embed-dark";

  return (
    <div className={`embed-container ${themeClass}`}>
      <style>{`
        .embed-container {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          margin: 0;
          padding: 0;
        }
        .embed-dark {
          --embed-bg: #0d0b0a;
          --embed-panel: #181614;
          --embed-border: #2a2725;
          --embed-primary: #e8e4df;
          --embed-muted: #a39e97;
          --embed-subtle: #6b6660;
          --embed-green: #5fb88e;
          --embed-amber: #d4a030;
          --embed-blue: #7aa2f7;
        }
        .embed-light {
          --embed-bg: #ffffff;
          --embed-panel: #f8f8f8;
          --embed-border: #e0e0e0;
          --embed-primary: #1a1a1a;
          --embed-muted: #666666;
          --embed-subtle: #999999;
          --embed-green: #22c55e;
          --embed-amber: #f59e0b;
          --embed-blue: #3b82f6;
        }
      `}</style>

      {view === "card" && (
        <EmbedCardView
          commit={commit}
          author={author}
          showAuthor={showAuthorBool}
          slug={slug}
        />
      )}

      {view === "summary" && (
        <EmbedSummaryView
          commit={commit}
          author={author}
          showAuthor={showAuthorBool}
          slug={slug}
        />
      )}

      {view === "full" && (
        <EmbedFullView
          commit={commit}
          author={author}
          showAuthor={showAuthorBool}
          slug={slug}
          height={heightPx}
        />
      )}
    </div>
  );
}
