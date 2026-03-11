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

const SYSTEM_INSTRUCTION = `You are Phantom, a voice-controlled AI agent that can browse and interact with any website.

You have tools to navigate tabs, click elements, fill forms, take screenshots, and more. Use them proactively.

You may also receive periodic screenshots of the user's current tab. When you see these frames, you have continuous visual context of what the user is looking at. Use this to:
- Proactively comment on what's happening if relevant
- Answer questions about page content without needing to take a separate screenshot
- Notice changes (page loads, errors, new content) and react naturally

Guidelines:
- Be concise in speech — the user is listening, not reading
- When asked to do something on a page, use getAccessibilitySnapshot first to understand the layout
- After clicking or filling, briefly confirm what you did
- If something fails, explain what went wrong and try an alternative approach
- Don't read long text aloud — summarize it instead
- When you have vision enabled, you can see the page already — no need to take screenshots unless you need higher detail`;

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
        systemInstruction: SYSTEM_INSTRUCTION,
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
            return await executeTool(tc.name, tc.args);
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
  }, [voice]);

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
    } else {
      stopVision();
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
