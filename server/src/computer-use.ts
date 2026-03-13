/**
 * Computer Use API endpoint
 * 
 * Receives a screenshot + task from the extension,
 * calls Gemini's Computer Use model, and returns planned actions.
 * 
 * The model operates on a 1000x1000 coordinate grid.
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

interface ComputerUseAction {
  type: "click" | "doubleClick" | "type" | "scroll" | "drag" | "keyPress" | "hover" | "wait";
  x?: number;
  y?: number;
  endX?: number;
  endY?: number;
  text?: string;
  key?: string;
  direction?: string;
  amount?: number;
  delayMs?: number;
}

interface ComputerUseRequest {
  model: string;
  task: string;
  screenshot: string; // base64
  mimeType: string;
}

interface ComputerUseResponse {
  success: boolean;
  actions: ComputerUseAction[];
  reasoning?: string;
  error?: string;
}

export async function handleComputerUse(req: ComputerUseRequest): Promise<ComputerUseResponse> {
  const apiKey = nextApiKey();
  if (!apiKey) {
    return { success: false, actions: [], error: "No API key configured" };
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = req.model || "gemini-3-flash-preview";

  try {
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
              text: `You are a computer use agent. Look at this screenshot and perform the following task:

${req.task}

Respond with a JSON object containing:
- "reasoning": brief explanation of what you see and what you'll do
- "actions": array of actions to perform

Each action has:
- "type": one of "click", "doubleClick", "type", "scroll", "drag", "keyPress", "hover", "wait"
- "x", "y": coordinates on a 1000x1000 grid (for click, doubleClick, hover, drag)
- "endX", "endY": end coordinates for drag
- "text": text to type (for type action)
- "key": key name (for keyPress, e.g. "Enter", "Tab", "Escape", "Backspace")
- "direction": "up", "down", "left", "right" (for scroll)
- "amount": pixels to scroll (for scroll, default 500)
- "delayMs": milliseconds to wait after this action (for wait, or delay between actions)

Coordinates use a 1000x1000 grid where (0,0) is top-left and (1000,1000) is bottom-right.

IMPORTANT: Respond with ONLY the JSON object, no markdown or code blocks.`,
            },
          ],
        },
      ],
      config: {
        tools: [{ computerUse: {} }],
      },
    } as any);

    // Parse the response — model might return computer use function calls or text
    const result = parseComputerUseResponse(response);
    return result;
  } catch (err: any) {
    console.error("[computer-use] API error:", err.message);
    return { success: false, actions: [], error: err.message };
  }
}

function parseComputerUseResponse(response: any): ComputerUseResponse {
  // Check for function calls (native computer use tool responses)
  const candidates = response.candidates || [];
  for (const candidate of candidates) {
    const parts = candidate.content?.parts || [];
    
    const actions: ComputerUseAction[] = [];
    let reasoning = "";

    for (const part of parts) {
      // Text part — might contain reasoning
      if (part.text) {
        // Try to parse as JSON first
        try {
          const cleaned = part.text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
          const parsed = JSON.parse(cleaned);
          if (parsed.actions) {
            return {
              success: true,
              actions: parsed.actions,
              reasoning: parsed.reasoning || "",
            };
          }
        } catch {
          reasoning += part.text;
        }
      }

      // Native computer use function calls
      if (part.functionCall) {
        const fc = part.functionCall;
        const action = mapFunctionCallToAction(fc);
        if (action) actions.push(action);
      }

      // Executable code responses (some models return this way)
      if (part.executableCode) {
        reasoning += `Code: ${part.executableCode.code}`;
      }
    }

    if (actions.length > 0) {
      return { success: true, actions, reasoning };
    }

    // If we got reasoning but no structured actions, try parsing reasoning as JSON
    if (reasoning) {
      try {
        const cleaned = reasoning.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.actions) {
          return {
            success: true,
            actions: parsed.actions,
            reasoning: parsed.reasoning || "",
          };
        }
      } catch {
        // Not JSON — return as-is
      }
    }
  }

  return { success: false, actions: [], error: "No actions found in response" };
}

function mapFunctionCallToAction(fc: any): ComputerUseAction | null {
  const name = fc.name || "";
  const args = fc.args || {};

  switch (name) {
    case "click_at":
      return { type: "click", x: args.x, y: args.y };
    case "double_click_at":
      return { type: "doubleClick", x: args.x, y: args.y };
    case "hover_at":
      return { type: "hover", x: args.x, y: args.y };
    case "type_text":
      return { type: "type", text: args.text };
    case "press_key":
    case "key_press":
      return { type: "keyPress", key: args.key };
    case "scroll":
      return { type: "scroll", direction: args.direction || "down", amount: args.amount || 500 };
    case "drag":
    case "drag_to":
      return { type: "drag", x: args.startX || args.x, y: args.startY || args.y, endX: args.endX, endY: args.endY };
    case "wait":
      return { type: "wait", delayMs: args.ms || args.delayMs || 1000 };
    default:
      console.warn("[computer-use] Unknown function call:", name);
      return null;
  }
}
