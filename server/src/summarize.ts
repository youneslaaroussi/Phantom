/**
 * Session summarization endpoint.
 *
 * Takes a transcript + tool calls and returns a concise summary
 * suitable for memory storage.
 */

import { GoogleGenAI } from "@google/genai";
import { nextApiKey, markKeyFailed, markKeySuccess, getKeyCount } from "./key-manager.js";

const SUMMARIZE_MODEL = "gemini-2.5-flash-lite";

export interface SummarizeRequest {
  transcript: string;
  toolCalls?: string[];
}

export async function handleSummarize(
  req: SummarizeRequest
): Promise<{ summary: string }> {
  if (getKeyCount() === 0) throw new Error("No API key configured");

  const toolContext = req.toolCalls?.length
    ? `\n\nTools used: ${req.toolCalls.join(", ")}`
    : "";

  const contents = [
    {
      role: "user" as const,
      parts: [
        {
          text: `Summarize this voice assistant session in 1-3 sentences. Focus on what the user wanted and what was accomplished. Be specific about websites, topics, or tasks mentioned. Do not include filler or pleasantries.

Transcript:
${req.transcript}${toolContext}

Summary:`,
        },
      ],
    },
  ];

  const keyCount = getKeyCount();
  for (let attempt = 0; attempt < keyCount; attempt++) {
    const apiKey = nextApiKey()!;
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: SUMMARIZE_MODEL,
        contents,
      });

      const text =
        response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) {
        markKeySuccess(apiKey);
        return { summary: text };
      }
    } catch (err) {
      markKeyFailed(apiKey);
      console.warn(`[Summarize] Key ${attempt + 1}/${keyCount} failed:`, err);
    }
  }

  return { summary: "Session occurred." };
}
