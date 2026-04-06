import { useEffect, useState } from "react";
import FullApp from "./FullApp";
import { LowPerformanceLanding } from "./components/LowPerformanceLanding";
import { LOW_PERFORMANCE_MODE_KEY } from "./hooks/useShelfStorage";

function getStorage() {
  if (typeof chrome !== "undefined" && chrome.storage?.local) return chrome.storage.local;
  return null;
}

export default function App() {
  const [bootMode, setBootMode] = useState<"loading" | "low" | "full">("loading");

  useEffect(() => {
    const st = getStorage();
    if (!st) {
      setBootMode("full");
      return;
    }
    st.get([LOW_PERFORMANCE_MODE_KEY], (r) => {
      setBootMode(r[LOW_PERFORMANCE_MODE_KEY] === true ? "low" : "full");
    });
  }, []);

  if (bootMode === "loading") {
    return (
      <div
        className="min-h-screen w-full"
        style={{ background: "var(--shelf-bg, #0a0a0a)" }}
        aria-busy="true"
        aria-label="Loading"
      />
    );
  }

  if (bootMode === "low") {
    return <LowPerformanceLanding onOpenFullShelf={() => setBootMode("full")} />;
  }

  return <FullApp />;
}
