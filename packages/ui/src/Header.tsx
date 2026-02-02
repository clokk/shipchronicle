"use client";

import React from "react";
import { UsageLimitBar } from "./UsageLimitBar";
import { StatsPopover } from "./StatsPopover";
import type { UsageData, WeeklySummaryStats } from "@cogcommit/types";

interface ProjectListItem {
  name: string;
  count: number;
}

interface HeaderProps {
  projectName: string;
  isGlobal?: boolean;
  stats?: {
    commitCount: number;
    totalTurns: number;
  };
  // Global mode props
  projects?: ProjectListItem[];
  totalCount?: number;
  selectedProject?: string | null;
  onSelectProject?: (project: string | null) => void;
  // Web dashboard auth props (optional - not used in local dashboard)
  user?: {
    userName: string;
    avatarUrl?: string;
  };
  homeHref?: string;
  settingsHref?: string;
  // Usage limits
  usage?: UsageData | null;
  usageLoading?: boolean;
  // Weekly summary stats
  weeklySummary?: WeeklySummaryStats | null;
}

export default function Header({
  projectName,
  isGlobal,
  stats,
  projects,
  totalCount,
  selectedProject,
  onSelectProject,
  user,
  homeHref,
  settingsHref,
  usage,
  usageLoading,
  weeklySummary,
}: HeaderProps) {
  return (
    <header className="bg-bg border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {homeHref && (
            <a href={homeHref} className="text-xl font-bold text-primary hover:text-chronicle-blue transition-colors">
              CogCommit
            </a>
          )}
          <h1 className="text-xl font-semibold text-chronicle-blue">
            {homeHref ? projectName : `Studio: ${projectName}`}
          </h1>

          {/* Project filter dropdown (global mode only) */}
          {isGlobal && projects && projects.length > 0 && onSelectProject && (
            <div className="relative">
              <select
                value={selectedProject || ""}
                onChange={(e) => onSelectProject(e.target.value || null)}
                className="appearance-none bg-panel border border-border rounded-lg px-3 py-1.5 pr-8 text-sm text-primary focus:border-chronicle-blue focus:outline-none cursor-pointer"
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({p.count})
                  </option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>
          )}

          {/* Stats popover */}
          <StatsPopover stats={stats} weeklySummary={weeklySummary} />
        </div>

        {/* Usage limits */}
        {usage !== undefined && (
          <UsageLimitBar
            usage={usage}
            loading={usageLoading}
            minimal={!!user}
            compact={!user}
            upgradeHref={user ? "/dashboard/settings" : undefined}
          />
        )}

        {/* User section (web dashboard only) */}
        {user && (
          <div className="flex items-center gap-4">
            <a
              href={settingsHref || "/dashboard/settings"}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.userName}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-panel flex items-center justify-center text-sm font-medium text-primary">
                  {user.userName[0]?.toUpperCase() || "U"}
                </div>
              )}
              <span className="text-primary font-medium">{user.userName}</span>
            </a>
          </div>
        )}
      </div>
    </header>
  );
}
