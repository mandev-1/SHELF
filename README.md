# ShELF · Bookmarks

## Quick Install

Download the latest release from `releases/<version>/` and load that folder unpacked in `chrome://extensions` or `brave://extensions`.

```bash
npm run release
npm run updaterelease         ### <---- This will update the release in same folder
```


A minimal, serverless Chrome/Brave extension that turns your new tab into a bookmark organizer. Built with **HeroUI v3**, **React 19**, and **Tailwind v4**.

## Features

- **New tab override** — Opening a new tab shows your bookmarks instead of the default page.
- **Grid layout** — [GridStack.js](https://gridstackjs.com/) powers a drag-and-drop, resizable grid of bookmark sections. Your layout is saved in the extension.
- **Color coding** — Assign a color accent (left bar) to any section via the color picker on each card. Colors are persisted.
- **Search** — Filter bookmarks by title or URL.
- **Serverless** — Uses the Chrome `bookmarks` and `storage` APIs only; no backend or account.

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

- [HeroUI v3](https://v3.heroui.com/) (React UI)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [GridStack.js](https://gridstackjs.com/) (dashboard layout)
- [Vite](https://vitejs.dev/) + React 19
- Chrome Extension Manifest V3, `chrome.bookmarks` and `chrome.storage` APIs

## License

MIT
