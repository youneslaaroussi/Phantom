/**
 * Voice Screen — the main Phantom interface
 * 
 * Centered mic button over a flowing wave visualizer.
 * Minimal, dark.
 */

import React, { useState, useEffect, useCallback } from "react";
import { Mic, Square, Settings, Eye, EyeOff, Terminal, Volume2, VolumeX } from "lucide-react";
import { useSession } from "../lib/session";
import { WaveVisualizer } from "./wave-visualizer";
import { MarkdownText } from "./markdown";
import { AnimatedMascot } from "./animated-mascot";

import type { LiveVoiceName } from "../lib/live/types";

interface VoiceScreenProps {
  onOpenSettings: () => void;
  onOpenTraces: () => void;
}

export const VoiceScreen = ({ onOpenSettings, onOpenTraces }: VoiceScreenProps) => {
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
    persona,
    hasApiKey,
    visionEnabled,
    setVisionEnabled,
    tabAudioEnabled,
    setTabAudioEnabled,
  } = useSession();

  const [textInput, setTextInput] = useState("");

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

  return (
    <div className="relative w-full h-full flex flex-col" style={{ background: "#0a0a12" }}>
      {/* Header */}
      <div className="relative z-20 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <img src={chrome.runtime.getURL("assets/" + persona.image)} alt="" className="w-5 h-5" style={{ imageRendering: "pixelated" as const }} />
          <span className="font-mono text-xs tracking-widest text-gray-500">{persona.name.toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setVisionEnabled(!visionEnabled)}
            className={`p-1.5 rounded-lg transition-colors ${
              visionEnabled
                ? "bg-cyan-500/20 text-cyan-400"
                : "hover:bg-white/5 text-gray-500"
            }`}
            title={visionEnabled ? "Screen sharing on — Phantom can see your screen" : "Screen sharing off"}
          >
            {visionEnabled
              ? <Eye className="w-4 h-4" />
              : <EyeOff className="w-4 h-4" />
            }
          </button>
          <button
            onClick={() => setTabAudioEnabled(!tabAudioEnabled)}
            className={`p-1.5 rounded-lg transition-colors ${
              tabAudioEnabled
                ? "bg-purple-500/20 text-purple-400"
                : "hover:bg-white/5 text-gray-500"
            }`}
            title={tabAudioEnabled ? "Tab audio on — Phantom can hear the page" : "Tab audio off"}
          >
            {tabAudioEnabled
              ? <Volume2 className="w-4 h-4" />
              : <VolumeX className="w-4 h-4" />
            }
          </button>
          <button
            onClick={onOpenTraces}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            title="Traces"
          >
            <Terminal className="w-4 h-4 text-gray-500" />
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

      {/* Main area — mascot + mic button */}
      <div className="flex-1 relative flex flex-col items-center justify-center">
        {/* Animated mascot */}
        <div className="relative z-10 mb-6">
          <AnimatedMascot
            state={
              executingTool ? "thinking"
              : state.isSpeaking ? "talking"
              : state.isListening ? "listening"
              : isConnected ? "idle"
              : "sleeping"
            }
            personaId={persona.id}
            size={80}
          />
        </div>

        {/* Mic button */}
        <button
          onClick={handleMicClick}
          disabled={isConnecting}
          className={`
            relative z-10 w-24 h-24 rounded-full transition-all duration-300
            flex items-center justify-center
            ${state.isListening
              ? "bg-purple-500 hover:bg-purple-600 shadow-lg shadow-purple-500/40"
              : isConnected
              ? "bg-cyan-500 hover:bg-cyan-400 shadow-lg shadow-cyan-500/30"
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
            <span className="absolute inset-0 rounded-full bg-purple-500 animate-ping opacity-20" />
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
            <p className="text-cyan-400 text-sm">Ready</p>
          )}

          {state.isListening && !transcript && (
            <p className="text-purple-400 text-sm font-medium">Listening...</p>
          )}

          {executingTool && (
            <p className="text-purple-400 text-xs font-mono">{executingTool}</p>
          )}

          {transcript && (
            <MarkdownText content={transcript} className="text-gray-300 text-sm leading-relaxed" />
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

      {/* Wave visualizer — pinned to bottom */}
      {isConnected && (
        <div className="absolute bottom-0 left-0 right-0 h-52 overflow-hidden pointer-events-none z-10">
          <WaveVisualizer
            inputLevel={inputLevel}
            outputLevel={outputLevel}
            isListening={state.isListening}
            isSpeaking={state.isSpeaking || outputLevel > 0.01}
            className="w-full h-full"
          />
        </div>
      )}

      {/* Bottom bar */}
      <div className="relative z-20 px-4 py-3 space-y-3" style={{ borderTop: "1px solid rgba(99,102,241,0.1)" }}>
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
