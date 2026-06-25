import { Input } from "@heroui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BookmarkTreeNode } from "../types/bookmarks";
import type { ShelfBackupData, ShelfTheme, StrategieState } from "../types/grid";

const ACCENT_SWATCHES = ["#16b981", "#5b9cff", "#c98bff", "#e0905a", "#d97706", "#0070f2"] as const;

type SettingsPanelProps = {
  open: boolean;
  onClose: () => void;
  theme: ShelfTheme;
  setTheme: (t: ShelfTheme) => void;
  accent: string;
  setAccent: (hex: string) => void;
  shelfName: string;
  setShelfName: (name: string) => void;
  bookmarkSize: "normal" | "senior";
  setBookmarkSize: (s: "normal" | "senior") => void;
  showGoals: boolean;
  setShowGoals: (v: boolean) => void;
  showTodoDates: boolean;
  setShowTodoDates: (v: boolean) => void;
  showCanvasBlockers: boolean;
  setShowCanvasBlockers: (v: boolean) => void;
  showFocusDrawer: boolean;
  setShowFocusDrawer: (v: boolean) => void;
  showBothNavButtons: boolean;
  setShowBothNavButtons: (v: boolean) => void;
  strategieState: StrategieState;
  strategieSetCurrency: (c: "USD" | "EUR" | "CZK") => void;
  strategieSetSecondaryCurrency: (c: "USD" | "EUR" | "CZK" | null) => void;
  exportBackup: () => ShelfBackupData;
  importBackup: (backup: Partial<ShelfBackupData>) => Promise<void>;
  taskLog: string;
  clearTaskLog: () => void;
  llmConsoleUrl: string;
  setLlmConsoleUrl: (url: string) => void;
  focusDesynced: boolean;
  setFocusDesynced: (v: boolean) => void;
  lowPerformanceMode: boolean;
  setLowPerformanceMode: (v: boolean) => void;
  hiddenFolderNodes: BookmarkTreeNode[];
  setHiddenFolders: (fn: (prev: string[]) => string[]) => void;
  obsidianLog: { enabled: boolean; baseUrl: string; apiKey: string; notePath: string; useDailyNote?: boolean };
  setObsidianLogConfig: (patch: Partial<SettingsPanelProps["obsidianLog"]>) => void;
  logToObsidian: (line: string) => Promise<void>;
  openTaskLogInObsidian: () => void;
  showStrategieTab: boolean;
  setShowStrategieTab: (v: boolean) => void;
  showHopperTab: boolean;
  setShowHopperTab: (v: boolean) => void;
  showInventoryTab: boolean;
  setShowInventoryTab: (v: boolean) => void;
  showBudgetTab: boolean;
  setShowBudgetTab: (v: boolean) => void;
  onImportFile: () => void;
  getFolderTitle: (node: BookmarkTreeNode) => string;
};

function taskLogCount(taskLog: string) {
  return taskLog.split("\n").filter(Boolean).length;
}

function matchesFilter(q: string, ...parts: Array<string | undefined>) {
  if (!q.trim()) return true;
  const needle = q.trim().toLowerCase();
  return parts.some((p) => p?.toLowerCase().includes(needle));
}

function SetSection({ label, children, hidden }: { label: string; children: React.ReactNode; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <>
      <div className="set-sect">{label}</div>
      {children}
    </>
  );
}

function SetToggleRow({
  label,
  on,
  onToggle,
  dash,
  hidden,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  dash?: boolean;
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <button type="button" className={`set-row set-row--toggle${dash ? " set-row--dash" : ""}`} onClick={onToggle}>
      <span className="set-lbl">{label}</span>
      <span className={`set-val${on ? " set-val--on" : ""}`}>{on ? "On" : "Off"}</span>
    </button>
  );
}

function SetSeg<T extends string>({
  value,
  options,
  onChange,
  className = "",
}: {
  value: T;
  options: Array<{ value: T; label: string; disabled?: boolean }>;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`seg set-seg ${className}`.trim()} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          className={`seg-btn${value === o.value ? " on" : ""}`}
          onClick={() => !o.disabled && onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsPanel(props: SettingsPanelProps) {
  const {
    open,
    onClose,
    theme,
    setTheme,
    accent,
    setAccent,
    shelfName,
    setShelfName,
    bookmarkSize,
    setBookmarkSize,
    showGoals,
    setShowGoals,
    showTodoDates,
    setShowTodoDates,
    showCanvasBlockers,
    setShowCanvasBlockers,
    showFocusDrawer,
    setShowFocusDrawer,
    showBothNavButtons,
    setShowBothNavButtons,
    strategieState,
    strategieSetCurrency,
    strategieSetSecondaryCurrency,
    exportBackup,
    importBackup,
    taskLog,
    clearTaskLog,
    llmConsoleUrl,
    setLlmConsoleUrl,
    focusDesynced,
    setFocusDesynced,
    lowPerformanceMode,
    setLowPerformanceMode,
    hiddenFolderNodes,
    setHiddenFolders,
    obsidianLog,
    setObsidianLogConfig,
    logToObsidian,
    openTaskLogInObsidian,
    showStrategieTab,
    setShowStrategieTab,
    showHopperTab,
    setShowHopperTab,
    showInventoryTab,
    setShowInventoryTab,
    showBudgetTab,
    setShowBudgetTab,
    onImportFile,
    getFolderTitle,
  } = props;

  const filterRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState("");
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [showHiddenFolders, setShowHiddenFolders] = useState(false);
  const [showObsidianConfig, setShowObsidianConfig] = useState(false);
  const [obsidianTestStatus, setObsidianTestStatus] = useState<"idle" | "ok" | "fail">("idle");

  const q = filter.trim().toLowerCase();
  const logCount = taskLogCount(taskLog);
  const syncFocusOn = !focusDesynced;
  const showAppearance = matchesFilter(q, "appearance", "theme", "accent", "greeting", "bookmark", "goal", "todo", "date");
  const showVisualFlow = matchesFilter(q, "visual flow", "blocker", "focused", "drawer", "dashboard", "nav");
  const showData = matchesFilter(q, "data", "currency", "export", "import", "task log", "llm", "console", "backup");
  const showSystem = matchesFilter(q, "system", "sync", "focus", "performance", "hidden", "folder");
  const showMore = q.length > 0 && matchesFilter(
    q,
    "tab",
    "strategie",
    "hopper",
    "inventory",
    "budget",
    "obsidian",
    "chrome",
    "bookmark manager",
    "more",
  );

  useEffect(() => {
    if (!open) {
      setFilter("");
      setJsonMode(false);
      setJsonError("");
      setShowHiddenFolders(false);
      setShowObsidianConfig(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        filterRef.current?.focus();
      }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const enterJsonMode = useCallback(() => {
    setJsonText(JSON.stringify(exportBackup(), null, 2));
    setJsonError("");
    setJsonMode(true);
  }, [exportBackup]);

  const applyJson = useCallback(async () => {
    try {
      const parsed = JSON.parse(jsonText) as Partial<ShelfBackupData>;
      setJsonError("");
      await importBackup(parsed);
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        window.location.reload();
      } else {
        setJsonMode(false);
      }
    } catch {
      setJsonError("Invalid JSON — fix syntax and try again.");
    }
  }, [importBackup, jsonText]);

  const resetDefaults = useCallback(() => {
    if (!window.confirm("Reset settings to defaults? Layout, todos, and bookmarks are kept.")) return;
    setTheme("auto");
    setAccent("#16b981");
    setShelfName("ShELF");
    setBookmarkSize("normal");
    setShowGoals(false);
    setShowTodoDates(false);
    setShowCanvasBlockers(true);
    setShowFocusDrawer(true);
    setShowBothNavButtons(false);
    setFocusDesynced(false);
    setLowPerformanceMode(false);
    setLlmConsoleUrl("https://example.org");
    setShowStrategieTab(true);
    setShowHopperTab(true);
    setShowInventoryTab(true);
    setShowBudgetTab(true);
    strategieSetCurrency("CZK");
    strategieSetSecondaryCurrency("USD");
    setHiddenFolders(() => []);
    setObsidianLogConfig({ enabled: false });
  }, [
    setTheme,
    setAccent,
    setShelfName,
    setBookmarkSize,
    setShowGoals,
    setShowTodoDates,
    setShowCanvasBlockers,
    setShowFocusDrawer,
    setShowBothNavButtons,
    setFocusDesynced,
    setLowPerformanceMode,
    setLlmConsoleUrl,
    setShowStrategieTab,
    setShowHopperTab,
    setShowInventoryTab,
    setShowBudgetTab,
    strategieSetCurrency,
    strategieSetSecondaryCurrency,
    setHiddenFolders,
    setObsidianLogConfig,
  ]);

  const downloadBackup = () => {
    const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shelf-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTaskLog = () => {
    const blob = new Blob([taskLog], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `task-log-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <div className="set-scrim" onClick={onClose}>
      <div className="set-panel" onClick={(e) => e.stopPropagation()}>
        <div className="set-filter-wrap">
          <span className="set-filter-icon" aria-hidden>
            🔍
          </span>
          <input
            ref={filterRef}
            type="search"
            className="set-filter"
            placeholder="Filter settings…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <kbd className="set-kbd">⌘K</kbd>
        </div>

        <div className="set-body">
          {jsonMode ? (
            <div className="set-json">
              <textarea
                className="set-json-area"
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  setJsonError("");
                }}
                spellCheck={false}
              />
              {jsonError && <p className="set-json-err">{jsonError}</p>}
              <div className="set-json-actions">
                <button type="button" className="set-link" onClick={() => setJsonMode(false)}>
                  ← Back to settings
                </button>
                <button type="button" className="set-link set-link--accent" onClick={applyJson}>
                  Apply JSON
                </button>
              </div>
            </div>
          ) : (
            <>
              <SetSection label="Appearance" hidden={!showAppearance}>
                {matchesFilter(q, "theme", "appearance") && (
                  <div className="set-row set-row--stack">
                    <span className="set-lbl">Theme</span>
                    <SetSeg
                      value={theme}
                      options={[
                        { value: "auto", label: "Auto" },
                        { value: "dark", label: "Dark" },
                        { value: "day", label: "Day" },
                        { value: "sap", label: "SAP" },
                      ]}
                      onChange={setTheme}
                    />
                  </div>
                )}
                {matchesFilter(q, "accent", "appearance") && (
                  <div className="set-row set-row--stack">
                    <span className="set-lbl">Accent</span>
                    <div className="set-accent">
                      {ACCENT_SWATCHES.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          className={`set-accent-dot${accent === hex ? " on" : ""}`}
                          style={{ backgroundColor: hex }}
                          onClick={() => setAccent(hex)}
                          title={hex}
                          aria-label={`Accent ${hex}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {matchesFilter(q, "greeting", "shelf", "appearance") && (
                  <div className="set-row set-row--stack">
                    <span className="set-lbl">Greeting</span>
                    <input
                      type="text"
                      className="set-field"
                      value={shelfName}
                      onChange={(e) => setShelfName(e.target.value)}
                      placeholder="Smile is your new…"
                    />
                  </div>
                )}
                {matchesFilter(q, "bookmark", "size", "appearance") && (
                  <div className="set-row set-row--stack">
                    <span className="set-lbl">Bookmark</span>
                    <SetSeg
                      value={bookmarkSize}
                      options={[
                        { value: "normal", label: "Normal" },
                        { value: "senior", label: "Large" },
                      ]}
                      onChange={setBookmarkSize}
                    />
                  </div>
                )}
                <SetToggleRow
                  label="Show Goal"
                  on={showGoals}
                  onToggle={() => setShowGoals(!showGoals)}
                  dash
                  hidden={!matchesFilter(q, "goal", "appearance")}
                />
                <SetToggleRow
                  label="Show dates on todos"
                  on={showTodoDates}
                  onToggle={() => setShowTodoDates(!showTodoDates)}
                  hidden={!matchesFilter(q, "date", "todo", "appearance")}
                />
              </SetSection>

              <SetSection label="Visual Flow" hidden={!showVisualFlow}>
                <SetToggleRow
                  label="Show blocker nodes"
                  on={showCanvasBlockers}
                  onToggle={() => setShowCanvasBlockers(!showCanvasBlockers)}
                  dash
                  hidden={!matchesFilter(q, "blocker", "visual flow")}
                />
                <SetToggleRow
                  label="Show Focused drawer"
                  on={showFocusDrawer}
                  onToggle={() => setShowFocusDrawer(!showFocusDrawer)}
                  hidden={!matchesFilter(q, "focused", "drawer", "visual flow")}
                />
                <SetToggleRow
                  label="Show Dashboard & VF buttons"
                  on={showBothNavButtons}
                  onToggle={() => setShowBothNavButtons(!showBothNavButtons)}
                  hidden={!matchesFilter(q, "dashboard", "nav", "visual flow")}
                />
              </SetSection>

              <SetSection label="Data & Currency" hidden={!showData}>
                {matchesFilter(q, "currency", "default", "compare", "data") && (
                  <div className="set-row set-row--stack">
                    <div className="set-currency-line">
                      <span className="set-lbl set-lbl--inline">Default</span>
                      <SetSeg
                        className="set-seg--inline"
                        value={strategieState.currency as "USD" | "EUR" | "CZK"}
                        options={(["USD", "EUR", "CZK"] as const).map((c) => ({ value: c, label: c }))}
                        onChange={strategieSetCurrency}
                      />
                      <span className="set-currency-mid">· compare vs</span>
                      <SetSeg
                        className="set-seg--inline"
                        value={(strategieState.secondaryCurrency ?? "none") as "USD" | "EUR" | "CZK" | "none"}
                        options={[
                          { value: "none" as const, label: "None" },
                          ...(["USD", "EUR", "CZK"] as const).map((c) => ({
                            value: c,
                            label: c,
                            disabled: c === strategieState.currency,
                          })),
                        ]}
                        onChange={(c) => strategieSetSecondaryCurrency(c === "none" ? null : c)}
                      />
                    </div>
                  </div>
                )}
                {matchesFilter(q, "export", "import", "task log", "backup", "data") && (
                  <div className="set-row set-row--links">
                    <span className="set-inline-links">
                      <button type="button" className="set-link" onClick={downloadBackup}>
                        Export
                      </button>
                      <span className="set-dot">·</span>
                      <button type="button" className="set-link" onClick={onImportFile}>
                        Import
                      </button>
                      <span className="set-dot">·</span>
                      <span className="set-tasklog">
                        Task log ({logCount})
                        <button
                          type="button"
                          className="set-icon-btn"
                          disabled={!taskLog.trim()}
                          onClick={downloadTaskLog}
                          title="Download task log"
                          aria-label="Download task log"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="set-icon-btn"
                          disabled={!taskLog.trim()}
                          onClick={() => {
                            if (taskLog.trim() && window.confirm("Clear the task log?")) clearTaskLog();
                          }}
                          title="Clear task log"
                          aria-label="Clear task log"
                        >
                          ✕
                        </button>
                      </span>
                    </span>
                  </div>
                )}
                {matchesFilter(q, "llm", "console", "data") && (
                  <div className="set-row set-row--stack">
                    <span className="set-lbl">LLM Console</span>
                    <Input
                      variant="secondary"
                      value={llmConsoleUrl}
                      onChange={(e) => setLlmConsoleUrl(e.target.value)}
                      placeholder="https://…"
                      className="set-llm-input text-xs"
                    />
                  </div>
                )}
              </SetSection>

              <SetSection label="System" hidden={!showSystem}>
                <SetToggleRow
                  label="Sync focus (Pillar ↔ Drawer)"
                  on={syncFocusOn}
                  onToggle={() => setFocusDesynced(!focusDesynced)}
                  dash
                  hidden={!matchesFilter(q, "sync", "focus", "system")}
                />
                <SetToggleRow
                  label="Performance mode (fewer effects)"
                  on={lowPerformanceMode}
                  onToggle={() => setLowPerformanceMode(!lowPerformanceMode)}
                  hidden={!matchesFilter(q, "performance", "system")}
                />
                {matchesFilter(q, "hidden", "folder", "system") && (
                  <>
                    <button
                      type="button"
                      className="set-row set-row--toggle"
                      onClick={() => setShowHiddenFolders((v) => !v)}
                    >
                      <span className="set-lbl">Hidden folders</span>
                      <span className="set-val">{hiddenFolderNodes.length > 0 ? String(hiddenFolderNodes.length) : "None"}</span>
                    </button>
                    {showHiddenFolders && (
                      <div className="set-nested">
                        {hiddenFolderNodes.length === 0 ? (
                          <p className="set-hint">No hidden folders. Right‑click a folder → Hide from shelf.</p>
                        ) : (
                          hiddenFolderNodes.map((node) => (
                            <div key={node.id} className="set-nested-row">
                              <span className="set-nested-lbl">{getFolderTitle(node)}</span>
                              <button
                                type="button"
                                className="set-link set-link--accent"
                                onClick={() => setHiddenFolders((prev) => prev.filter((id) => id !== node.id))}
                              >
                                Unhide
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </SetSection>

              <SetSection label="More" hidden={!showMore}>
                {matchesFilter(q, "tab", "strategie", "hopper", "inventory", "budget") && (
                  <div className="set-nested set-nested--tabs">
                    <p className="set-hint">Shelf and Visual Flow are always on.</p>
                    {(
                      [
                        { id: "strategie", label: "Strategie", on: showStrategieTab, set: setShowStrategieTab },
                        { id: "hopper", label: "Hopper", on: showHopperTab, set: setShowHopperTab },
                        { id: "inventory", label: "Inventory", on: showInventoryTab, set: setShowInventoryTab },
                        { id: "budget", label: "Budget", on: showBudgetTab, set: setShowBudgetTab },
                      ] as const
                    ).map((t) => (
                      <SetToggleRow key={t.id} label={t.label} on={t.on} onToggle={() => t.set(!t.on)} />
                    ))}
                  </div>
                )}
                {matchesFilter(q, "chrome", "bookmark manager") && (
                  <button
                    type="button"
                    className="set-row set-row--toggle"
                    onClick={() => {
                      if (typeof chrome !== "undefined" && chrome.tabs?.create) {
                        chrome.tabs.create({ url: "chrome://bookmarks/" });
                      }
                      onClose();
                    }}
                  >
                    <span className="set-lbl">Go to Chrome bookmarks</span>
                    <span className="set-val">chrome://</span>
                  </button>
                )}
                {matchesFilter(q, "obsidian") && (
                  <>
                    <button
                      type="button"
                      className="set-row set-row--toggle"
                      onClick={() => setShowObsidianConfig((v) => !v)}
                    >
                      <span className="set-lbl">Obsidian log</span>
                      <span className={`set-val${obsidianLog.enabled ? " set-val--on" : ""}`}>
                        {obsidianLog.enabled ? "On" : "Off"}
                      </span>
                    </button>
                    {showObsidianConfig && (
                      <div className="set-nested">
                        <a
                          href={
                            typeof chrome !== "undefined" && chrome.runtime?.getURL
                              ? chrome.runtime.getURL("obsidian-setup.html")
                              : "/obsidian-setup.html"
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="set-link set-link--accent"
                        >
                          Setup guide: connect Obsidian
                        </a>
                        <label className="set-check">
                          <input
                            type="checkbox"
                            checked={obsidianLog.enabled}
                            onChange={(e) => setObsidianLogConfig({ enabled: e.target.checked })}
                          />
                          Enable todo log to Obsidian
                        </label>
                        <label className="set-check">
                          <input
                            type="checkbox"
                            checked={obsidianLog.useDailyNote ?? false}
                            onChange={(e) => setObsidianLogConfig({ useDailyNote: e.target.checked })}
                          />
                          Use daily note (one log per day)
                        </label>
                        <div className="set-row set-row--stack">
                          <span className="set-lbl">REST URL</span>
                          <Input
                            variant="secondary"
                            value={obsidianLog.baseUrl}
                            onChange={(e) => setObsidianLogConfig({ baseUrl: e.target.value })}
                            placeholder="http://127.0.0.1:27124"
                            className="text-xs"
                          />
                        </div>
                        <div className="set-row set-row--stack">
                          <span className="set-lbl">API Key</span>
                          <Input
                            variant="secondary"
                            type="password"
                            value={obsidianLog.apiKey}
                            onChange={(e) => setObsidianLogConfig({ apiKey: e.target.value })}
                            className="text-xs"
                          />
                        </div>
                        <div className="set-row set-row--stack">
                          <span className="set-lbl">Note path</span>
                          <Input
                            variant="secondary"
                            value={obsidianLog.notePath}
                            onChange={(e) => setObsidianLogConfig({ notePath: e.target.value })}
                            placeholder={obsidianLog.useDailyNote ? "Daily" : "ShELF/todo-log.md"}
                            className="text-xs"
                          />
                        </div>
                        <div className="set-json-actions">
                          <button
                            type="button"
                            className="set-link"
                            onClick={async () => {
                              setObsidianTestStatus("idle");
                              try {
                                await logToObsidian("\n--- ShELF test log " + new Date().toISOString() + " ---");
                                setObsidianTestStatus("ok");
                              } catch {
                                setObsidianTestStatus("fail");
                              }
                            }}
                          >
                            Test connection
                          </button>
                          <button type="button" className="set-link" onClick={() => openTaskLogInObsidian()}>
                            Open in Obsidian
                          </button>
                          {obsidianTestStatus === "ok" && <span className="set-val set-val--on">OK</span>}
                          {obsidianTestStatus === "fail" && <span className="set-val set-val--err">Failed</span>}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </SetSection>

              {!showAppearance && !showVisualFlow && !showData && !showSystem && !showMore && q && (
                <p className="set-hint set-hint--empty">No settings match “{filter.trim()}”.</p>
              )}
            </>
          )}
        </div>

        {!jsonMode && (
          <div className="set-footer">
            <button type="button" className="set-footer-btn" onClick={enterJsonMode}>
              Edit as JSON ⟷
            </button>
            <button type="button" className="set-footer-btn" onClick={resetDefaults}>
              Reset to defaults ↺
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
