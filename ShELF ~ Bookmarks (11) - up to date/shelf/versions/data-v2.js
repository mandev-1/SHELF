// ShELF — content data, grounded in the real shelf
window.SHELF_DATA = {
  shelfName: "Hey Jimmy, smile",

  pins: [
    { id: "p1", title: "Perplexity", url: "https://www.perplexity.ai", host: "perplexity.ai" },
    { id: "p2", title: "Claude", url: "https://claude.ai/new", host: "claude.ai" },
    { id: "p3", title: "42 | Profile", url: "https://profile-v3.intra.42.fr", host: "intra.42.fr" },
  ],

  todos: [
    { id: "t1", title: "Autoskola", sub: "skupina b", tag: "nutne", tagClass: "violet", link: true, done: false, focus: true, focusRank: 1 },
    { id: "t2", title: "gomoku", sub: "42 project", link: true, done: false, focus: false },
    { id: "t3", title: "zuzaprague.de", sub: "family", tag: "support", tagClass: "blue", link: true, done: false, focus: true, focusRank: 2 },
    { id: "t4", title: "Watch Sandra Hu…", sub: "", link: true, done: false, focus: false },
    { id: "t5", title: "Export shelf backup", sub: "monthly", done: true, focus: false },
  ],

  prompts: [
    {
      id: "pr1", name: "Hacker prompt", version: "1.0.3",
      lines: [
        { sys: "[SYSTEM]", rest: " You are a sharp, careful assistant." },
        { rest: "Think step by step, keep the answer concise…" },
      ],
      full: "[SYSTEM] You are a sharp, careful assistant. Think step by step, keep the answer concise, and never invent facts.",
    },
    {
      id: "pr2", name: "Humanizer", version: "2.5.1",
      lines: [
        { rest: "--- name: humanizer version: 2.5.1" },
        { rest: "description: | Remove signs of AI-generated…" },
      ],
      full: "--- name: humanizer version: 2.5.1 description: | Remove signs of AI-generated phrasing while preserving meaning and tone.",
    },
  ],

  folders: [
    {
      id: "f1", title: "Movies", hue: "var(--hue-zinc)", dot: false,
      bookmarks: [
        { title: "42 | Profile", host: "intra.42.fr", url: "https://profile-v3.intra.42.fr" },
        { title: "Letterboxd • Social film discovery.", host: "letterboxd.com", url: "https://letterboxd.com" },
        { title: "ČT24 — Nejdůvěryhodnější zpravodajský web", host: "ct24.ceskatelevize.cz", url: "https://ct24.ceskatelevize.cz" },
        { title: "Railway | The all-in-one cloud provider", host: "railway.app", url: "https://railway.app" },
        { title: "Coursera | Online Courses From Top Universities", host: "coursera.org", url: "https://coursera.org" },
        { sep: true },
        { title: "42calculator", host: "42calculator.com", url: "https://42calculator.com" },
      ],
    },
    {
      id: "f2", title: "Misc", hue: "var(--hue-orange)", dot: true,
      bookmarks: [],
    },
    {
      id: "f3", title: "Andere Lesezeichen", hue: "var(--hue-green)", dot: true,
      bookmarks: [
        { title: "GitHub", host: "github.com", url: "https://github.com" },
        { title: "martinman.dev", host: "martinman.dev", url: "https://martinman.dev" },
        { title: "zuzapragtour.de", host: "zuzapragtour.de", url: "https://zuzapragtour.de" },
        { title: "Outlook", host: "outlook.com", url: "https://outlook.com" },
      ],
    },
    {
      id: "f4", title: "New Folder", hue: "var(--hue-zinc)", dot: false,
      bookmarks: [
        { title: "Perplexity", host: "perplexity.ai", url: "https://perplexity.ai" },
        { big: true, title: "SAP Learning", url: "https://learninghub.sap.com", host: "learninghub.sap.com", initials: "SAP", color: "#0a6ed1" },
        { title: "Přehraj.to - Sledování a stahování", host: "prehraj.to", url: "https://prehraj.to" },
      ],
    },
    {
      id: "f5", title: "Tech Stack LOL", hue: "var(--hue-purple)", dot: false,
      bookmarks: [
        { title: "Nuxt: The Full-Stack Vue Framework", host: "nuxt.com", url: "https://nuxt.com" },
        { title: "Demo Kit - SAPUI5 SDK", host: "sapui5.hana.ondemand.com", url: "https://sapui5.hana.ondemand.com" },
        { title: "v3.heroui.com", host: "heroui.com", url: "https://v3.heroui.com" },
      ],
    },
    {
      id: "f6", title: "Ai, Agents, MCPs, LLMs…", hue: "var(--hue-blue)", dot: false,
      bookmarks: [
        { title: "Smithery - Connect agents to MCPs in minutes", host: "smithery.ai", url: "https://smithery.ai" },
        { title: "Perplexity Computer", host: "perplexity.ai", url: "https://perplexity.ai" },
        { title: "Claude", host: "claude.ai", url: "https://claude.ai" },
      ],
    },
  ],

  goal: {
    eyebrow: "IBM Certified",
    title: "Coursera — Agentic RAG",
    pct: 98,
    cta: "Continue",
  },

  hopper: [
    { id: "h1", name: "nabíječka na 2s baterky", next: false },
    { id: "h2", name: "mýčka + instalace", next: true },
  ],
};

window.favicon = (host) => `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
