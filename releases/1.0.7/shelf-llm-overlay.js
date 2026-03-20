/**
 * ShELF LLM Console — floating Prompt Library dialog.
 * Content script runs on all pages; when URL matches extension setting, inserts a floating dialog.
 */
(function () {
  const DIALOG_WIDTH = 300;
  const DIALOG_MAX_HEIGHT = 420;
  const PROMPTS_KEY = "shelf-prompts";
  const LLM_CONSOLE_URL_KEY = "shelf-llm-console-url";

  function urlMatches(current, stored) {
    if (!stored || typeof stored !== "string") return false;
    const s = stored.trim().toLowerCase();
    if (!s.startsWith("http")) return false;
    try {
      const cur = new URL(current);
      const st = new URL(s);
      if (cur.origin !== st.origin) return false;
      const curPath = cur.pathname.replace(/\/$/, "") || "/";
      const stPath = st.pathname.replace(/\/$/, "") || "/";
      return curPath === stPath || curPath.startsWith(stPath + "/");
    } catch {
      return false;
    }
  }

  const styles = `
    #shelf-llm-dialog {
      position: fixed !important;
      bottom: 20px;
      right: 20px;
      width: ${DIALOG_WIDTH}px;
      max-height: ${DIALOG_MAX_HEIGHT}px;
      background: #ffffff;
      border: 1px solid #c7d2fe;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.04);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 2147483647;
      font-family: ui-sans-serif, system-ui, sans-serif;
    }
    #shelf-llm-dialog * { box-sizing: border-box; }
    .shelf-llm-dialog-header {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      border-bottom: 1px solid #e0e7ff;
      background: #f8fafc;
      cursor: grab;
      user-select: none;
    }
    .shelf-llm-dialog-header:active { cursor: grabbing; }
    .shelf-llm-dialog-title {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #1a73e8;
    }
    .shelf-llm-dialog-close {
      padding: 4px 8px;
      font-size: 18px;
      line-height: 1;
      color: #94a3b8;
      background: none;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    }
    .shelf-llm-dialog-close:hover { color: #64748b; background: #e2e8f0; }
    .shelf-llm-dialog-body {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      min-height: 0;
    }
    .shelf-llm-dialog-empty {
      font-size: 12px;
      color: #94a3b8;
      padding: 8px 0;
    }
    .shelf-llm-card {
      width: 100%;
      border-radius: 10px;
      border: 1px solid #e0e7ff;
      background: #fff;
      padding: 10px 12px;
      text-align: left;
      cursor: pointer;
      transition: all 0.15s ease;
      margin-bottom: 8px;
    }
    .shelf-llm-card:hover {
      border-color: #c7d2fe;
      background: #f8fafc;
    }
    .shelf-llm-card.copied {
      background: #d1fae5;
      border-color: #a7f3d0;
    }
    .shelf-llm-card-title {
      font-size: 0.875rem;
      font-weight: 500;
      color: #1a73e8;
    }
    .shelf-llm-card-action {
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #86efac;
    }
    .shelf-llm-card.copied .shelf-llm-card-action { color: #059669; }
    .shelf-llm-card-body {
      font-size: 12px;
      color: #64748b;
      font-family: ui-monospace, monospace;
      margin-top: 6px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .shelf-llm-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      padding: 10px 16px;
      font-size: 13px;
      color: #d1fae5;
      background: rgba(0,0,0,0.85);
      border: 1px solid rgba(74,222,128,0.3);
      border-radius: 12px;
      z-index: 2147483647;
      pointer-events: none;
      animation: shelf-toast-in 0.2s ease-out;
    }
    @keyframes shelf-toast-in {
      from { opacity: 0; transform: translateX(-50%) translateY(8px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  `;

  function createDialog(prompts) {
    const root = document.createElement("div");
    root.id = "shelf-llm-dialog";

    const styleEl = document.createElement("style");
    styleEl.textContent = styles;
    root.appendChild(styleEl);

    const promptList = Object.values(prompts || {}).filter((p) => p && typeof p.body === "string");

    root.innerHTML = `
      <div class="shelf-llm-dialog-header">
        <span class="shelf-llm-dialog-title">Prompt Library</span>
        <button type="button" class="shelf-llm-dialog-close" aria-label="Close">&times;</button>
      </div>
      <div class="shelf-llm-dialog-body">
        ${promptList.length === 0 ? '<p class="shelf-llm-dialog-empty">No prompts yet. Add them from the shelf.</p>' : ""}
      </div>
    `;

    const header = root.querySelector(".shelf-llm-dialog-header");
    const closeBtn = root.querySelector(".shelf-llm-dialog-close");
    const body = root.querySelector(".shelf-llm-dialog-body");

    closeBtn.addEventListener("click", () => {
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: "closeLLMConsole" });
      }
      root.remove();
    });

    let dragStartX, dragStartY, elStartX, elStartY;
    header.addEventListener("mousedown", (e) => {
      if (e.target === closeBtn) return;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      const rect = root.getBoundingClientRect();
      elStartX = rect.right - DIALOG_WIDTH;
      elStartY = rect.bottom - rect.height;
      const onMove = (e2) => {
        const dx = e2.clientX - dragStartX;
        const dy = e2.clientY - dragStartY;
        root.style.right = "auto";
        root.style.bottom = "auto";
        root.style.left = (elStartX + dx) + "px";
        root.style.top = (elStartY + dy) + "px";
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    promptList.forEach((p) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "shelf-llm-card";
      card.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <span class="shelf-llm-card-title" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(p.title || "Untitled")}</span>
          <span class="shelf-llm-card-action">Copy</span>
        </div>
        <p class="shelf-llm-card-body">${escapeHtml(p.body)}</p>
      `;
      card.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(p.body);
          card.classList.add("copied");
          card.querySelector(".shelf-llm-card-action").textContent = "Copied";
          showToast(root, "Copied");
          setTimeout(() => {
            card.classList.remove("copied");
            card.querySelector(".shelf-llm-card-action").textContent = "Copy";
          }, 1200);
        } catch (err) {
          console.warn("[ShELF] Copy failed:", err);
        }
      });
      body.appendChild(card);
    });

    return root;
  }

  function showToast(container, text) {
    const id = "shelf-llm-toast";
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.id = id;
    toast.className = "shelf-llm-toast";
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1400);
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function run() {
    if (document.getElementById("shelf-llm-dialog")) return;
    if (typeof chrome === "undefined" || !chrome.storage?.local?.get) return;

    chrome.storage.local.get([LLM_CONSOLE_URL_KEY, PROMPTS_KEY], (result) => {
      const llmUrl = result?.[LLM_CONSOLE_URL_KEY];
      if (!urlMatches(window.location.href, llmUrl)) return;

      const mount = () => {
        if (document.getElementById("shelf-llm-dialog")) return;
        const target = document.body || document.documentElement;
        if (!target) {
          setTimeout(mount, 80);
          return;
        }
        const prompts = result?.[PROMPTS_KEY] && typeof result[PROMPTS_KEY] === "object" ? result[PROMPTS_KEY] : {};
        const dialog = createDialog(prompts);
        target.appendChild(dialog);
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", mount);
      } else {
        mount();
      }
    });
  }

  run();
})();
