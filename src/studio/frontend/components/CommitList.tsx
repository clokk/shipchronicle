import React from "react";
import { type CognitiveCommit } from "../api";
import CommitCard from "./CommitCard";

interface CommitListProps {
  commits: CognitiveCommit[];
  selectedCommitId: string | null;
  onSelectCommit: (id: string) => void;
  showProjectBadges?: boolean;
}

export default function CommitList({
  commits,
  selectedCommitId,
  onSelectCommit,
  showProjectBadges = false,
}: CommitListProps) {
  if (commits.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 p-4">
        No cognitive commits found.
        <br />
        Start the daemon to capture commits.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      {commits.map((commit) => (
        <CommitCard
          key={commit.id}
          commit={commit}
          isSelected={selectedCommitId === commit.id}
          onClick={() => onSelectCommit(commit.id)}
          showProjectBadge={showProjectBadges}
        />
      ))}
    </div>
  );
}
