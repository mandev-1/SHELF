# ShELF · Bookmarks

## Quick Install

Download the latest release from `releases/<version>/` and load that folder unpacked in `chrome://extensions` or `brave://extensions`.

```bash
npm run release
npm run updaterelease         ### <---- This will update the release in same folder
```


A minimal, serverless Chrome/Brave extension that turns your new tab into a bookmark organizer. Built with **HeroUI v3**, **React 19**, and **Tailwind v4**.

## Features

### Bookmarks & layout

- **New tab override** — Opening a new tab shows your bookmarks instead of the default page.
- **Grid layout** — [GridStack.js](https://gridstackjs.com/) powers a drag-and-drop, resizable grid of bookmark sections. Layout is persisted in the extension.
- **Color coding** — Assign a color accent to any section. Colors are saved.
- **Search** — Filter bookmarks by title or URL (keyboard: ↑↓ and Enter).
- **Folder separators** — Add dividers inside bookmark folders for structure.
- **Goal cards** — Track progress with optional “Continue” links.
- **Hidden folders** — Hide folders from the shelf (restore via settings).
- **Export/Import** — Backup and restore your shelf as JSON.
- **Serverless** — Uses Chrome `bookmarks` and `storage` APIs only; no backend or account.

### Pillar (sidebar)

- **Top 6 pins** — Drag bookmarks into the pillar for quick access.
- **Todo list** — Add tasks with notes, URLs, tags, and block status.
- **Task completion** — Mark tasks done and log activity.
- **Obsidian log** — Optionally append task activity to an Obsidian note via Local REST API.

### Prompt library

- **Saved prompts** — Store prompts with titles and versions.
- **Prompt editor** — Edit, version, and preview prompts in a modal.
- **Click to copy** — One-click copy from the grid or the LLM Console pillar.

### Error Dashboard

- **JSON analytics** — Paste or load JSON to visualize error counts and details.
- **Named dashboards** — Multiple tabs (e.g. by environment or source).
- **Collapsible panels** — Hide JSON input, coverage, and importance for more list space.
- **Keyboard** — Press Esc to collapse panels and maximize the error list.

### Visual Flow

- **Flow diagram** — View todos as a node-and-edge diagram.
- **Add, edit, delete** — Manage tasks from the graph.
- **Context menu** — Edit, mark completed, or delete from node right-click.
- **Collision avoidance** — New nodes are placed to avoid overlaps.

### LLM Console

- **Embedded chat** — Iframe for your LLM UI (Ollama, LM Studio, etc.). URL configurable in settings.
- **Prompt library pillar** — Copy prompts from the sidebar while chatting.
- **Open in tab** — Fallback when the target site blocks embedding.
- **Edit in library** — Right-click a prompt to open and edit it in the main Prompt Library.

### Themes & settings

- **Themes** — Dark, Day, SAP, and Auto (time-based).
- **Settings** — Theme, bookmark size, task log, Obsidian config, LLM Console URL.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Build the extension**

   ```bash
   npm run build
   ```

3. **Load in Chrome or Brave**

   - Open `chrome://extensions` (or `brave://extensions`).
   - Enable **Developer mode**.
   - Click **Load unpacked** and select the `dist` folder inside this project.
   - If you want a versioned release build, use `releases/<version>/` instead.

4. **Use it**

   - Open a new tab. The ShELF bookmark page should appear.
   - Grant the **Bookmarks** permission if prompted.

## Development

**Live reload (recommended)** — Changes apply without refreshing:

1. Run the dev server: `npm run dev`
2. In Chrome/Brave go to `chrome://extensions`, enable **Developer mode**, and click **Load unpacked**.
3. Select the **`dev`** folder (not `dist`). The extension will show as "ShELF Bookmarks (dev)".
4. Open a new tab. Edits to the code will hot-reload in that tab.

**Production-style build** (no dev server):

- One-off build: `npm run build`
- Watch and rebuild on change: `npm run build:watch`

Then load the extension from `dist` or from `releases/<version>/` and refresh the new-tab page after each rebuild.

## Tech stack

### Core

- [React 19](https://react.dev/) — UI framework
- [TypeScript](https://www.typescriptlang.org/) 5.6 — Type safety
- [Vite](https://vitejs.dev/) 6 — Build tool and dev server

### UI

- [HeroUI v3](https://v3.heroui.com/) — Components (Button, Input, Link, Surface, SearchField, Popover, Spinner, Disclosure)
- [Tailwind CSS v4](https://tailwindcss.com/) — Styling via `@tailwindcss/vite`

### Layout & data viz

- [GridStack.js](https://gridstackjs.com/) — Drag-and-drop, resizable bookmark grid
- [React Flow](https://reactflow.dev/) (`@xyflow/react`) — Visual Flow node-and-edge diagram

### Chrome Extension

- Manifest V3
- `chrome.bookmarks` — Read, create, update, delete, move bookmarks
- `chrome.storage.local` — Persist layout, themes, prompts, todos, settings
- `chrome.tabs` — Open LLM Console URL in new tab

## License

MIT
