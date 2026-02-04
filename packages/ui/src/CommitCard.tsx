"use client";

import React from "react";
import type { CognitiveCommit, CommitListItem, SentimentLabel } from "@cogcommit/types";
import { formatTime, getProjectColor } from "./utils/formatters";

// Sentiment badge configuration
const SENTIMENT_CONFIG: Record<
  SentimentLabel,
  { label: string; bg: string; text: string }
> = {
  smooth: {
    label: "smooth",
    bg: "bg-chronicle-green/20",
    text: "text-chronicle-green",
  },
  "some-iteration": {
    label: "some iteration",
    bg: "bg-chronicle-amber/20",
    text: "text-chronicle-amber",
  },
  struggled: {
    label: "struggled",
    bg: "bg-chronicle-red/20",
    text: "text-chronicle-red",
  },
};

// CommitCard accepts either full CognitiveCommit or lightweight CommitListItem
type CommitData = CognitiveCommit | CommitListItem;

interface CommitCardProps {
  commit: CommitData;
  isSelected?: boolean;
  onClick?: () => void;
  showProjectBadge?: boolean;
}

function hasFullData(commit: CommitData): commit is CognitiveCommit {
  return "sessions" in commit && Array.isArray(commit.sessions);
}

function getFirstUserMessage(commit: CommitData): string | null {
  if (!hasFullData(commit)) return null;
  for (const session of commit.sessions) {
    for (const turn of session.turns) {
      if (turn.role === "user" && turn.content) {
        const content = turn.content.trim();
        return content.length > 60 ? content.substring(0, 60) + "..." : content;
      }
    }
  }
  return null;
}

export default function CommitCard({
  commit,
  isSelected = false,
  onClick,
  showProjectBadge = false,
}: CommitCardProps) {
  const hasGitHash = !!commit.gitHash;
  const borderColor = hasGitHash
    ? "border-chronicle-green"
    : "border-chronicle-amber";
  const turnCount = commit.turnCount ?? (hasFullData(commit)
    ? commit.sessions.reduce((sum, s) => sum + s.turns.length, 0)
    : 0);
  const sessionCount = "sessionCount" in commit
    ? commit.sessionCount
    : (hasFullData(commit) ? commit.sessions.length : 0);
  const projectColor = commit.projectName
    ? getProjectColor(commit.projectName)
    : null;

  return (
    <div
      onClick={onClick}
      className={`relative rounded-lg p-3 cursor-pointer transition-all border-l-2 ${borderColor} ${
        isSelected
          ? "bg-panel/80 ring-1 ring-chronicle-blue/50"
          : "bg-bg/50 hover:bg-panel/50"
      }`}
    >
      <div className="flex-1 min-w-0">
        {/* Project badge (when showing all projects) */}
        {showProjectBadge && commit.projectName && projectColor && (
          <div className="mb-1">
            <span
              className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${projectColor.bg} ${projectColor.text}`}
              title={`Project: ${commit.projectName}`}
            >
              {commit.projectName}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Git hash or status */}
          {commit.gitHash ? (
            <span className="font-mono text-sm text-chronicle-green">
              [{commit.gitHash.substring(0, 7)}]
            </span>
          ) : (
            <span className="font-mono text-sm text-chronicle-amber">
              [uncommitted]
            </span>
          )}

          {/* Public indicator */}
          {commit.published && commit.publicSlug && (
            <span
              className="px-1.5 py-0.5 text-xs font-medium rounded bg-chronicle-green/20 text-chronicle-green"
              title="Public commit"
            >
              Public
            </span>
          )}

          {/* Parallel indicator */}
          {commit.parallel && (
            <span
              className="text-chronicle-purple text-xs"
              title="Parallel sessions"
            >
              ||
            </span>
          )}
        </div>

        {/* Title or first user message */}
        <div className="text-sm text-primary mt-1 truncate">
          {commit.title || getFirstUserMessage(commit) || "No content"}
        </div>

        {/* Stats with sentiment */}
        <div className="flex items-center gap-2 mt-1 text-xs text-muted flex-wrap">
          <span>{turnCount} prompts</span>
          {commit.rejectionCount !== undefined && commit.rejectionCount > 0 && (
            <>
              <span className="text-subtle">·</span>
              <span className="text-chronicle-red">
                {commit.rejectionCount} rejection{commit.rejectionCount !== 1 ? "s" : ""}
              </span>
            </>
          )}
          {commit.approvalCount !== undefined && commit.approvalCount > 0 && (
            <>
              <span className="text-subtle">·</span>
              <span className="text-chronicle-green">
                {commit.approvalCount} approval{commit.approvalCount !== 1 ? "s" : ""}
              </span>
            </>
          )}
          {/* Sentiment badge */}
          {commit.sentimentLabel && SENTIMENT_CONFIG[commit.sentimentLabel] && (
            <span
              className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                SENTIMENT_CONFIG[commit.sentimentLabel].bg
              } ${SENTIMENT_CONFIG[commit.sentimentLabel].text}`}
            >
              {SENTIMENT_CONFIG[commit.sentimentLabel].label}
            </span>
          )}
        </div>

        {/* Time */}
        <div className="text-xs text-subtle mt-1">
          {formatTime(commit.closedAt)}
        </div>
      </div>
    </div>
  );
}
