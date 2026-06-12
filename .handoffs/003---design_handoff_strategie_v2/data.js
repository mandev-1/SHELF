/* ShELF — sample dataset for the standalone prototype.
   Mirrors the shape the components + Strategie panel expect:
   shelfName · pins (Top 6) · folders[bookmarks] · todos · goal · prompts · hopper. */
window.SHELF_DATA = {
  shelfName: "ShELF",

  /* ---- Top 6 pins (also indexed by search) ---- */
  pins: [
    { title: "GitHub", host: "github.com", url: "https://github.com" },
    { title: "localhost:5173", host: "localhost", url: "http://localhost:5173" },
    { title: "Claude", host: "claude.ai", url: "https://claude.ai" },
    { title: "Linear", host: "linear.app", url: "https://linear.app" },
    { title: "Gmail", host: "mail.google.com", url: "https://mail.google.com" },
    { title: "Calendar", host: "calendar.google.com", url: "https://calendar.google.com" },
  ],

  /* ---- bookmark folders (drag to rearrange in the Shelf view) ---- */
  folders: [
    {
      id: "f-dev", title: "Dev", hue: "var(--hue-green)",
      bookmarks: [
        { title: "GitHub — pull requests", host: "github.com", url: "https://github.com/pulls" },
        { title: "MDN Web Docs", host: "developer.mozilla.org", url: "https://developer.mozilla.org" },
        { title: "Can I use…", host: "caniuse.com", url: "https://caniuse.com" },
        { sep: true },
        { title: "Vite", host: "vitejs.dev", url: "https://vitejs.dev" },
        { title: "React docs", host: "react.dev", url: "https://react.dev" },
        { title: "Tailwind CSS", host: "tailwindcss.com", url: "https://tailwindcss.com" },
      ],
    },
    {
      id: "f-work", title: "SAP · Work", hue: "var(--hue-blue)",
      bookmarks: [
        { title: "SAP BTP Cockpit", host: "cockpit.btp.cloud.sap", url: "https://cockpit.btp.cloud.sap" },
        { title: "CAP — Capire", host: "cap.cloud.sap", url: "https://cap.cloud.sap" },
        { title: "Fiori elements", host: "ui5.sap.com", url: "https://ui5.sap.com" },
        { sep: true },
        { title: "Jira board", host: "jira.tools.sap", url: "https://jira.tools.sap" },
        { title: "Confluence", host: "wiki.one.int.sap", url: "https://wiki.one.int.sap" },
      ],
    },
    {
      id: "f-learn", title: "Learning", hue: "var(--hue-purple)",
      bookmarks: [
        { title: "Agentic RAG capstone", host: "coursera.org", url: "https://coursera.org" },
        { title: "LangChain docs", host: "python.langchain.com", url: "https://python.langchain.com" },
        { title: "Hugging Face", host: "huggingface.co", url: "https://huggingface.co" },
        { title: "Free LLM API list", host: "github.com", url: "https://github.com" },
      ],
    },
    {
      id: "f-42", title: "42 · Projects", hue: "var(--hue-orange)",
      bookmarks: [
        { title: "Intra 42", host: "intra.42.fr", url: "https://intra.42.fr" },
        { title: "minishell", host: "github.com", url: "https://github.com" },
        { title: "philosophers", host: "github.com", url: "https://github.com" },
        { sep: true },
        { title: "push_swap tester", host: "github.com", url: "https://github.com" },
        { title: "Norm checker", host: "github.com", url: "https://github.com" },
      ],
    },
    {
      id: "f-read", title: "Reading", hue: "var(--hue-rose)",
      bookmarks: [
        { title: "Hacker News", host: "news.ycombinator.com", url: "https://news.ycombinator.com" },
        { title: "Lobsters", host: "lobste.rs", url: "https://lobste.rs" },
        { title: "Refactoring UI", host: "refactoringui.com", url: "https://refactoringui.com" },
      ],
    },
    {
      id: "f-tools", title: "Tools", hue: "var(--hue-zinc)",
      bookmarks: [
        { title: "Excalidraw", host: "excalidraw.com", url: "https://excalidraw.com" },
        { title: "Obsidian", host: "obsidian.md", url: "https://obsidian.md" },
        { title: "RegExr", host: "regexr.com", url: "https://regexr.com" },
        { title: "Transform tools", host: "transform.tools", url: "https://transform.tools" },
      ],
    },
  ],

  /* ---- pillar todo list ---- */
  todos: [
    { id: "t1", title: "Ship Strategie panel", sub: "wire useShelfStorage slice", tag: "ShELF", tagType: "violet", focus: true, link: "https://github.com" },
    { id: "t2", title: "Finish Agentic RAG cert", sub: "1 module left · 98%", tag: "Learning", tagType: "blue", focus: true },
    { id: "t3", title: "Review teammate's PR", sub: "BookmarkGrid refactor", tag: "Work", tagType: "blue" },
    { id: "t4", title: "Book dentist", done: true },
    { id: "t5", title: "Renew domain", sub: "expires in 9 days", tag: "Admin", tagType: "violet" },
  ],

  /* ---- a single goal card on the shelf ---- */
  goal: {
    eyebrow: "Quarter goal",
    title: "Reach 27% savings rate",
    pct: 74,
    cta: "Open Strategie",
  },

  /* ---- prompt library ---- */
  prompts: [
    { name: "Commit message", sys: "system", body: "Write a concise conventional-commit message for the staged diff. One line, imperative mood, no body unless breaking." },
    { name: "Explain code", sys: "system", body: "Explain this code to a mid-level engineer. Lead with what it does, then the non-obvious parts. Skip the boilerplate." },
    { name: "Rubber duck", body: "I'm stuck on a bug. Ask me one sharp diagnostic question at a time until we find it. Don't guess the fix early." },
    { name: "Refine UI copy", sys: "system", body: "Tighten this microcopy. Plain, human, no marketing voice. Return 3 options ranked by clarity." },
  ],

  /* ---- Hopper: the buy-list / wishlist chute ---- */
  hopper: [
    { name: "Mýčka + instalace" },
    { name: "Standing desk" },
    { name: "Mechanical keyboard" },
    { name: "Noise-cancelling headphones" },
    { name: "External SSD · 2TB" },
  ],
};
