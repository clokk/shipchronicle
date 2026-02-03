"use client";

import Link from "next/link";
import type { CognitiveCommit } from "@cogcommit/types";

interface ProfileCommitCardProps {
  commit: CognitiveCommit;
}

function getFirstUserMessage(commit: CognitiveCommit): string | null {
  for (const session of commit.sessions || []) {
    for (const turn of session.turns || []) {
      if (turn.role === "user" && turn.content) {
        const content = turn.content.trim();
        return content.length > 100 ? content.substring(0, 100) + "..." : content;
      }
    }
  }
  return null;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ProfileCommitCard({ commit }: ProfileCommitCardProps) {
  const hasGitHash = !!commit.gitHash;
  const turnCount = commit.sessions?.reduce(
    (sum, s) => sum + (s.turns?.length || 0),
    0
  ) || 0;
  const sessionCount = commit.sessions?.length || 0;
  const title = commit.title || getFirstUserMessage(commit) || "Untitled";

  return (
    <Link
      href={`/c/${commit.publicSlug}`}
      className="block rounded-lg border border-border bg-panel hover:bg-panel-alt transition-colors overflow-hidden"
    >
      {/* Accent bar */}
      <div
        className={`h-1 ${hasGitHash ? "bg-chronicle-green" : "bg-chronicle-amber"}`}
      />

      <div className="p-4">
        {/* Git hash */}
        <div className="flex items-center gap-2 mb-2">
          {hasGitHash ? (
            <span className="font-mono text-xs text-chronicle-green">
              [{commit.gitHash!.substring(0, 7)}]
            </span>
          ) : (
            <span className="font-mono text-xs text-chronicle-amber">
              [uncommitted]
            </span>
          )}
          {commit.parallel && (
            <span className="text-chronicle-purple text-xs" title="Parallel sessions">
              ||
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-sm font-medium text-primary line-clamp-2 mb-2">
          {title}
        </h3>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-muted">
          <span>{turnCount} prompts</span>
          <span className="text-subtle">·</span>
          <span>{sessionCount} session{sessionCount !== 1 ? "s" : ""}</span>
        </div>

        {/* Date */}
        <div className="text-xs text-subtle mt-2">
          {formatDate(commit.closedAt)}
        </div>
      </div>
    </Link>
  );
}
