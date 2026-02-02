"use client";

import React from "react";
import type { UsageData } from "@cogcommit/types";

interface UsageLimitBarProps {
  usage: UsageData | null;
  loading?: boolean;
  compact?: boolean;
  /** Minimal mode: single 16px bar with tooltip showing breakdown */
  minimal?: boolean;
  upgradeHref?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getBarColor(pct: number): string {
  if (pct >= 90) return "bg-red-500";
  if (pct >= 75) return "bg-chronicle-amber";
  return "bg-chronicle-blue";
}

export function UsageLimitBar({ usage, loading, compact, minimal, upgradeHref }: UsageLimitBarProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 animate-pulse">
        <div className="h-4 w-24 bg-subtle/40 rounded" />
        <div className="h-1.5 w-16 bg-subtle/40 rounded-full" />
      </div>
    );
  }

  if (!usage) return null;

  const commitPct = Math.min((usage.commitCount / usage.commitLimit) * 100, 100);
  const storagePct = Math.min((usage.storageUsedBytes / usage.storageLimitBytes) * 100, 100);
  const showUpgrade = (commitPct >= 80 || storagePct >= 80) && usage.tier === "free";
  const higherPct = Math.max(commitPct, storagePct);

  // Minimal mode: single narrow bar with tooltip
  if (minimal) {
    return (
      <div className="flex items-center gap-2">
        <div
          className="w-4 h-4 bg-subtle/30 rounded overflow-hidden flex items-end"
          title={`Commits: ${usage.commitCount}/${usage.commitLimit} · Storage: ${formatBytes(usage.storageUsedBytes)}/${formatBytes(usage.storageLimitBytes)}`}
        >
          <div
            className={`w-full ${getBarColor(higherPct)}`}
            style={{ height: `${higherPct}%` }}
          />
        </div>
        <span className="text-xs text-muted">{Math.round(higherPct)}%</span>
        {showUpgrade && upgradeHref && (
          <a href={upgradeHref} className="text-xs text-chronicle-blue hover:underline">
            Upgrade
          </a>
        )}
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className="flex items-center gap-2"
        title={`${usage.commitCount}/${usage.commitLimit} commits • ${formatBytes(usage.storageUsedBytes)}/${formatBytes(usage.storageLimitBytes)}`}
      >
        <div className="w-16 h-1.5 bg-subtle/30 rounded-full overflow-hidden">
          <div className={`h-full ${getBarColor(higherPct)}`} style={{ width: `${higherPct}%` }} />
        </div>
        <span className="text-xs text-muted">{Math.round(higherPct)}%</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 px-3 py-1.5 bg-panel/50 rounded-lg text-xs">
      <div className="flex items-center gap-2">
        <span className="text-muted">{usage.commitCount}/{usage.commitLimit}</span>
        <div className="w-14 h-1.5 bg-subtle/30 rounded-full overflow-hidden">
          <div className={`h-full ${getBarColor(commitPct)}`} style={{ width: `${commitPct}%` }} />
        </div>
        <span className="text-muted">commits</span>
      </div>
      <span className="text-subtle">•</span>
      <div className="flex items-center gap-2">
        <span className="text-muted">{formatBytes(usage.storageUsedBytes)}/{formatBytes(usage.storageLimitBytes)}</span>
        <div className="w-14 h-1.5 bg-subtle/30 rounded-full overflow-hidden">
          <div className={`h-full ${getBarColor(storagePct)}`} style={{ width: `${storagePct}%` }} />
        </div>
      </div>
      {showUpgrade && upgradeHref && (
        <a href={upgradeHref} className="text-chronicle-blue hover:underline ml-2">Upgrade</a>
      )}
    </div>
  );
}
