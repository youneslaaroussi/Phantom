/**
 * Setup screen — shown on first launch when no API key is saved
 */

import React, { useState } from "react";
import { Key, ArrowRight, Eye, EyeOff, ExternalLink } from "lucide-react";
import { saveApiKey, isValidKeyFormat } from "../lib/api-key";
import { useSession } from "../lib/session";

interface SetupScreenProps {
  onComplete: () => void;
}

export const SetupScreen = ({ onComplete }: SetupScreenProps) => {
  const { checkApiKey } = useSession();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");

  const handleContinue = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setError("Enter your API key to get started");
      return;
    }
    if (!isValidKeyFormat(trimmed)) {
      setError("That doesn't look right — should start with AIza...");
      return;
    }
    setError("");
    await saveApiKey(trimmed);
    await checkApiKey();
    onComplete();
  };

  return (
    <div className="w-full h-full bg-black text-white flex flex-col items-center justify-center px-8">
      <div className="max-w-sm w-full space-y-8">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center">
              <Key className="w-7 h-7 text-gray-500" />
            </div>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Phantom</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Talk to AI. Control your browser by voice.
          </p>
        </div>

        {/* API Key input */}
        <div className="space-y-3">
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setError(""); }}
              placeholder="Paste your Gemini API key..."
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-gray-700 pr-10 transition-colors"
              onKeyDown={(e) => e.key === "Enter" && handleContinue()}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            onClick={() => chrome.tabs.create({ url: "https://aistudio.google.com/apikey" })}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
          >
            Get a free API key from Google AI Studio <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        {/* Continue */}
        <button
          onClick={handleContinue}
          className="w-full bg-white text-black py-3 rounded-lg font-medium text-sm hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
        >
          Get Started
          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="text-center text-[10px] text-gray-700">
          Your key stays on your device. Never shared.
        </p>
      </div>
    </div>
  );
};
