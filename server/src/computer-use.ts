/**
 * Computer Use API endpoint
 *
 * Two modes:
 * 1. Native Computer Use tool (gemini-3-flash-preview) — uses the proper
 *    computerUse tool API with click_at/type_text/etc function calls
 * 2. Vision fallback (any model with vision) — sends screenshot + prompt,
 *    asks for JSON coordinates. Works with gemini-2.5-flash, 2.0-flash, etc.
 *
 * The client doesn't need to care which mode is used.
 */

import { GoogleGenAI } from "@google/genai";
import { nextApiKey, markKeyFailed, markKeySuccess } from "./key-manager.js";

interface ComputerUseAction {
  type:
    | "click"
    | "doubleClick"
    | "type"
    | "scroll"
    | "drag"
    | "keyPress"
    | "hover"
    | "wait"
    | "navigate"
    | "goBack"
    | "goForward"
    | "search";
  x?: number;
  y?: number;
  endX?: number;
  endY?: number;
  text?: string;
  key?: string;
  direction?: string;
  amount?: number;
  delayMs?: number;
  url?: string;
  pressEnter?: boolean;
  clearBeforeTyping?: boolean;
}

interface ComputerUseRequest {
  model: string;
  task: string;
  screenshot: string;
  mimeType: string;
}

interface ComputerUseResponse {
  success: boolean;
  actions: ComputerUseAction[];
  reasoning?: string;
  error?: string;
  mode?: "native" | "vision";
}

// Models that support native Computer Use tool
const NATIVE_CU_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3-pro-preview",
];

// Fallback vision model for coordinate extraction
const VISION_FALLBACK_MODEL = "gemini-2.5-flash";

export async function handleComputerUse(req: ComputerUseRequest): Promise<ComputerUseResponse> {
  const apiKey = nextApiKey();
  if (!apiKey) {
    return { success: false, actions: [], error: "No API key configured" };
  }

  const requestedModel = req.model || "gemini-3-flash-preview";

  // Try native Computer Use first if the model supports it
  if (NATIVE_CU_MODELS.includes(requestedModel)) {
    try {
      const result = await tryNativeComputerUse(apiKey, requestedModel, req);
      if (result.success) {
        markKeySuccess(apiKey);
        return result;
      }
      console.log("[computer-use] Native CU failed, falling back to vision:", result.error);
    } catch (err: any) {
      console.log("[computer-use] Native CU error, falling back:", err.message);
    }
  }

  // Fallback: vision-based coordinate extraction
  try {
    const result = await tryVisionFallback(apiKey, VISION_FALLBACK_MODEL, req);
    markKeySuccess(apiKey);
    return result;
  } catch (err: any) {
    // Last resort: try with the requested model without CU tool
    try {
      const result = await tryVisionFallback(apiKey, requestedModel, req);
      markKeySuccess(apiKey);
      return result;
    } catch (err2: any) {
      markKeyFailed(apiKey);
      return { success: false, actions: [], error: `All methods failed. Last error: ${err2.message}` };
    }
  }
}

// ─── Native Computer Use (Gemini 3 models) ───

async function tryNativeComputerUse(
  apiKey: string,
  model: string,
  req: ComputerUseRequest
): Promise<ComputerUseResponse> {
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data: req.screenshot,
              mimeType: req.mimeType,
            },
          },
          { text: req.task },
        ],
      },
    ],
    config: {
      tools: [
        {
          computerUse: {
            environment: "ENVIRONMENT_BROWSER",
          },
        } as any,
      ],
    },
  } as any);

  // Parse native function calls
  const candidates = response.candidates || [];
  const actions: ComputerUseAction[] = [];
  let reasoning = "";

  for (const candidate of candidates) {
    const parts = candidate.content?.parts || [];
    for (const part of parts) {
      if (part.text) reasoning += part.text;
      if ((part as any).functionCall) {
        const action = mapNativeFunctionCall((part as any).functionCall);
        if (action) actions.push(action);
      }
    }
  }

  if (actions.length === 0 && !reasoning) {
    return { success: false, actions: [], error: "No actions from native CU" };
  }

  return { success: true, actions, reasoning, mode: "native" };
}

// ─── Vision Fallback (any model with vision) ───

async function tryVisionFallback(
  apiKey: string,
  model: string,
  req: ComputerUseRequest
): Promise<ComputerUseResponse> {
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data: req.screenshot,
              mimeType: req.mimeType,
            },
          },
          {
            text: `Look at this screenshot carefully. I need you to help me: ${req.task}

Return a JSON object (no markdown, no code blocks) with:
{
  "reasoning": "brief description of what you see and what to do",
  "actions": [
    {
      "type": "click",
      "x": <number 0-1000>,
      "y": <number 0-1000>
    }
  ]
}

Coordinate system: 1000x1000 grid. (0,0) = top-left, (1000,1000) = bottom-right.
Action types: click, doubleClick, type, scroll, keyPress, hover, drag, wait.
For "type": include "text" field. For "keyPress": include "key" field.
For "scroll": include "direction" (up/down/left/right).
For "drag": include "endX" and "endY".

IMPORTANT: Return ONLY the JSON object. No explanation, no markdown.`,
          },
        ],
      },
    ],
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Try to parse JSON from response
  try {
    const cleaned = text
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);

    if (parsed.actions && Array.isArray(parsed.actions)) {
      return {
        success: true,
        actions: parsed.actions,
        reasoning: parsed.reasoning || "",
        mode: "vision",
      };
    }
  } catch {
    // Try to extract JSON from mixed text
    const jsonMatch = text.match(/\{[\s\S]*"actions"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          actions: parsed.actions || [],
          reasoning: parsed.reasoning || "",
          mode: "vision",
        };
      } catch {}
    }
  }

  return {
    success: false,
    actions: [],
    error: `Could not parse actions from model response: ${text.slice(0, 200)}`,
  };
}

// ─── Helpers ───

function mapNativeFunctionCall(fc: any): ComputerUseAction | null {
  const name = fc.name || "";
  const args = fc.args || {};

  switch (name) {
    case "open_web_browser":
      return null;
    case "wait_5_seconds":
      return { type: "wait", delayMs: 5000 };
    case "go_back":
      return { type: "goBack" };
    case "go_forward":
      return { type: "goForward" };
    case "search":
      return { type: "search" };
    case "navigate":
      return { type: "navigate", url: args.url };
    case "click_at":
      return { type: "click", x: args.x, y: args.y };
    case "double_click_at":
      return { type: "doubleClick", x: args.x, y: args.y };
    case "hover_at":
      return { type: "hover", x: args.x, y: args.y };
    case "type_text_at":
      return {
        type: "type",
        x: args.x,
        y: args.y,
        text: args.text,
        pressEnter: args.press_enter ?? true,
        clearBeforeTyping: args.clear_before_typing ?? true,
      };
    case "key_combination":
      return { type: "keyPress", key: args.keys };
    case "scroll_document":
      return { type: "scroll", direction: args.direction || "down" };
    case "scroll_at":
      return {
        type: "scroll",
        x: args.x,
        y: args.y,
        direction: args.direction || "down",
        amount: args.magnitude ?? 800,
      };
    case "drag_and_drop":
      return {
        type: "drag",
        x: args.x,
        y: args.y,
        endX: args.destination_x,
        endY: args.destination_y,
      };
    case "wait":
      return { type: "wait", delayMs: args.ms || args.delayMs || 1000 };
    default:
      console.warn("[computer-use] Unknown native function:", name);
      return null;
  }
}
