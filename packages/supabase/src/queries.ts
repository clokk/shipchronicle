/**
 * Supabase query functions for fetching commits, sessions, and turns
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CognitiveCommit, DbCommit, DbSession, DbTurn } from "@cogcommit/types";
import {
  transformCommit,
  transformSession,
  transformTurn,
  type DbCommitWithRelations,
  transformCommitWithRelations,
} from "./transforms";

/**
 * Options for fetching commits
 */
export interface GetCommitsOptions {
  /** User ID to filter by (required for RLS) */
  userId?: string;
  /** Project name to filter by */
  projectName?: string;
  /** Only include non-hidden commits */
  excludeHidden?: boolean;
  /** Number of commits to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Order by field */
  orderBy?: "closed_at" | "started_at" | "updated_at";
  /** Order direction */
  orderDirection?: "asc" | "desc";
}

/**
 * Fetch commits from Supabase
 */
export async function getCommits(
  client: SupabaseClient,
  options: GetCommitsOptions = {}
): Promise<CognitiveCommit[]> {
  const {
    userId,
    projectName,
    excludeHidden = true,
    limit = 50,
    offset = 0,
    orderBy = "closed_at",
    orderDirection = "desc",
  } = options;

  let query = client
    .from("cognitive_commits")
    .select(
      `
      *,
      sessions (
        *,
        turns (*)
      )
    `
    )
    .is("deleted_at", null)
    .order(orderBy, { ascending: orderDirection === "asc" })
    .range(offset, offset + limit - 1);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  if (projectName) {
    query = query.eq("project_name", projectName);
  }

  if (excludeHidden) {
    query = query.eq("hidden", false);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch commits: ${error.message}`);
  }

  if (!data) {
    return [];
  }

  // Transform the nested data
  return (data as DbCommitWithRelations[]).map(transformCommitWithRelations);
}

/**
 * Fetch a single commit by ID with all nested data
 */
export async function getCommit(
  client: SupabaseClient,
  commitId: string
): Promise<CognitiveCommit | null> {
  const { data, error } = await client
    .from("cognitive_commits")
    .select(
      `
      *,
      sessions (
        *,
        turns (*)
      )
    `
    )
    .eq("id", commitId)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // Not found
      return null;
    }
    throw new Error(`Failed to fetch commit: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return transformCommitWithRelations(data as DbCommitWithRelations);
}

/**
 * Fetch commits count
 */
export async function getCommitsCount(
  client: SupabaseClient,
  options: Omit<GetCommitsOptions, "limit" | "offset"> = {}
): Promise<number> {
  const { userId, projectName, excludeHidden = true } = options;

  let query = client
    .from("cognitive_commits")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  if (projectName) {
    query = query.eq("project_name", projectName);
  }

  if (excludeHidden) {
    query = query.eq("hidden", false);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to count commits: ${error.message}`);
  }

  return count ?? 0;
}

/**
 * Fetch unique project names for a user
 */
export async function getProjectNames(
  client: SupabaseClient,
  userId?: string
): Promise<string[]> {
  let query = client
    .from("cognitive_commits")
    .select("project_name")
    .is("deleted_at", null)
    .not("project_name", "is", null);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch project names: ${error.message}`);
  }

  if (!data) {
    return [];
  }

  // Get unique project names
  const uniqueNames = new Set(
    data
      .map((row) => row.project_name as string)
      .filter((name): name is string => name !== null)
  );

  return Array.from(uniqueNames).sort();
}

/**
 * Update a commit
 */
export async function updateCommit(
  client: SupabaseClient,
  commitId: string,
  updates: Partial<{
    title: string | null;
    published: boolean;
    hidden: boolean;
    displayOrder: number;
  }>
): Promise<CognitiveCommit> {
  const dbUpdates: Partial<DbCommit> = {};

  if (updates.title !== undefined) {
    dbUpdates.title = updates.title;
  }
  if (updates.published !== undefined) {
    dbUpdates.published = updates.published;
  }
  if (updates.hidden !== undefined) {
    dbUpdates.hidden = updates.hidden;
  }
  if (updates.displayOrder !== undefined) {
    dbUpdates.display_order = updates.displayOrder;
  }

  const { data, error } = await client
    .from("cognitive_commits")
    .update(dbUpdates)
    .eq("id", commitId)
    .select(
      `
      *,
      sessions (
        *,
        turns (*)
      )
    `
    )
    .single();

  if (error) {
    throw new Error(`Failed to update commit: ${error.message}`);
  }

  return transformCommitWithRelations(data as DbCommitWithRelations);
}

/**
 * Soft delete a commit (sets deleted_at)
 */
export async function deleteCommit(
  client: SupabaseClient,
  commitId: string
): Promise<void> {
  const { error } = await client
    .from("cognitive_commits")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commitId);

  if (error) {
    throw new Error(`Failed to delete commit: ${error.message}`);
  }
}

/**
 * Get the current user's profile
 */
export async function getUserProfile(
  client: SupabaseClient
): Promise<{ id: string; githubUsername: string } | null> {
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data, error } = await client
    .from("user_profiles")
    .select("id, github_username")
    .eq("id", user.id)
    .single();

  if (error) {
    // Profile might not exist yet
    return null;
  }

  return {
    id: data.id,
    githubUsername: data.github_username,
  };
}
