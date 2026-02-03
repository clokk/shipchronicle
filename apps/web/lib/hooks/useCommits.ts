"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CognitiveCommit, CommitListItem, UsageData, WeeklySummaryStats, CommitAnalytics } from "@cogcommit/types";
import { useCallback } from "react";

interface ProjectListItem {
  name: string;
  count: number;
}

interface CommitListResponse {
  commits: CommitListItem[];
}

interface CommitDetailResponse {
  commit: CognitiveCommit;
}

// Query key factory for type-safe, consistent keys
export const commitKeys = {
  all: ["commits"] as const,
  lists: () => [...commitKeys.all, "list"] as const,
  list: (project?: string | null) =>
    [...commitKeys.lists(), { project: project ?? "all" }] as const,
  details: () => [...commitKeys.all, "detail"] as const,
  detail: (id: string) => [...commitKeys.details(), id] as const,
};

export const projectKeys = {
  all: ["projects"] as const,
};

export const usageKeys = {
  all: ["usage"] as const,
};

interface UseCommitListOptions {
  project?: string | null;
}

/**
 * Lightweight hook for fetching commit list data.
 * Returns only summary fields needed for sidebar display.
 * Use useCommitDetail for full commit data with sessions/turns.
 */
export function useCommitList({ project }: UseCommitListOptions = {}) {
  return useQuery({
    queryKey: commitKeys.list(project),
    queryFn: async (): Promise<CommitListItem[]> => {
      const url = project
        ? `/api/commits/list?project=${encodeURIComponent(project)}`
        : "/api/commits/list";
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Failed to fetch commits");
      }
      const data: CommitListResponse = await res.json();
      return data.commits;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook for fetching full commit details with sessions and turns.
 * Called lazily when a user selects a commit.
 */
export function useCommitDetail(commitId: string | null) {
  return useQuery({
    queryKey: commitKeys.detail(commitId ?? ""),
    queryFn: async (): Promise<CognitiveCommit | null> => {
      if (!commitId) return null;
      const res = await fetch(`/api/commits/${commitId}/detail`);
      if (!res.ok) {
        throw new Error("Failed to fetch commit detail");
      }
      const data: CommitDetailResponse = await res.json();
      return data.commit;
    },
    enabled: !!commitId,
    staleTime: 5 * 60 * 1000,
  });
}

interface UpdateTitleVariables {
  commitId: string;
  title: string | null;
}

interface PublishResult {
  slug: string;
  url: string;
}

/**
 * Mutation hook for updating commit titles with optimistic updates.
 * Uses targeted cache invalidation for better performance.
 */
export function useUpdateCommitTitle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commitId, title }: UpdateTitleVariables) => {
      const res = await fetch(`/api/commits/${commitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        throw new Error("Failed to update title");
      }
      return res.json();
    },
    // Optimistic update for both list and detail caches
    onMutate: async ({ commitId, title }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: commitKeys.lists() });
      await queryClient.cancelQueries({ queryKey: commitKeys.detail(commitId) });

      // Snapshot list queries for rollback
      const previousLists = queryClient.getQueriesData<CommitListItem[]>({
        queryKey: commitKeys.lists(),
      });

      // Snapshot detail query for rollback
      const previousDetail = queryClient.getQueryData<CognitiveCommit>(
        commitKeys.detail(commitId)
      );

      // Optimistically update list queries
      queryClient.setQueriesData<CommitListItem[]>(
        { queryKey: commitKeys.lists() },
        (old) => {
          if (!old) return old;
          return old.map((commit) =>
            commit.id === commitId
              ? { ...commit, title: title || undefined }
              : commit
          );
        }
      );

      // Optimistically update detail query
      if (previousDetail) {
        queryClient.setQueryData<CognitiveCommit>(
          commitKeys.detail(commitId),
          { ...previousDetail, title: title || undefined }
        );
      }

      return { previousLists, previousDetail, commitId };
    },
    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previousLists) {
        for (const [queryKey, data] of context.previousLists) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousDetail && context?.commitId) {
        queryClient.setQueryData(
          commitKeys.detail(context.commitId),
          context.previousDetail
        );
      }
    },
    // Targeted invalidation - only refetch the affected detail
    onSettled: (_, __, { commitId }) => {
      queryClient.invalidateQueries({
        queryKey: commitKeys.detail(commitId),
      });
      // Also invalidate lists to get updated title
      queryClient.invalidateQueries({
        queryKey: commitKeys.lists(),
      });
    },
  });
}

/**
 * Mutation hook for publishing a commit (making it publicly accessible)
 */
export function usePublishCommit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commitId: string): Promise<PublishResult> => {
      const res = await fetch(`/api/commits/${commitId}/publish`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to publish commit");
      }
      return res.json();
    },
    onMutate: async (commitId) => {
      await queryClient.cancelQueries({ queryKey: commitKeys.lists() });
      await queryClient.cancelQueries({ queryKey: commitKeys.detail(commitId) });

      const previousLists = queryClient.getQueriesData<CommitListItem[]>({
        queryKey: commitKeys.lists(),
      });

      const previousDetail = queryClient.getQueryData<CognitiveCommit>(
        commitKeys.detail(commitId)
      );

      // Optimistically update list queries
      queryClient.setQueriesData<CommitListItem[]>(
        { queryKey: commitKeys.lists() },
        (old) => {
          if (!old) return old;
          return old.map((commit) =>
            commit.id === commitId
              ? { ...commit, published: true, publishedAt: new Date().toISOString() }
              : commit
          );
        }
      );

      // Optimistically update detail query
      if (previousDetail) {
        queryClient.setQueryData<CognitiveCommit>(
          commitKeys.detail(commitId),
          { ...previousDetail, published: true, publishedAt: new Date().toISOString() }
        );
      }

      return { previousLists, previousDetail, commitId };
    },
    onError: (err, commitId, context) => {
      if (context?.previousLists) {
        for (const [queryKey, data] of context.previousLists) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousDetail && context?.commitId) {
        queryClient.setQueryData(
          commitKeys.detail(context.commitId),
          context.previousDetail
        );
      }
    },
    onSettled: (_, __, commitId) => {
      queryClient.invalidateQueries({ queryKey: commitKeys.detail(commitId) });
      queryClient.invalidateQueries({ queryKey: commitKeys.lists() });
    },
  });
}

/**
 * Mutation hook for unpublishing a commit (making it private again)
 */
export function useUnpublishCommit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commitId: string): Promise<void> => {
      const res = await fetch(`/api/commits/${commitId}/unpublish`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to unpublish commit");
      }
    },
    onMutate: async (commitId) => {
      await queryClient.cancelQueries({ queryKey: commitKeys.lists() });
      await queryClient.cancelQueries({ queryKey: commitKeys.detail(commitId) });

      const previousLists = queryClient.getQueriesData<CommitListItem[]>({
        queryKey: commitKeys.lists(),
      });

      const previousDetail = queryClient.getQueryData<CognitiveCommit>(
        commitKeys.detail(commitId)
      );

      // Optimistically update list queries
      queryClient.setQueriesData<CommitListItem[]>(
        { queryKey: commitKeys.lists() },
        (old) => {
          if (!old) return old;
          return old.map((commit) =>
            commit.id === commitId
              ? { ...commit, published: false }
              : commit
          );
        }
      );

      // Optimistically update detail query
      if (previousDetail) {
        queryClient.setQueryData<CognitiveCommit>(
          commitKeys.detail(commitId),
          { ...previousDetail, published: false }
        );
      }

      return { previousLists, previousDetail, commitId };
    },
    onError: (err, commitId, context) => {
      if (context?.previousLists) {
        for (const [queryKey, data] of context.previousLists) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousDetail && context?.commitId) {
        queryClient.setQueryData(
          commitKeys.detail(context.commitId),
          context.previousDetail
        );
      }
    },
    onSettled: (_, __, commitId) => {
      queryClient.invalidateQueries({ queryKey: commitKeys.detail(commitId) });
      queryClient.invalidateQueries({ queryKey: commitKeys.lists() });
    },
  });
}

interface ProjectsResponse {
  projects: ProjectListItem[];
  totalCount: number;
  weeklySummary?: WeeklySummaryStats;
}

/**
 * Hook for fetching projects list with React Query.
 */
export function useProjects() {
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: async (): Promise<ProjectsResponse> => {
      const res = await fetch("/api/projects");
      if (!res.ok) {
        throw new Error("Failed to fetch projects");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

interface UsageResponse {
  usage: UsageData;
}

/**
 * Hook for fetching user usage data (commit count, storage, limits).
 */
export function useUsage() {
  return useQuery({
    queryKey: usageKeys.all,
    queryFn: async (): Promise<UsageData> => {
      const res = await fetch("/api/usage");
      if (!res.ok) {
        throw new Error("Failed to fetch usage");
      }
      const data: UsageResponse = await res.json();
      return data.usage;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook that returns a function to load analytics for a commit.
 * Returns a stable callback that can be passed to ConversationViewer.
 */
export function useCommitAnalytics() {
  return useCallback(async (commitId: string): Promise<CommitAnalytics> => {
    const res = await fetch(`/api/commits/${commitId}/analytics`);
    if (!res.ok) {
      throw new Error("Failed to fetch analytics");
    }
    return res.json();
  }, []);
}

// ============================================
// Legacy hooks for backwards compatibility
// ============================================

interface CommitsResponse {
  commits: CognitiveCommit[];
}

interface UseCommitsOptions {
  initialData?: CognitiveCommit[];
  project?: string | null;
}

/**
 * @deprecated Use useCommitList for sidebar and useCommitDetail for selected commit.
 * This hook fetches all commit data which is inefficient.
 */
export function useCommits({ initialData, project }: UseCommitsOptions = {}) {
  return useQuery({
    queryKey: commitKeys.list(project),
    queryFn: async (): Promise<CognitiveCommit[]> => {
      const url = project
        ? `/api/commits?project=${encodeURIComponent(project)}`
        : "/api/commits";
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Failed to fetch commits");
      }
      const data: CommitsResponse = await res.json();
      return data.commits;
    },
    initialData,
    staleTime: 5 * 60 * 1000,
  });
}
