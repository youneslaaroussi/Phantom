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
import { getAudioInputDevices } from "./live/audio";
import { startSession as startTrace, endSession as endTrace, addTrace } from "./trace";
import { playConnect, playDisconnect, playToolStart, playToolEnd, playError, playListenStart, playListenStop, playVisionOn, playVisionOff, playWake, startThinking } from "./sounds";
import { getSavedPersonaId, savePersonaId, getPersona, type Persona } from "./personas";
import type { LiveSessionState, LiveVoiceName } from "./live/types";
import { buildMemoryContext, summarizeSession } from "./memory/index";
import { playPageLaunchEffect, playPageVisionEffect, playPageAudioEffect } from "./page-effects";
import { startSpotlight, stopSpotlight } from "./spotlight";
import { buildSessionContext } from "./context";
import { showCaption } from "./captions";
import { startEvents, stopEvents } from "./events";

const MODEL_PRIMARY = "gemini-2.5-flash-native-audio-preview-12-2025";
const MODEL_FALLBACK = "gemini-2.5-flash-native-audio-preview-09-2025";

async function getActiveTabMeta(): Promise<string> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      return `Current tab — title: "${tab.title || "unknown"}", URL: ${tab.url || "unknown"}`;
    }
  } catch {}
  return "Current tab — unknown";
}

const TOOL_GUIDELINES = `

Guidelines:
- ACT FIRST, TALK SECOND. When the user asks you to do something, DO IT IMMEDIATELY. Call the tools right away. Don't describe what you're "about to do" or "planning to do" — just do it. Never say "I will now proceed to..." — just proceed.
- Be extremely proactive. If the user says "close all tabs except X", call getTabs and then closeTab for each one in rapid succession. Don't stop to narrate between each action.
- When you get tool results, keep going. Don't pause to summarize intermediate results. Chain tool calls back-to-back until the task is fully complete.
- Be conversational but brief. A quick confirmation after the task is done is enough. Don't narrate every step.
- After using a tool, confirm what happened naturally, as if you did it yourself. Don't mention tool names or describe your internal process.
- If something fails, try an alternative approach on your own before asking the user. Only explain if you're truly stuck.
- Don't read long text aloud — summarize it instead.
- You have tools to navigate tabs, click elements, fill forms, scroll, highlight things, and more. Use them immediately without being asked twice.
- When asked to click buttons, links, icons, or interact with UI elements, prefer computerAction (AI vision clicking) — it's more reliable for visual interactions and works across all UI types.
- For filling forms, typing into inputs, dropdowns, checkboxes, and standard HTML form controls, prefer the DOM tools (clickOn, typeInto, pressKey) with CSS selectors — they are faster and more reliable for structured form elements.
- Use getAccessibilitySnapshot to understand what's on the page when you need to find form fields or understand page structure.
- Use contentAction to highlight text on the page and show a popup with a summary, rewrite, explanation, translation, or simplified version.
- You have memory! Use rememberThis when the user asks you to remember something or when you learn important facts about them.
- Use recallMemory when the user references past sessions or says "do you remember...".
- Use updateUserProfile to store the user's name, preferences, and durable facts about them.
- If the user tells you their name, store it immediately with updateUserProfile.
- When you see a form on the page (signup, checkout, booking, application, etc.), proactively solicit the user for the information needed to fill it out. Read the form fields, then ask the user for the required details naturally — don't wait for them to dictate each field one by one.
- When filling forms or browsing around the page, keep the user's view in sync with what you're doing. Use scroll tools to bring the current field or section into view so the user can see what's happening in real time — don't let actions happen off-screen.`;

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
  cancelTool: () => void;
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
  paused: boolean;
  setPaused: (paused: boolean) => void;
  activeMicName: string;
  activeModel: string;
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
  const [paused, setPausedState] = useState(false);
  const [activeMicName, setActiveMicName] = useState("");
  const modelRef = useRef(MODEL_PRIMARY);
  const savedResumptionHandleRef = useRef<string | null>(null);
  const autoReconnectingRef = useRef(false);
  const internalStateRef = useRef<LiveSessionState | null>(null);
  const [reconnectTick, setReconnectTick] = useState(0);
  const pausedInputsRef = useRef<{ vision: boolean; tabAudio: boolean; spotlight: boolean; listening: boolean }>({ vision: false, tabAudio: false, spotlight: false, listening: false });
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
        const tabMeta = await getActiveTabMeta();
        sessionRef.current?.sendText(`[SYSTEM] Tab audio capture just enabled. The audio stream is starting up — wait 1-2 seconds before reacting to any audio so the stream has time to begin. ${tabMeta}. Listen and respond to what you actually hear.`);
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

  const reconnectTranscriptRef = useRef<string[] | null>(null);

  const connect = useCallback(async () => {
    const previousTranscript = reconnectTranscriptRef.current;
    reconnectTranscriptRef.current = null;

    if (sessionRef.current) {
      const oldHandle = sessionRef.current.getResumptionHandle();
      if (oldHandle) savedResumptionHandleRef.current = oldHandle;
      wasConnectedRef.current = false;
      sessionRef.current.disconnect();
      sessionRef.current = null;
    }

    const tools = getToolDeclarations();

    if (!previousTranscript) {
      sessionTranscriptRef.current = [];
      sessionToolCallsRef.current = [];
    }

    let memoryContext = "";
    try {
      memoryContext = await buildMemoryContext();
      if (memoryContext) {
        addTrace("system", `Memory context injected (${memoryContext.length} chars)`);
      }
    } catch (err) {
      addTrace("system", `Memory context failed: ${err}`);
      console.warn("[Phantom] Failed to build memory context:", err);
    }

    const agentConfig = `\n\nYour config:\nPersona: ${persona.name} (${persona.id})\nAvatar: ${persona.image}\nVoice: ${voice}\nVision: ${visionEnabled ? "on" : "off"}\nTab audio: ${tabAudioEnabled ? "on" : "off"}\nCursor spotlight: ${spotlightEnabled ? "on" : "off"}`;

    const session = new LiveSession(
      {
        model: modelRef.current,
        systemInstruction: persona.prompt + TOOL_GUIDELINES + memoryContext + buildSessionContext() + agentConfig + (visionEnabled ? VISION_ON_ADDENDUM : VISION_OFF_ADDENDUM),
        tools,
        responseModalities: ["AUDIO"],
        voice,
      },
      {
        onStateChange: (s) => {
          if (autoReconnectingRef.current && !userDisconnectRef.current) {
            if (s.status === "connected") {

              autoReconnectingRef.current = false;
              setState(s);
            }
            if (s.status === "disconnected") {

              internalStateRef.current = s;
              setReconnectTick((t) => t + 1);
            }
            return;
          }
          if (userDisconnectRef.current) {

            autoReconnectingRef.current = false;
            setState(s);
            return;
          }
          if (s.status === "disconnected" && wasConnectedRef.current) {
            autoReconnectingRef.current = true;
            internalStateRef.current = s;
            setReconnectTick((t) => t + 1);
            return;
          }
          setState(s);
        },
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
          showCaption(text, "user");
        },
        onOutputTranscription: (text) => {
          addTrace("agent_speech", text);
          sessionTranscriptRef.current.push(`Agent: ${text}`);
          showCaption(text, "agent");
        },
        onGoAway: (timeLeft) => {
          addTrace("system", `Server GoAway — ${timeLeft || "reconnecting soon"}`);
          console.log("[Phantom] GoAway received, auto-reconnect will handle it");
        },
        onError: (err) => {
          addTrace("error", err instanceof Error ? err.message : String(err));
          if (!silent && !autoReconnectingRef.current) {
            toast("error", err instanceof Error ? err.message : String(err));
          }
        },
      },
      savedResumptionHandleRef.current
    );
    savedResumptionHandleRef.current = null;

    sessionRef.current = session;
    startTrace();
    addTrace("system", `Connecting with model ${modelRef.current}, voice ${voice}`);

    const silent = autoReconnectingRef.current;
    try {
      const serverUrl = await getServerUrl();
      const wsUrl = serverUrl.replace(/\/$/, "") + "/ws/live";
      await session.connect({ proxyUrl: wsUrl });
      addTrace("system", silent ? "Silently reconnected" : "Connected");
      if (!silent) {
        playConnect();
        toast("success", "Connected");
        playPageLaunchEffect(persona.image).catch(() => {});
      }
      startEvents((text) => {
        if (sessionRef.current?.isConnected()) {
          addTrace("system", text);
          sessionRef.current.sendText(text);
        }
      });
      if (previousTranscript && previousTranscript.length > 0) {
        const traceWindow = previousTranscript.slice(-30).join("\n");
        session.sendText(`[SYSTEM] You were disconnected mid-conversation. Here is the conversation so far:\n${traceWindow}\n\nContinue naturally from where we left off. Do NOT re-introduce yourself or say hi again.`);
      } else {
        session.sendText("Say hi! Greet the user briefly in character. Keep it to one short sentence.");
      }
    } catch (err) {
      addTrace("error", `Connect failed: ${err instanceof Error ? err.message : String(err)} (silent=${silent} autoReconnecting=${autoReconnectingRef.current})`);
      if (!silent) {
        playError();
        toast("error", `Connection failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }, [voice, visionEnabled, persona]);

  const disconnect = useCallback(() => {

    userDisconnectRef.current = true;
    autoReconnectingRef.current = false;
    sessionRef.current?.cancelToolExecution();
    playDisconnect();
    addTrace("system", "Disconnected");
    modelRef.current = MODEL_PRIMARY;

    const transcript = sessionTranscriptRef.current.join("\n");
    const toolCalls = [...sessionToolCallsRef.current];
    if (transcript.length > 20) {
      addTrace("system", "Summarizing session...");
      summarizeSession(transcript, toolCalls)
        .then(() => addTrace("system", "Session summary stored"))
        .catch((err) => {
          addTrace("system", `Session summary failed: ${err}`);
          console.warn("[Phantom] Session summary failed:", err);
        });
    }

    endTrace();
    stopEvents();
    stopVision();
    stopTabAudio();
    stopSpotlight();
    setTabAudioEnabledState(false);
    setSpotlightEnabledState(false);
    setPausedState(false);

    sessionRef.current?.disconnect();
    sessionRef.current = null;
    setState({ status: "disconnected", isListening: false, isSpeaking: false });
    setTranscript("");
    setExecutingTool(null);
    setInputLevel(0);
    setOutputLevel(0);
    setActiveMicName("");
  }, []);

  // Vision toggle
  const setVisionEnabled = useCallback(async (enabled: boolean) => {
    setVisionEnabledState(enabled);
    if (enabled && sessionRef.current?.isConnected()) {
      playVisionOn();
      addTrace("system", "Vision enabled");
      playPageVisionEffect().catch(() => {});
      startVision((base64, mimeType) => {
        addTrace("vision_frame", "frame sent");
        sessionRef.current?.sendImage(base64, mimeType);
      }, persona.image);
      const tabMeta = await getActiveTabMeta();
      sessionRef.current?.sendText(`[SYSTEM] Screen vision just enabled. The first frames are arriving now — wait 1-2 seconds before describing anything so you see a real frame, not a blank or stale image. ${tabMeta}. Describe only what you actually see once frames start flowing.`);
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
        addTrace("vision_frame", "frame sent");
        sessionRef.current?.sendImage(base64, mimeType);
      }, persona.image);
    } else if (!visionEnabled) {
      stopVision();
    }
  }, [state.status, visionEnabled]);

  // Spotlight toggle
  const setSpotlightEnabled = useCallback(async (enabled: boolean) => {
    setSpotlightEnabledState(enabled);
    if (enabled && sessionRef.current?.isConnected()) {
      addTrace("system", "Spotlight enabled");
      startSpotlight((context) => {
        sessionRef.current?.sendText(context);
      }, persona.image);
      const tabMeta = await getActiveTabMeta();
      sessionRef.current?.sendText(`[SYSTEM] Cursor spotlight just enabled. It takes a moment before cursor context starts arriving — do not hallucinate element data until you receive the first [SPOTLIGHT] message. ${tabMeta}. Use cursor context to understand what the user is focused on. Only comment on it if the user asks or if it's relevant to the conversation.`);
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

  const setPaused = useCallback((pause: boolean) => {
    if (pause) {
      pausedInputsRef.current = {
        vision: isVisionActive(),
        tabAudio: isTabAudioActive(),
        spotlight: spotlightEnabled,
        listening: state.isListening,
      };
      addTrace("system", "Inputs paused");
      if (isVisionActive()) stopVision();
      if (isTabAudioActive()) stopTabAudio();
      stopSpotlight();
      if (state.isListening) sessionRef.current?.stopListening();
      if (sessionRef.current?.isConnected()) {
        sessionRef.current.sendText("[SYSTEM] All inputs paused. Vision, tab audio, spotlight, and mic are temporarily disabled.");
      }
    } else {
      addTrace("system", "Inputs resumed");
      const prev = pausedInputsRef.current;
      if (prev.vision && sessionRef.current?.isConnected()) {
        startVision((base64, mimeType) => {
          addTrace("vision_frame", "frame sent");
          sessionRef.current?.sendImage(base64, mimeType);
        }, persona.image);
      }
      if (prev.tabAudio && sessionRef.current?.isConnected()) {
        startTabAudio((pcm) => sessionRef.current?.pushTabAudio(pcm) ?? false).catch(() => {});
      }
      if (prev.spotlight && sessionRef.current?.isConnected()) {
        startSpotlight((context) => {
          sessionRef.current?.sendText(context);
        }, persona.image);
      }
      if (prev.listening && sessionRef.current?.isConnected()) {
        sessionRef.current.startListening({ onAudioLevel: setInputLevel }).catch(() => {});
      }
      if (sessionRef.current?.isConnected()) {
        sessionRef.current.sendText("[SYSTEM] All inputs resumed. Previously active inputs have been restored.");
      }
    }
    setPausedState(pause);
  }, [spotlightEnabled, state.isListening, persona.image]);

  const startListening = useCallback(async (deviceId?: string) => {
    if (!sessionRef.current?.isConnected()) {
      await connect();
    }
    if (!sessionRef.current?.isConnected()) {
      console.warn("[Phantom] startListening: not connected after connect()");
      return;
    }
    const micId = deviceId || await getSavedMicId();
    try {
      const devices = await getAudioInputDevices();
      const match = devices.find((d) => d.deviceId === micId);
      setActiveMicName(match?.label || devices[0]?.label || "Microphone");
    } catch {}
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

  const cancelTool = useCallback(() => {
    if (!sessionRef.current) return;
    addTrace("system", "Tool execution cancelled by user");
    sessionRef.current.cancelToolExecution();
  }, []);

  const wasConnectedRef = useRef(false);
  const userDisconnectRef = useRef(false);

  useEffect(() => {
    if (state.status === "connected") {
      wasConnectedRef.current = true;
    }
    if (state.status === "disconnected" && wasConnectedRef.current) {
      wasConnectedRef.current = false;
      addTrace("system", `[useEffect] disconnected. userDisconnect=${userDisconnectRef.current} autoReconnecting=${autoReconnectingRef.current}`);
      if (userDisconnectRef.current) {
        addTrace("system", "[useEffect] user disconnect — not reconnecting");
        userDisconnectRef.current = false;
        if (isTabAudioActive()) {
          stopTabAudio();
          setTabAudioEnabledState(false);
        }
        return;
      }
      autoReconnectingRef.current = true;
      const is1008 = state.closeReason?.includes("1008");
      if (is1008 && modelRef.current === MODEL_PRIMARY) {
        modelRef.current = MODEL_FALLBACK;
        addTrace("system", `1008 detected — switching to ${MODEL_FALLBACK}`);
      }
      reconnectTranscriptRef.current = [...sessionTranscriptRef.current];
      addTrace("system", `[useEffect] Auto-reconnecting (code=${state.closeCode} reason=${state.closeReason?.slice(0, 80)})`);
      connect().catch(() => {});
    }
  }, [state.status, state.closeCode, state.closeReason, connect]);

  useEffect(() => {
    if (!reconnectTick || !autoReconnectingRef.current) return;
    const s = internalStateRef.current;
    if (!s) return;
    internalStateRef.current = null;
    const is1008 = s.closeReason?.includes("1008");
    if (is1008 && modelRef.current === MODEL_PRIMARY) {
      modelRef.current = MODEL_FALLBACK;
      addTrace("system", `1008 detected — switching to ${MODEL_FALLBACK}`);
    }
    reconnectTranscriptRef.current = [...sessionTranscriptRef.current];
    addTrace("system", `Silent reconnect (code=${s.closeCode} reason=${s.closeReason?.slice(0, 80)})`);
    connect().catch(() => {});
  }, [reconnectTick, connect]);

  useEffect(() => {
    return () => {
      sessionRef.current?.disconnect();
      stopEvents();
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
        cancelTool,
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
        paused,
        setPaused,
        activeMicName,
        activeModel: modelRef.current,
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
