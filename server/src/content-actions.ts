/**
 * Content action endpoint — summarize, rewrite, explain, translate, simplify.
 * Uses a fast Gemini model (Flash Lite) for quick responses.
 */

import { GoogleGenAI } from "@google/genai";
import { nextApiKey, markKeyFailed, markKeySuccess } from "./key-manager.js";

const MODEL = "gemini-2.5-flash-lite";

type ActionType = "summarize" | "rewrite" | "explain" | "translate" | "simplify";

const PROMPTS: Record<ActionType, string> = {
  summarize:
    "Summarize the following text concisely. Keep the key points and important details. Output only the summary, no preamble.",
  rewrite:
    "Rewrite the following text to be clearer and more polished. Maintain the same meaning and tone. Output only the rewritten text.",
  explain:
    "Explain the following text in simple terms. What does it mean and why does it matter? Be concise (2-4 sentences).",
  translate:
    "Translate the following text to English. If it's already in English, translate to French. Output only the translation.",
  simplify:
    "Simplify the following text so a 10-year-old could understand it. Keep the core meaning. Output only the simplified version.",
};

export interface ContentActionRequest {
  text: string;
  action: ActionType;
  instruction?: string;
}

export async function handleContentAction(
  req: ContentActionRequest
): Promise<{ result: string }> {
  const apiKey = nextApiKey();
  if (!apiKey) throw new Error("No API key configured");

  const ai = new GoogleGenAI({ apiKey });

  const basePrompt = PROMPTS[req.action] || PROMPTS.explain;
  const extra = req.instruction ? `\n\nAdditional instruction: ${req.instruction}` : "";

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [{ text: `${basePrompt}${extra}\n\nText:\n${req.text}` }],
        },
      ],
    });

    const text =
      response.candidates?.[0]?.content?.parts?.[0]?.text || "Unable to process.";

    markKeySuccess(apiKey);
    return { result: text.trim() };
  } catch (err) {
    markKeyFailed(apiKey);
    throw err;
  }
}
