/**
 * Gemini Live proxy using Google GenAI SDK
 *
 * Client sends JSON messages over WebSocket.
 * Server maintains a GenAI Live session and relays between them.
 */

import { GoogleGenAI, Modality, type Session } from "@google/genai";

const apiKeys: string[] = (
  process.env.GOOGLE_GENERATIVE_AI_API_KEYS ||
  process.env.GEMINI_API_KEY ||
  ""
)
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

let keyIndex = 0;
function nextApiKey(): string | undefined {
  if (apiKeys.length === 0) return undefined;
  const key = apiKeys[keyIndex % apiKeys.length];
  keyIndex++;
  return key;
}

interface ClientWs {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
}

export function createGeminiProxy(clientWs: ClientWs, onClose: () => void) {
  const apiKey = nextApiKey();
  if (!apiKey) {
    clientWs.send(JSON.stringify({ error: "Server API key not configured" }));
    clientWs.close(1008, "No API key");
    onClose();
    return { send: (_d: string) => {}, close: () => {} };
  }

  let session: Session | null = null;
  let setupReceived = false;
  const buffer: string[] = [];

  async function initSession(setupMsg: Record<string, unknown>) {
    const ai = new GoogleGenAI({ apiKey });
    const setup = setupMsg.setup as Record<string, unknown>;

    const config: Record<string, unknown> = {};
    if (setup.generationConfig) config.responseModalities = (setup.generationConfig as Record<string, unknown>).responseModalities;
    if (setup.systemInstruction) config.systemInstruction = setup.systemInstruction;
    if (setup.tools) config.tools = setup.tools;
    if ((setup.generationConfig as Record<string, unknown>)?.speechConfig) {
      config.speechConfig = (setup.generationConfig as Record<string, unknown>).speechConfig;
    }

    const modelName = (setup.model as string || "").replace("models/", "");

    try {
      session = await ai.live.connect({
        model: modelName,
        config: config as any,
        callbacks: {
          onopen() {
            console.log("[genai] Session opened");
            clientWs.send(JSON.stringify({ setupComplete: {} }));
            for (const msg of buffer) {
              handleClientMessage(msg);
            }
            buffer.length = 0;
          },
          onmessage(message: any) {
            clientWs.send(JSON.stringify(message));
          },
          onerror(e: any) {
            console.error("[genai] Error:", e.message || e);
            clientWs.close(1011, "Gemini error");
            onClose();
          },
          onclose(e: any) {
            console.log("[genai] Closed:", e.reason || e.code || "");
            clientWs.close(1000, "Session ended");
            onClose();
          },
        },
      });
    } catch (err: any) {
      console.error("[genai] Connect failed:", err.message);
      clientWs.send(JSON.stringify({ error: err.message }));
      clientWs.close(1011, "Connect failed");
      onClose();
    }
  }

  function handleClientMessage(raw: string) {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.setup && !setupReceived) {
      setupReceived = true;
      initSession(msg);
      return;
    }

    if (!session) {
      buffer.push(raw);
      return;
    }

    if (msg.realtimeInput) {
      const ri = msg.realtimeInput as Record<string, unknown>;
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
      session.sendClientContent(msg.clientContent as any);
      return;
    }

    if (msg.toolResponse) {
      session.sendToolResponse(msg.toolResponse as any);
      return;
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
