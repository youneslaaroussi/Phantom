import React, { useState, useEffect } from "react";
import { SessionProvider, useSession } from "./lib/session";
import { VoiceScreen } from "./components/voice-screen";
import { SettingsScreen } from "./components/settings-screen";
import { SetupScreen } from "./components/setup-screen";
import { TraceViewer } from "./components/trace-viewer";
import { getConnectionMode } from "./lib/connection-mode";
import "./style.css";

type Screen = "voice" | "settings" | "setup" | "loading" | "traces";

const App = () => {
  const { hasApiKey } = useSession();
  const [screen, setScreen] = useState<Screen>("loading");

  // Check if setup is already complete (either has key or is in hosted mode)
  useEffect(() => {
    (async () => {
      const mode = await getConnectionMode();
      if (mode === "hosted" || hasApiKey) {
        setScreen("voice");
      } else {
        // Check if they previously chose a mode
        const stored = await new Promise<string | null>((resolve) => {
          chrome.storage.local.get("phantom_connection_mode", (r) => resolve(r.phantom_connection_mode || null));
        });
        setScreen(stored ? "voice" : "setup");
      }
    })();
  }, [hasApiKey]);

  if (screen === "loading") {
    return <div className="w-full h-full bg-black" />;
  }

  if (screen === "setup") {
    return <SetupScreen onComplete={() => setScreen("voice")} />;
  }

  if (screen === "settings") {
    return <SettingsScreen onBack={() => setScreen("voice")} />;
  }

  if (screen === "traces") {
    return <TraceViewer onBack={() => setScreen("voice")} />;
  }

  return <VoiceScreen onOpenSettings={() => setScreen("settings")} onOpenTraces={() => setScreen("traces")} />;
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
      <SessionProvider>
        <App />
      </SessionProvider>
    </div>
  );
};

export default SidePanel;
