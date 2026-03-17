# ShELF · Bookmarks

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

- **One-off build:** `npm run build`
- **Watch mode (rebuild on change):** `npm run dev`

After changing code, go to `chrome://extensions` and click the reload icon on the ShELF extension to pick up the new build.

## Tech stack

- [HeroUI v3](https://v3.heroui.com/) (React UI)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [GridStack.js](https://gridstackjs.com/) (dashboard layout)
- [Vite](https://vitejs.dev/) + React 19
- Chrome Extension Manifest V3, `chrome.bookmarks` and `chrome.storage` APIs

## License

MIT
