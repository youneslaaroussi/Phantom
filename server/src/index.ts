import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createNodeWebSocket } from "@hono/node-ws";
import { createGeminiProxy } from "./proxy.js";

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.get("/health", (c) => c.json({ status: "ok" }));

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
          () => { proxy = null; }
        );
      },
      onMessage(event, _ws) {
        const raw = event.data;
        const data = typeof raw === "string" ? raw
          : Buffer.isBuffer(raw) ? raw.toString("utf-8")
          : raw instanceof ArrayBuffer ? Buffer.from(raw).toString("utf-8")
          : Array.isArray(raw) ? Buffer.concat(raw).toString("utf-8")
          : String(raw);
        proxy?.send(data);
      },
      onClose() {
        proxy?.close();
        proxy = null;
      },
      onError(event) {
        console.error("[ws] Error:", event);
        proxy?.close();
        proxy = null;
      },
    };
  })
);

app.use("/*", serveStatic({ root: "./public" }));

const port = parseInt(process.env.PORT || "8080");
const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Phantom server running on http://localhost:${info.port}`);
});

injectWebSocket(server);
