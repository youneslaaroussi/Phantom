/**
 * Phantom session provider
 * 
 * Manages a single Gemini Live WebSocket session with:
 * - API key auth
 * - Bidirectional audio streaming
 * - Tool execution routing
 * - Voice selection
 */

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { LiveSession } from "./live/client";
import { getToolDeclarations, executeTool } from "./tools";
import { getApiKey } from "./api-key";
import { getConnectionMode, getServerUrl, type ConnectionMode } from "./connection-mode";
import { startVision, stopVision, isVisionActive } from "./vision";
import type { LiveSessionState, LiveVoiceName } from "./live/types";

const MODEL = "gemini-2.0-flash-exp";
const VOICE_KEY = "phantom_voice";

const SYSTEM_INSTRUCTION_BASE = `You are Phantom, a voice-controlled AI agent that can browse and interact with any website.

You have tools to navigate tabs, click elements, fill forms, take screenshots, and more. Use them proactively.

Guidelines:
- Be concise in speech — the user is listening, not reading
- When asked to do something on a page, use getAccessibilitySnapshot first to understand the layout
- After clicking or filling, briefly confirm what you did
- If something fails, explain what went wrong and try an alternative approach
- Don't read long text aloud — summarize it instead`;

const VISION_ON_ADDENDUM = `

VISION MODE IS ACTIVE. You are receiving periodic screenshots of the user's screen every few seconds. You can see what they see.
- You can reference what's on screen directly — no need to take separate screenshots
- Notice changes (page loads, errors, new content) and react naturally
- If the user asks "what do you see" or "what's on my screen", describe the latest frame
- Do NOT hallucinate page content — only describe what you actually see in frames`;

const VISION_OFF_ADDENDUM = `

VISION MODE IS OFF. You cannot see the user's screen. You must use tools to inspect pages:
- Use captureScreenshot to see the page visually
- Use getAccessibilitySnapshot to read page structure
- Do NOT guess or assume what's on the page without using a tool first
- If the user asks "what do you see", use captureScreenshot then describe it`;

interface SessionContextValue {
  state: LiveSessionState;
  connect: () => Promise<void>;
  disconnect: () => void;
  startListening: (deviceId?: string) => Promise<void>;
  stopListening: () => void;
  sendText: (text: string) => void;
  transcript: string;
  executingTool: string | null;
  inputLevel: number;
  outputLevel: number;
  voice: LiveVoiceName;
  setVoice: (v: LiveVoiceName) => void;
  hasApiKey: boolean;
  checkApiKey: () => Promise<boolean>;
  /** Whether vision (screen streaming) is enabled */
  visionEnabled: boolean;
  /** Toggle vision on/off */
  setVisionEnabled: (enabled: boolean) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const sessionRef = useRef<LiveSession | null>(null);
  const [state, setState] = useState<LiveSessionState>({
    status: "disconnected",
    isListening: false,
    isSpeaking: false,
  });
  const [transcript, setTranscript] = useState("");
  const [executingTool, setExecutingTool] = useState<string | null>(null);
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [voice, setVoiceState] = useState<LiveVoiceName>("Kore");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [connectionMode, setConnectionModeState] = useState<ConnectionMode>("byok");
  const [visionEnabled, setVisionEnabledState] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(VOICE_KEY, (r) => {
      if (r[VOICE_KEY]) setVoiceState(r[VOICE_KEY]);
    });
    getApiKey().then((k) => setHasApiKey(!!k));
    getConnectionMode().then(setConnectionModeState);
  }, []);

  const setVoice = useCallback((v: LiveVoiceName) => {
    setVoiceState(v);
    chrome.storage.local.set({ [VOICE_KEY]: v });
    if (sessionRef.current?.isConnected()) {
      sessionRef.current.disconnect();
      sessionRef.current = null;
    }
  }, []);

  const checkApiKey = useCallback(async () => {
    const k = await getApiKey();
    setHasApiKey(!!k);
    return !!k;
  }, []);

  const connect = useCallback(async () => {
    const mode = await getConnectionMode();
    const apiKey = await getApiKey();

    if (mode === "byok" && !apiKey) {
      setState((p) => ({ ...p, status: "error", error: "No API key. Add one in settings." }));
      return;
    }

    if (sessionRef.current) {
      sessionRef.current.disconnect();
      sessionRef.current = null;
    }

    const tools = getToolDeclarations();

    const session = new LiveSession(
      {
        model: MODEL,
        systemInstruction: SYSTEM_INSTRUCTION_BASE + (visionEnabled ? VISION_ON_ADDENDUM : VISION_OFF_ADDENDUM),
        tools,
        responseModalities: ["AUDIO"],
        voice,
      },
      {
        onStateChange: setState,
        onTranscript: (text) => setTranscript(text),
        onToolCall: async (tc) => {
          setExecutingTool(tc.name);
          try {
            const result = await executeTool(tc.name, tc.args);
            // If tool returned image data, send it as a frame to the session
            if (result._imageData && result._imageMimeType) {
              session.sendImage(result._imageData as string, result._imageMimeType as string);
              delete result._imageData;
              delete result._imageMimeType;
            }
            return result;
          } finally {
            setExecutingTool(null);
          }
        },
        onToolStart: ({ name }) => setExecutingTool(name),
        onToolEnd: () => setExecutingTool(null),
        onOutputLevel: setOutputLevel,
        onError: (err) => console.error("[Phantom] Session error:", err),
      }
    );

    sessionRef.current = session;

    try {
      if (mode === "hosted") {
        const serverUrl = await getServerUrl();
        const wsUrl = serverUrl.replace(/\/$/, "") + "/ws/live";
        await session.connect({ proxyUrl: wsUrl });
      } else {
        await session.connect({ apiKey: apiKey! });
        setHasApiKey(true);
      }
    } catch (err) {
      console.error("[Phantom] Connect failed:", err);
    }
  }, [voice, visionEnabled]);

  const disconnect = useCallback(() => {
    stopVision();
    sessionRef.current?.disconnect();
    sessionRef.current = null;
    setTranscript("");
    setExecutingTool(null);
    setInputLevel(0);
    setOutputLevel(0);
  }, []);

  // Vision toggle
  const setVisionEnabled = useCallback((enabled: boolean) => {
    setVisionEnabledState(enabled);
    if (enabled && sessionRef.current?.isConnected()) {
      startVision((base64, mimeType) => {
        sessionRef.current?.sendImage(base64, mimeType);
      });
      // Notify the model that vision is now active
      sessionRef.current?.sendText("[SYSTEM] Vision mode activated. You will now receive periodic screenshots of the user's screen. Describe only what you actually see in the frames.");
    } else {
      stopVision();
      // Notify the model that vision is disabled
      if (sessionRef.current?.isConnected()) {
        sessionRef.current?.sendText("[SYSTEM] Vision mode deactivated. You can no longer see the screen. Use captureScreenshot or getAccessibilitySnapshot tools if you need to inspect the page.");
      }
    }
  }, []);

  // Start/stop vision when connection state changes
  useEffect(() => {
    if (visionEnabled && state.status === "connected" && sessionRef.current) {
      startVision((base64, mimeType) => {
        sessionRef.current?.sendImage(base64, mimeType);
      });
    } else {
      stopVision();
    }
  }, [state.status, visionEnabled]);

  const startListening = useCallback(async (deviceId?: string) => {
    if (!sessionRef.current?.isConnected()) {
      await connect();
      // Wait briefly for connection
      await new Promise((r) => setTimeout(r, 500));
    }
    await sessionRef.current?.startListening({
      deviceId,
      onAudioLevel: setInputLevel,
    });
  }, [connect]);

  const stopListening = useCallback(() => {
    sessionRef.current?.stopListening();
    setInputLevel(0);
  }, []);

  const sendText = useCallback((text: string) => {
    if (!sessionRef.current?.isConnected()) return;
    sessionRef.current.sendText(text);
  }, []);

  // Auto-reconnect on unexpected disconnect (not user-initiated)
  const wasConnectedRef = useRef(false);
  useEffect(() => {
    if (state.status === "connected") {
      wasConnectedRef.current = true;
    }
    if (state.status === "disconnected" && wasConnectedRef.current && state.closeCode !== undefined && state.closeCode !== 1000) {
      // Unexpected disconnect — try to reconnect after a short delay
      wasConnectedRef.current = false;
      const timer = setTimeout(() => {
        console.log("[Phantom] Auto-reconnecting after unexpected disconnect...");
        connect().catch(() => {});
      }, 2000);
      return () => clearTimeout(timer);
    }
    if (state.status === "disconnected") {
      wasConnectedRef.current = false;
    }
  }, [state.status, state.closeCode, connect]);

  useEffect(() => {
    return () => { sessionRef.current?.disconnect(); };
  }, []);

  return (
    <SessionContext.Provider
      value={{
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
        checkApiKey,
        visionEnabled,
        setVisionEnabled,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be within SessionProvider");
  return ctx;
};
