# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Ignore `.handoffs/` by default.** Do NOT read, open, search (`Grep`/`Glob`/`Explore`), or otherwise pull anything under `.handoffs/` into context unless the user **explicitly** points you at a specific handoff. It's large design-reference prototype source (HTML / JSX / CSS) that bloats context and pollutes search results. When the user does reference one (e.g. "handoff 005"), read only that bundle.

## Project

ShELF Bookmarks — a Manifest V3 Chrome/Brave extension that overrides the new-tab page with a bookmark organizer, todo pillar, prompt library, visual flow graph, and an LLM Console overlay. React 19 + TypeScript 5.6 + Vite 6 + Tailwind v4 + HeroUI v3. Serverless — uses only `chrome.bookmarks` and `chrome.storage.local`.

## Commands

- `npm run dev` — Vite dev server. Load the **`dev/`** folder unpacked at `chrome://extensions` (not `dist/`). Edits hot-reload on the new-tab page.
- `npm run build` — `tsc -b && vite build` → outputs `dist/`. Load `dist/` unpacked to test a production build.
- `npm run build:watch` — production-style watch rebuild (no dev server).
- `npm run release:new` — bumps patch in `package.json` and `public/manifest.json`, builds, copies into `releases/<version>/`, and creates `.zip` / `.tar.gz`. Driven by `scripts/release.js`.
- `npm run release:rebuild` — re-runs the release packaging against the current version (no bump).
- Tags starting with `v` trigger a GitHub Actions release workflow (`.github/workflows/`).

There is no test runner, linter, or formatter configured. Type errors surface via `tsc -b` during `npm run build`.

## Architecture

### Entry and boot

- `index.html` → `src/main.tsx` → `src/App.tsx`. `App.tsx` reads `LOW_PERFORMANCE_MODE_KEY` from `chrome.storage.local` and either renders `LowPerformanceLanding` or `FullApp`. Outside the extension (no `chrome.*`), it always boots `FullApp`.
- `src/FullApp.tsx` is the new-tab shell. It owns global view state (`shelf` vs `visual-flow`), search, and composes `BookmarkGrid`, `Pillar`, `PromptLibraryCard`, `VisualFlowPanel`, `LLMConsolePanel`, `SearchResults`.

### State / persistence (the central seam)

`src/hooks/useShelfStorage.ts` is the single source of truth for all persisted UI state. It defines every `chrome.storage.local` key (layout, colors, prompts, pillar pins, todos, visual flow, theme, bookmark size, grazeland, bin, LLM console URL, low-performance flag, etc.) and exposes typed getters/setters. **Any new persisted setting goes here** — adding the key, default, hydration, and setter in one place — and the type lives in `src/types/grid.ts`. Components consume the hook rather than touching `chrome.storage` directly.

`src/hooks/useBookmarks.ts` wraps `chrome.bookmarks` (tree + search). It listens to bookmarks change events and re-fetches.

### Extension surfaces (Manifest V3)

`public/manifest.json` declares:

- `chrome_url_overrides.newtab` → `index.html` (the React app).
- `background.service_worker` → `public/background.js`. Handles three messages: `openLLMConsole` (navigates the active tab to the configured LLM URL), `closeLLMConsole` (opens the dashboard in a new tab), `openPromptLibrary`.
- Content script `public/shelf-llm-overlay.js` injected at `document_end` on `<all_urls>`. It draws a top-bar + Prompt Library sidebar overlay on top of whichever site the LLM Console points at — this is why ShELF works against sites that block iframe embedding (Ollama, LM Studio, ChatGPT, etc.).
- Host permission for `localhost:27124` is the Obsidian Local REST API used by the task-log → Obsidian feature in `Pillar`.

These three files (`manifest.json`, `background.js`, `shelf-llm-overlay.js`) are static assets served from `public/`. Vite copies them as-is into `dist/`; `scripts/release.js` also copies them into `releases/<version>/`.

### Major components

- `BookmarkGrid.tsx` (~1.5k LOC) — GridStack.js-backed drag/resize grid of bookmark folders. Owns layout persistence, color accents, folder separators, goal cards, hidden folders, export/import.
- `VisualFlowPanel.tsx` (~3k LOC) — React Flow (`@xyflow/react`) view of todos as nodes/edges, with context menus, collision avoidance, and sector handles. Persists via `VISUAL_FLOW_KEY` in `useShelfStorage`.
- `Pillar.tsx` — left sidebar: top-6 pins, todo list with notes/URLs/tags/block status, completion log, optional Obsidian append.
- `PromptLibraryCard.tsx` — prompt CRUD with versions; also appears inside the LLM overlay sidebar.
- `LLMConsolePanel.tsx` / `LowPerformanceLanding.tsx` / `BookmarkTree.tsx` / `NoteContent.tsx` / `SearchResults.tsx` — focused panels consumed by `FullApp`.

### Build / release flow

Vite builds with `base: "./"` and `outDir: "dist"`. `scripts/release.js`:

1. Reads/normalizes a version (from `RELEASE_VERSION` env, `.release-version` file, or bumps patch of `package.json`).
2. Updates `package.json` and `public/manifest.json` to the version.
3. Runs the build, then copies `dist/index.html`, `manifest.json`, `assets/`, `background.js`, `shelf-llm-overlay.js` into `releases/<version>/` and produces archives.

Keep `package.json` `version`, `public/manifest.json` `version`, and the `releases/<version>/` folder name in sync — the release script enforces this, so prefer running `npm run release:new` rather than hand-editing versions.

## Conventions specific to this repo

- Always go through `useShelfStorage` for any persisted state; don't add new `chrome.storage.local` reads/writes inline in components.
- Code must run both inside the extension (with `chrome.*` available) and in plain Vite dev (no extension context). Guard `chrome` access with `typeof chrome !== "undefined"` as `App.tsx` and `FullApp.tsx` do.
- Manifest V3 service worker (`background.js`) — no DOM, no long-lived globals; use message passing for window/tab actions.
- The LLM Console intentionally does **not** use an iframe — it navigates the current tab and overlays UI via the content script. Don't reintroduce iframe embedding.
