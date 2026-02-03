"use client";

import React, { useState, useCallback } from "react";

export interface EmbedCodeModalProps {
  slug: string;
  title?: string;
  onClose: () => void;
}

type EmbedView = "card" | "summary" | "full";
type EmbedTheme = "dark" | "light";

const VIEW_OPTIONS: { value: EmbedView; label: string; description: string }[] = [
  { value: "card", label: "Card", description: "200px - Title, stats, author" },
  { value: "summary", label: "Summary", description: "120px - Compact preview" },
  { value: "full", label: "Full", description: "Scrollable conversation" },
];

const THEME_OPTIONS: { value: EmbedTheme; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

export function EmbedCodeModal({ slug, title, onClose }: EmbedCodeModalProps) {
  const [view, setView] = useState<EmbedView>("card");
  const [theme, setTheme] = useState<EmbedTheme>("dark");
  const [height, setHeight] = useState(400);
  const [showAuthor, setShowAuthor] = useState(true);
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://cogcommit.com";

  // Build embed URL
  const embedUrl = `${baseUrl}/embed/${slug}?view=${view}&theme=${theme}&showAuthor=${showAuthor}${view === "full" ? `&height=${height}` : ""}`;

  // Calculate iframe height
  const iframeHeight = view === "summary" ? 120 : view === "full" ? height : 200;

  // Generate code snippets
  const iframeCode = `<iframe
  src="${embedUrl}"
  width="100%"
  height="${iframeHeight}"
  frameborder="0"
  style="border-radius: 8px; overflow: hidden;"
></iframe>`;

  const scriptCode = `<div
  class="cogcommit-embed"
  data-slug="${slug}"
  data-view="${view}"
  data-theme="${theme}"
  data-show-author="${showAuthor}"${view === "full" ? `
  data-height="${height}"` : ""}
></div>
<script src="${baseUrl}/embed.js" async></script>`;

  const oembedUrl = `${baseUrl}/api/oembed?url=${encodeURIComponent(`${baseUrl}/c/${slug}`)}`;

  const handleCopy = useCallback(async (text: string, tab: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTab(tab);
      setTimeout(() => setCopiedTab(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-panel rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-medium text-primary">Embed Commit</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-primary transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Options */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* View selector */}
            <div>
              <label className="block text-sm font-medium text-primary mb-2">
                View
              </label>
              <div className="space-y-2">
                {VIEW_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      view === option.value
                        ? "border-chronicle-blue bg-chronicle-blue/10"
                        : "border-border hover:border-subtle"
                    }`}
                  >
                    <input
                      type="radio"
                      name="view"
                      value={option.value}
                      checked={view === option.value}
                      onChange={() => setView(option.value)}
                      className="mt-1"
                    />
                    <div>
                      <div className="text-sm font-medium text-primary">
                        {option.label}
                      </div>
                      <div className="text-xs text-muted">{option.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Theme + options */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Theme
                </label>
                <div className="flex gap-2">
                  {THEME_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setTheme(option.value)}
                      className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${
                        theme === option.value
                          ? "border-chronicle-blue bg-chronicle-blue/10 text-chronicle-blue"
                          : "border-border text-muted hover:text-primary"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {view === "full" && (
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    Height (px)
                  </label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(Math.max(200, parseInt(e.target.value) || 400))}
                    min={200}
                    max={800}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-primary focus:border-chronicle-blue focus:outline-none"
                  />
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAuthor}
                  onChange={(e) => setShowAuthor(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-primary">Show author</span>
              </label>
            </div>
          </div>

          {/* Preview */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-primary mb-2">Preview</h3>
            <div className="bg-bg rounded-lg p-4 border border-border">
              <iframe
                src={embedUrl}
                width="100%"
                height={iframeHeight}
                frameBorder="0"
                style={{ borderRadius: 8, overflow: "hidden" }}
              />
            </div>
          </div>

          {/* Code snippets */}
          <div className="space-y-4">
            {/* Iframe */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-primary">HTML Iframe</h3>
                <button
                  onClick={() => handleCopy(iframeCode, "iframe")}
                  className="text-xs text-chronicle-blue hover:text-chronicle-blue/80"
                >
                  {copiedTab === "iframe" ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="bg-bg rounded-lg p-3 text-xs text-muted overflow-x-auto border border-border">
                <code>{iframeCode}</code>
              </pre>
            </div>

            {/* Script */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-primary">Script Embed</h3>
                <button
                  onClick={() => handleCopy(scriptCode, "script")}
                  className="text-xs text-chronicle-blue hover:text-chronicle-blue/80"
                >
                  {copiedTab === "script" ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="bg-bg rounded-lg p-3 text-xs text-muted overflow-x-auto border border-border">
                <code>{scriptCode}</code>
              </pre>
            </div>

            {/* oEmbed */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-primary">oEmbed URL</h3>
                <button
                  onClick={() => handleCopy(oembedUrl, "oembed")}
                  className="text-xs text-chronicle-blue hover:text-chronicle-blue/80"
                >
                  {copiedTab === "oembed" ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="bg-bg rounded-lg p-3 text-xs text-muted overflow-x-auto border border-border">
                <code>{oembedUrl}</code>
              </pre>
              <p className="text-xs text-muted mt-1">
                Use this for Notion, Medium, and other oEmbed-compatible platforms.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-panel-alt text-primary rounded-lg font-medium hover:bg-panel transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default EmbedCodeModal;
