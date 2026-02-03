"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import type { CommitAnalytics } from "@cogcommit/types";

export interface AnalyticsPopoverProps {
  commitId: string;
  /** Quick display before full load */
  viewCount?: number;
  /** Callback to load full analytics data */
  onLoadAnalytics?: (commitId: string) => Promise<CommitAnalytics>;
}

/**
 * Analytics popover showing view stats for a published commit
 *
 * - Eye icon trigger with view count badge
 * - Popover shows total/unique views, time-based stats, referrers, devices
 * - Loading state with shimmer effect
 * - Only shown for published commits
 */
export function AnalyticsPopover({
  commitId,
  viewCount,
  onLoadAnalytics,
}: AnalyticsPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [analytics, setAnalytics] = useState<CommitAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Load analytics when popover opens
  const loadAnalytics = useCallback(async () => {
    if (!onLoadAnalytics || analytics) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await onLoadAnalytics(commitId);
      setAnalytics(data);
    } catch (err) {
      console.error("Failed to load analytics:", err);
      setError("Failed to load analytics");
    } finally {
      setIsLoading(false);
    }
  }, [commitId, onLoadAnalytics, analytics]);

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    if (newState) {
      loadAnalytics();
    }
  };

  // Format number with commas
  const formatNumber = (n: number) => n.toLocaleString();

  // Get display view count
  const displayCount = analytics?.totalViews ?? viewCount ?? 0;

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger button */}
      <button
        onClick={handleToggle}
        className="px-2 py-1 text-xs text-muted hover:text-primary hover:bg-panel rounded transition-colors flex items-center gap-1.5"
        title="View analytics"
      >
        {/* Eye icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span>{formatNumber(displayCount)}</span>
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-panel border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-primary">View Analytics</h3>
          </div>

          {/* Content */}
          <div className="p-4">
            {isLoading ? (
              <AnalyticsShimmer />
            ) : error ? (
              <div className="text-xs text-red-400">{error}</div>
            ) : analytics ? (
              <div className="space-y-4">
                {/* Main stats */}
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    label="Total Views"
                    value={formatNumber(analytics.totalViews)}
                  />
                  <StatCard
                    label="Unique Visitors"
                    value={formatNumber(analytics.uniqueViewers)}
                  />
                  <StatCard
                    label="Today"
                    value={formatNumber(analytics.viewsToday)}
                  />
                  <StatCard
                    label="This Week"
                    value={formatNumber(analytics.viewsThisWeek)}
                  />
                </div>

                {/* Top referrers */}
                {analytics.topReferrers.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted mb-2">
                      Top Referrers
                    </h4>
                    <div className="space-y-1">
                      {analytics.topReferrers.map((ref) => (
                        <div
                          key={ref.domain}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-primary truncate max-w-[180px]">
                            {ref.domain}
                          </span>
                          <span className="text-muted">{formatNumber(ref.count)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Device breakdown */}
                {analytics.deviceBreakdown.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted mb-2">
                      Devices
                    </h4>
                    <div className="flex gap-3">
                      {analytics.deviceBreakdown.map((device) => (
                        <DeviceBadge
                          key={device.type}
                          type={device.type}
                          count={device.count}
                          total={analytics.totalViews}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* No data message */}
                {analytics.totalViews === 0 && (
                  <div className="text-xs text-muted text-center py-2">
                    No views yet
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted text-center py-2">
                No analytics available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-panel-alt rounded-lg px-3 py-2">
      <div className="text-lg font-semibold text-primary">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function DeviceBadge({
  type,
  count,
  total,
}: {
  type: "desktop" | "mobile" | "tablet";
  count: number;
  total: number;
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  const icons = {
    desktop: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    mobile: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12" y2="18" />
      </svg>
    ),
    tablet: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12" y2="18" />
      </svg>
    ),
  };

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted">
      {icons[type]}
      <span className="text-primary">{percentage}%</span>
    </div>
  );
}

function AnalyticsShimmer() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-panel-alt rounded-lg px-3 py-2">
            <div className="h-6 w-12 bg-border rounded mb-1" />
            <div className="h-3 w-16 bg-border rounded" />
          </div>
        ))}
      </div>
      <div>
        <div className="h-3 w-20 bg-border rounded mb-2" />
        <div className="space-y-1">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="h-3 w-24 bg-border rounded" />
              <div className="h-3 w-8 bg-border rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AnalyticsPopover;
