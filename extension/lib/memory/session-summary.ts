/**
 * Session summarization on disconnect.
 *
 * When the user disconnects, we collect whatever transcript/trace data
 * we have and ask the server to summarize it via a quick Gemini call.
 * The summary is stored as a session memory with an embedding.
 */

import { getServerUrl } from "../connection-mode";
import { addMemory } from "./store";

/**
 * Summarize the current session and store it as a memory.
 * Called on disconnect.
 */
export async function summarizeSession(
  transcript: string,
  toolCalls: string[] = []
): Promise<void> {
  if (!transcript || transcript.trim().length < 20) {
    console.log("[Memory] Session too short to summarize, skipping");
    return;
  }

  try {
    const serverUrl = await getServerUrl();
    const httpUrl = serverUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
    const response = await fetch(
      `${httpUrl.replace(/\/$/, "")}/api/summarize`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcript.slice(0, 8000), // Cap to avoid huge payloads
          toolCalls: toolCalls.slice(0, 20),
        }),
      }
    );

    if (!response.ok) {
      console.warn("[Memory] Summary API failed:", response.status);
      // Fallback: store a truncated version of the transcript
      await addMemory(
        `Session: ${transcript.slice(0, 300)}`,
        "session_summary"
      );
      return;
    }

    const { summary } = await response.json();
    if (summary) {
      await addMemory(summary, "session_summary");
      console.log("[Memory] Session summary stored:", summary.slice(0, 100));
    }
  } catch (err) {
    console.warn("[Memory] Failed to summarize session:", err);
    // Fallback: store raw transcript snippet
    await addMemory(
      `Session: ${transcript.slice(0, 300)}`,
      "session_summary"
    );
  }
}
