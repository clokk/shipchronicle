"use client";

import React, { useState, useRef, useEffect } from "react";
import type { WeeklySummaryStats } from "@cogcommit/types";

interface StatsPopoverProps {
  stats?: {
    commitCount: number;
    totalTurns: number;
  };
  weeklySummary?: WeeklySummaryStats | null;
}

/**
 * StatsPopover - Clickable trigger that opens a popover with stats breakdown
 *
 * Displays weekly activity as trigger, expands to show full stats on click.
 * Hidden if no weekly activity (0 commits this week).
 */
export function StatsPopover({ stats, weeklySummary }: StatsPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Hide if no weekly activity
  if (!weeklySummary || weeklySummary.weeklyCommitCount === 0) {
    return null;
  }

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 text-sm text-muted hover:text-primary transition-colors rounded hover:bg-panel"
      >
        {/* Small chart icon */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        <span>{weeklySummary.weeklyCommitCount} this week</span>
        {/* Chevron */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute top-full left-0 mt-1 bg-panel border border-border rounded-lg shadow-lg z-50 min-w-[200px]"
        >
          {/* This Week section */}
          <div className="p-3">
            <div className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
              This Week
            </div>
            <div className="text-sm text-primary">
              {weeklySummary.weeklyCommitCount} commits · {weeklySummary.weeklyPromptCount.toLocaleString()} prompts
            </div>
            <div className="text-xs text-muted mt-1">
              avg {weeklySummary.avgPromptsPerCommit.toFixed(1)} prompts/commit
            </div>
          </div>

          {/* Divider */}
          {stats && (
            <>
              <div className="border-t border-border" />

              {/* All Time section */}
              <div className="p-3">
                <div className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
                  All Time
                </div>
                <div className="text-sm text-primary">
                  {stats.commitCount.toLocaleString()} commits · {stats.totalTurns.toLocaleString()} prompts
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default StatsPopover;
