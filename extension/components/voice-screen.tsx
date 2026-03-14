import React, { useState, useEffect, useCallback, useRef } from "react";
import { Mic, Square, Settings, Eye, EyeOff, Terminal, Volume2, VolumeX, Send, MousePointer2, X, Pause, Play, Code2, Shield } from "lucide-react";
import { useSession } from "../lib/session";
import { WaveVisualizer } from "./wave-visualizer";
import { MarkdownText } from "./markdown";
import { AnimatedMascot } from "./animated-mascot";
import { playSparkles } from "../lib/sparkle-effect";
import { BLUR_SENSITIVE_SCRIPT, UNBLUR_SCRIPT } from "../lib/privacy/inject";
import { Tooltip } from "./tooltip";

import type { LiveVoiceName } from "../lib/live/types";

interface VoiceScreenProps {
  onOpenSettings: () => void;
  onOpenTraces: () => void;
  onOpenDom: () => void;
}

const TOOL_LABELS: Record<string, string> = {
  getPageTitle: "Reading title",
  openTab: "Opening tab",
  getTabs: "Checking tabs",
  switchTab: "Switching tab",
  getAccessibilitySnapshot: "Scanning page",
  readPageContent: "Reading page",
  findOnPage: "Searching page",
  clickOn: "Clicking",
  typeInto: "Typing",
  pressKey: "Pressing key",
  scrollDown: "Scrolling down",
  scrollUp: "Scrolling up",
  scrollTo: "Scrolling to element",
  highlight: "Highlighting",
  computerAction: "Performing action",
  contentAction: "Processing content",
  rememberThis: "Saving to memory",
  recallMemory: "Recalling memory",
  updateUserProfile: "Updating profile",
};

function humanizeToolName(name: string): string {
  return TOOL_LABELS[name] || name.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
}

export const VoiceScreen = ({ onOpenSettings, onOpenTraces, onOpenDom }: VoiceScreenProps) => {
  const {
    state,
    connect,
    disconnect,
    startListening,
    stopListening,
    sendText,
    cancelTool,
    transcript,
    executingTool,
    inputLevel,
    outputLevel,
    voice,
    setVoice,
    persona,
    visionEnabled,
    setVisionEnabled,
    tabAudioEnabled,
    setTabAudioEnabled,
    spotlightEnabled,
    setSpotlightEnabled,
    paused,
    setPaused,
  } = useSession();

  const [textInput, setTextInput] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const visionBtnRef = useRef<HTMLButtonElement>(null);
  const audioBtnRef = useRef<HTMLButtonElement>(null);
  const spotlightBtnRef = useRef<HTMLButtonElement>(null);

  const isConnected = state.status === "connected";
  const isConnecting = state.status === "connecting";

  useEffect(() => {
    if (isConnected) inputRef.current?.focus();
  }, [isConnected]);

  const handleMicClick = useCallback(async () => {
    if (state.isListening) {
      stopListening();
    } else {
      await startListening();
    }
  }, [state.isListening, startListening, stopListening]);

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

  

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const text = textInput.trim();
    setTextInput("");
    if (!isConnected) {
      await connect();
    }
    sendText(text);
  };

  const micColor = state.isListening
    ? "bg-g-red hover:bg-red-600 shadow-lg shadow-red-200"
    : isConnected
    ? "bg-g-blue hover:bg-g-blue-hover shadow-lg shadow-blue-200"
    : "bg-g-surface-container-high hover:bg-g-outline-variant";

  return (
    <div ref={containerRef} className="relative w-full h-full flex flex-col" style={{ background: "var(--g-surface)" }}>
      <div className="relative z-20 flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--g-outline-variant)" }}>
        <div className="flex items-center gap-2.5">
          <img
            src={chrome.runtime.getURL("assets/" + persona.image)}
            alt=""
            className="w-8 h-8"
            style={{ imageRendering: "pixelated" as const }}
          />
          <span className="font-google text-sm font-medium" style={{ color: "var(--g-on-surface)" }}>
            {persona.name}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <Tooltip text={spotlightEnabled ? "Spotlight on" : "Spotlight"}>
            <button
              ref={spotlightBtnRef}
              onClick={() => {
                const turning = !spotlightEnabled;
                setSpotlightEnabled(turning);
                if (turning && containerRef.current) {
                  const r = spotlightBtnRef.current?.getBoundingClientRect();
                  const cr = containerRef.current.getBoundingClientRect();
                  playSparkles(containerRef.current, {
                    originX: r ? r.left - cr.left + r.width / 2 : undefined,
                    originY: r ? r.top - cr.top + r.height / 2 : undefined,
                    color: "#FBBC05",
                  });
                }
              }}
              className="p-2 rounded-full transition-colors"
              style={{
                background: spotlightEnabled ? "var(--g-yellow-bg)" : "transparent",
                color: spotlightEnabled ? "#e37400" : "var(--g-outline)",
              }}
            >
              <MousePointer2 className="w-[18px] h-[18px]" />
            </button>
          </Tooltip>
          <Tooltip text={visionEnabled ? "Vision on" : "Vision"}>
            <button
              ref={visionBtnRef}
              onClick={() => {
                const turning = !visionEnabled;
                setVisionEnabled(turning);
                if (turning && containerRef.current) {
                  const r = visionBtnRef.current?.getBoundingClientRect();
                  const cr = containerRef.current.getBoundingClientRect();
                  playSparkles(containerRef.current, {
                    originX: r ? r.left - cr.left + r.width / 2 : undefined,
                    originY: r ? r.top - cr.top + r.height / 2 : undefined,
                    color: "#4285F4",
                  });
                }
              }}
              className="p-2 rounded-full transition-colors"
              style={{
                background: visionEnabled ? "var(--g-blue-bg)" : "transparent",
                color: visionEnabled ? "var(--g-blue)" : "var(--g-outline)",
              }}
            >
              {visionEnabled ? <Eye className="w-[18px] h-[18px]" /> : <EyeOff className="w-[18px] h-[18px]" />}
            </button>
          </Tooltip>
          <Tooltip text={tabAudioEnabled ? "Tab audio on" : "Tab audio"}>
            <button
              ref={audioBtnRef}
              onClick={() => {
                const turning = !tabAudioEnabled;
                setTabAudioEnabled(turning);
                if (turning && containerRef.current) {
                  const r = audioBtnRef.current?.getBoundingClientRect();
                  const cr = containerRef.current.getBoundingClientRect();
                  playSparkles(containerRef.current, {
                    originX: r ? r.left - cr.left + r.width / 2 : undefined,
                    originY: r ? r.top - cr.top + r.height / 2 : undefined,
                    color: "#4285F4",
                  });
                }
              }}
              className="p-2 rounded-full transition-colors"
              style={{
                background: tabAudioEnabled ? "var(--g-blue-bg)" : "transparent",
                color: tabAudioEnabled ? "var(--g-blue)" : "var(--g-outline)",
              }}
            >
              {tabAudioEnabled ? <Volume2 className="w-[18px] h-[18px]" /> : <VolumeX className="w-[18px] h-[18px]" />}
            </button>
          </Tooltip>
          {isConnected && (
            <Tooltip text={paused ? "Resume inputs" : "Pause inputs"}>
              <button
                onClick={() => setPaused(!paused)}
                className="p-2 rounded-full transition-colors"
                style={{
                  background: paused ? "var(--g-red-bg, rgba(234,67,53,0.12))" : "transparent",
                  color: paused ? "var(--g-red)" : "var(--g-outline)",
                }}
              >
                {paused ? <Play className="w-[18px] h-[18px]" /> : <Pause className="w-[18px] h-[18px]" />}
              </button>
            </Tooltip>
          )}
          <Tooltip text="DOM">
            <button
              onClick={onOpenDom}
              className="p-2 rounded-full transition-colors hover:bg-g-surface-container"
              style={{ color: "var(--g-outline)" }}
            >
              <Code2 className="w-[18px] h-[18px]" />
            </button>
          </Tooltip>
          <Tooltip text="Traces">
            <button
              onClick={onOpenTraces}
              className="p-2 rounded-full transition-colors hover:bg-g-surface-container"
              style={{ color: "var(--g-outline)" }}
            >
              <Terminal className="w-[18px] h-[18px]" />
            </button>
          </Tooltip>
          <Tooltip text="Settings">
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-full transition-colors hover:bg-g-surface-container"
              style={{ color: "var(--g-outline)" }}
            >
              <Settings className="w-[18px] h-[18px]" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col items-center justify-center">
        <div className="relative z-10 mb-8">
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

        <Tooltip text={state.isListening ? "Stop" : isConnected ? "Listen" : "Connect"} position="top">
        <button
          onClick={handleMicClick}
          disabled={isConnecting}
          className={`relative z-10 w-20 h-20 rounded-full transition-all duration-300 flex items-center justify-center ${micColor} ${isConnecting ? "opacity-50 cursor-wait animate-pulse" : "cursor-pointer"}`}
          style={state.isListening ? { transform: `scale(${1 + inputLevel * 0.12})` } : undefined}
        >
          {state.isListening ? (
            <Square className="w-7 h-7 text-white" />
          ) : (
            <Mic className={`w-7 h-7 ${isConnected ? "text-white" : ""}`} style={!isConnected ? { color: "var(--g-on-surface-variant)" } : undefined} />
          )}
          {state.isListening && (
            <span className="absolute inset-0 rounded-full bg-g-red" style={{ animation: "pulse-ring 1.5s ease-out infinite" }} />
          )}
        </button>
        </Tooltip>

        <div className="relative z-10 mt-6 text-center min-h-[60px] max-w-sm px-4">
          {isConnecting && (
            <p className="text-sm font-google animate-pulse" style={{ color: "var(--g-blue)" }}>Connecting...</p>
          )}

          {state.error && (
            <p className="text-xs font-google" style={{ color: "var(--g-red)" }}>{state.error}</p>
          )}

          {!isConnected && !isConnecting && !state.error && (
            <p className="text-sm font-google" style={{ color: "var(--g-outline)" }}>Tap to start</p>
          )}

          {isConnected && !state.isListening && !state.isSpeaking && !executingTool && !transcript && (
            <p className="text-sm font-google font-medium" style={{ color: "var(--g-blue)" }}>Ready</p>
          )}

          {state.isListening && !transcript && (
            <p className="text-sm font-google font-medium" style={{ color: "var(--g-red)" }}>Listening...</p>
          )}

          {transcript && (
            <div className="w-full rounded-xl px-3 py-2 overflow-hidden" style={{ background: "rgba(0,0,0,0.02)", borderRadius: "12px" }}>
              <MarkdownText content={transcript} className="text-sm font-google-text leading-relaxed" style={{ color: "var(--g-on-surface)", overflowWrap: "break-word", wordBreak: "break-word", overflow: "hidden" }} />
            </div>
          )}

          {executingTool && (
            <div className="flex flex-col items-center gap-1.5 mt-4">
              <div className="flex gap-1 items-center">
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--g-blue)", animationDelay: "0ms", animationDuration: "1s" }} />
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--g-red)", animationDelay: "150ms", animationDuration: "1s" }} />
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--g-yellow)", animationDelay: "300ms", animationDuration: "1s" }} />
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--g-green)", animationDelay: "450ms", animationDuration: "1s" }} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-google-text" style={{ color: "var(--g-outline)" }}>{humanizeToolName(executingTool)}</span>
                <Tooltip text="Stop" position="top">
                  <button
                    onClick={cancelTool}
                    className="w-5 h-5 flex items-center justify-center rounded-full transition-colors hover:bg-g-surface-container"
                    style={{ color: "var(--g-outline)" }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Tooltip>
              </div>
            </div>
          )}
        </div>

        {isConnected && (
          <button
            onClick={handleDisconnect}
            className="relative z-10 mt-4 text-xs font-google font-medium px-4 py-1.5 rounded-g-full transition-colors hover:bg-g-surface-container"
            style={{ color: "var(--g-outline)" }}
          >
            Disconnect
          </button>
        )}


      </div>

      {isConnected && (
        <div className="absolute bottom-14 left-0 right-0 h-40 overflow-hidden pointer-events-none z-10">
          <WaveVisualizer
            inputLevel={inputLevel}
            outputLevel={outputLevel}
            isListening={state.isListening}
            isSpeaking={state.isSpeaking || outputLevel > 0.01}
            className="w-full h-full"
          />
        </div>
      )}

      <div className="relative z-20 px-3 py-3">
        <form onSubmit={handleTextSubmit} className="flex gap-2 items-center">
          <input
            ref={inputRef}
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Ask Phantom anything..."
            autoFocus
            className="flex-1 h-10 px-4 text-sm font-google-text rounded-g-full transition-colors focus:outline-none"
            style={{
              background: "var(--g-surface-container)",
              border: "1px solid var(--g-outline-variant)",
              color: "var(--g-on-surface)",
            }}
          />
          <Tooltip text="Send" position="top">
            <button
              type="submit"
              className="h-10 w-10 flex items-center justify-center rounded-full transition-colors"
              style={{ background: "var(--g-blue)", color: "#fff" }}
            >
              <Send className="w-4 h-4" />
            </button>
          </Tooltip>
        </form>
      </div>
    </div>
  );
};
