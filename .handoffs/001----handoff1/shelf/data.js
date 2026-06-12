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

  selling: [
    { id: "s1", name: "Doja Cat tickets · 2×", price: 2400, unit: "Kč", where: "resale", url: "https://www.ticketswap.com/event/doja-cat", status: "listed",
      createdAt: "2024-01-09T18:20:00", updatedAt: "2024-01-19T09:05:00", soldAt: null,
      history: [
        { at: "2024-01-19T09:05:00", text: "Price 2 600 → 2 400 Kč" },
        { at: "2024-01-12T20:40:00", text: "Listed on TicketSwap" },
        { at: "2024-01-09T18:20:00", text: "Created" },
      ] },
    { id: "s2", name: "Madbuds 2018", price: 600, unit: "Kč", where: "Bazoš", url: "https://www.bazos.cz/inzerat/madbuds-2018", status: "reserved",
      createdAt: "2024-01-04T11:00:00", updatedAt: "2024-01-21T14:30:00", soldAt: null,
      history: [
        { at: "2024-01-21T14:30:00", text: "Status listed → reserved" },
        { at: "2024-01-04T11:00:00", text: "Created" },
      ] },
    { id: "s3", name: "Longboard — repainted", price: 1200, unit: "Kč", where: "FB Marketplace", url: "https://www.facebook.com/marketplace/item/longboard", status: "listed",
      createdAt: "2024-01-15T16:10:00", updatedAt: "2024-01-15T16:10:00", soldAt: null,
      history: [ { at: "2024-01-15T16:10:00", text: "Created" } ] },
    { id: "s4", name: "Pavel — old monitor", price: 900, unit: "Kč", where: "in person", url: "", status: "sold",
      createdAt: "2023-12-20T09:00:00", updatedAt: "2024-01-06T17:45:00", soldAt: "2024-01-06T17:45:00",
      history: [
        { at: "2024-01-06T17:45:00", text: "Marked sold — 900 Kč" },
        { at: "2023-12-28T10:15:00", text: "Status listed → reserved" },
        { at: "2023-12-20T09:00:00", text: "Created" },
      ] },
    { id: "s5", name: "3D printer spool lot", price: 450, unit: "Kč", where: "Bazoš", url: "https://www.bazos.cz/inzerat/pla-spool-lot", status: "listed",
      createdAt: "2024-01-22T08:30:00", updatedAt: "2024-01-22T08:30:00", soldAt: null,
      history: [ { at: "2024-01-22T08:30:00", text: "Created" } ] },
  ],

  // what I own — a catalogue that feeds net worth and pipes into the Selling ledger
  inventory: [
    { id: "i1", name: "Prusa MK4 — 3D printer", cat: "Gear", value: 18500, unit: "Kč", notes: "Daily driver. Spare nozzle set in the drawer.", sellUrl: "https://www.bazos.cz/3d-tiskarny/" },
    { id: "i2", name: "MacBook Pro 14\" M1", cat: "Tech", value: 32000, unit: "Kč", notes: "AppleCare until late 2025. Light scuff on lid.", sellUrl: "",
      kids: [
        { id: "i2a", name: "96W USB-C charger", value: 1400 },
        { id: "i2b", name: "Sleeve + dongle kit", value: 900 },
      ] },
    { id: "i3", name: "Fender Player Strat", cat: "Music", value: 14000, unit: "Kč", notes: "Sunburst. Needs a fresh set of strings.", sellUrl: "" },
    { id: "i4", name: "Rolleiflex 2.8F", cat: "Photo", value: 21000, unit: "Kč", notes: "Inherited. CLA'd in 2022, meter accurate.", sellUrl: "https://www.fotoaparat.cz/bazar/",
      kids: [
        { id: "i4a", name: "Bay-III lens hood", value: 600 },
        { id: "i4b", name: "Leather neck strap", value: 450 },
        { id: "i4c", name: "Rolleinar close-up set", value: 1800 },
      ] },
    { id: "i5", name: "Specialized Allez road bike", cat: "Sport", value: 16000, unit: "Kč", notes: "105 groupset, new tyres last spring.", sellUrl: "" },
    { id: "i6", name: "DJI Mini 3 drone", cat: "Tech", value: 9500, unit: "Kč", notes: "Two batteries + ND filter set.", sellUrl: "" },
    { id: "i7", name: "Herman Miller Aeron", cat: "Home", value: 12000, unit: "Kč", notes: "Size B, fully loaded. The good chair.", sellUrl: "" },
  ],
};

window.favicon = (host) => `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
