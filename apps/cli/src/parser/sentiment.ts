/**
 * Sentiment analysis for cognitive commits
 * Detects rejection and approval patterns in user messages
 */

import type { Turn, SentimentLabel } from "@cogcommit/types";

// Rejection patterns - each match indicates struggle/iteration
const REJECTION_PATTERNS: RegExp[] = [
  // Direct contradiction (careful with "no problem", "no worries")
  /\bno[,.]?\s+(that'?s\s+)?(not|wrong|incorrect)/i,
  /\b(wrong|incorrect)\b/i,
  /\bnot (right|correct)\b/i,

  // Undo/revert
  /\b(undo|revert|roll\s*back|go\s*back)\b/i,
  /\b(put|change)\s+it\s+back\b/i,

  // Retry requests
  /\btry\s+(again|that\s+again)\b/i,
  /\bone\s+more\s+time\b/i,

  // Correction markers
  /^(wait|actually)[,.\s]/i, // at start of message
  /\b(not\s+)?what\s+i\s+(meant|asked|wanted)\b/i,
  /\bmisunderstood\b/i,

  // Failure indicators
  /\b(doesn'?t|didn'?t|isn'?t|not)\s+work(ing)?\b/i,
  /\b(broke|broken)\b/i,
  /\bstill\s+(getting|seeing|having)\b/i,
  /\bsame\s+(error|issue|problem)\b/i,

  // Explicit rejection
  /\bdon'?t\s+do\s+that\b/i,
  /\b(remove|delete|get\s+rid\s+of)\s+that\b/i,
  /\bfix\s+(that|this|it)\b/i,
  /\bi\s+said\b/i,
  /\bwhy\s+did\s+you\b/i,
];

// Approval patterns - indicates success/satisfaction
const APPROVAL_PATTERNS: RegExp[] = [
  /\b(thanks|thank\s+you|thx)\b/i,
  /\b(perfect|excellent|awesome|amazing|great|nice)\b/i,
  /\b(looks?\s+good|lgtm)\b/i,
  /\b(that\s+)?works\b/i,
  /\b(exactly|love\s+it|ship\s+it)\b/i,
];

export interface SentimentResult {
  rejectionCount: number;
  approvalCount: number;
  promptCount: number;
  label: SentimentLabel;
}

/**
 * Check if a message matches any rejection pattern
 */
export function hasRejection(content: string): boolean {
  return REJECTION_PATTERNS.some((p) => p.test(content));
}

/**
 * Check if a message matches any approval pattern
 */
export function hasApproval(content: string): boolean {
  return APPROVAL_PATTERNS.some((p) => p.test(content));
}

/**
 * Analyze sentiment across all turns in a cognitive commit
 */
export function analyzeSentiment(turns: Turn[]): SentimentResult {
  const userTurns = turns.filter((t) => t.role === "user");
  const promptCount = userTurns.length;

  let rejectionCount = 0;
  let approvalCount = 0;

  for (const turn of userTurns) {
    const content = turn.content || "";
    if (hasRejection(content)) rejectionCount++;
    if (hasApproval(content)) approvalCount++;
  }

  // Label logic
  const ratio = promptCount > 0 ? rejectionCount / promptCount : 0;
  let label: SentimentLabel = "smooth";
  if (rejectionCount >= 3 || ratio > 0.3) {
    label = "struggled";
  } else if (rejectionCount >= 1) {
    label = "some-iteration";
  }

  return { rejectionCount, approvalCount, promptCount, label };
}

/**
 * Get sentiment label for display
 */
export function getSentimentLabel(
  rejectionCount: number,
  promptCount: number
): SentimentLabel {
  const ratio = promptCount > 0 ? rejectionCount / promptCount : 0;
  if (rejectionCount >= 3 || ratio > 0.3) {
    return "struggled";
  } else if (rejectionCount >= 1) {
    return "some-iteration";
  }
  return "smooth";
}
