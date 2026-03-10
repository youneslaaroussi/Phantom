import React, { useState, useEffect } from "react";
import { SessionProvider, useSession } from "./lib/session";
import { VoiceScreen } from "./components/voice-screen";
import { SettingsScreen } from "./components/settings-screen";
import { SetupScreen } from "./components/setup-screen";
import "./style.css";

type Screen = "voice" | "settings" | "setup";

const App = () => {
  const { hasApiKey } = useSession();
  const [screen, setScreen] = useState<Screen>(hasApiKey ? "voice" : "setup");

  useEffect(() => {
    if (hasApiKey && screen === "setup") setScreen("voice");
  }, [hasApiKey, screen]);

  if (screen === "setup" && !hasApiKey) {
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
