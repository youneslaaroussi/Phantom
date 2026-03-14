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
import { getServerUrl } from "./connection-mode";
import { startTabAudio, stopTabAudio, isTabAudioActive } from "./tab-audio";
import { useToast } from "../components/toast";
import { startVision, stopVision, isVisionActive } from "./vision";
import { getSavedMicId } from "../components/mic-selector";
import { startSession as startTrace, endSession as endTrace, addTrace } from "./trace";
import { playConnect, playDisconnect, playToolStart, playToolEnd, playError, playListenStart, playListenStop, playVisionOn, playVisionOff, playWake, startThinking } from "./sounds";
import { getSavedPersonaId, savePersonaId, getPersona, type Persona } from "./personas";
import type { LiveSessionState, LiveVoiceName } from "./live/types";
import { buildMemoryContext, summarizeSession } from "./memory/index";
import { playPageLaunchEffect, playPageVisionEffect, playPageAudioEffect } from "./page-effects";
import { startSpotlight, stopSpotlight } from "./spotlight";
import { buildSessionContext } from "./context";

const MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";

const TOOL_GUIDELINES = `

Guidelines:
- When asked to do something on a page, use getAccessibilitySnapshot first to understand the interactive elements
- After using a tool, confirm what happened naturally, as if you did it yourself. Don't mention tool names or describe your internal process.
- If something fails, try an alternative approach. Only explain if you're stuck.
- Don't read long text aloud — summarize it instead
- Keep responses SHORT — the user is listening, not reading. 1-2 sentences max unless they ask for detail.
- You have tools to navigate tabs, click elements, fill forms, scroll, highlight things, and more. Use them proactively.
- For web interactions, prefer computerAction (AI vision clicking) as your primary tool — it takes a screenshot, uses AI vision to find coordinates, and clicks/types at exact positions. It works on everything: buttons, links, canvas, iframes, video players, complex UIs.
- Fall back to clickOn/typeInto with CSS selectors only when computerAction fails or for simple, repetitive form-filling where speed matters.
- Use getAccessibilitySnapshot to understand what's on the page, but act with computerAction.
- Use contentAction to highlight text on the page and show a popup with a summary, rewrite, explanation, translation, or simplified version.
- You have memory! Use rememberThis when the user asks you to remember something or when you learn important facts about them.
- Use recallMemory when the user references past sessions or says "do you remember...".
- Use updateUserProfile to store the user's name, preferences, and durable facts about them.
- If the user tells you their name, store it immediately with updateUserProfile.`;

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
  visionEnabled: boolean;
  setVisionEnabled: (enabled: boolean) => void;
  tabAudioEnabled: boolean;
  setTabAudioEnabled: (enabled: boolean) => void;
  spotlightEnabled: boolean;
  setSpotlightEnabled: (enabled: boolean) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
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
  const [visionEnabled, setVisionEnabledState] = useState(false);
  const [tabAudioEnabled, setTabAudioEnabledState] = useState(false);
  const [spotlightEnabled, setSpotlightEnabledState] = useState(false);
  const sessionTranscriptRef = useRef<string[]>([]);
  const sessionToolCallsRef = useRef<string[]>([]);

  useEffect(() => {
    getSavedPersonaId().then((id) => {
      const p = getPersona(id);
      setPersonaState(p);
      setVoiceState(p.voice);
    });
  }, []);

  const setTabAudioEnabled = useCallback(async (enabled: boolean) => {
    setTabAudioEnabledState(enabled);
    if (enabled && sessionRef.current?.isConnected()) {
      addTrace("system", "Tab audio capture started");
      playPageAudioEffect().catch(() => {});
      try {
        await startTabAudio((pcm) => {
          return sessionRef.current?.pushTabAudio(pcm) ?? false;
        });
        sessionRef.current?.sendText("[SYSTEM] You can now hear the audio playing in the user's browser tab. Listen and respond to what you hear.");
      } catch (err) {
        addTrace("error", `Tab audio failed: ${err instanceof Error ? err.message : String(err)}`);
        toast("error", `Tab audio: ${err instanceof Error ? err.message : String(err)}`);
        setTabAudioEnabledState(false);
      }
    } else {
      addTrace("system", "Tab audio capture stopped");
      await stopTabAudio();
      if (sessionRef.current?.isConnected()) {
        sessionRef.current?.sendText("[SYSTEM] Tab audio capture stopped. You can no longer hear the browser audio.");
      }
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

  const connect = useCallback(async () => {
    if (sessionRef.current) {
      sessionRef.current.disconnect();
      sessionRef.current = null;
    }

    const tools = getToolDeclarations();

    // Reset session tracking
    sessionTranscriptRef.current = [];
    sessionToolCallsRef.current = [];

    // Build memory context to inject into system prompt
    let memoryContext = "";
    try {
      memoryContext = await buildMemoryContext();
    } catch (err) {
      console.warn("[Phantom] Failed to build memory context:", err);
    }

    const session = new LiveSession(
      {
        model: MODEL,
        systemInstruction: persona.prompt + TOOL_GUIDELINES + memoryContext + buildSessionContext() + (visionEnabled ? VISION_ON_ADDENDUM : VISION_OFF_ADDENDUM),
        tools,
        responseModalities: ["AUDIO"],
        voice,
      },
      {
        onStateChange: setState,
        onTranscript: (text) => {
          setTranscript(text);
          if (text) {
            addTrace("agent_text", text);
            sessionTranscriptRef.current.push(`Agent: ${text}`);
          }
        },
        onToolCall: async (tc) => {
          addTrace("tool_call", tc.name, { args: tc.args });
          sessionToolCallsRef.current.push(tc.name);
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
            toast("error", `Tool failed: ${e instanceof Error ? e.message : String(e)}`);
            throw e;
          } finally {
            setExecutingTool(null);
          }
        },
        onToolStart: ({ name }) => setExecutingTool(name),
        onToolEnd: () => setExecutingTool(null),
        onOutputLevel: setOutputLevel,
        onInputTranscription: (text) => {
          addTrace("user_speech", text);
          sessionTranscriptRef.current.push(`User: ${text}`);
        },
        onOutputTranscription: (text) => {
          addTrace("agent_speech", text);
          sessionTranscriptRef.current.push(`Agent: ${text}`);
        },
        onGoAway: (timeLeft) => {
          addTrace("system", `Server GoAway — ${timeLeft || "reconnecting soon"}`);
          console.log("[Phantom] GoAway received, auto-reconnect will handle it");
        },
        onError: (err) => {
          addTrace("error", err instanceof Error ? err.message : String(err));
          toast("error", err instanceof Error ? err.message : String(err));
          console.error("[Phantom] Session error:", err);
        },
      }
    );

    sessionRef.current = session;
    startTrace();
    addTrace("system", `Connecting with model ${MODEL}, voice ${voice}`);

    try {
      const serverUrl = await getServerUrl();
      const wsUrl = serverUrl.replace(/\/$/, "") + "/ws/live";
      await session.connect({ proxyUrl: wsUrl });
      addTrace("system", "Connected");
      playConnect();
      toast("success", "Connected");
      // Immersive launch effect on the actual page
      playPageLaunchEffect(persona.image).catch(() => {});
      session.sendText("Say hi! Greet the user briefly in character. Keep it to one short sentence.");
    } catch (err) {
      addTrace("error", `Connect failed: ${err instanceof Error ? err.message : String(err)}`);
      playError();
      toast("error", `Connection failed: ${err instanceof Error ? err.message : String(err)}`);
      console.error("[Phantom] Connect failed:", err);
    }
  }, [voice, visionEnabled, persona]);

  const disconnect = useCallback(() => {
    playDisconnect();
    addTrace("system", "Disconnected");
    endTrace();
    stopVision();
    stopTabAudio();
    stopSpotlight();
    setTabAudioEnabledState(false);
    setSpotlightEnabledState(false);

    // Summarize session before cleanup (fire and forget)
    const transcript = sessionTranscriptRef.current.join("\n");
    const toolCalls = [...sessionToolCallsRef.current];
    if (transcript.length > 20) {
      summarizeSession(transcript, toolCalls).catch((err) =>
        console.warn("[Phantom] Session summary failed:", err)
      );
    }

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
      playPageVisionEffect().catch(() => {});
      startVision((base64, mimeType) => {
        addTrace("vision_frame", "frame sent");
        sessionRef.current?.sendImage(base64, mimeType);
      }, persona.image);
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
      }, persona.image);
    } else if (!visionEnabled) {
      stopVision();
    }
  }, [state.status, visionEnabled]);

  // Spotlight toggle
  const setSpotlightEnabled = useCallback((enabled: boolean) => {
    setSpotlightEnabledState(enabled);
    if (enabled && sessionRef.current?.isConnected()) {
      addTrace("system", "Spotlight enabled");
      startSpotlight((context) => {
        sessionRef.current?.sendText(context);
      }, persona.image);
      sessionRef.current?.sendText("[SYSTEM] Spotlight is now active. You will receive context about the DOM element the user is pointing at with their cursor. Use this to understand what the user is focused on. Only comment on it if the user asks or if it's relevant to the conversation.");
    } else {
      addTrace("system", "Spotlight disabled");
      stopSpotlight();
      if (sessionRef.current?.isConnected()) {
        sessionRef.current?.sendText("[SYSTEM] Spotlight is now off. You no longer receive cursor context.");
      }
    }
  }, [persona.image]);

  // Start/stop spotlight when connection state changes
  useEffect(() => {
    if (spotlightEnabled && state.status === "connected" && sessionRef.current) {
      startSpotlight((context) => {
        sessionRef.current?.sendText(context);
      }, persona.image);
    } else {
      stopSpotlight();
    }
  }, [state.status, spotlightEnabled]);

  const startListening = useCallback(async (deviceId?: string) => {
    if (!sessionRef.current?.isConnected()) {
      await connect();
    }
    if (!sessionRef.current?.isConnected()) {
      console.warn("[Phantom] startListening: not connected after connect()");
      return;
    }
    const micId = deviceId || await getSavedMicId();
    playListenStart();
    await sessionRef.current.startListening({
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
    sessionTranscriptRef.current.push(`User: ${text}`);
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
      if (isTabAudioActive()) {
        stopTabAudio();
        setTabAudioEnabledState(false);
      }
    }
  }, [state.status, state.closeCode, connect]);

  useEffect(() => {
    return () => {
      sessionRef.current?.disconnect();
      stopSpotlight();
    };
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
        setVoice: setVoiceState,
        persona,
        setPersonaId,
        visionEnabled,
        setVisionEnabled,
        tabAudioEnabled,
        setTabAudioEnabled,
        spotlightEnabled,
        setSpotlightEnabled,
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
