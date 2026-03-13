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
import { getSavedMicId } from "../components/mic-selector";
import { startSession as startTrace, endSession as endTrace, addTrace } from "./trace";
import { playConnect, playDisconnect, playToolStart, playToolEnd, playError, playListenStart, playListenStop, playVisionOn, playVisionOff, playWake, startThinking } from "./sounds";
import { getSavedPersonaId, savePersonaId, getPersona, type Persona } from "./personas";
import type { LiveSessionState, LiveVoiceName } from "./live/types";

const MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";

const TOOL_GUIDELINES = `

Guidelines:
- When asked to do something on a page, use getAccessibilitySnapshot first to understand the layout
- After clicking or filling, briefly confirm what you did
- If something fails, explain what went wrong and try an alternative approach
- Don't read long text aloud — summarize it instead
- Keep responses SHORT — the user is listening, not reading. 1-2 sentences max unless they ask for detail.
- You have tools to navigate tabs, click elements, fill forms, scroll, highlight things, and more. Use them proactively.`;

const VISION_ON_ADDENDUM = `

YOU CAN SEE THE USER'S SCREEN. You are receiving a live view of their screen, updated once per second.
- You CAN see the screen right now. Describe what you ACTUALLY see.
- Do NOT use readPageContent — you already have a live view. Just look at the screen.
- When the user asks "what do you see", describe what's currently on screen.
- Do NOT make up or guess what's on screen. Only describe what you can actually see.
- React to changes naturally — new pages loading, content appearing, errors showing up.`;

const VISION_OFF_ADDENDUM = `

YOU CANNOT SEE THE USER'S SCREEN right now. You must use tools to find out what's on the page:
- Use readPageContent to see what's on the page
- Do NOT guess or assume what's on screen without checking first
- If the user asks "what do you see", use readPageContent first then describe it`;

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
  persona: Persona;
  setPersonaId: (id: string) => void;
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
  const [persona, setPersonaState] = useState<Persona>(getPersona("default"));
  const [hasApiKey, setHasApiKey] = useState(false);
  const [connectionMode, setConnectionModeState] = useState<ConnectionMode>("byok");
  const [visionEnabled, setVisionEnabledState] = useState(false);

  useEffect(() => {
    getSavedPersonaId().then((id) => {
      const p = getPersona(id);
      setPersonaState(p);
      setVoiceState(p.voice);
    });
    getApiKey().then((k) => setHasApiKey(!!k));
    getConnectionMode().then(setConnectionModeState);
  }, []);

  const setVoice = useCallback((v: LiveVoiceName) => {
    setVoiceState(v);
    if (sessionRef.current?.isConnected()) {
      sessionRef.current.disconnect();
      sessionRef.current = null;
    }
  }, []);

  const setPersonaId = useCallback(async (id: string) => {
    const p = getPersona(id);
    setPersonaState(p);
    setVoiceState(p.voice);
    await savePersonaId(id);
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
        systemInstruction: persona.prompt + TOOL_GUIDELINES + (visionEnabled ? VISION_ON_ADDENDUM : VISION_OFF_ADDENDUM),
        tools,
        responseModalities: ["AUDIO"],
        voice,
      },
      {
        onStateChange: setState,
        onTranscript: (text) => {
          setTranscript(text);
          if (text) addTrace("agent_text", text);
        },
        onToolCall: async (tc) => {
          addTrace("tool_call", tc.name, { args: tc.args });
          playToolStart();
          const stopThinking = startThinking();
          setExecutingTool(tc.name);
          try {
            const result = await executeTool(tc.name, tc.args);
            addTrace("tool_result", JSON.stringify(result).slice(0, 500));
            stopThinking();
            playToolEnd();
            return result;
          } catch (e) {
            stopThinking();
            playError();
            throw e;
          } finally {
            setExecutingTool(null);
          }
        },
        onToolStart: ({ name }) => setExecutingTool(name),
        onToolEnd: () => setExecutingTool(null),
        onOutputLevel: setOutputLevel,
        onError: (err) => {
          addTrace("error", err instanceof Error ? err.message : String(err));
          console.error("[Phantom] Session error:", err);
        },
      }
    );

    sessionRef.current = session;
    startTrace();
    addTrace("system", `Connecting (${mode}) with model ${MODEL}, voice ${voice}`);

    try {
      if (mode === "hosted") {
        const serverUrl = await getServerUrl();
        const wsUrl = serverUrl.replace(/\/$/, "") + "/ws/live";
        await session.connect({ proxyUrl: wsUrl });
      } else {
        await session.connect({ apiKey: apiKey! });
        setHasApiKey(true);
      }
      addTrace("system", "Connected");
      playConnect();
    } catch (err) {
      addTrace("error", `Connect failed: ${err instanceof Error ? err.message : String(err)}`);
      playError();
      console.error("[Phantom] Connect failed:", err);
    }
  }, [voice, visionEnabled, persona]);

  const disconnect = useCallback(() => {
    playDisconnect();
    addTrace("system", "Disconnected");
    endTrace();
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
      playVisionOn();
      addTrace("system", "Vision enabled");
      startVision((base64, mimeType) => {
        addTrace("vision_frame", "frame sent");
        sessionRef.current?.sendImage(base64, mimeType);
      });
      sessionRef.current?.sendText("[SYSTEM] You can now see the user's screen. You'll receive a live view updated every second. Describe only what you actually see.");
    } else {
      playVisionOff();
      addTrace("system", "Vision disabled");
      stopVision();
      if (sessionRef.current?.isConnected()) {
        sessionRef.current?.sendText("[SYSTEM] You can no longer see the user's screen. Use readPageContent if you need to check what's on the page.");
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
      await new Promise((r) => setTimeout(r, 500));
    }
    const micId = deviceId || await getSavedMicId();
    playListenStart();
    await sessionRef.current?.startListening({
      deviceId: micId,
      onAudioLevel: setInputLevel,
    });
  }, [connect]);

  const stopListening = useCallback(() => {
    playListenStop();
    sessionRef.current?.stopListening();
    setInputLevel(0);
  }, []);

  const sendText = useCallback((text: string) => {
    if (!sessionRef.current?.isConnected()) return;
    addTrace("user_text", text);
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
        persona,
        setPersonaId,
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
