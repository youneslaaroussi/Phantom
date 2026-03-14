/**
 * Computer Use sidecar
 * 
 * Routes screen interaction tasks to Gemini's Computer Use model.
 * The voice model delegates here when it needs coordinate-level clicking,
 * dragging, or interacting with non-DOM elements (canvas, iframes, etc).
 * 
 * Flow:
 * 1. Capture screenshot of active tab
 * 2. Send to Computer Use model with the task description
 * 3. Model returns actions (click_at, type, scroll, etc.) — native CU returns
 *    pixel coords in image space, vision fallback uses a 1000x1000 grid
 * 4. Native CU coords are rescaled from compressed image dims to the 1000x1000 grid
 * 5. We execute those actions by dispatching real mouse/keyboard events
 */

import { getServerUrl } from "./connection-mode";
import { addTrace } from "./trace";

import { compressScreenshot } from "./image";

// Configurable — swap to gemini-3.1-flash-preview when computer use lands there
const COMPUTER_USE_MODEL = "gemini-3-flash-preview";

export interface ComputerUseAction {
  type: "click" | "doubleClick" | "type" | "scroll" | "drag" | "keyPress" | "hover" | "wait";
  x?: number;
  y?: number;
  endX?: number;
  endY?: number;
  text?: string;
  key?: string;
  direction?: "up" | "down" | "left" | "right";
  amount?: number;
  delayMs?: number;
}

export interface ComputerUseResult {
  success: boolean;
  actions: ComputerUseAction[];
  reasoning?: string;
  error?: string;
  mode?: "native" | "vision";
}

/**
 * Ask the Computer Use model what to do, given a task and screenshot.
 */
export async function planComputerAction(task: string): Promise<ComputerUseResult & { imageWidth?: number; imageHeight?: number }> {
  try {
    const screenshot = await captureScreenshot();
    if (!screenshot) {
      return { success: false, actions: [], error: "Failed to capture screenshot" };
    }

    addTrace("computer_use", `Planning: ${task}`);

    const serverUrl = (await getServerUrl()).replace(/^wss:/, "https:").replace(/^ws:/, "http:");
    const response = await fetch(`${serverUrl.replace(/\/$/, "")}/api/computer-use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: COMPUTER_USE_MODEL,
        task,
        screenshot: screenshot.base64,
        mimeType: screenshot.mimeType,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, actions: [], error: `Server error: ${errText}` };
    }

    const result: ComputerUseResult = await response.json();
    addTrace("computer_use", `Got ${result.actions.length} actions`, { actions: result.actions });
    return { ...result, imageWidth: screenshot.width, imageHeight: screenshot.height };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    addTrace("error", `Computer use failed: ${msg}`);
    return { success: false, actions: [], error: msg };
  }
}

/**
 * Plan actions AND execute them on the page.
 */
export async function executeComputerAction(task: string): Promise<{
  success: boolean;
  result: string;
  actionsExecuted: number;
}> {
  const plan = await planComputerAction(task);
  if (!plan.success || plan.actions.length === 0) {
    return {
      success: false,
      result: plan.error || "No actions planned",
      actionsExecuted: 0,
    };
  }

  // Get viewport dimensions for coordinate scaling
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return { success: false, result: "No active tab", actionsExecuted: 0 };
  }

  const viewport = await getViewportSize(tab.id);

  if (plan.mode === "native" && plan.imageWidth && plan.imageHeight) {
    for (const action of plan.actions) {
      rescaleNativeCoords(action, plan.imageWidth, plan.imageHeight, viewport);
    }
  }

  let executed = 0;

  for (const action of plan.actions) {
    try {
      await executeAction(tab.id, action, viewport);
      executed++;
      // Small delay between actions for page to respond
      if (action.delayMs) {
        await sleep(action.delayMs);
      } else {
        await sleep(150);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addTrace("error", `Action failed: ${action.type} — ${msg}`);
      return {
        success: executed > 0,
        result: `Executed ${executed}/${plan.actions.length} actions. Failed on ${action.type}: ${msg}`,
        actionsExecuted: executed,
      };
    }
  }

  const summary = plan.actions
    .map((a) => {
      if (a.type === "click") return `clicked at (${a.x}, ${a.y})`;
      if (a.type === "doubleClick") return `double-clicked at (${a.x}, ${a.y})`;
      if (a.type === "type") return `typed "${a.text}"`;
      if (a.type === "scroll") return `scrolled ${a.direction || "down"}`;
      if (a.type === "keyPress") return `pressed ${a.key}`;
      if (a.type === "hover") return `hovered at (${a.x}, ${a.y})`;
      if (a.type === "drag") return `dragged from (${a.x}, ${a.y}) to (${a.endX}, ${a.endY})`;
      if (a.type === "wait") return `waited ${a.delayMs}ms`;
      return a.type;
    })
    .join(", then ");

  return {
    success: true,
    result: `Done: ${summary}${plan.reasoning ? `. Reasoning: ${plan.reasoning}` : ""}`,
    actionsExecuted: executed,
  };
}

// ─── Screenshot capture ───

async function captureScreenshot(): Promise<{ base64: string; mimeType: string; width: number; height: number } | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.windowId) return null;

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "jpeg",
      quality: 60,
    });

    return await compressScreenshot(dataUrl);
  } catch {
    return null;
  }
}

function rescaleNativeCoords(
  action: ComputerUseAction,
  imgW: number,
  imgH: number,
  _viewport: { width: number; height: number }
) {
  const toGridX = (px: number) => Math.round((px / imgW) * 1000);
  const toGridY = (py: number) => Math.round((py / imgH) * 1000);
  if (action.x != null) action.x = toGridX(action.x);
  if (action.y != null) action.y = toGridY(action.y);
  if (action.endX != null) action.endX = toGridX(action.endX);
  if (action.endY != null) action.endY = toGridY(action.endY);
}

// ─── Action execution ───

async function executeAction(
  tabId: number,
  action: ComputerUseAction,
  viewport: { width: number; height: number }
) {
  // Scale from 1000x1000 grid to actual viewport
  const scaleX = (x: number) => Math.round((x / 1000) * viewport.width);
  const scaleY = (y: number) => Math.round((y / 1000) * viewport.height);

  switch (action.type) {
    case "click": {
      const x = scaleX(action.x ?? 500);
      const y = scaleY(action.y ?? 500);
      // Show agent cursor before clicking
      await chrome.scripting.executeScript({
        target: { tabId },
        func: _injectClickCursorAt,
        args: [x, y],
      });
      await sleep(450); // Wait for cursor animation
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (cx: number, cy: number) => {
          const el = document.elementFromPoint(cx, cy);
          if (el) {
            for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"] as const) {
              el.dispatchEvent(new PointerEvent(type, {
                clientX: cx, clientY: cy,
                bubbles: true, cancelable: true,
                view: window, button: 0, buttons: type.includes("down") ? 1 : 0,
                pointerId: 1, pointerType: "mouse",
              }));
            }
          }
        },
        args: [x, y],
      });
      break;
    }

    case "doubleClick": {
      const x = scaleX(action.x ?? 500);
      const y = scaleY(action.y ?? 500);
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (cx: number, cy: number) => {
          const el = document.elementFromPoint(cx, cy);
          if (el) {
            el.dispatchEvent(new MouseEvent("dblclick", {
              clientX: cx, clientY: cy,
              bubbles: true, cancelable: true, view: window,
            }));
          }
        },
        args: [x, y],
      });
      break;
    }

    case "hover": {
      const x = scaleX(action.x ?? 500);
      const y = scaleY(action.y ?? 500);
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (cx: number, cy: number) => {
          const el = document.elementFromPoint(cx, cy);
          if (el) {
            el.dispatchEvent(new MouseEvent("mouseover", {
              clientX: cx, clientY: cy, bubbles: true, view: window,
            }));
            el.dispatchEvent(new MouseEvent("mouseenter", {
              clientX: cx, clientY: cy, bubbles: false, view: window,
            }));
            el.dispatchEvent(new MouseEvent("mousemove", {
              clientX: cx, clientY: cy, bubbles: true, view: window,
            }));
          }
        },
        args: [x, y],
      });
      break;
    }

    case "type": {
      const text = action.text ?? "";
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (txt: string) => {
          const el = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
          if (el && ("value" in el)) {
            el.value = txt;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          } else {
            // Try inserting via execCommand for contentEditable
            document.execCommand("insertText", false, txt);
          }
        },
        args: [text],
      });
      break;
    }

    case "keyPress": {
      const key = action.key ?? "Enter";
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (k: string) => {
          const target = document.activeElement || document.body;
          target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
          target.dispatchEvent(new KeyboardEvent("keypress", { key: k, bubbles: true }));
          target.dispatchEvent(new KeyboardEvent("keyup", { key: k, bubbles: true }));
        },
        args: [key],
      });
      break;
    }

    case "scroll": {
      const dir = action.direction ?? "down";
      const amount = action.amount ?? 500;
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (d: string, px: number) => {
          const dx = d === "left" ? -px : d === "right" ? px : 0;
          const dy = d === "up" ? -px : d === "down" ? px : 0;
          window.scrollBy(dx, dy);
        },
        args: [dir, amount],
      });
      break;
    }

    case "drag": {
      const sx = scaleX(action.x ?? 500);
      const sy = scaleY(action.y ?? 500);
      const ex = scaleX(action.endX ?? 500);
      const ey = scaleY(action.endY ?? 500);
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (startX: number, startY: number, endX: number, endY: number) => {
          const el = document.elementFromPoint(startX, startY);
          if (!el) return;
          el.dispatchEvent(new PointerEvent("pointerdown", {
            clientX: startX, clientY: startY, bubbles: true, button: 0, buttons: 1,
          }));
          // Simulate movement in steps
          const steps = 10;
          for (let i = 1; i <= steps; i++) {
            const x = startX + (endX - startX) * (i / steps);
            const y = startY + (endY - startY) * (i / steps);
            el.dispatchEvent(new PointerEvent("pointermove", {
              clientX: x, clientY: y, bubbles: true, button: 0, buttons: 1,
            }));
          }
          const target = document.elementFromPoint(endX, endY) || el;
          target.dispatchEvent(new PointerEvent("pointerup", {
            clientX: endX, clientY: endY, bubbles: true, button: 0,
          }));
        },
        args: [sx, sy, ex, ey],
      });
      break;
    }

    case "wait": {
      await sleep(action.delayMs ?? 1000);
      break;
    }
  }
}

// ─── Helpers ───

async function getViewportSize(tabId: number): Promise<{ width: number; height: number }> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({ width: window.innerWidth, height: window.innerHeight }),
  });
  return results[0]?.result ?? { width: 1920, height: 1080 };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function _injectClickCursorAt(x: number, y: number) {
  const existing = document.getElementById("phantom-agent-cursor");
  if (existing) existing.remove();

  const cursor = document.createElement("div");
  cursor.id = "phantom-agent-cursor";
  cursor.innerHTML = `<div style="width:48px;height:48px;border-radius:24px;background:rgba(66,133,244,0.15);border:2.5px solid #4285F4;box-shadow:0 0 16px rgba(66,133,244,0.25),0 0 4px rgba(66,133,244,0.15);transform:translate(-50%,-50%);"></div><div id="phantom-cursor-ripple" style="position:absolute;top:0;left:0;width:48px;height:48px;border-radius:50%;background:rgba(66,133,244,0.2);transform:translate(-50%,-50%) scale(1);pointer-events:none;opacity:1;"></div>`;

  const edges = [
    { left: x, top: -60 },
    { left: x, top: window.innerHeight + 60 },
    { left: -60, top: y },
    { left: window.innerWidth + 60, top: y },
  ];
  const start = edges[Math.floor(Math.random() * edges.length)];
  cursor.style.cssText = `position:fixed;z-index:2147483646;pointer-events:none;transition:left 0.4s cubic-bezier(0.4,0,0.2,1),top 0.4s cubic-bezier(0.4,0,0.2,1);left:${start.left}px;top:${start.top}px;`;

  document.body.appendChild(cursor);
  requestAnimationFrame(() => { cursor.style.left = x + "px"; cursor.style.top = y + "px"; });

  setTimeout(() => {
    const ripple = document.getElementById("phantom-cursor-ripple");
    if (ripple) { ripple.style.transition = "transform 0.5s cubic-bezier(0.4,0,0.2,1),opacity 0.5s ease-out"; ripple.style.transform = "translate(-50%,-50%) scale(2.5)"; ripple.style.opacity = "0"; }
  }, 420);
  setTimeout(() => { cursor.style.transition = "opacity 0.5s ease-out"; cursor.style.opacity = "0"; }, 2000);
  setTimeout(() => { cursor.remove(); }, 2500);
}
