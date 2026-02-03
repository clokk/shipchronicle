"use client";

import { useEffect, useRef } from "react";

interface ViewTrackerProps {
  slug: string;
}

/**
 * Client component that records a view when mounted
 *
 * - Fires POST to /api/views on mount
 * - Sends slug, document.referrer, navigator.userAgent
 * - Silent failure - doesn't affect page if tracking fails
 * - Only fires once per component mount
 */
export default function ViewTracker({ slug }: ViewTrackerProps) {
  const hasFired = useRef(false);

  useEffect(() => {
    // Only fire once per mount
    if (hasFired.current) return;
    hasFired.current = true;

    // Fire and forget - don't await or handle errors
    fetch("/api/views", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slug,
        referrer: document.referrer || null,
        userAgent: navigator.userAgent || null,
      }),
    }).catch(() => {
      // Silent failure - view tracking should not affect user experience
    });
  }, [slug]);

  // This component renders nothing
  return null;
}
