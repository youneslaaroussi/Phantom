/**
 * Gemini Live proxy using Google GenAI SDK
 *
 * Client sends JSON messages over WebSocket.
 * Server maintains a GenAI Live session and relays between them.
 */

import { GoogleGenAI, Modality, type Session } from "@google/genai";
import { nextApiKey, markKeyFailed, markKeySuccess } from "./key-manager.js";

interface ClientWs {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
}

export function createGeminiProxy(clientWs: ClientWs, onClose: () => void) {
  const apiKey = nextApiKey() as string;
  if (!apiKey) {
    clientWs.send(JSON.stringify({ error: "Server API key not configured" }));
    clientWs.close(1008, "No API key");
    onClose();
    return { send: (_d: string) => {}, close: () => {} };
  }

  let session: Session | null = null;
  let setupReceived = false;
  const buffer: string[] = [];
  let inputGated = false;
  let lastVideoFrame: any = null;

  async function initSession(setupMsg: Record<string, unknown>) {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1alpha" } });
    const setup = setupMsg.setup as Record<string, unknown>;
    const genConfig = (setup.generationConfig || {}) as Record<string, unknown>;

    const config: Record<string, unknown> = {};

    // Response modalities
    if (genConfig.responseModalities) config.responseModalities = genConfig.responseModalities;

    // System instruction
    if (setup.systemInstruction) config.systemInstruction = setup.systemInstruction;

    // Tools (function calling)
    if (setup.tools) config.tools = setup.tools;

    // Voice / speech config
    if (genConfig.speechConfig) config.speechConfig = genConfig.speechConfig;

    // ─── Session Resumption ───
    // Allows seamless reconnection when the ~10 min WebSocket resets.
    // Server sends SessionResumptionUpdate with a handle token;
    // client stores it and passes it back on reconnect.
    config.sessionResumption = setup.sessionResumption || {};

    // ─── Context Window Compression ───
    // Sliding window compression so sessions can run much longer
    // (without this: audio-only ~15min, audio+video ~2min)
    config.contextWindowCompression = {
      slidingWindow: {},
      ...(setup.contextWindowCompression as object || {}),
    };

    // ─── Audio Transcription ───
    // Get text transcripts of both user speech and model speech.
    config.inputAudioTranscription = setup.inputAudioTranscription || {};
    config.outputAudioTranscription = setup.outputAudioTranscription || {};

    // ─── Affective Dialog ───
    // Model picks up on tone, emotion, pace for natural conversation.
    if (genConfig.enableAffectiveDialog !== false) {
      config.enableAffectiveDialog = true;
    }

    // ─── Proactive Audio ───
    // Model only responds when relevant — prevents talking over noise.
    if (setup.proactivity || genConfig.proactiveAudio !== false) {
      config.proactivity = setup.proactivity || { proactiveAudio: true };
    }

    // ─── Google Search Grounding ───
    // Pass through if client requests it
    if (setup.googleSearch) {
      if (!config.tools) config.tools = [];
      (config.tools as any[]).push({ googleSearch: setup.googleSearch });
    }

    const modelName = (setup.model as string || "").replace("models/", "");

    try {
      session = await ai.live.connect({
        model: modelName,
        config: config as any,
        callbacks: {
          onopen() {
            console.log("[genai] Session opened");
            markKeySuccess(apiKey);
            clientWs.send(JSON.stringify({ setupComplete: {} }));
            for (const msg of buffer) {
              handleClientMessage(msg);
            }
            buffer.length = 0;
          },
          onmessage(message: any) {
            if (message.toolCall?.functionCalls?.length) {
              inputGated = true;
            }
            if (message.serverContent?.modelTurn) {
              inputGated = true;
            }
            if (message.serverContent?.turnComplete) {
              inputGated = false;
              lastVideoFrame = null;
            }
            clientWs.send(JSON.stringify(message));
          },
          onerror(e: any) {
            console.error("[genai] Error:", e.message || e);
            console.error("[genai] Error details:", JSON.stringify(e).slice(0, 1000));
            clientWs.close(1011, `Gemini error: ${(e.message || "unknown").slice(0, 100)}`);
            onClose();
          },
          onclose(e: any) {
            const code = e.code || "none";
            const reason = (typeof e.reason === "string" ? e.reason : typeof e === "string" ? e : JSON.stringify(e)).slice(0, 200);
            console.log("[genai] Closed: code=%s reason=%s", code, reason);
            clientWs.close(1000, `Gemini closed: code=${code} reason=${reason}`.slice(0, 123));
            onClose();
          },
        },
      });
    } catch (err: any) {
      console.error("[genai] Connect failed:", err.message);
      markKeyFailed(apiKey);
      clientWs.send(JSON.stringify({ error: err.message }));
      clientWs.close(1011, "Connect failed");
      onClose();
    }
  }

  let msgCount = 0;

  function handleClientMessage(raw: string) {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw);
    } catch {
      console.error("[proxy] Failed to parse client message:", raw.slice(0, 200));
      return;
    }

    msgCount++;
    const type = msg.setup ? "setup" : msg.realtimeInput ? "realtimeInput" : msg.clientContent ? "clientContent" : msg.toolResponse ? "toolResponse" : "unknown";

    if (type !== "realtimeInput") {
      console.log("[proxy] msg#%d type=%s size=%d session=%s", msgCount, type, raw.length, session ? "alive" : "null");
    }

    if (msg.setup && !setupReceived) {
      setupReceived = true;
      const sysLen = JSON.stringify((msg.setup as any)?.systemInstruction || "").length;
      const toolsLen = JSON.stringify((msg.setup as any)?.tools || []).length;
      console.log("[proxy] Setup: systemInstruction=%d chars, tools=%d chars", sysLen, toolsLen);
      initSession(msg);
      return;
    }

    if (!session) {
      console.log("[proxy] Buffering msg#%d (no session yet)", msgCount);
      buffer.push(raw);
      return;
    }

    try {
      if (msg.realtimeInput) {
        const ri = msg.realtimeInput as Record<string, unknown>;
        if (inputGated) {
          if (ri.video) lastVideoFrame = ri.video;
          return;
        }
        if (ri.audio) {
          session.sendRealtimeInput({ audio: ri.audio as any });
        }
        if (ri.video) {
          session.sendRealtimeInput({ video: ri.video as any });
        }
        if (ri.text) {
          session.sendRealtimeInput({ text: ri.text as string });
        }
        return;
      }

      if (msg.clientContent) {
        if (inputGated) return;
        session.sendClientContent(msg.clientContent as any);
        return;
      }

      if (msg.toolResponse) {
        inputGated = false;
        session.sendToolResponse(msg.toolResponse as any);
        return;
      }

      console.log("[proxy] Unhandled message type: %s", type);
    } catch (err: any) {
      console.error("[proxy] Error sending to Gemini: %s", err.message || err);
    }
  }

  return {
    send(data: string) {
      handleClientMessage(data);
    },
    close() {
      if (session) {
        session.close();
        session = null;
      }
    },
  };
}
