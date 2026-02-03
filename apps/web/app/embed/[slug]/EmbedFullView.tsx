"use client";

import type { CognitiveCommit, Turn } from "@cogcommit/types";
import { useState } from "react";

interface EmbedFullViewProps {
  commit: CognitiveCommit;
  author: { username: string; avatarUrl?: string };
  showAuthor: boolean;
  slug: string;
  height?: number;
}

function TurnContent({ turn }: { turn: Turn }) {
  const isUser = turn.role === "user";

  return (
    <div
      style={{
        padding: 12,
        backgroundColor: isUser ? "var(--embed-bg)" : "transparent",
        borderRadius: 8,
        marginBottom: 8,
      }}
    >
      {/* Role indicator */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          color: isUser ? "var(--embed-blue)" : "var(--embed-green)",
          marginBottom: 4,
        }}
      >
        {isUser ? "User" : "Assistant"}
      </div>

      {/* Content */}
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.5,
          color: "var(--embed-primary)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {turn.content || (
          <span style={{ color: "var(--embed-muted)", fontStyle: "italic" }}>
            [Tool calls only]
          </span>
        )}
      </div>

      {/* Tool calls indicator */}
      {turn.toolCalls && turn.toolCalls.length > 0 && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: "var(--embed-subtle)",
          }}
        >
          {turn.toolCalls.length} tool call{turn.toolCalls.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

export default function EmbedFullView({
  commit,
  author,
  showAuthor,
  slug,
  height = 400,
}: EmbedFullViewProps) {
  const hasGitHash = !!commit.gitHash;
  const turnCount =
    commit.sessions?.reduce((sum, s) => sum + (s.turns?.length || 0), 0) || 0;
  const title = commit.title || "Untitled";

  // Flatten all turns
  const allTurns: Turn[] = [];
  for (const session of commit.sessions || []) {
    for (const turn of session.turns || []) {
      allTurns.push(turn);
    }
  }

  const handleOpenFull = () => {
    window.open(`https://cogcommit.com/c/${slug}`, "_blank");
  };

  return (
    <div
      style={{
        backgroundColor: "var(--embed-panel)",
        border: "1px solid var(--embed-border)",
        borderRadius: 8,
        overflow: "hidden",
        height,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 12,
          borderBottom: "1px solid var(--embed-border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        {/* Accent dot */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: hasGitHash ? "var(--embed-green)" : "var(--embed-amber)",
          }}
        />

        {/* Title */}
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--embed-primary)",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </span>

        {/* Stats */}
        <span style={{ fontSize: 11, color: "var(--embed-muted)" }}>
          {turnCount} prompts
        </span>

        {/* Open full link */}
        <button
          onClick={handleOpenFull}
          style={{
            fontSize: 11,
            color: "var(--embed-blue)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px 8px",
            borderRadius: 4,
          }}
        >
          Open Full
        </button>
      </div>

      {/* Conversation */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 12,
        }}
      >
        {allTurns.map((turn) => (
          <TurnContent key={turn.id} turn={turn} />
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: 8,
          borderTop: "1px solid var(--embed-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          backgroundColor: "var(--embed-bg)",
        }}
      >
        {showAuthor && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {author.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={author.avatarUrl}
                alt=""
                style={{ width: 16, height: 16, borderRadius: 8 }}
              />
            ) : (
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: "var(--embed-panel)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 8,
                  fontWeight: 500,
                  color: "var(--embed-primary)",
                }}
              >
                {author.username[0]?.toUpperCase() || "U"}
              </div>
            )}
            <span style={{ fontSize: 11, color: "var(--embed-muted)" }}>
              @{author.username}
            </span>
          </div>
        )}

        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "var(--embed-subtle)",
          }}
        >
          Powered by CogCommit
        </span>
      </div>
    </div>
  );
}
