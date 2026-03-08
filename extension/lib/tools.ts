/**
 * Phantom tool system
 * 
 * Stripped-down tool set for Gemini Live:
 * - Browser navigation & interaction (tabs, clicks, forms)
 * - Page inspection (screenshot, accessibility, title)
 * - Scrolling & keyboard
 * 
 * Dropped from Marionette:
 * - storeMemory / getMemories (Nano context window management)
 * - writeContent (Writer API — Nano only)
 * - summarizePage (Summarization API — Nano only)
 * - translateText / detectLanguage (Translation API — Nano only)
 * - think (Nano internal reasoning hack)
 * - searchVault / getVaultStats (local embedding model)
 * - getPlaybook (Nano prompt scaffolding)
 * - listen (audio capture for Nano — Live handles audio natively)
 * - highlightSelector / highlightText (visual debugging)
 * - captureCurrentPage (HTML scraping for Nano context)
 */

import type { LiveToolDeclaration } from "./live/types";

export interface ToolResult {
  success: boolean;
  result?: string;
  error?: string;
}

// ─── Tool declarations for Gemini Live ───

export function getToolDeclarations(): LiveToolDeclaration[] {
  return [{
    functionDeclarations: [
      {
        name: "getPageTitle",
        description: "Get the title and URL of the current active tab.",
        parameters: { type: "object", properties: {} },
      },
      {
        name: "openTab",
        description: "Open a URL in a new tab or navigate the current tab.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to open" },
            newTab: { type: "boolean", description: "Open in new tab (default: true)" },
          },
          required: ["url"],
        },
      },
      {
        name: "getTabs",
        description: "List all open tabs in the current window.",
        parameters: { type: "object", properties: {} },
      },
      {
        name: "switchTab",
        description: "Switch to a tab by index.",
        parameters: {
          type: "object",
          properties: {
            index: { type: "number", description: "Tab index (0-based)" },
          },
          required: ["index"],
        },
      },
      {
        name: "captureScreenshot",
        description: "Take a screenshot of the visible area of the current tab. Returns a base64 image.",
        parameters: { type: "object", properties: {} },
      },
      {
        name: "getAccessibilitySnapshot",
        description: "Get the accessibility tree of the current page. Returns a structured text description of all interactive elements with their roles, names, and selectors.",
        parameters: { type: "object", properties: {} },
      },
      {
        name: "findElements",
        description: "Find elements on the page matching a text query or CSS selector.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Text content or CSS selector to search for" },
            type: { type: "string", description: "Search type: 'text' or 'selector' (default: text)" },
          },
          required: ["query"],
        },
      },
      {
        name: "clickElement",
        description: "Click an element on the page by CSS selector.",
        parameters: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector of the element to click" },
          },
          required: ["selector"],
        },
      },
      {
        name: "fillInput",
        description: "Type text into an input field identified by CSS selector.",
        parameters: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector of the input" },
            value: { type: "string", description: "Text to type" },
          },
          required: ["selector", "value"],
        },
      },
      {
        name: "pressKey",
        description: "Press a keyboard key (Enter, Tab, Escape, etc).",
        parameters: {
          type: "object",
          properties: {
            key: { type: "string", description: "Key to press (e.g. 'Enter', 'Tab', 'Escape')" },
          },
          required: ["key"],
        },
      },
      {
        name: "scrollDown",
        description: "Scroll down on the page.",
        parameters: {
          type: "object",
          properties: {
            pixels: { type: "number", description: "Pixels to scroll (default: 500)" },
          },
        },
      },
      {
        name: "scrollUp",
        description: "Scroll up on the page.",
        parameters: {
          type: "object",
          properties: {
            pixels: { type: "number", description: "Pixels to scroll (default: 500)" },
          },
        },
      },
    ],
  }];
}

// ─── Tool execution ───

export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  try {
    const result = await executeToolInternal(name, args);
    if (result.success) {
      return { result: result.result || "ok" };
    }
    return { error: result.error || "Tool failed" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

async function executeToolInternal(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  switch (name) {
    case "getPageTitle": {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return { success: false, error: "No active tab" };
      return { success: true, result: `Title: ${tab.title}\nURL: ${tab.url}` };
    }

    case "openTab": {
      const url = args.url as string;
      const newTab = args.newTab !== false;
      if (newTab) {
        await chrome.tabs.create({ url });
      } else {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) await chrome.tabs.update(tab.id, { url });
      }
      return { success: true, result: `Opened ${url}` };
    }

    case "getTabs": {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const list = tabs.map((t, i) => `[${i}] ${t.title} — ${t.url}`).join("\n");
      return { success: true, result: list };
    }

    case "switchTab": {
      const index = args.index as number;
      const tabs = await chrome.tabs.query({ currentWindow: true });
      if (index < 0 || index >= tabs.length) return { success: false, error: `Invalid tab index ${index}` };
      await chrome.tabs.update(tabs[index].id!, { active: true });
      return { success: true, result: `Switched to tab ${index}: ${tabs[index].title}` };
    }

    case "captureScreenshot": {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return { success: false, error: "No active tab" };
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId!, { format: "jpeg", quality: 60 });
      return { success: true, result: dataUrl };
    }

    case "getAccessibilitySnapshot": {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return { success: false, error: "No active tab" };
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const elements: string[] = [];
          const walk = (el: Element, depth: number) => {
            const role = el.getAttribute("role") || el.tagName.toLowerCase();
            const name = el.getAttribute("aria-label") || (el as HTMLElement).innerText?.slice(0, 60) || "";
            const isInteractive = ["a", "button", "input", "select", "textarea"].includes(el.tagName.toLowerCase())
              || el.getAttribute("role") === "button"
              || el.getAttribute("tabindex") !== null;
            if (isInteractive && name.trim()) {
              const indent = "  ".repeat(depth);
              const sel = el.id ? `#${el.id}` : el.className ? `.${el.className.toString().split(" ")[0]}` : el.tagName.toLowerCase();
              elements.push(`${indent}[${role}] "${name.trim()}" → ${sel}`);
            }
            for (const child of el.children) walk(child, depth + 1);
          };
          walk(document.body, 0);
          return elements.slice(0, 100).join("\n");
        },
      });
      return { success: true, result: results[0]?.result || "No elements found" };
    }

    case "findElements": {
      const query = args.query as string;
      const type = (args.type as string) || "text";
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return { success: false, error: "No active tab" };
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (q: string, t: string) => {
          if (t === "selector") {
            const els = document.querySelectorAll(q);
            return Array.from(els).slice(0, 20).map((el, i) => {
              const text = (el as HTMLElement).innerText?.slice(0, 80) || "";
              return `[${i}] <${el.tagName.toLowerCase()}> "${text}"`;
            }).join("\n");
          }
          // Text search
          const all = document.querySelectorAll("*");
          const matches: string[] = [];
          const lowerQ = q.toLowerCase();
          all.forEach((el) => {
            const text = (el as HTMLElement).innerText?.toLowerCase() || "";
            if (text.includes(lowerQ) && el.children.length === 0) {
              const sel = el.id ? `#${el.id}` : el.className ? `.${el.className.toString().split(" ")[0]}` : el.tagName.toLowerCase();
              matches.push(`<${el.tagName.toLowerCase()}> "${(el as HTMLElement).innerText.slice(0, 80)}" → ${sel}`);
            }
          });
          return matches.slice(0, 20).join("\n") || "No matches found";
        },
        args: [query, type],
      });
      return { success: true, result: results[0]?.result || "No results" };
    }

    case "clickElement": {
      const selector = args.selector as string;
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return { success: false, error: "No active tab" };
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (sel: string) => {
          const el = document.querySelector(sel) as HTMLElement | null;
          if (!el) throw new Error(`Element not found: ${sel}`);
          el.click();
        },
        args: [selector],
      });
      return { success: true, result: `Clicked ${selector}` };
    }

    case "fillInput": {
      const selector = args.selector as string;
      const value = args.value as string;
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return { success: false, error: "No active tab" };
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (sel: string, val: string) => {
          const el = document.querySelector(sel) as HTMLInputElement | null;
          if (!el) throw new Error(`Element not found: ${sel}`);
          el.focus();
          el.value = val;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        },
        args: [selector, value],
      });
      return { success: true, result: `Filled ${selector} with "${value}"` };
    }

    case "pressKey": {
      const key = args.key as string;
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return { success: false, error: "No active tab" };
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (k: string) => {
          document.activeElement?.dispatchEvent(
            new KeyboardEvent("keydown", { key: k, bubbles: true })
          );
          document.activeElement?.dispatchEvent(
            new KeyboardEvent("keyup", { key: k, bubbles: true })
          );
        },
        args: [key],
      });
      return { success: true, result: `Pressed ${key}` };
    }

    case "scrollDown": {
      const pixels = (args.pixels as number) || 500;
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return { success: false, error: "No active tab" };
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (px: number) => window.scrollBy(0, px),
        args: [pixels],
      });
      return { success: true, result: `Scrolled down ${pixels}px` };
    }

    case "scrollUp": {
      const pixels = (args.pixels as number) || 500;
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return { success: false, error: "No active tab" };
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (px: number) => window.scrollBy(0, -px),
        args: [pixels],
      });
      return { success: true, result: `Scrolled up ${pixels}px` };
    }

    default:
      return { success: false, error: `Unknown tool: ${name}` };
  }
}
