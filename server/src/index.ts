import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createNodeWebSocket } from "@hono/node-ws";
import { createGeminiProxy } from "./proxy.js";

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// WebSocket proxy to Gemini Live
app.get(
  "/ws/live",
  upgradeWebSocket(() => {
    let proxy: ReturnType<typeof createGeminiProxy> | null = null;

    return {
      onOpen(_event, ws) {
        console.log("[ws] Client connected");
        proxy = createGeminiProxy(
          {
            send: (data: string) => ws.send(data),
            close: (code?: number, reason?: string) => ws.close(code, reason),
          },
          () => {
            proxy = null;
          }
        );
      },
      onMessage(event, _ws) {
        const data = typeof event.data === "string" ? event.data : event.data.toString();
        proxy?.send(data);
      },
      onClose() {
        console.log("[ws] Client disconnected");
        proxy?.close();
        proxy = null;
      },
      onError(event) {
        console.error("[ws] Client error:", event);
        proxy?.close();
        proxy = null;
      },
    };
  })
);

// Landing page — static files from /public
app.use("/*", serveStatic({ root: "./public" }));

const port = parseInt(process.env.PORT || "8080");

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Phantom server running on http://localhost:${info.port}`);
});

injectWebSocket(server);
