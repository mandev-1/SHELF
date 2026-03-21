/**
 * ShELF LLM Console — floating Prompt Library dialog.
 * All styles applied inline to avoid page CSS/CSP interference.
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

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function createDialog(prompts) {
    const root = document.createElement("div");
    root.id = "shelf-llm-dialog";
    Object.assign(root.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      width: DIALOG_WIDTH + "px",
      maxHeight: DIALOG_MAX_HEIGHT + "px",
      background: "#ffffff",
      border: "1px solid #c7d2fe",
      borderRadius: "16px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.04)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      zIndex: "2147483647",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      boxSizing: "border-box",
    });

    const header = document.createElement("div");
    Object.assign(header.style, {
      flexShrink: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 14px",
      borderBottom: "1px solid #e0e7ff",
      background: "#f8fafc",
      cursor: "grab",
      userSelect: "none",
    });

    const title = document.createElement("span");
    title.textContent = "Prompt Library";
    Object.assign(title.style, {
      fontSize: "11px",
      fontWeight: "600",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "#1a73e8",
    });

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "\u00D7";
    Object.assign(closeBtn.style, {
      padding: "4px 8px",
      fontSize: "18px",
      lineHeight: "1",
      color: "#94a3b8",
      background: "none",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
    });
    closeBtn.addEventListener("mouseenter", () => {
      closeBtn.style.color = "#64748b";
      closeBtn.style.background = "#e2e8f0";
    });
    closeBtn.addEventListener("mouseleave", () => {
      closeBtn.style.color = "#94a3b8";
      closeBtn.style.background = "none";
    });
    closeBtn.addEventListener("click", () => {
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: "closeLLMConsole" });
      }
      root.remove();
    });

    const openLibraryBtn = document.createElement("button");
    openLibraryBtn.type = "button";
    openLibraryBtn.textContent = "Edit in Shelf";
    Object.assign(openLibraryBtn.style, {
      padding: "4px 10px",
      fontSize: "11px",
      fontWeight: "500",
      color: "#1a73e8",
      background: "none",
      border: "1px solid #c7d2fe",
      borderRadius: "6px",
      cursor: "pointer",
    });
    openLibraryBtn.addEventListener("mouseenter", () => {
      openLibraryBtn.style.background = "#e0e7ff";
    });
    openLibraryBtn.addEventListener("mouseleave", () => {
      openLibraryBtn.style.background = "none";
    });
    openLibraryBtn.addEventListener("click", () => {
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: "openPromptLibrary" });
      }
    });

    header.appendChild(title);
    header.appendChild(openLibraryBtn);
    header.appendChild(closeBtn);
    root.appendChild(header);

    const body = document.createElement("div");
    Object.assign(body.style, {
      flex: "1",
      overflowY: "auto",
      padding: "12px",
      minHeight: "0",
      boxSizing: "border-box",
    });
    root.appendChild(body);

    const promptList = Object.values(prompts || {})
      .filter((p) => p && typeof p.body === "string")
      .reverse();

    if (promptList.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "No prompts yet. Add them from the shelf.";
      Object.assign(empty.style, { fontSize: "12px", color: "#94a3b8", padding: "8px 0", margin: 0 });
      body.appendChild(empty);
    } else {
      promptList.forEach((p) => {
        const card = document.createElement("button");
        card.type = "button";
        Object.assign(card.style, {
          width: "100%",
          borderRadius: "10px",
          border: "1px solid #e0e7ff",
          background: "#fff",
          padding: "10px 12px",
          textAlign: "left",
          cursor: "pointer",
          transition: "border 0.15s, background 0.15s",
          marginBottom: "8px",
          boxSizing: "border-box",
        });
        card.addEventListener("mouseenter", () => {
          if (!card.dataset.copied) {
            card.style.borderColor = "#c7d2fe";
            card.style.background = "#f8fafc";
          }
        });
        card.addEventListener("mouseleave", () => {
          if (!card.dataset.copied) {
            card.style.borderColor = "#e0e7ff";
            card.style.background = "#fff";
          }
        });

        const row = document.createElement("div");
        Object.assign(row.style, {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        });

        const titleSpan = document.createElement("span");
        titleSpan.textContent = p.title || "Untitled";
        Object.assign(titleSpan.style, {
          fontSize: "0.875rem",
          fontWeight: "500",
          color: "#1a73e8",
          flex: "1",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        });

        const actionSpan = document.createElement("span");
        actionSpan.textContent = "Copy";
        Object.assign(actionSpan.style, {
          fontSize: "10px",
          fontWeight: "500",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#86efac",
          flexShrink: "0",
        });

        row.appendChild(titleSpan);
        row.appendChild(actionSpan);
        card.appendChild(row);

        const bodyP = document.createElement("p");
        bodyP.textContent = p.body;
        Object.assign(bodyP.style, {
          fontSize: "12px",
          color: "#64748b",
          fontFamily: "ui-monospace, monospace",
          margin: "6px 0 0 0",
          overflow: "hidden",
        });
        bodyP.style.setProperty("display", "-webkit-box");
        bodyP.style.setProperty("-webkit-line-clamp", "2");
        bodyP.style.setProperty("-webkit-box-orient", "vertical");

        card.appendChild(bodyP);

        card.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(p.body);
            card.dataset.copied = "1";
            card.style.borderColor = "#a7f3d0";
            card.style.background = "#d1fae5";
            actionSpan.style.color = "#059669";
            actionSpan.textContent = "Copied";
            showToast("Copied");
            setTimeout(() => {
              delete card.dataset.copied;
              card.style.borderColor = "#e0e7ff";
              card.style.background = "#fff";
              actionSpan.style.color = "#86efac";
              actionSpan.textContent = "Copy";
            }, 1200);
          } catch (err) {
            console.warn("[ShELF] Copy failed:", err);
          }
        });

        body.appendChild(card);
      });
    }

    let dragStartX, dragStartY, elStartX, elStartY;
    header.addEventListener("mousedown", (e) => {
      if (e.target === closeBtn) return;
      header.style.cursor = "grabbing";
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
        header.style.cursor = "grab";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    return root;
  }

  function showToast(text) {
    const id = "shelf-llm-toast";
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.id = id;
    toast.textContent = text;
    Object.assign(toast.style, {
      position: "fixed",
      bottom: "24px",
      left: "50%",
      transform: "translateX(-50%)",
      padding: "10px 16px",
      fontSize: "13px",
      color: "#d1fae5",
      background: "rgba(0,0,0,0.85)",
      border: "1px solid rgba(74,222,128,0.3)",
      borderRadius: "12px",
      zIndex: "2147483647",
      pointerEvents: "none",
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1400);
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
