"use client";

import type { CognitiveCommit } from "@cogcommit/types";

interface EmbedCardViewProps {
  commit: CognitiveCommit;
  author: { username: string; avatarUrl?: string };
  showAuthor: boolean;
  slug: string;
}

function getFirstUserMessage(commit: CognitiveCommit): string | null {
  for (const session of commit.sessions || []) {
    for (const turn of session.turns || []) {
      if (turn.role === "user" && turn.content) {
        const content = turn.content.trim();
        return content.length > 120 ? content.substring(0, 120) + "..." : content;
      }
    }
  }
  return null;
}

export default function EmbedCardView({
  commit,
  author,
  showAuthor,
  slug,
}: EmbedCardViewProps) {
  const hasGitHash = !!commit.gitHash;
  const turnCount =
    commit.sessions?.reduce((sum, s) => sum + (s.turns?.length || 0), 0) || 0;
  const title = commit.title || getFirstUserMessage(commit) || "Untitled";

  const handleClick = () => {
    window.open(`https://cogcommit.com/c/${slug}`, "_blank");
  };

  return (
    <div
      onClick={handleClick}
      style={{
        backgroundColor: "var(--embed-panel)",
        border: "1px solid var(--embed-border)",
        borderRadius: 8,
        cursor: "pointer",
        overflow: "hidden",
        height: 200,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          height: 4,
          backgroundColor: hasGitHash ? "var(--embed-green)" : "var(--embed-amber)",
        }}
      />

      {/* Content */}
      <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          {hasGitHash ? (
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 12,
                color: "var(--embed-green)",
              }}
            >
              [{commit.gitHash!.substring(0, 7)}]
            </span>
          ) : (
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 12,
                color: "var(--embed-amber)",
              }}
            >
              [uncommitted]
            </span>
          )}
          <span
            style={{
              fontSize: 11,
              padding: "2px 6px",
              borderRadius: 4,
              backgroundColor: "var(--embed-green)",
              color: "var(--embed-bg)",
              fontWeight: 500,
            }}
          >
            Public
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--embed-primary)",
            lineHeight: 1.4,
            flex: 1,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {title}
        </div>

        {/* Stats */}
        <div
          style={{
            fontSize: 12,
            color: "var(--embed-muted)",
            marginTop: 8,
          }}
        >
          {turnCount} prompts
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid var(--embed-border)",
          }}
        >
          {showAuthor && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {author.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={author.avatarUrl}
                  alt=""
                  style={{ width: 20, height: 20, borderRadius: 10 }}
                />
              ) : (
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: "var(--embed-bg)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 500,
                    color: "var(--embed-primary)",
                  }}
                >
                  {author.username[0]?.toUpperCase() || "U"}
                </div>
              )}
              <span style={{ fontSize: 12, color: "var(--embed-muted)" }}>
                @{author.username}
              </span>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--embed-subtle)",
              }}
            >
              CogCommit
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
