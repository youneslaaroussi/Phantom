import React, { useState, useEffect } from "react";
import { SessionProvider, useSession } from "./lib/session";
import { VoiceScreen } from "./components/voice-screen";
import { SettingsScreen } from "./components/settings-screen";
import { SetupScreen } from "./components/setup-screen";
import { getConnectionMode } from "./lib/connection-mode";
import "./style.css";

type Screen = "voice" | "settings" | "setup" | "loading";

const App = () => {
  const { hasApiKey } = useSession();
  const [screen, setScreen] = useState<Screen>("loading");

  useEffect(() => {
    (async () => {
      const mode = await getConnectionMode();
      if (mode === "hosted" || hasApiKey) {
        setScreen("voice");
      } else {
        const stored = await new Promise<string | null>((resolve) => {
          chrome.storage.local.get("phantom_connection_mode", (r) => resolve(r.phantom_connection_mode || null));
        });
        setScreen(stored ? "voice" : "setup");
      }
    })();
  }, [hasApiKey]);

  if (screen === "loading") return <div className="w-full h-full bg-black" />;

  if (screen === "setup") {
    return <SetupScreen onComplete={() => setScreen("voice")} />;
  }

  if (screen === "settings") {
    return <SettingsScreen onBack={() => setScreen("voice")} />;
  }

  return <VoiceScreen onOpenSettings={() => setScreen("settings")} />;
};

const Popup = () => (
  <div style={{ width: 380, height: 560 }}>
    <SessionProvider>
      <App />
    </SessionProvider>
  </div>
);

export default Popup;
