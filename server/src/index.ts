import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createNodeWebSocket } from "@hono/node-ws";
import { createGeminiProxy } from "./proxy.js";
import { handleComputerUse } from "./computer-use.js";
import { handleSummarize } from "./summarize.js";
import { handleContentAction } from "./content-actions.js";

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.get("/health", (c) => c.json({ status: "ok", version: "1.0.0" }));

// Computer Use sidecar endpoint
app.post("/api/computer-use", async (c) => {
  try {
    const body = await c.req.json();
    const result = await handleComputerUse(body);
    return c.json(result);
  } catch (err: any) {
    console.error("[api] computer-use error:", err);
    return c.json({ success: false, actions: [], error: err.message }, 500);
  }
});

// Session summarization endpoint
app.post("/api/summarize", async (c) => {
  try {
    const body = await c.req.json();
    const result = await handleSummarize(body);
    return c.json(result);
  } catch (err: any) {
    console.error("[api] summarize error:", err);
    return c.json({ summary: "" }, 500);
  }
});

// Content action endpoint (summarize, rewrite, explain, etc.)
app.post("/api/content-action", async (c) => {
  try {
    const body = await c.req.json();
    const result = await handleContentAction(body);
    return c.json(result);
  } catch (err: any) {
    console.error("[api] content-action error:", err);
    return c.json({ result: `Error: ${err.message}` }, 500);
  }
});

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

// Blog route
app.get("/blog", (c) => {
  return c.redirect("/blog.html");
});

app.get("/privacy", (c) => {
  return c.redirect("/privacy.html");
});

app.get("/terms", (c) => {
  return c.redirect("/terms.html");
});

app.use("/*", serveStatic({ root: "./public" }));

const port = parseInt(process.env.PORT || "8080");
const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Phantom server running on http://localhost:${info.port}`);
});

injectWebSocket(server);
