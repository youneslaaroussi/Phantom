import React, { useState, useEffect } from "react";
import { SessionProvider } from "./lib/session";
import { VoiceScreen } from "./components/voice-screen";
import { SettingsScreen } from "./components/settings-screen";
import { SetupScreen } from "./components/setup-screen";
import { TraceViewer } from "./components/trace-viewer";
import { DomInspector } from "./components/dom-inspector";
import { MemoryScreen } from "./components/memory-screen";
import { ToastProvider } from "./components/toast";
import "./style.css";

type Screen = "voice" | "settings" | "setup" | "loading" | "traces" | "dom" | "memory";

const SETUP_DONE_KEY = "phantom_setup_done";

const App = () => {
  const [screen, setScreen] = useState<Screen>("loading");

  useEffect(() => {
    chrome.storage.local.get(SETUP_DONE_KEY, (r) => {
      setScreen(r[SETUP_DONE_KEY] ? "voice" : "setup");
    });
  }, []);

  const handleSetupComplete = () => {
    chrome.storage.local.set({ [SETUP_DONE_KEY]: true });
    setScreen("voice");
  };

  if (screen === "loading") {
    return <div className="w-full h-full" style={{ background: "var(--g-surface)" }} />;
  }

  if (screen === "setup") {
    return <SetupScreen onComplete={handleSetupComplete} />;
  }

  if (screen === "settings") {
    return <SettingsScreen onBack={() => setScreen("voice")} />;
  }

  if (screen === "traces") {
    return <TraceViewer onBack={() => setScreen("voice")} />;
  }

  if (screen === "dom") {
    return <DomInspector onBack={() => setScreen("voice")} />;
  }

  if (screen === "memory") {
    return <MemoryScreen onBack={() => setScreen("voice")} />;
  }

  return <VoiceScreen onOpenSettings={() => setScreen("settings")} onOpenTraces={() => setScreen("traces")} onOpenDom={() => setScreen("dom")} onOpenMemory={() => setScreen("memory")} />;
};

const SidePanel = () => {
  useEffect(() => {
    document.body.style.height = "100vh";
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";
    document.documentElement.style.height = "100vh";
  }, []);

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <ToastProvider>
        <SessionProvider>
          <App />
        </SessionProvider>
      </ToastProvider>
    </div>
  );
};

export default SidePanel;
