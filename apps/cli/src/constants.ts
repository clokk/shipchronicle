/**
 * Tuhnr CLI Constants
 *
 * Centralized constants used across the CLI application.
 */

// ============================================
// Sync Constants
// ============================================

/** Batch size for uploading turns to cloud */
export const SYNC_BATCH_SIZE = 200;

/** Number of parallel upload chunks */
export const SYNC_CONCURRENCY = 12;

/** UUID namespace for generating deterministic UUIDs */
export const COGCOMMIT_UUID_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

// ============================================
// OAuth Constants
// ============================================

/** Local port for OAuth callback server */
export const OAUTH_CALLBACK_PORT = 54321;

/** OAuth callback URL */
export const OAUTH_CALLBACK_URL = `http://localhost:${OAUTH_CALLBACK_PORT}/auth/callback`;

// ============================================
// Studio Constants
// ============================================

/** Default port for the studio dashboard */
export const STUDIO_DEFAULT_PORT = 4747;

// ============================================
// Server Detection Constants
// ============================================

/** Common development server ports to check */
export const COMMON_DEV_PORTS = [3000, 5173, 8080, 4321, 8000, 4200, 5000, 3001];
