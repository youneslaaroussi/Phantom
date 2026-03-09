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
import type { LiveSessionState, LiveVoiceName } from "./live/types";

const MODEL = "gemini-2.0-flash-exp";
const VOICE_KEY = "phantom_voice";

const SYSTEM_INSTRUCTION = `You are Phantom, a voice-controlled AI agent that can browse and interact with any website.

You have tools to navigate tabs, click elements, fill forms, take screenshots, and more. Use them proactively.

Guidelines:
- Be concise in speech — the user is listening, not reading
- When asked to do something on a page, use getAccessibilitySnapshot first to understand the layout
- After clicking or filling, briefly confirm what you did
- If something fails, explain what went wrong and try an alternative approach
- Don't read long text aloud — summarize it instead
- When the user asks "what do you see", take a screenshot and describe it`;

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

  useEffect(() => {
    chrome.storage.local.get(VOICE_KEY, (r) => {
      if (r[VOICE_KEY]) setVoiceState(r[VOICE_KEY]);
    });
    getApiKey().then((k) => setHasApiKey(!!k));
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
    const apiKey = await getApiKey();
    if (!apiKey) {
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
      await session.connect(apiKey);
      setHasApiKey(true);
    } catch (err) {
      console.error("[Phantom] Connect failed:", err);
    }
  }, [voice]);

  const disconnect = useCallback(() => {
    sessionRef.current?.disconnect();
    sessionRef.current = null;
    setTranscript("");
    setExecutingTool(null);
    setInputLevel(0);
    setOutputLevel(0);
  }, []);

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
