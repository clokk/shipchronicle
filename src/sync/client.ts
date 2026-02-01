/**
 * Supabase client wrapper for cloud sync
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import type { AuthTokens, UserProfile } from "./types";

// Supabase project configuration
// These will be set during project setup
const SUPABASE_URL = process.env.AGENTLOGS_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.AGENTLOGS_SUPABASE_ANON_KEY || "";

const AUTH_FILE = "auth.json";

/**
 * Get the auth file path
 */
export function getAuthFilePath(): string {
  const home = process.env.HOME || "";
  return path.join(home, ".agentlogs", AUTH_FILE);
}

/**
 * Load stored auth tokens
 */
export function loadAuthTokens(): AuthTokens | null {
  const authPath = getAuthFilePath();

  if (!fs.existsSync(authPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(authPath, "utf-8");
    const tokens = JSON.parse(content) as AuthTokens;

    // Check if token is expired
    if (tokens.expiresAt && Date.now() > tokens.expiresAt) {
      return null;
    }

    return tokens;
  } catch {
    return null;
  }
}

/**
 * Save auth tokens
 */
export function saveAuthTokens(tokens: AuthTokens): void {
  const authPath = getAuthFilePath();
  const authDir = path.dirname(authPath);

  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  fs.writeFileSync(authPath, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

/**
 * Clear stored auth tokens
 */
export function clearAuthTokens(): void {
  const authPath = getAuthFilePath();

  if (fs.existsSync(authPath)) {
    fs.unlinkSync(authPath);
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return loadAuthTokens() !== null;
}

/**
 * Get current user profile
 */
export function getCurrentUser(): UserProfile | null {
  const tokens = loadAuthTokens();
  return tokens?.user || null;
}

/**
 * Supabase client singleton
 */
let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create Supabase client
 */
export function getSupabaseClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase not configured. Set AGENTLOGS_SUPABASE_URL and AGENTLOGS_SUPABASE_ANON_KEY environment variables."
    );
  }

  if (!supabaseClient) {
    const tokens = loadAuthTokens();

    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: tokens
          ? { Authorization: `Bearer ${tokens.accessToken}` }
          : {},
      },
    });
  }

  return supabaseClient;
}

/**
 * Get authenticated Supabase client (throws if not authenticated)
 */
export function getAuthenticatedClient(): SupabaseClient {
  const tokens = loadAuthTokens();

  if (!tokens) {
    throw new Error("Not authenticated. Run 'agentlogs login' first.");
  }

  return getSupabaseClient();
}

/**
 * Reset client (for testing or after logout)
 */
export function resetClient(): void {
  supabaseClient = null;
}

/**
 * Check if cloud sync is available
 */
export function isCloudAvailable(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Get a unique machine ID for this device
 */
export function getMachineId(): string {
  const home = process.env.HOME || "";
  const machineIdPath = path.join(home, ".agentlogs", "machine-id");

  if (fs.existsSync(machineIdPath)) {
    return fs.readFileSync(machineIdPath, "utf-8").trim();
  }

  // Generate a new machine ID
  const machineId = `${process.platform}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

  const machineIdDir = path.dirname(machineIdPath);
  if (!fs.existsSync(machineIdDir)) {
    fs.mkdirSync(machineIdDir, { recursive: true });
  }

  fs.writeFileSync(machineIdPath, machineId);
  return machineId;
}
