/**
 * Computer Use sidecar
 *
 * Routes screen interaction tasks to Gemini's Computer Use model.
 * The voice model delegates here when it needs coordinate-level clicking,
 * dragging, or interacting with non-DOM elements (canvas, iframes, etc).
 *
 * Flow:
 * 1. Capture high-quality screenshot of active tab (JPEG 90% at native viewport res)
 * 2. Send to Computer Use model with the task description
 * 3. Model returns actions with coordinates on a normalised 0-999 grid
 * 4. We scale 0-999 grid coords to the actual viewport and dispatch events
 */

import { getServerUrl } from "./connection-mode";
import { addTrace } from "./trace";

import { screenshotForComputerUse } from "./image";
import { showKeystroke } from "./keystroke-overlay";

// Configurable — swap to gemini-3.1-flash-preview when computer use lands there
const COMPUTER_USE_MODEL = "gemini-3-flash-preview";

export interface ComputerUseAction {
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
  direction?: "up" | "down" | "left" | "right";
  amount?: number;
  delayMs?: number;
  url?: string;
  pressEnter?: boolean;
  clearBeforeTyping?: boolean;
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
export async function planComputerAction(task: string): Promise<ComputerUseResult> {
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
    return result;
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
      if (a.type === "navigate") return `navigated to ${a.url}`;
      if (a.type === "goBack") return `went back`;
      if (a.type === "goForward") return `went forward`;
      if (a.type === "search") return `opened search`;
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
      quality: 90,
    });

    return await screenshotForComputerUse(dataUrl);
  } catch {
    return null;
  }
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
      await chrome.scripting.executeScript({
        target: { tabId },
        func: _injectClickCursorAt,
        args: [x, y],
      });
      await sleep(450);
      await debuggerClick(tabId, x, y);
      break;
    }

    case "doubleClick": {
      const x = scaleX(action.x ?? 500);
      const y = scaleY(action.y ?? 500);
      await withDebugger(tabId, async (target) => {
        await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
          type: "mousePressed", x, y, button: "left", clickCount: 1,
        });
        await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
          type: "mouseReleased", x, y, button: "left", clickCount: 1,
        });
        await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
          type: "mousePressed", x, y, button: "left", clickCount: 2,
        });
        await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
          type: "mouseReleased", x, y, button: "left", clickCount: 2,
        });
      });
      break;
    }

    case "hover": {
      const x = scaleX(action.x ?? 500);
      const y = scaleY(action.y ?? 500);
      await withDebugger(tabId, async (target) => {
        await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
          type: "mouseMoved", x, y,
        });
      });
      break;
    }

    case "type": {
      const text = action.text ?? "";
      const clearFirst = action.clearBeforeTyping ?? true;
      const pressEnter = action.pressEnter ?? true;
      if (action.x != null && action.y != null) {
        const tx = scaleX(action.x);
        const ty = scaleY(action.y);
        await debuggerClick(tabId, tx, ty);
        await sleep(100);
      }
      if (clearFirst) {
        await debuggerKey(tabId, "Home");
        await sleep(30);
        await debuggerKeyCombo(tabId, "End", { shift: true });
        await sleep(30);
        await debuggerKey(tabId, "Backspace");
        await sleep(50);
      }
      showKeystroke(text.length > 30 ? text.slice(0, 30) + "…" : text);
      await debuggerType(tabId, text);
      if (pressEnter) {
        showKeystroke("Enter");
        await debuggerKey(tabId, "Enter");
      }
      break;
    }

    case "keyPress": {
      const combo = action.key ?? "Enter";
      showKeystroke(combo);
      const parts = combo.split("+").map((p) => p.trim());
      const key = parts.pop() || "";
      const modifiers = {
        ctrl: parts.some((p) => /^ctrl|control$/i.test(p)),
        shift: parts.some((p) => /^shift$/i.test(p)),
        alt: parts.some((p) => /^alt$/i.test(p)),
        meta: parts.some((p) => /^meta|command|cmd|super$/i.test(p)),
      };
      await debuggerKeyCombo(tabId, key, modifiers);
      break;
    }

    case "scroll": {
      const dir = action.direction ?? "down";
      const amount = action.amount ?? 500;
      const sx = action.x != null ? scaleX(action.x) : Math.round(viewport.width / 2);
      const sy = action.y != null ? scaleY(action.y) : Math.round(viewport.height / 2);
      const dx = dir === "left" ? -amount : dir === "right" ? amount : 0;
      const dy = dir === "up" ? -amount : dir === "down" ? amount : 0;
      await withDebugger(tabId, async (target) => {
        await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
          type: "mouseWheel", x: sx, y: sy, deltaX: dx, deltaY: dy,
        });
      });
      break;
    }

    case "drag": {
      const sx = scaleX(action.x ?? 500);
      const sy = scaleY(action.y ?? 500);
      const ex = scaleX(action.endX ?? 500);
      const ey = scaleY(action.endY ?? 500);
      await withDebugger(tabId, async (target) => {
        await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
          type: "mousePressed", x: sx, y: sy, button: "left", clickCount: 1,
        });
        const steps = 10;
        for (let i = 1; i <= steps; i++) {
          const x = sx + (ex - sx) * (i / steps);
          const y = sy + (ey - sy) * (i / steps);
          await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
            type: "mouseMoved", x: Math.round(x), y: Math.round(y), button: "left",
          });
        }
        await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
          type: "mouseReleased", x: ex, y: ey, button: "left", clickCount: 1,
        });
      });
      break;
    }

    case "navigate": {
      const url = action.url ?? "";
      await chrome.tabs.update(tabId, { url });
      break;
    }

    case "goBack": {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => window.history.back(),
      });
      break;
    }

    case "goForward": {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => window.history.forward(),
      });
      break;
    }

    case "search": {
      await chrome.tabs.update(tabId, { url: "https://www.google.com" });
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

// ─── Chrome Debugger helpers (trusted input events) ───

async function withDebugger<T>(tabId: number, fn: (target: { tabId: number }) => Promise<T>): Promise<T> {
  const target = { tabId };
  await chrome.debugger.attach(target, "1.3");
  try {
    return await fn(target);
  } finally {
    await chrome.debugger.detach(target).catch(() => {});
  }
}

function modifierBit(m: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean }): number {
  return (m.alt ? 1 : 0) | (m.ctrl ? 2 : 0) | (m.meta ? 4 : 0) | (m.shift ? 8 : 0);
}

async function debuggerType(tabId: number, text: string): Promise<void> {
  await withDebugger(tabId, async (target) => {
    for (const ch of text) {
      await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
        type: "keyDown",
        text: ch,
      });
      await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
        type: "keyUp",
      });
    }
  });
}

async function debuggerKey(tabId: number, key: string): Promise<void> {
  await withDebugger(tabId, async (target) => {
    await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      windowsVirtualKeyCode: keyToVirtualCode(key),
      key,
    });
    await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
      type: "keyUp",
      windowsVirtualKeyCode: keyToVirtualCode(key),
      key,
    });
  });
}

async function debuggerKeyCombo(
  tabId: number,
  key: string,
  modifiers: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean }
): Promise<void> {
  await withDebugger(tabId, async (target) => {
    await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      windowsVirtualKeyCode: keyToVirtualCode(key),
      key,
      modifiers: modifierBit(modifiers),
    });
    await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
      type: "keyUp",
      windowsVirtualKeyCode: keyToVirtualCode(key),
      key,
      modifiers: modifierBit(modifiers),
    });
  });
}

async function debuggerClick(tabId: number, x: number, y: number): Promise<void> {
  await withDebugger(tabId, async (target) => {
    await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
      type: "mousePressed",
      x,
      y,
      button: "left",
      clickCount: 1,
    });
    await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x,
      y,
      button: "left",
      clickCount: 1,
    });
  });
}

function keyToVirtualCode(key: string): number {
  const map: Record<string, number> = {
    Backspace: 8, Tab: 9, Enter: 13, Escape: 27, Space: 32,
    ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40,
    Delete: 46, Home: 36, End: 35, PageUp: 33, PageDown: 34,
    a: 65, b: 66, c: 67, d: 68, e: 69, f: 70, g: 71, h: 72,
    i: 73, j: 74, k: 75, l: 76, m: 77, n: 78, o: 79, p: 80,
    q: 81, r: 82, s: 83, t: 84, u: 85, v: 86, w: 87, x: 88,
    y: 89, z: 90, F1: 112, F2: 113, F3: 114, F4: 115, F5: 116,
    F6: 117, F7: 118, F8: 119, F9: 120, F10: 121, F11: 122, F12: 123,
  };
  return map[key] ?? key.toUpperCase().charCodeAt(0);
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
