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

  // Sync screen when API key state changes
  useEffect(() => {
    if (hasApiKey && screen === "setup") {
      setScreen("voice");
    }
  }, [hasApiKey, screen]);

  if (screen === "setup" && !hasApiKey) {
    return <SetupScreen onComplete={() => setScreen("voice")} />;
  }

  if (screen === "settings") {
    return <SettingsScreen onBack={() => setScreen("voice")} />;
  }

  return <VoiceScreen onOpenSettings={() => setScreen("settings")} />;
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
