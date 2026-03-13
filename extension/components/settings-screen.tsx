import React, { useState, useEffect } from "react";
import { ArrowLeft, Eye, EyeOff, CheckCircle, ExternalLink, Trash2, Globe, Key } from "lucide-react";
import { getApiKey, saveApiKey, removeApiKey, isValidKeyFormat } from "../lib/api-key";
import { getConnectionMode, setConnectionMode, type ConnectionMode } from "../lib/connection-mode";
import { useSession } from "../lib/session";
import { MicSelector } from "./mic-selector";
import { PERSONAS } from "../lib/personas";

interface SettingsScreenProps {
  onBack: () => void;
}

export const SettingsScreen = ({ onBack }: SettingsScreenProps) => {
  const { persona, setPersonaId, checkApiKey, disconnect } = useSession();
  const [apiKey, setApiKeyState] = useState("");
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState("");
  const [connMode, setConnMode] = useState<ConnectionMode>("byok");

  useEffect(() => {
    getApiKey().then((k) => {
      if (k) { setApiKeyState(k); setSaved(true); }
    });
    getConnectionMode().then(setConnMode);
    setVersion(chrome.runtime.getManifest().version);
  }, []);

  const handleSave = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) { setError("Enter an API key"); return; }
    if (!isValidKeyFormat(trimmed)) { setError("Invalid format — should start with AIza..."); return; }
    setError("");
    await saveApiKey(trimmed);
    setSaved(true);
    await checkApiKey();
  };

  const handleRemove = async () => {
    await removeApiKey();
    setApiKeyState("");
    setSaved(false);
    setError("");
    disconnect();
    await checkApiKey();
  };

  return (
    <div className="w-full h-full flex flex-col" style={{ background: "#0a0a12", color: "#e2e8f0" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid rgba(99,102,241,0.1)" }}>
        <button onClick={onBack} className="p-1 rounded hover:bg-white/5">
          <ArrowLeft className="w-4 h-4" style={{ color: "#64748b" }} />
        </button>
        <span className="font-mono text-xs tracking-widest" style={{ color: "#64748b" }}>SETTINGS</span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-md mx-auto space-y-6">

          {/* Persona */}
          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#475569" }}>Personality</div>
            <div className="grid grid-cols-4 gap-2">
              {PERSONAS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPersonaId(p.id)}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all border"
                  style={{
                    background: persona.id === p.id ? "rgba(99,102,241,0.15)" : "rgba(30,27,75,0.2)",
                    borderColor: persona.id === p.id ? "rgba(103,232,249,0.5)" : "rgba(99,102,241,0.1)",
                  }}
                >
                  <img
                    src={chrome.runtime.getURL("assets/" + p.image)}
                    alt={p.name}
                    className="w-8 h-8"
                    style={{ imageRendering: "pixelated", filter: persona.id === p.id ? "drop-shadow(0 0 6px rgba(103,232,249,0.5))" : "none" }}
                  />
                  <span className="text-[9px] font-medium truncate w-full text-center">{p.name}</span>
                </button>
              ))}
            </div>
            <div className="rounded-lg p-2.5 flex items-center gap-2" style={{ background: "rgba(30,27,75,0.3)", border: "1px solid rgba(99,102,241,0.1)" }}>
              <img src={chrome.runtime.getURL("assets/" + persona.image)} alt="" className="w-5 h-5" style={{ imageRendering: "pixelated" }} />
              <span className="text-xs font-medium">{persona.name}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full ml-auto" style={{ background: "rgba(99,102,241,0.2)", color: "#a5b4fc" }}>{persona.voice}</span>
            </div>
          </div>

          {/* Microphone */}
          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#475569" }}>Microphone</div>
            <MicSelector />
          </div>

          {/* Connection */}
          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#475569" }}>Connection</div>
            <div className="flex gap-2">
              <button
                onClick={async () => { await setConnectionMode("hosted"); setConnMode("hosted"); disconnect(); }}
                className="flex-1 py-2.5 px-3 rounded-lg text-xs font-mono transition-all flex items-center justify-center gap-2 border"
                style={{
                  background: connMode === "hosted" ? "rgba(99,102,241,0.15)" : "rgba(30,27,75,0.2)",
                  borderColor: connMode === "hosted" ? "rgba(103,232,249,0.4)" : "rgba(99,102,241,0.1)",
                  color: connMode === "hosted" ? "#67e8f9" : "#64748b",
                }}
              >
                <Globe className="w-3.5 h-3.5" /> Hosted
              </button>
              <button
                onClick={async () => { await setConnectionMode("byok"); setConnMode("byok"); disconnect(); }}
                className="flex-1 py-2.5 px-3 rounded-lg text-xs font-mono transition-all flex items-center justify-center gap-2 border"
                style={{
                  background: connMode === "byok" ? "rgba(99,102,241,0.15)" : "rgba(30,27,75,0.2)",
                  borderColor: connMode === "byok" ? "rgba(103,232,249,0.4)" : "rgba(99,102,241,0.1)",
                  color: connMode === "byok" ? "#67e8f9" : "#64748b",
                }}
              >
                <Key className="w-3.5 h-3.5" /> Own Key
              </button>
            </div>
          </div>

          {/* API Key */}
          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#475569" }}>API Key</div>
            <div className="rounded-lg p-4 space-y-3" style={{ background: "rgba(30,27,75,0.2)", border: "1px solid rgba(99,102,241,0.1)" }}>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => { setApiKeyState(e.target.value); setSaved(false); setError(""); }}
                  placeholder="AIza..."
                  className="w-full rounded px-3 py-2 text-xs font-mono focus:outline-none pr-10"
                  style={{ background: "rgba(10,10,18,0.8)", border: "1px solid rgba(99,102,241,0.15)", color: "#e2e8f0" }}
                />
                <button onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "#64748b" }}>
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {error && <p className="text-[10px]" style={{ color: "#f87171" }}>{error}</p>}
              <div className="flex gap-2">
                {!saved && apiKey.trim() && (
                  <button onClick={handleSave} className="flex-1 px-3 py-1.5 rounded text-xs font-mono" style={{ background: "#6366f1", color: "white" }}>Save</button>
                )}
                {saved && (
                  <>
                    <div className="flex items-center gap-1.5 text-xs font-mono" style={{ color: "#34d399" }}>
                      <CheckCircle className="w-3 h-3" /> Saved
                    </div>
                    <button onClick={handleRemove} className="ml-auto p-1.5 transition-colors hover:opacity-80" style={{ color: "#64748b" }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
              <button
                onClick={() => chrome.tabs.create({ url: "https://aistudio.google.com/apikey" })}
                className="text-[10px] flex items-center gap-1 hover:opacity-80"
                style={{ color: "#67e8f9" }}
              >
                Get a free API key <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* About */}
          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#475569" }}>About</div>
            <div className="rounded-lg p-4 space-y-2" style={{ background: "rgba(30,27,75,0.2)", border: "1px solid rgba(99,102,241,0.1)" }}>
              <div className="flex justify-between text-xs">
                <span style={{ color: "#64748b" }}>Version</span>
                <span className="font-mono" style={{ color: "#94a3b8" }}>{version}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: "#64748b" }}>Model</span>
                <span className="font-mono" style={{ color: "#94a3b8" }}>gemini-2.5-flash</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
