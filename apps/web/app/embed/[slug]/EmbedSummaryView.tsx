"use client";

import type { CognitiveCommit } from "@cogcommit/types";

interface EmbedSummaryViewProps {
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
        return content.length > 80 ? content.substring(0, 80) + "..." : content;
      }
    }
  }
  return null;
}

export default function EmbedSummaryView({
  commit,
  author,
  showAuthor,
  slug,
}: EmbedSummaryViewProps) {
  const hasGitHash = !!commit.gitHash;
  const turnCount =
    commit.sessions?.reduce((sum, s) => sum + (s.turns?.length || 0), 0) || 0;
  const title = commit.title || "Untitled";
  const preview = getFirstUserMessage(commit);

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
        height: 120,
        display: "flex",
        flexDirection: "row",
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          width: 4,
          backgroundColor: hasGitHash ? "var(--embed-green)" : "var(--embed-amber)",
        }}
      />

      {/* Content */}
      <div
        style={{
          padding: 16,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--embed-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </span>
          <span
            style={{
              fontSize: 10,
              padding: "1px 4px",
              borderRadius: 3,
              backgroundColor: "var(--embed-green)",
              color: "var(--embed-bg)",
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            Public
          </span>
        </div>

        {/* Preview */}
        {preview && (
          <div
            style={{
              fontSize: 12,
              color: "var(--embed-muted)",
              marginTop: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {preview}
          </div>
        )}

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
            fontSize: 11,
            color: "var(--embed-subtle)",
          }}
        >
          {hasGitHash && (
            <span style={{ fontFamily: "monospace", color: "var(--embed-green)" }}>
              [{commit.gitHash!.substring(0, 7)}]
            </span>
          )}
          <span>{turnCount} prompts</span>
          {showAuthor && (
            <>
              <span>·</span>
              <span>@{author.username}</span>
            </>
          )}
        </div>
      </div>

      {/* Branding */}
      <div
        style={{
          padding: 16,
          display: "flex",
          alignItems: "center",
          borderLeft: "1px solid var(--embed-border)",
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "var(--embed-subtle)",
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
          }}
        >
          CogCommit
        </span>
      </div>
    </div>
  );
}
