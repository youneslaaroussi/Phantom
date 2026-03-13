/**
 * Phantom tool system
 * 
 * Browser tools for Gemini Live function calling:
 * - Navigation & interaction (tabs, clicks, forms)
 * - Page reading & element finding
 * - Scrolling & keyboard
 */

import type { LiveToolDeclaration } from "./live/types";
import { playNavigate, playScroll, playHighlight, playTyping, playSuccess } from "./sounds";

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
        description: "See what page the user is on — gets the page title and web address.",
        parameters: { type: "object", properties: {} },
      },
      {
        name: "openTab",
        description: "Go to a website — opens it in a new or current tab.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "The web address to open" },
            newTab: { type: "boolean", description: "Open in a new tab (default: yes)" },
          },
          required: ["url"],
        },
      },
      {
        name: "getTabs",
        description: "See all open tabs the user has.",
        parameters: { type: "object", properties: {} },
      },
      {
        name: "switchTab",
        description: "Switch to a different tab by its position.",
        parameters: {
          type: "object",
          properties: {
            index: { type: "number", description: "Which tab to switch to (0 = first tab)" },
          },
          required: ["index"],
        },
      },

      {
        name: "readPageContent",
        description: "Read the current page to see all the buttons, links, inputs, and other things the user can interact with.",
        parameters: { type: "object", properties: {} },
      },
      {
        name: "findOnPage",
        description: "Search for something on the page by its text or by a specific selector.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "What to search for — text or a CSS selector" },
            type: { type: "string", description: "How to search: 'text' (default) or 'selector'" },
          },
          required: ["query"],
        },
      },
      {
        name: "clickOn",
        description: "Click on something on the page.",
        parameters: {
          type: "object",
          properties: {
            selector: { type: "string", description: "Which element to click (CSS selector)" },
          },
          required: ["selector"],
        },
      },
      {
        name: "typeInto",
        description: "Type text into a field on the page.",
        parameters: {
          type: "object",
          properties: {
            selector: { type: "string", description: "Which field to type into (CSS selector)" },
            value: { type: "string", description: "What to type" },
          },
          required: ["selector", "value"],
        },
      },
      {
        name: "pressKey",
        description: "Press a key on the keyboard, like Enter, Tab, or Escape.",
        parameters: {
          type: "object",
          properties: {
            key: { type: "string", description: "Which key to press (e.g. 'Enter', 'Tab', 'Escape')" },
          },
          required: ["key"],
        },
      },
      {
        name: "scrollDown",
        description: "Scroll down the page to see more content below.",
        parameters: {
          type: "object",
          properties: {
            pixels: { type: "number", description: "How far to scroll (default: 500)" },
          },
        },
      },
      {
        name: "scrollUp",
        description: "Scroll up the page to see content above.",
        parameters: {
          type: "object",
          properties: {
            pixels: { type: "number", description: "How far to scroll (default: 500)" },
          },
        },
      },
      {
        name: "scrollTo",
        description: "Scroll to a specific thing on the page so the user can see it.",
        parameters: {
          type: "object",
          properties: {
            selector: { type: "string", description: "Which element to scroll to (CSS selector)" },
            text: { type: "string", description: "Or search by text content instead" },
          },
        },
      },
      {
        name: "highlight",
        description: "Highlight something on the page to show the user what you found. Shows a yellow outline around it.",
        parameters: {
          type: "object",
          properties: {
            selector: { type: "string", description: "Which element to highlight (CSS selector)" },
            label: { type: "string", description: "Optional label to show next to it" },
            duration: { type: "number", description: "How long to show it in milliseconds (default: 3000)" },
          },
          required: ["selector"],
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
      playNavigate();
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

    case "readPageContent": {
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

    case "findOnPage": {
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

    case "clickOn": {
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
      return { success: true, result: `Clicked on ${selector}` };
    }

    case "typeInto": {
      playTyping();
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
      return { success: true, result: `Typed "${value}" into ${selector}` };
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
      playScroll();
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
      playScroll();
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

    case "scrollTo": {
      const selector = args.selector as string | undefined;
      const text = args.text as string | undefined;
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return { success: false, error: "No active tab" };
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (sel: string | undefined, txt: string | undefined) => {
          let el: Element | null = null;
          if (sel) {
            el = document.querySelector(sel);
          }
          if (!el && txt) {
            const all = document.querySelectorAll("*");
            const lower = txt.toLowerCase();
            for (const node of all) {
              const innerText = (node as HTMLElement).innerText?.toLowerCase() || "";
              if (innerText.includes(lower) && node.children.length === 0) {
                el = node;
                break;
              }
            }
          }
          if (!el) return "Element not found";
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          return `Scrolled to: ${(el as HTMLElement).innerText?.slice(0, 60) || el.tagName}`;
        },
        args: [selector, text],
      });
      const msg = results[0]?.result;
      if (msg === "Element not found") return { success: false, error: msg };
      return { success: true, result: msg };
    }

    case "highlight": {
      playHighlight();
      const selector = args.selector as string;
      const label = (args.label as string) || "";
      const duration = (args.duration as number) || 3000;
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return { success: false, error: "No active tab" };
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (sel: string, lbl: string, dur: number) => {
          const el = document.querySelector(sel) as HTMLElement | null;
          if (!el) throw new Error(`Element not found: ${sel}`);
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          const prev = el.style.cssText;
          el.style.outline = "3px solid #facc15";
          el.style.outlineOffset = "2px";
          el.style.backgroundColor = "rgba(250, 204, 21, 0.15)";
          el.style.transition = "outline 0.3s, background-color 0.3s";
          let labelEl: HTMLElement | null = null;
          if (lbl) {
            labelEl = document.createElement("div");
            labelEl.textContent = lbl;
            labelEl.style.cssText = "position:absolute;z-index:999999;background:#facc15;color:#000;font-size:12px;font-weight:600;padding:2px 8px;border-radius:4px;pointer-events:none;white-space:nowrap;";
            const rect = el.getBoundingClientRect();
            labelEl.style.top = (window.scrollY + rect.top - 24) + "px";
            labelEl.style.left = (window.scrollX + rect.left) + "px";
            document.body.appendChild(labelEl);
          }
          setTimeout(() => {
            el.style.cssText = prev;
            if (labelEl) labelEl.remove();
          }, dur);
        },
        args: [selector, label, duration],
      });
      return { success: true, result: `Highlighted ${selector}${label ? ` — "${label}"` : ""}` };
    }

    default:
      return { success: false, error: `Unknown tool: ${name}` };
  }
}
