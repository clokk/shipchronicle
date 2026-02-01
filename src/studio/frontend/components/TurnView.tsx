import React, { useState, forwardRef } from "react";
import { type Turn } from "../api";
import { copyToClipboard, formatTurnAsPlainText } from "../utils/export";

interface TurnViewProps {
  turn: Turn;
  searchTerm?: string;
  isMatch?: boolean;
  fontSize?: number;
}

const COLLAPSE_THRESHOLD = 500;
const PREVIEW_LENGTH = 300;

/**
 * Format model name to short display form
 */
function formatModelName(model?: string): string {
  if (!model) return "Agent";
  if (model.includes("opus-4-5")) return "Opus 4.5";
  if (model.includes("opus-4")) return "Opus 4";
  if (model.includes("opus")) return "Opus";
  if (model.includes("sonnet-4")) return "Sonnet 4";
  if (model.includes("3-5-sonnet") || model.includes("3.5-sonnet")) return "Sonnet 3.5";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku")) return "Haiku";
  return model.split("-").pop() || "Agent";
}

/**
 * Get tool summary for hover tooltip
 */
function getToolSummary(tc: Turn["toolCalls"][0]): string {
  const input = tc.input;
  if ("file_path" in input) return String(input.file_path);
  if ("command" in input) {
    const cmd = String(input.command);
    return cmd.length > 60 ? cmd.substring(0, 60) + "..." : cmd;
  }
  if ("pattern" in input) return `pattern: ${input.pattern}`;
  if ("query" in input) return `query: ${input.query}`;
  if ("url" in input) return String(input.url);
  if (tc.isError) return "Error";
  return tc.name;
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Highlight search matches in text
 */
function highlightMatches(text: string, term: string): React.ReactNode {
  if (!term) return text;
  const regex = new RegExp(`(${escapeRegex(term)})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-chronicle-blue/30 text-white rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

/**
 * Format relative time
 */
function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format absolute time for tooltip
 */
function formatAbsoluteTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

const TurnView = forwardRef<HTMLDivElement, TurnViewProps>(
  function TurnView({ turn, searchTerm, isMatch, fontSize = 16 }, ref) {
    const [expanded, setExpanded] = useState(false);
    const [expandedToolId, setExpandedToolId] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const isUser = turn.role === "user";
    const hasToolCalls = turn.toolCalls && turn.toolCalls.length > 0;
    const shouldCollapse = turn.content.length > COLLAPSE_THRESHOLD;

    const displayContent = shouldCollapse && !expanded
      ? turn.content.slice(0, PREVIEW_LENGTH)
      : turn.content;

    const handleCopy = async () => {
      const text = formatTurnAsPlainText(turn);
      const success = await copyToClipboard(text);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    };

    return (
      <div
        ref={ref}
        className={`group rounded-lg p-4 border-l-2 transition-opacity ${
          isUser
            ? "bg-chronicle-blue/5 border-chronicle-blue"
            : "bg-zinc-900/50 border-zinc-700"
        } ${searchTerm && !isMatch ? "opacity-40" : ""}`}
      >
        {/* Role indicator with model name */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`text-sm font-medium ${
              isUser ? "text-blue-400" : "text-zinc-400"
            }`}
          >
            {isUser ? "User" : formatModelName(turn.model)}
          </span>
          <span
            className="text-xs text-zinc-600 cursor-help"
            title={formatAbsoluteTime(turn.timestamp)}
          >
            {formatRelativeTime(turn.timestamp)}
          </span>
          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="ml-auto p-1 text-zinc-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
            title="Copy turn"
          >
            {copied ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-chronicle-green">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        </div>

        {/* Content */}
        {turn.content && (
          <div className="relative">
            <div
              className="text-zinc-200 whitespace-pre-wrap leading-relaxed"
              style={{ fontSize: `${fontSize}px`, lineHeight: 1.6 }}
            >
              {searchTerm
                ? highlightMatches(displayContent, searchTerm)
                : displayContent}
              {shouldCollapse && !expanded && "..."}
            </div>
            {shouldCollapse && !expanded && (
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-zinc-900/80 to-transparent pointer-events-none" />
            )}
          </div>
        )}

        {/* Show more button */}
        {shouldCollapse && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-chronicle-blue text-sm hover:text-chronicle-blue/80 transition-colors"
          >
            {expanded
              ? "Show less"
              : `Show more (${turn.content.length.toLocaleString()} chars)`}
          </button>
        )}

        {/* Compact tool call pills */}
        {hasToolCalls && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-1">
              {turn.toolCalls!.map((tc) => (
                <button
                  key={tc.id}
                  title={getToolSummary(tc)}
                  onClick={() =>
                    setExpandedToolId(expandedToolId === tc.id ? null : tc.id)
                  }
                  className={`px-2 py-0.5 text-xs font-mono rounded cursor-pointer transition-colors
                    ${
                      tc.isError
                        ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }
                    ${expandedToolId === tc.id ? "ring-1 ring-chronicle-blue" : ""}`}
                >
                  {tc.name}
                </button>
              ))}
            </div>

            {/* Expanded tool detail */}
            {expandedToolId && (
              <div className="mt-2 animate-expand">
                {turn.toolCalls!
                  .filter((tc) => tc.id === expandedToolId)
                  .map((tc) => (
                    <div
                      key={tc.id}
                      className="bg-zinc-800/50 rounded p-3 text-xs font-mono"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`font-medium ${
                            tc.isError ? "text-red-400" : "text-chronicle-green"
                          }`}
                        >
                          {tc.name}
                        </span>
                        {tc.isError && (
                          <span className="px-1.5 py-0.5 text-xs rounded bg-red-400/20 text-red-400">
                            error
                          </span>
                        )}
                      </div>

                      {/* Input */}
                      {tc.input && Object.keys(tc.input).length > 0 && (
                        <details className="mt-1" open>
                          <summary className="text-zinc-500 cursor-pointer hover:text-zinc-400">
                            Input
                          </summary>
                          <pre className="mt-1 p-2 bg-zinc-900 rounded text-zinc-400 overflow-x-auto">
                            {formatToolInput(tc.input)}
                          </pre>
                        </details>
                      )}

                      {/* Result */}
                      {tc.result && (
                        <details className="mt-1">
                          <summary className="text-zinc-500 cursor-pointer hover:text-zinc-400">
                            Result
                          </summary>
                          <pre className="mt-1 p-2 bg-zinc-900 rounded text-zinc-400 overflow-x-auto max-h-40">
                            {tc.result.length > 500
                              ? tc.result.substring(0, 500) + "..."
                              : tc.result}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

function formatToolInput(input: Record<string, unknown>): string {
  // For common tools, show a simplified view
  if ("command" in input) {
    return `command: ${input.command}`;
  }
  if ("file_path" in input) {
    return `file: ${input.file_path}`;
  }
  if ("pattern" in input) {
    return `pattern: ${input.pattern}`;
  }
  return JSON.stringify(input, null, 2);
}

export default TurnView;
