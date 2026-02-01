/**
 * Visual sync for screenshots and other media
 */

import * as fs from "fs";
import * as path from "path";
import { getAuthenticatedClient, loadAuthTokens, isAuthenticated } from "./client";
import { AgentlogsDB } from "../storage/db";

// Cache TTL for downloaded visuals (24 hours)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface VisualInfo {
  id: string;
  commitId: string;
  type: string;
  localPath: string;
  cloudUrl: string | null;
  capturedAt: string;
  caption: string | null;
}

/**
 * Upload a visual to cloud storage
 */
export async function uploadVisual(
  db: AgentlogsDB,
  visualId: string
): Promise<string | null> {
  const tokens = loadAuthTokens();
  if (!tokens) {
    throw new Error("Not authenticated");
  }

  const visual = db.getVisual(visualId);
  if (!visual) {
    throw new Error(`Visual not found: ${visualId}`);
  }

  if (visual.cloudUrl) {
    return visual.cloudUrl; // Already uploaded
  }

  if (!fs.existsSync(visual.path)) {
    throw new Error(`Local file not found: ${visual.path}`);
  }

  const supabase = getAuthenticatedClient();
  const fileBuffer = fs.readFileSync(visual.path);
  const ext = path.extname(visual.path) || ".png";
  const fileName = `${tokens.user.id}/${visual.commitId}/${visual.id}${ext}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from("visuals")
    .upload(fileName, fileBuffer, {
      contentType: getMimeType(ext),
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("visuals")
    .getPublicUrl(fileName);

  const cloudUrl = urlData.publicUrl;

  // Update database records
  db.updateVisualCloudUrl(visual.id, cloudUrl);

  // Update cloud record
  await supabase.from("visuals").upsert(
    {
      id: visual.id,
      commit_id: visual.commitId,
      type: visual.type,
      path: visual.path,
      cloud_url: cloudUrl,
      captured_at: visual.capturedAt,
      caption: visual.caption,
      version: 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  return cloudUrl;
}

/**
 * Download a visual from cloud storage
 */
export async function downloadVisual(
  cloudUrl: string,
  localPath: string
): Promise<void> {
  if (!isAuthenticated()) {
    throw new Error("Not authenticated");
  }

  const supabase = getAuthenticatedClient();

  // Extract path from URL
  const urlPath = cloudUrl.replace(/^.*\/visuals\//, "");

  const { data, error } = await supabase.storage
    .from("visuals")
    .download(urlPath);

  if (error) {
    throw new Error(`Download failed: ${error.message}`);
  }

  // Ensure directory exists
  const dir = path.dirname(localPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write file
  const buffer = Buffer.from(await data.arrayBuffer());
  fs.writeFileSync(localPath, buffer);
}

/**
 * Get a visual, downloading from cloud if necessary
 */
export async function getVisual(
  db: AgentlogsDB,
  visualId: string
): Promise<{ path: string; fromCloud: boolean }> {
  const visual = db.getVisual(visualId);
  if (!visual) {
    throw new Error(`Visual not found: ${visualId}`);
  }

  // Check if local file exists and is not stale
  if (fs.existsSync(visual.path)) {
    const stats = fs.statSync(visual.path);
    const age = Date.now() - stats.mtimeMs;

    if (age < CACHE_TTL_MS) {
      return { path: visual.path, fromCloud: false };
    }
  }

  // Try to download from cloud
  if (visual.cloudUrl && isAuthenticated()) {
    await downloadVisual(visual.cloudUrl, visual.path);
    return { path: visual.path, fromCloud: true };
  }

  // No local file and can't download
  if (!fs.existsSync(visual.path)) {
    throw new Error(`Visual not available: ${visualId}`);
  }

  return { path: visual.path, fromCloud: false };
}

/**
 * Sync all visuals for a commit
 */
export async function syncVisualsForCommit(
  db: AgentlogsDB,
  commitId: string,
  direction: "push" | "pull" | "both" = "both"
): Promise<{ uploaded: number; downloaded: number; errors: string[] }> {
  const result = { uploaded: 0, downloaded: 0, errors: [] as string[] };

  if (!isAuthenticated()) {
    result.errors.push("Not authenticated");
    return result;
  }

  const visuals = db.getVisuals(commitId);

  for (const visual of visuals) {
    try {
      const hasLocalFile = fs.existsSync(visual.path);
      const hasCloudUrl = !!visual.cloudUrl;

      if (direction === "push" || direction === "both") {
        if (hasLocalFile && !hasCloudUrl) {
          await uploadVisual(db, visual.id);
          result.uploaded++;
        }
      }

      if (direction === "pull" || direction === "both") {
        if (!hasLocalFile && hasCloudUrl) {
          await downloadVisual(visual.cloudUrl!, visual.path);
          result.downloaded++;
        }
      }
    } catch (error) {
      result.errors.push(`Visual ${visual.id}: ${(error as Error).message}`);
    }
  }

  return result;
}

/**
 * Clean up old cached visuals
 */
export function cleanupVisualCache(db: AgentlogsDB, maxAgeDays = 30): number {
  const home = process.env.HOME || "";
  const cacheDir = path.join(home, ".agentlogs", "visual-cache");

  if (!fs.existsSync(cacheDir)) {
    return 0;
  }

  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let cleaned = 0;

  const files = fs.readdirSync(cacheDir, { recursive: true });
  for (const file of files) {
    const filePath = path.join(cacheDir, file as string);
    try {
      const stats = fs.statSync(filePath);
      if (stats.isFile() && now - stats.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    } catch {
      // Ignore errors
    }
  }

  return cleaned;
}

/**
 * Get MIME type from extension
 */
function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  };

  return mimeTypes[ext.toLowerCase()] || "application/octet-stream";
}

/**
 * Check if visuals need syncing
 */
export function getVisualSyncStatus(
  db: AgentlogsDB,
  commitId: string
): { pending: number; synced: number; missing: number } {
  const visuals = db.getVisuals(commitId);

  let pending = 0;
  let synced = 0;
  let missing = 0;

  for (const visual of visuals) {
    const hasLocalFile = fs.existsSync(visual.path);
    const hasCloudUrl = !!visual.cloudUrl;

    if (hasLocalFile && hasCloudUrl) {
      synced++;
    } else if (hasLocalFile && !hasCloudUrl) {
      pending++;
    } else if (!hasLocalFile && hasCloudUrl) {
      pending++;
    } else {
      missing++;
    }
  }

  return { pending, synced, missing };
}
