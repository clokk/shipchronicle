/**
 * Project detection utilities
 *
 * Detects the "primary" project from file operations in a Claude session,
 * rather than relying solely on the Claude session storage path.
 */

/**
 * Extract project name from an absolute file path
 * /Users/connorleisz/cogcommit/src/foo.ts → "cogcommit"
 * /home/user/myproject/file.js → "myproject"
 */
export function extractProjectFromPath(filePath: string): string | null {
  const home = process.env.HOME || "";
  if (!home || !filePath.startsWith(home)) return null;

  // Get path relative to home: "cogcommit/src/foo.ts"
  const relativePath = filePath.slice(home.length + 1);
  const firstSegment = relativePath.split("/")[0];

  if (!firstSegment) return null;

  // Skip hidden directories
  if (firstSegment.startsWith(".")) {
    return null;
  }

  // Skip common non-project paths
  const nonProjectDirs = [
    "Library",
    "Applications",
    "Downloads",
    "Documents",
    "Desktop",
    "Pictures",
    "Music",
    "Movies",
    "Public",
    "tmp",
  ];

  if (nonProjectDirs.includes(firstSegment)) {
    return null;
  }

  return firstSegment;
}

/**
 * Detect primary project from file operations
 *
 * Scoring:
 * - File reads: 1 point each
 * - File edits/writes: 3 points each
 *
 * Returns the project with the highest score, or fallback if no file ops.
 */
export function detectPrimaryProject(
  filesRead: string[],
  filesChanged: string[],
  fallbackProject: string
): string {
  const projectScores = new Map<string, number>();

  // Score reads (1 point each)
  for (const filePath of filesRead) {
    const project = extractProjectFromPath(filePath);
    if (project) {
      projectScores.set(project, (projectScores.get(project) || 0) + 1);
    }
  }

  // Score edits/writes (3 points each)
  for (const filePath of filesChanged) {
    const project = extractProjectFromPath(filePath);
    if (project) {
      projectScores.set(project, (projectScores.get(project) || 0) + 3);
    }
  }

  // No file operations - use fallback
  if (projectScores.size === 0) {
    return fallbackProject;
  }

  // Find highest scoring project
  let maxScore = 0;
  let primaryProject = fallbackProject;

  for (const [project, score] of projectScores) {
    if (score > maxScore) {
      maxScore = score;
      primaryProject = project;
    }
  }

  return primaryProject;
}
