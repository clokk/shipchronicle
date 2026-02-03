import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { recordView, getCommitIdBySlug } from "@cogcommit/supabase/queries";

/**
 * Hash a string using SHA-256
 */
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Extract domain from referrer URL
 */
function extractDomain(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Detect device type from User-Agent string
 */
function detectDeviceType(userAgent: string | null): "desktop" | "mobile" | "tablet" {
  if (!userAgent) return "desktop";

  const ua = userAgent.toLowerCase();

  // Check for tablets first (iPad, Android tablets)
  if (
    ua.includes("ipad") ||
    (ua.includes("android") && !ua.includes("mobile"))
  ) {
    return "tablet";
  }

  // Check for mobile devices
  if (
    ua.includes("mobile") ||
    ua.includes("iphone") ||
    ua.includes("ipod") ||
    ua.includes("android") ||
    ua.includes("webos") ||
    ua.includes("blackberry") ||
    ua.includes("opera mini") ||
    ua.includes("iemobile")
  ) {
    return "mobile";
  }

  return "desktop";
}

/**
 * Record a view for a public commit
 *
 * POST /api/views
 * Body: { slug: string, referrer?: string, userAgent?: string }
 *
 * Privacy-conscious:
 * - Hashes IP + User-Agent for uniqueness (no PII stored)
 * - One view per visitor per day (unique constraint)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slug, referrer, userAgent } = body;

    if (!slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Get commit ID from slug
    const commitId = await getCommitIdBySlug(supabase, slug);
    if (!commitId) {
      // Silently fail - commit not found or not published
      return NextResponse.json({ success: true });
    }

    // Get IP from headers (for hashing only)
    const headersList = await headers();
    const forwardedFor = headersList.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";

    // Create visitor hash (IP + User-Agent)
    const visitorHash = await hashString(`${ip}:${userAgent || "unknown"}`);

    // Parse referrer domain
    const referrerDomain = extractDomain(referrer);

    // Detect device type
    const deviceType = detectDeviceType(userAgent);

    // Record the view
    await recordView(supabase, {
      commitId,
      visitorHash,
      referrerDomain,
      deviceType,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // Silently fail - view tracking should not break the page
    console.error("Failed to record view:", error);
    return NextResponse.json({ success: true });
  }
}
