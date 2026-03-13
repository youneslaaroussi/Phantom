/**
 * Content Actions — highlight text on page and show action popup.
 *
 * The voice model can highlight content and trigger on-page AI actions
 * (summarize, rewrite, explain) via Gemini Nano / server-side models.
 *
 * Actions are injected into the page via chrome.scripting.executeScript.
 */

import { getServerUrl } from "./connection-mode";
import { addTrace } from "./trace";

export type ContentActionType =
  | "summarize"
  | "rewrite"
  | "explain"
  | "translate"
  | "simplify";

export interface ContentActionResult {
  success: boolean;
  result?: string;
  error?: string;
}

/**
 * Highlight text on the page and show an AI action popup with the result.
 */
export async function executeContentAction(
  selector: string,
  action: ContentActionType,
  instruction?: string
): Promise<ContentActionResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { success: false, error: "No active tab" };

  // 1. Get the text content from the element
  const textResults = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return null;
      return el.innerText || el.textContent || "";
    },
    args: [selector],
  });

  const text = textResults[0]?.result;
  if (!text) return { success: false, error: `Element not found: ${selector}` };

  addTrace("content_action", `${action}: ${text.slice(0, 80)}...`);

  // 2. Process with AI
  let aiResult: string;
  try {
    aiResult = await processWithAI(text, action, instruction);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }

  // 3. Show highlight + popup on the page
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: showContentPopup,
    args: [selector, action, aiResult],
  });

  return { success: true, result: aiResult };
}

/**
 * Process text with AI — tries server-side Gemini first.
 */
async function processWithAI(
  text: string,
  action: ContentActionType,
  instruction?: string
): Promise<string> {
  const serverUrl = await getServerUrl();
  const response = await fetch(
    `${serverUrl.replace(/\/$/, "")}/api/content-action`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 4000), action, instruction }),
    }
  );

  if (!response.ok) throw new Error(`Server error: ${response.status}`);
  const { result } = await response.json();
  return result;
}

/**
 * Injected into the page — shows a highlight and popup.
 */
function showContentPopup(
  selector: string,
  action: string,
  result: string
) {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return;

  // Scroll to and highlight
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const prevOutline = el.style.outline;
  const prevBg = el.style.backgroundColor;
  el.style.outline = "2px solid #a78bfa";
  el.style.outlineOffset = "3px";
  el.style.backgroundColor = "rgba(167, 139, 250, 0.08)";
  el.style.transition = "outline 0.3s, background-color 0.3s";

  // Create popup
  const popup = document.createElement("div");
  popup.id = "phantom-content-popup";

  const actionLabels: Record<string, string> = {
    summarize: "📝 Summary",
    rewrite: "✏️ Rewrite",
    explain: "💡 Explanation",
    translate: "🌐 Translation",
    simplify: "🎯 Simplified",
  };

  const label = actionLabels[action] || action;

  popup.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      max-width: 400px;
      max-height: 300px;
      background: #1a1a2e;
      border: 1px solid #a78bfa;
      border-radius: 12px;
      padding: 16px;
      z-index: 2147483647;
      box-shadow: 0 8px 32px rgba(167, 139, 250, 0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #e2e8f0;
      overflow-y: auto;
      animation: phantomSlideIn 0.3s ease-out;
    ">
      <style>
        @keyframes phantomSlideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <div style="font-size: 13px; font-weight: 600; color: #a78bfa;">${label}</div>
        <button id="phantom-popup-close" style="
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
          font-size: 18px;
          padding: 0 4px;
          line-height: 1;
        ">×</button>
      </div>
      <div style="font-size: 13px; line-height: 1.6; color: #cbd5e1; white-space: pre-wrap;">${result}</div>
    </div>
  `;

  document.body.appendChild(popup);

  // Close button
  const closeBtn = document.getElementById("phantom-popup-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      popup.remove();
      el.style.outline = prevOutline;
      el.style.backgroundColor = prevBg;
    });
  }

  // Auto-dismiss after 30s
  setTimeout(() => {
    popup.remove();
    el.style.outline = prevOutline;
    el.style.backgroundColor = prevBg;
  }, 30000);
}

/**
 * Just highlight content without a popup — for the voice model to point things out.
 */
export async function highlightContent(
  selector: string,
  label?: string
): Promise<ContentActionResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { success: false, error: "No active tab" };

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string, lbl: string | undefined) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const prev = el.style.cssText;
      el.style.outline = "3px solid #a78bfa";
      el.style.outlineOffset = "2px";
      el.style.backgroundColor = "rgba(167, 139, 250, 0.1)";
      el.style.transition = "all 0.3s";

      if (lbl) {
        const tag = document.createElement("div");
        tag.textContent = lbl;
        tag.style.cssText =
          "position:absolute;z-index:999999;background:#a78bfa;color:#000;font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;pointer-events:none;white-space:nowrap;";
        const rect = el.getBoundingClientRect();
        tag.style.top = window.scrollY + rect.top - 24 + "px";
        tag.style.left = window.scrollX + rect.left + "px";
        document.body.appendChild(tag);
        setTimeout(() => tag.remove(), 5000);
      }

      setTimeout(() => {
        el.style.cssText = prev;
      }, 5000);
    },
    args: [selector, label],
  });

  return { success: true };
}
