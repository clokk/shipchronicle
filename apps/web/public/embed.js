/**
 * CogCommit Embed Script
 *
 * Usage:
 * <div class="cogcommit-embed" data-slug="abc12345" data-view="card" data-theme="dark"></div>
 * <script src="https://cogcommit.com/embed.js" async></script>
 *
 * Attributes:
 * - data-slug: The commit slug (required)
 * - data-view: View type - "card" (default), "summary", "full"
 * - data-theme: Theme - "dark" (default), "light", "auto"
 * - data-height: Height in pixels (for "full" view, default 400)
 * - data-show-author: Show author info - "true" (default), "false"
 */
(function () {
  "use strict";

  const EMBED_BASE_URL = "https://cogcommit.com/embed";

  function initEmbeds() {
    const containers = document.querySelectorAll(".cogcommit-embed");

    containers.forEach(function (container) {
      // Skip if already initialized
      if (container.dataset.initialized === "true") {
        return;
      }

      const slug = container.dataset.slug;
      if (!slug) {
        console.error("CogCommit embed: missing data-slug attribute");
        return;
      }

      // Get options
      const view = container.dataset.view || "card";
      const theme = container.dataset.theme || "dark";
      const height = container.dataset.height || (view === "full" ? "400" : "200");
      const showAuthor = container.dataset.showAuthor !== "false";

      // Build URL
      const params = new URLSearchParams({
        view: view,
        theme: theme,
        showAuthor: showAuthor.toString(),
      });

      if (view === "full") {
        params.set("height", height);
      }

      const embedUrl = EMBED_BASE_URL + "/" + slug + "?" + params.toString();

      // Calculate height based on view
      let iframeHeight;
      switch (view) {
        case "summary":
          iframeHeight = "120";
          break;
        case "full":
          iframeHeight = height;
          break;
        case "card":
        default:
          iframeHeight = "200";
      }

      // Create iframe
      const iframe = document.createElement("iframe");
      iframe.src = embedUrl;
      iframe.width = "100%";
      iframe.height = iframeHeight;
      iframe.frameBorder = "0";
      iframe.style.borderRadius = "8px";
      iframe.style.overflow = "hidden";
      iframe.style.display = "block";
      iframe.style.maxWidth = "100%";
      iframe.setAttribute("loading", "lazy");
      iframe.setAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-popups"
      );
      iframe.setAttribute("title", "CogCommit Embed");

      // Clear container and add iframe
      container.innerHTML = "";
      container.appendChild(iframe);
      container.dataset.initialized = "true";
    });
  }

  // Initialize on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initEmbeds);
  } else {
    initEmbeds();
  }

  // Also watch for dynamically added embeds
  if (typeof MutationObserver !== "undefined") {
    const observer = new MutationObserver(function (mutations) {
      let hasNewEmbeds = false;
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (
            node.nodeType === 1 &&
            (node.classList.contains("cogcommit-embed") ||
              node.querySelector(".cogcommit-embed"))
          ) {
            hasNewEmbeds = true;
          }
        });
      });
      if (hasNewEmbeds) {
        initEmbeds();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
})();
