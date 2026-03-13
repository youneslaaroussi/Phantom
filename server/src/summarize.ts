/**
 * Session summarization endpoint.
 *
 * Takes a transcript + tool calls and returns a concise summary
 * suitable for memory storage.
 */

import { GoogleGenAI } from "@google/genai";

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

const SUMMARIZE_MODEL = "gemini-2.5-flash-lite";

export interface SummarizeRequest {
  transcript: string;
  toolCalls?: string[];
}

export async function handleSummarize(
  req: SummarizeRequest
): Promise<{ summary: string }> {
  const apiKey = nextApiKey();
  if (!apiKey) throw new Error("No API key configured");

  const ai = new GoogleGenAI({ apiKey });

  const toolContext = req.toolCalls?.length
    ? `\n\nTools used: ${req.toolCalls.join(", ")}`
    : "";

  const response = await ai.models.generateContent({
    model: SUMMARIZE_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Summarize this voice assistant session in 1-3 sentences. Focus on what the user wanted and what was accomplished. Be specific about websites, topics, or tasks mentioned. Do not include filler or pleasantries.

Transcript:
${req.transcript}${toolContext}

Summary:`,
          },
        ],
      },
    ],
  });

  const text =
    response.candidates?.[0]?.content?.parts?.[0]?.text || "Session occurred.";

  return { summary: text.trim() };
}
