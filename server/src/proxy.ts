/**
 * Gemini Live WebSocket proxy
 * 
 * Client connects to /ws/live, server relays to Gemini Live API.
 * API key stays server-side. Client never sees it.
 */

import { WebSocket as WS } from "ws";

const GEMINI_WS_BASE =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

export function createGeminiProxy(
  clientWs: { send: (data: string) => void; close: (code?: number, reason?: string) => void },
  onClose: () => void
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    clientWs.send(JSON.stringify({ error: "Server API key not configured" }));
    clientWs.close(1008, "No API key");
    onClose();
    return { send: () => {}, close: () => {} };
  }

  const url = `${GEMINI_WS_BASE}?key=${apiKey}`;
  const upstream = new WS(url);

  let clientOpen = true;
  let upstreamOpen = false;
  const buffer: string[] = [];

  upstream.on("open", () => {
    upstreamOpen = true;
    // Flush any messages buffered while connecting
    for (const msg of buffer) {
      upstream.send(msg);
    }
    buffer.length = 0;
  });

  upstream.on("message", (data) => {
    if (clientOpen) {
      clientWs.send(data.toString());
    }
  });

  upstream.on("close", (code, reason) => {
    if (clientOpen) {
      clientWs.close(code, reason.toString());
      clientOpen = false;
    }
    onClose();
  });

  upstream.on("error", (err) => {
    console.error("[proxy] Upstream error:", err.message);
    if (clientOpen) {
      clientWs.close(1011, "Upstream error");
      clientOpen = false;
    }
    onClose();
  });

  return {
    send(data: string) {
      if (upstreamOpen) {
        upstream.send(data);
      } else {
        buffer.push(data);
      }
    },
    close() {
      clientOpen = false;
      if (upstreamOpen) {
        upstream.close();
      }
    },
  };
}
