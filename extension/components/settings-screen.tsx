/**
 * Settings screen — API key, voice, permissions
 */

import React, { useState, useEffect } from "react";
import { ArrowLeft, Eye, EyeOff, CheckCircle, ExternalLink, Trash2, Globe, Key } from "lucide-react";
import { getApiKey, saveApiKey, removeApiKey, isValidKeyFormat } from "../lib/api-key";
import { getConnectionMode, setConnectionMode, type ConnectionMode } from "../lib/connection-mode";
import { useSession } from "../lib/session";
import { MicSelector } from "./mic-selector";

interface SettingsScreenProps {
  onBack: () => void;
}

export const SettingsScreen = ({ onBack }: SettingsScreenProps) => {
  const { voice, setVoice, checkApiKey, disconnect } = useSession();
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
    if (!trimmed) {
      setError("Enter an API key");
      return;
    }
    if (!isValidKeyFormat(trimmed)) {
      setError("Invalid format — should start with AIza...");
      return;
    }
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKeyState(e.target.value);
    setSaved(false);
    setError("");
  };

  return (
    <div className="w-full h-full bg-black text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-900">
        <button onClick={onBack} className="p-1 hover:bg-white/5 rounded">
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </button>
        <span className="font-mono text-xs tracking-widest text-gray-500">SETTINGS</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-md mx-auto space-y-6">
          {/* Connection Mode */}
          <div className="space-y-3">
            <div className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">Connection</div>
            <div className="flex gap-2">
              <button
                onClick={async () => { await setConnectionMode("hosted"); setConnMode("hosted"); disconnect(); }}
                className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-mono transition-all flex items-center justify-center gap-2 ${
                  connMode === "hosted"
                    ? "bg-blue-600/20 border border-blue-500/50 text-blue-400"
                    : "bg-gray-900 border border-gray-800 text-gray-500 hover:bg-gray-800"
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                Hosted
              </button>
              <button
                onClick={async () => { await setConnectionMode("byok"); setConnMode("byok"); disconnect(); }}
                className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-mono transition-all flex items-center justify-center gap-2 ${
                  connMode === "byok"
                    ? "bg-blue-600/20 border border-blue-500/50 text-blue-400"
                    : "bg-gray-900 border border-gray-800 text-gray-500 hover:bg-gray-800"
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                Own Key
              </button>
            </div>
          </div>

          {/* Microphone */}
          <div className="space-y-3">
            <div className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">Microphone</div>
            <MicSelector />
          </div>

          {/* API Key */}
          <div className="space-y-3">
            <div className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">Gemini API Key</div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-3">
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={handleChange}
                  placeholder="AIza..."
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 pr-10"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              {error && <p className="text-[10px] text-red-400">{error}</p>}

              <div className="flex gap-2">
                {!saved && apiKey.trim() && (
                  <button
                    onClick={handleSave}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-mono transition-colors"
                  >
                    Save
                  </button>
                )}
                {saved && (
                  <>
                    <div className="flex items-center gap-1.5 text-green-400 text-xs font-mono">
                      <CheckCircle className="w-3 h-3" />
                      Saved
                    </div>
                    <button
                      onClick={handleRemove}
                      className="ml-auto p-1.5 text-gray-600 hover:text-red-400 transition-colors"
                      title="Remove key"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={() => chrome.tabs.create({ url: "https://aistudio.google.com/apikey" })}
                className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
              >
                Get a free API key <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-3">
            <div className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">About</div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Version</span>
                <span className="text-gray-400 font-mono">{version}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Model</span>
                <span className="text-gray-400 font-mono">gemini-2.5-flash</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Audio</span>
                <span className="text-gray-400 font-mono">16kHz in / 24kHz out</span>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <button
            onClick={() => chrome.tabs.create({ url: "chrome://extensions/?id=" + chrome.runtime.id })}
            className="w-full bg-gray-900/50 border border-gray-800 hover:bg-gray-800/50 rounded-lg p-4 flex items-center justify-between transition-colors"
          >
            <span className="text-xs font-mono text-gray-400">Extension Permissions</span>
            <ExternalLink className="w-3.5 h-3.5 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
};
