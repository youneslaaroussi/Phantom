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
import { executeComputerAction } from "./computer-use";
import { executeContentAction, type ContentActionType } from "./content-actions";

import {
  addMemory,
  searchMemories,
  addProfileFact,
  addProfilePreference,
  updateUserProfile,
} from "./memory";

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
        name: "closeTab",
        description: "Close a tab by its position, or the current tab if no index given.",
        parameters: {
          type: "object",
          properties: {
            index: { type: "number", description: "Which tab to close (0 = first tab). Omit to close the current tab." },
          },
        },
      },

      {
        name: "readPageContent",
        description: "Read the current page to see all the buttons, links, inputs, and other things the user can interact with.",
        parameters: { type: "object", properties: {} },
      },
      {
        name: "getAccessibilitySnapshot",
        description: "Get a structured list of all interactive elements on the page (buttons, links, inputs, etc.) with their roles, names, and selectors. Use this to understand what's on the page before clicking or interacting. Optionally filter by a query to find specific elements.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Optional: filter elements by text match (e.g. 'submit button', 'search input')" },
          },
        },
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
      {
        name: "computerAction",
        description: "Use AI vision to interact with the screen by clicking at coordinates, typing, scrolling, or dragging. Use this when CSS selectors won't work — for canvas elements, complex UIs, iframes, or when you can see something on screen but can't find a selector for it. Describe what you want to do in natural language.",
        parameters: {
          type: "object",
          properties: {
            task: { type: "string", description: "What to do, described in natural language. Be specific about what to click, where to type, etc. Example: 'Click the blue Submit button in the bottom right', 'Click the play button on the video', 'Drag the slider to 75%'" },
          },
          required: ["task"],
        },
      },
      {
        name: "contentAction",
        description: "Highlight content on the page and show an AI-generated summary, rewrite, explanation, translation, or simplification in a popup. Use when the user asks you to summarize a paragraph, explain a section, simplify jargon, rewrite text, or translate content they're looking at.",
        parameters: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector of the content to process" },
            action: { type: "string", description: "One of: summarize, rewrite, explain, translate, simplify" },
            instruction: { type: "string", description: "Optional extra instruction, e.g. 'make it more casual' or 'translate to Spanish'" },
          },
          required: ["selector", "action"],
        },
      },
      {
        name: "rememberThis",
        description: "Save something to long-term memory. Use when the user explicitly asks you to remember something, or when you learn an important fact about them (name, preferences, habits, important dates).",
        parameters: {
          type: "object",
          properties: {
            text: { type: "string", description: "What to remember" },
            type: { type: "string", description: "'explicit' for user-requested memories, 'fact' for things you infer about the user" },
          },
          required: ["text"],
        },
      },
      {
        name: "recallMemory",
        description: "Search your memory for relevant past information. Use when the user asks 'do you remember...', references something from a past session, or when context from previous sessions would help you answer better.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "What to search for in memory" },
          },
          required: ["query"],
        },
      },
      {
        name: "updateUserProfile",
        description: "Update what you know about the user — their name, preferences, or facts. Use when you learn something durable about them.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "User's name" },
            fact: { type: "string", description: "A fact about the user to store" },
            preference: { type: "string", description: "A preference to store" },
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

    case "closeTab": {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      if (args.index != null) {
        const idx = args.index as number;
        if (idx < 0 || idx >= tabs.length) return { success: false, error: `Invalid tab index ${idx}` };
        const title = tabs[idx].title;
        await chrome.tabs.remove(tabs[idx].id!);
        return { success: true, result: `Closed tab ${idx}: ${title}` };
      }
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!active?.id) return { success: false, error: "No active tab" };
      const title = active.title;
      await chrome.tabs.remove(active.id);
      return { success: true, result: `Closed current tab: ${title}` };
    }

    case "getAccessibilitySnapshot": {
      const query = (args.query as string) || "";
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return { success: false, error: "No active tab" };
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (q: string) => {
          const esc = (s: string) => CSS.escape(s);
          const only = (s: string) => { try { return document.querySelectorAll(s).length === 1; } catch { return false; } };
          const UP = /^(w-|h-|p[xytrbl]?-|m[xytrbl]?-|text-\[|bg-\[|border-|rounded-|shadow-|opacity-|z-|gap-|space-|overflow-|max-|min-|top-|right-|bottom-|left-|inset-|translate-|scale-|rotate-|duration-|delay-|ease-|tracking-|leading-|font-(?:normal|bold|light|thin|medium|semibold|extrabold|black)|disabled:|hover:|focus:|active:|group-hover:|dark:|sm:|md:|lg:|xl:|2xl:)/;
          const isSem = (c: string) => c.length <= 60 && !/^[0-9]/.test(c) && !UP.test(c);
          const uniqueSel = (el: Element): string => {
            if (el.id) { const s = `#${esc(el.id)}`; if (only(s)) return s; }
            const tag = el.tagName.toLowerCase();
            for (const a of ["aria-label", "placeholder", "name", "data-testid", "title", "type", "role"]) {
              const v = el.getAttribute(a); if (v) { const s = `${tag}[${a}="${esc(v)}"]`; if (only(s)) return s; }
            }
            const all = (typeof el.className === "string" ? el.className : "").trim().split(/\s+/).filter(Boolean);
            const sem = all.filter(isSem); const cls = sem.length > 0 ? sem : all.slice(0, 3);
            for (const c of cls) { const s = `${tag}.${esc(c)}`; if (only(s)) return s; }
            for (let i = 0; i < cls.length && i < 5; i++) for (let j = i + 1; j < cls.length && j < 6; j++) { const s = `${tag}.${esc(cls[i])}.${esc(cls[j])}`; if (only(s)) return s; }
            const parts: string[] = [];
            let cur: Element | null = el;
            while (cur && cur !== document.body) {
              let seg = cur.tagName.toLowerCase();
              if (cur.id) { parts.unshift(`#${esc(cur.id)}`); const f = parts.join(" > "); if (only(f)) return f; return f; }
              const p = cur.parentElement;
              if (p) { const sibs = Array.from(p.children).filter(c => c.tagName === cur!.tagName); if (sibs.length > 1) seg = `${seg}:nth-of-type(${sibs.indexOf(cur) + 1})`; }
              parts.unshift(seg);
              const f = parts.join(" > "); if (only(f)) return f;
              cur = cur.parentElement;
            }
            return parts.join(" > ");
          };

          const sels = [
            "button", "a[href]", "input", "textarea", "select",
            '[role="button"]', '[role="link"]', '[role="textbox"]',
            '[tabindex]:not([tabindex="-1"])', "[onclick]",
          ];
          const elements: string[] = [];
          let idx = 0;
          const allEls = document.querySelectorAll(sels.join(","));
          const lq = q.toLowerCase();
          allEls.forEach((el) => {
            const h = el as HTMLElement;
            const style = window.getComputedStyle(h);
            if (style.display === "none" || style.visibility === "hidden") return;
            const rect = h.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;

            let name = h.getAttribute("aria-label") || "";
            if (!name && (h instanceof HTMLInputElement || h instanceof HTMLTextAreaElement)) {
              name = h.labels?.[0]?.textContent?.trim() || h.placeholder || "";
            }
            if (!name) name = h.textContent?.trim() || "";
            name = name.slice(0, 80);

            let role = h.getAttribute("role") || "";
            if (!role) {
              const tag = h.tagName.toLowerCase();
              if (tag === "button") role = "button";
              else if (tag === "a") role = "link";
              else if (tag === "input") role = (h as HTMLInputElement).type === "submit" ? "button" : "textbox";
              else if (tag === "textarea") role = "textbox";
              else if (tag === "select") role = "combobox";
            }

            if (lq && !name.toLowerCase().includes(lq) && !role.toLowerCase().includes(lq)) return;

            const sel = uniqueSel(h);
            const disabled = h.hasAttribute("disabled") ? " [DISABLED]" : "";
            elements.push(`[${idx}] ${role.toUpperCase()}: "${name}" → ${sel}${disabled}`);
            idx++;
          });
          return elements.slice(0, 50).join("\n") || "No interactive elements found.";
        },
        args: [query],
      });
      return { success: true, result: results[0]?.result || "No elements found" };
    }

    case "readPageContent": {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return { success: false, error: "No active tab" };
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const esc = (s: string) => CSS.escape(s);
          const only = (s: string) => { try { return document.querySelectorAll(s).length === 1; } catch { return false; } };
          const UP = /^(w-|h-|p[xytrbl]?-|m[xytrbl]?-|text-\[|bg-\[|border-|rounded-|shadow-|opacity-|z-|gap-|space-|overflow-|max-|min-|top-|right-|bottom-|left-|inset-|translate-|scale-|rotate-|duration-|delay-|ease-|tracking-|leading-|font-(?:normal|bold|light|thin|medium|semibold|extrabold|black)|disabled:|hover:|focus:|active:|group-hover:|dark:|sm:|md:|lg:|xl:|2xl:)/;
          const isSem = (c: string) => c.length <= 60 && !/^[0-9]/.test(c) && !UP.test(c);
          const uniqueSel = (el: Element): string => {
            if (el.id) { const s = `#${esc(el.id)}`; if (only(s)) return s; }
            const tag = el.tagName.toLowerCase();
            for (const a of ["aria-label", "placeholder", "name", "data-testid", "title", "type", "role"]) {
              const v = el.getAttribute(a); if (v) { const s = `${tag}[${a}="${esc(v)}"]`; if (only(s)) return s; }
            }
            const all = (typeof el.className === "string" ? el.className : "").trim().split(/\s+/).filter(Boolean);
            const sem = all.filter(isSem); const cls = sem.length > 0 ? sem : all.slice(0, 3);
            for (const c of cls) { const s = `${tag}.${esc(c)}`; if (only(s)) return s; }
            for (let i = 0; i < cls.length && i < 5; i++) for (let j = i + 1; j < cls.length && j < 6; j++) { const s = `${tag}.${esc(cls[i])}.${esc(cls[j])}`; if (only(s)) return s; }
            const parts: string[] = [];
            let cur: Element | null = el;
            while (cur && cur !== document.body) {
              let seg = cur.tagName.toLowerCase();
              if (cur.id) { parts.unshift(`#${esc(cur.id)}`); const f = parts.join(" > "); if (only(f)) return f; return f; }
              const p = cur.parentElement;
              if (p) { const sibs = Array.from(p.children).filter(c => c.tagName === cur!.tagName); if (sibs.length > 1) seg = `${seg}:nth-of-type(${sibs.indexOf(cur) + 1})`; }
              parts.unshift(seg);
              const f = parts.join(" > "); if (only(f)) return f;
              cur = cur.parentElement;
            }
            return parts.join(" > ");
          };

          const elements: string[] = [];
          const walk = (el: Element, depth: number) => {
            const role = el.getAttribute("role") || el.tagName.toLowerCase();
            const name = el.getAttribute("aria-label") || (el as HTMLElement).innerText?.slice(0, 60) || "";
            const isInteractive = ["a", "button", "input", "select", "textarea"].includes(el.tagName.toLowerCase())
              || el.getAttribute("role") === "button"
              || el.getAttribute("tabindex") !== null;
            if (isInteractive && name.trim()) {
              const indent = "  ".repeat(depth);
              const sel = uniqueSel(el);
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
          const esc = (s: string) => CSS.escape(s);
          const only = (s: string) => { try { return document.querySelectorAll(s).length === 1; } catch { return false; } };
          const UP = /^(w-|h-|p[xytrbl]?-|m[xytrbl]?-|text-\[|bg-\[|border-|rounded-|shadow-|opacity-|z-|gap-|space-|overflow-|max-|min-|top-|right-|bottom-|left-|inset-|translate-|scale-|rotate-|duration-|delay-|ease-|tracking-|leading-|font-(?:normal|bold|light|thin|medium|semibold|extrabold|black)|disabled:|hover:|focus:|active:|group-hover:|dark:|sm:|md:|lg:|xl:|2xl:)/;
          const isSem = (c: string) => c.length <= 60 && !/^[0-9]/.test(c) && !UP.test(c);
          const uniqueSel = (el: Element): string => {
            if (el.id) { const s = `#${esc(el.id)}`; if (only(s)) return s; }
            const tag = el.tagName.toLowerCase();
            for (const a of ["aria-label", "placeholder", "name", "data-testid", "title", "type", "role"]) {
              const v = el.getAttribute(a); if (v) { const s = `${tag}[${a}="${esc(v)}"]`; if (only(s)) return s; }
            }
            const all = (typeof el.className === "string" ? el.className : "").trim().split(/\s+/).filter(Boolean);
            const sem = all.filter(isSem); const cls = sem.length > 0 ? sem : all.slice(0, 3);
            for (const c of cls) { const s = `${tag}.${esc(c)}`; if (only(s)) return s; }
            for (let i = 0; i < cls.length && i < 5; i++) for (let j = i + 1; j < cls.length && j < 6; j++) { const s = `${tag}.${esc(cls[i])}.${esc(cls[j])}`; if (only(s)) return s; }
            const parts: string[] = [];
            let cur: Element | null = el;
            while (cur && cur !== document.body) {
              let seg = cur.tagName.toLowerCase();
              if (cur.id) { parts.unshift(`#${esc(cur.id)}`); const f = parts.join(" > "); if (only(f)) return f; return f; }
              const p = cur.parentElement;
              if (p) { const sibs = Array.from(p.children).filter(c => c.tagName === cur!.tagName); if (sibs.length > 1) seg = `${seg}:nth-of-type(${sibs.indexOf(cur) + 1})`; }
              parts.unshift(seg);
              const f = parts.join(" > "); if (only(f)) return f;
              cur = cur.parentElement;
            }
            return parts.join(" > ");
          };

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
              const sel = uniqueSel(el);
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
      // Scroll into view if not visible
      const visCheck = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (sel: string) => {
          const el = document.querySelector(sel) as HTMLElement | null;
          if (!el) return "not_found";
          const rect = el.getBoundingClientRect();
          const inView = rect.top >= 0 && rect.bottom <= window.innerHeight && rect.left >= 0 && rect.right <= window.innerWidth;
          if (!inView) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            return "scrolled";
          }
          return "visible";
        },
        args: [selector],
      });
      const vis = visCheck[0]?.result;
      if (vis === "not_found") return { success: false, error: `Element not found: ${selector}` };
      if (vis === "scrolled") await new Promise((r) => setTimeout(r, 600));
      // Show agent cursor at target
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: _injectClickCursor,
        args: [selector],
      });
      // Wait for cursor animation then click
      await new Promise((r) => setTimeout(r, 450));
      // Use background service worker to dispatch trusted CDP click
      const response = await chrome.runtime.sendMessage({
        type: "CDP_CLICK",
        tabId: tab.id,
        selector,
      });
      if (response?.error) return { success: false, error: response.error };
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
        func: (keyToPress: string) => {
          const keyMap: Record<string, { code: string; keyCode: number }> = {
            ArrowDown: { code: "ArrowDown", keyCode: 40 },
            ArrowUp: { code: "ArrowUp", keyCode: 38 },
            ArrowLeft: { code: "ArrowLeft", keyCode: 37 },
            ArrowRight: { code: "ArrowRight", keyCode: 39 },
            Enter: { code: "Enter", keyCode: 13 },
            Escape: { code: "Escape", keyCode: 27 },
            Tab: { code: "Tab", keyCode: 9 },
            Backspace: { code: "Backspace", keyCode: 8 },
            Delete: { code: "Delete", keyCode: 46 },
            " ": { code: "Space", keyCode: 32 },
          };
          const info = keyMap[keyToPress] || { code: keyToPress, keyCode: 0 };
          const props = {
            key: keyToPress, code: info.code, keyCode: info.keyCode,
            which: info.keyCode, bubbles: true, cancelable: true,
            composed: true, view: window,
          };
          const targets = [document.activeElement || document.body, document.body, document.documentElement];
          for (const target of targets) {
            target.dispatchEvent(new KeyboardEvent("keydown", props));
            target.dispatchEvent(new KeyboardEvent("keypress", props));
            target.dispatchEvent(new KeyboardEvent("keyup", props));
          }
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
      const vpDown = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({ w: window.innerWidth, h: window.innerHeight }),
      });
      const dVp = vpDown[0]?.result ?? { w: 960, h: 540 };
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: _injectScrollCursor,
        args: [dVp.w / 2, dVp.h / 2, "down", pixels],
      });
      const posDown = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({ y: Math.round(window.scrollY), max: Math.round(document.documentElement.scrollHeight - window.innerHeight), vh: window.innerHeight }),
      });
      const pd = posDown[0]?.result ?? { y: 0, max: 0, vh: 0 };
      const atBottom = pd.y >= pd.max - 10;
      return { success: true, result: `Scrolled down ${pixels}px. Position: ${pd.y}/${pd.max}px (viewport ${pd.vh}px).${atBottom ? " You are at the bottom of the page." : ""}` };
    }

    case "scrollUp": {
      playScroll();
      const pixels = (args.pixels as number) || 500;
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return { success: false, error: "No active tab" };
      const vpUp = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({ w: window.innerWidth, h: window.innerHeight }),
      });
      const uVp = vpUp[0]?.result ?? { w: 960, h: 540 };
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: _injectScrollCursor,
        args: [uVp.w / 2, uVp.h / 2, "up", pixels],
      });
      const posUp = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({ y: Math.round(window.scrollY), max: Math.round(document.documentElement.scrollHeight - window.innerHeight), vh: window.innerHeight }),
      });
      const pu = posUp[0]?.result ?? { y: 0, max: 0, vh: 0 };
      const atTop = pu.y <= 10;
      return { success: true, result: `Scrolled up ${pixels}px. Position: ${pu.y}/${pu.max}px (viewport ${pu.vh}px).${atTop ? " You are at the top of the page." : ""}` };
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
          const y = Math.round(window.scrollY);
          const max = Math.round(document.documentElement.scrollHeight - window.innerHeight);
          return `Scrolled to: ${(el as HTMLElement).innerText?.slice(0, 60) || el.tagName}. Position: ${y}/${max}px (viewport ${window.innerHeight}px).`;
        },
        args: [selector ?? null, text ?? null],
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

    case "computerAction": {
      const task = args.task as string;
      const result = await executeComputerAction(task);
      return {
        success: result.success,
        result: result.result,
      };
    }

    case "contentAction": {
      const selector = args.selector as string;
      const action = args.action as ContentActionType;
      const instruction = args.instruction as string | undefined;
      const result = await executeContentAction(selector, action, instruction);
      return {
        success: result.success,
        result: result.result || result.error,
      };
    }

    case "rememberThis": {
      const text = args.text as string;
      const type = (args.type as string) === "fact" ? "fact" : "explicit";
      await addMemory(text, type as any);
      return { success: true, result: `Remembered: "${text}"` };
    }

    case "recallMemory": {
      const query = args.query as string;
      const results = await searchMemories(query, 5);
      if (results.length === 0) {
        return { success: true, result: "No relevant memories found." };
      }
      const formatted = results
        .map((r) => {
          const date = new Date(r.entry.timestamp).toLocaleDateString();
          return `[${date}, ${(r.similarity * 100).toFixed(0)}% match] ${r.entry.text}`;
        })
        .join("\n");
      return { success: true, result: formatted };
    }

    case "updateUserProfile": {
      const name = args.name as string | undefined;
      const fact = args.fact as string | undefined;
      const preference = args.preference as string | undefined;
      const updates: string[] = [];
      if (name) {
        await updateUserProfile({ name });
        updates.push(`name → ${name}`);
      }
      if (fact) {
        await addProfileFact(fact);
        updates.push(`fact: ${fact}`);
      }
      if (preference) {
        await addProfilePreference(preference);
        updates.push(`preference: ${preference}`);
      }
      return {
        success: true,
        result: `Profile updated: ${updates.join(", ")}`,
      };
    }

    default:
      return { success: false, error: `Unknown tool: ${name}` };
  }
}

function _injectClickCursor(selector: string) {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

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

function _injectScrollCursor(x: number, y: number, direction: string, amount: number) {
  const existing = document.getElementById("phantom-agent-cursor");
  if (existing) existing.remove();

  const isDown = direction === "down";
  const scrollDuration = 800;
  const drift = isDown ? 150 : -150;

  const cursor = document.createElement("div");
  cursor.id = "phantom-agent-cursor";
  cursor.innerHTML = `<div style="width:48px;height:48px;border-radius:24px;background:rgba(66,133,244,0.15);border:2.5px solid #4285F4;box-shadow:0 0 16px rgba(66,133,244,0.25),0 0 4px rgba(66,133,244,0.15);transform:translate(-50%,-50%);"></div>`;

  const edges = [
    { left: x, top: -60 },
    { left: x, top: window.innerHeight + 60 },
    { left: -60, top: y },
    { left: window.innerWidth + 60, top: y },
  ];
  const start = edges[Math.floor(Math.random() * edges.length)];
  cursor.style.cssText = `position:fixed;z-index:2147483646;pointer-events:none;transition:left 0.4s cubic-bezier(0.4,0,0.2,1),top 0.4s cubic-bezier(0.4,0,0.2,1);left:${start.left}px;top:${start.top}px;`;

  document.body.appendChild(cursor);

  requestAnimationFrame(() => {
    cursor.style.left = x + "px";
    cursor.style.top = y + "px";
  });

  setTimeout(() => {
    cursor.style.transition = `top ${scrollDuration}ms cubic-bezier(0.4,0,0.2,1)`;
    cursor.style.top = (y + drift) + "px";

    const startScroll = window.scrollY;
    const targetScroll = startScroll + (isDown ? amount : -amount);
    const startTime = performance.now();
    function animateScroll(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / scrollDuration, 1);
      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      window.scrollTo(0, startScroll + (targetScroll - startScroll) * ease);
      if (progress < 1) requestAnimationFrame(animateScroll);
    }
    requestAnimationFrame(animateScroll);
  }, 450);

  setTimeout(() => {
    cursor.style.transition = "top 0.4s cubic-bezier(0.4,0,0.2,1),opacity 0.4s ease-out";
    cursor.style.top = (isDown ? window.innerHeight + 60 : -60) + "px";
    cursor.style.opacity = "0";
  }, 450 + scrollDuration + 200);

  setTimeout(() => { cursor.remove(); }, 450 + scrollDuration + 700);
}
