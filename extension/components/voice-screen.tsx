/**
 * Voice Screen — the main Phantom interface
 * 
 * Centered mic button over a flowing wave visualizer.
 * Minimal, dark.
 */

import React, { useState, useEffect, useCallback } from "react";
import { Mic, Square, Settings, ChevronDown, Volume2, Eye, EyeOff } from "lucide-react";
import { useSession } from "../lib/session";
import { WaveVisualizer } from "./wave-visualizer";
import type { LiveVoiceName } from "../lib/live/types";

const VOICES: { id: LiveVoiceName; label: string; desc: string }[] = [
  { id: "Puck", label: "Puck", desc: "Upbeat" },
  { id: "Charon", label: "Charon", desc: "Informative" },
  { id: "Kore", label: "Kore", desc: "Warm" },
  { id: "Fenrir", label: "Fenrir", desc: "Excitable" },
  { id: "Aoede", label: "Aoede", desc: "Breezy" },
  { id: "Leda", label: "Leda", desc: "Youthful" },
  { id: "Orus", label: "Orus", desc: "Firm" },
  { id: "Zephyr", label: "Zephyr", desc: "Bright" },
];

interface VoiceScreenProps {
  onOpenSettings: () => void;
}

export const VoiceScreen = ({ onOpenSettings }: VoiceScreenProps) => {
  const {
    state,
    connect,
    disconnect,
    startListening,
    stopListening,
    sendText,
    transcript,
    executingTool,
    inputLevel,
    outputLevel,
    voice,
    setVoice,
    hasApiKey,
    visionEnabled,
    setVisionEnabled,
  } = useSession();

  const [textInput, setTextInput] = useState("");
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);

  const isConnected = state.status === "connected";
  const isConnecting = state.status === "connecting";

  const handleMicClick = useCallback(async () => {
    if (!isConnected) {
      await connect();
      setTimeout(() => startListening(), 500);
    } else if (state.isListening) {
      stopListening();
    } else {
      await startListening();
    }
  }, [isConnected, state.isListening, connect, startListening, stopListening]);

  // Listen for keyboard shortcut from background
  useEffect(() => {
    const listener = (message: { type: string }) => {
      if (message.type === "toggle-listening") {
        handleMicClick();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [handleMicClick]);

  const handleDisconnect = () => {
    disconnect();
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    if (!isConnected) {
      connect().then(() => {
        setTimeout(() => sendText(textInput.trim()), 600);
      });
    } else {
      sendText(textInput.trim());
    }
    setTextInput("");
  };

  // Wave color based on state
  const waveColor = state.isListening
    ? "#ef4444" // red when listening
    : state.isSpeaking
    ? "#3b82f6" // blue when speaking
    : executingTool
    ? "#a855f7" // purple when running tools
    : "#3b82f6"; // default blue

  return (
    <div className="relative w-full h-full bg-black flex flex-col">
      {/* Header */}
      <div className="relative z-20 flex items-center justify-between px-4 py-3">
        <div className="font-mono text-xs tracking-widest text-gray-500">PHANTOM</div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setVisionEnabled(!visionEnabled)}
            className={`p-1.5 rounded-lg transition-colors ${
              visionEnabled
                ? "bg-blue-500/20 text-blue-400"
                : "hover:bg-white/5 text-gray-500"
            }`}
            title={visionEnabled ? "Vision on — streaming screen" : "Vision off"}
          >
            {visionEnabled
              ? <Eye className="w-4 h-4" />
              : <EyeOff className="w-4 h-4" />
            }
          </button>
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Main area — wave + mic button */}
      <div className="flex-1 relative flex flex-col items-center justify-center">
        {/* Wave visualizer — fills background */}
        {isConnected && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <WaveVisualizer
              level={state.isSpeaking ? outputLevel : state.isListening ? inputLevel : 0.02}
              isActive={state.isSpeaking || state.isListening}
              color={waveColor}
              className="w-full h-full"
            />
          </div>
        )}

        {/* Audio input level bars */}
        {state.isListening && (
          <div className="relative z-10 flex items-center gap-1 h-8 mb-6">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1.5 rounded-full bg-red-500 transition-all duration-75"
                style={{
                  height: `${Math.min(100, Math.max(20, inputLevel * 100 * (5 - Math.abs(i - 2))))}%`,
                  opacity: inputLevel > i * 0.15 ? 1 : 0.3,
                }}
              />
            ))}
          </div>
        )}

        {/* Mic button */}
        <button
          onClick={handleMicClick}
          disabled={isConnecting}
          className={`
            relative z-10 w-24 h-24 rounded-full transition-all duration-300
            flex items-center justify-center
            ${state.isListening
              ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/40"
              : isConnected
              ? "bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/30"
              : "bg-gray-800 hover:bg-gray-700 border border-gray-700"
            }
            ${isConnecting ? "opacity-50 cursor-wait animate-pulse" : "cursor-pointer"}
          `}
          style={state.isListening ? { transform: `scale(${1 + inputLevel * 0.15})` } : undefined}
          title={
            state.isListening ? "Stop listening"
            : isConnected ? "Start listening"
            : "Connect & start"
          }
        >
          {state.isListening ? (
            <Square className="w-10 h-10 text-white" />
          ) : (
            <Mic className={`w-10 h-10 ${isConnected ? "text-white" : "text-gray-400"}`} />
          )}
          {state.isListening && (
            <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20" />
          )}
        </button>

        {/* Status text */}
        <div className="relative z-10 mt-6 text-center min-h-[60px] max-w-sm px-4">
          {isConnecting && (
            <p className="text-gray-400 text-sm animate-pulse">Connecting...</p>
          )}

          {state.error && (
            <p className="text-red-400 text-xs">{state.error}</p>
          )}

          {!isConnected && !isConnecting && !state.error && (
            <p className="text-gray-500 text-xs">Tap to start</p>
          )}

          {isConnected && !state.isListening && !state.isSpeaking && !executingTool && !transcript && (
            <p className="text-blue-400 text-sm">Ready</p>
          )}

          {state.isListening && !transcript && (
            <p className="text-red-400 text-sm font-medium">Listening...</p>
          )}

          {executingTool && (
            <p className="text-purple-400 text-xs font-mono">{executingTool}</p>
          )}

          {transcript && (
            <p className="text-gray-300 text-sm leading-relaxed">{transcript}</p>
          )}
        </div>

        {/* Disconnect */}
        {isConnected && (
          <button
            onClick={handleDisconnect}
            className="relative z-10 mt-4 text-gray-600 hover:text-gray-400 text-[10px] underline transition-colors"
          >
            disconnect
          </button>
        )}
      </div>

      {/* Bottom bar — voice selector + text input */}
      <div className="relative z-20 border-t border-gray-900 px-4 py-3 space-y-3">
        {/* Voice selector */}
        {!state.isListening && (
          <div className="flex justify-center">
            <div className="relative">
              <button
                onClick={() => setShowVoiceSelector(!showVoiceSelector)}
                disabled={isConnected}
                className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title={isConnected ? "Disconnect to change voice" : "Select voice"}
              >
                <Volume2 className="w-3 h-3" />
                <span>{voice}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showVoiceSelector ? "rotate-180" : ""}`} />
              </button>

              {showVoiceSelector && !isConnected && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-900 border border-gray-800 rounded-lg shadow-xl py-1 min-w-[140px] max-h-[200px] overflow-y-auto z-30">
                  {VOICES.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => { setVoice(v.id); setShowVoiceSelector(false); }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-800 transition-colors flex justify-between ${
                        v.id === voice ? "text-blue-400" : "text-gray-300"
                      }`}
                    >
                      <span>{v.label}</span>
                      <span className="text-gray-600 text-[10px]">{v.desc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Text input */}
        <form onSubmit={handleTextSubmit} className="flex gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="type a command..."
            className="flex-1 h-8 px-3 text-xs font-mono bg-gray-900 border border-gray-800 rounded-lg text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-700 transition-colors"
          />
          <button
            type="submit"
            className="h-8 px-4 text-xs font-mono bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg transition-colors"
          >
            send
          </button>
        </form>
      </div>
    </div>
  );
};
