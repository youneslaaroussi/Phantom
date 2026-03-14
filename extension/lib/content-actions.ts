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

  const textResults = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string) => {
      let el = document.querySelector(sel) as HTMLElement | null;
      var usedSelector = sel;
      if (!el) {
        var candidates = ["article", "main", "[role='main']"];
        for (var i = 0; i < candidates.length; i++) {
          var c = document.querySelector(candidates[i]) as HTMLElement | null;
          if (c && (c.innerText || "").trim().length > 50) { el = c; usedSelector = candidates[i]; break; }
        }
      }
      if (!el) return null;
      var text = (el.innerText || el.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
      return { text: text.slice(0, 6000), selector: usedSelector };
    },
    args: [selector],
  });

  const extracted = textResults[0]?.result;
  if (!extracted) return { success: false, error: `Element not found: ${selector}` };
  const text = typeof extracted === "string" ? extracted : extracted.text;
  const resolvedSelector = typeof extracted === "string" ? selector : extracted.selector;

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
    args: [resolvedSelector, action, aiResult],
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
  const serverUrl = (await getServerUrl()).replace(/^wss:/, "https:").replace(/^ws:/, "http:");
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

  var existingPopups = document.querySelectorAll(".phantom-content-popup");
  var stackOffset = existingPopups.length * 60;

  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const prevOutline = el.style.outline;
  const prevBg = el.style.backgroundColor;
  el.style.outline = "2px solid #4285F4";
  el.style.outlineOffset = "3px";
  el.style.backgroundColor = "rgba(66, 133, 244, 0.06)";
  el.style.transition = "outline 0.3s, background-color 0.3s";

  const popup = document.createElement("div");
  popup.className = "phantom-content-popup";

  const actionLabels: Record<string, string> = {
    summarize: "Summary",
    rewrite: "Rewrite",
    explain: "Explanation",
    translate: "Translation",
    simplify: "Simplified",
  };

  const label = actionLabels[action] || action;

  popup.innerHTML = `
    <div style="
      position: fixed;
      bottom: ${20 + stackOffset}px;
      right: 20px;
      max-width: 400px;
      max-height: 340px;
      background: #ffffff;
      border: 1px solid #e8eaed;
      border-radius: 16px;
      padding: 0;
      z-index: 2147483647;
      box-shadow: 0 2px 6px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.08);
      font-family: 'Google Sans Text', 'Google Sans', 'Segoe UI', system-ui, -apple-system, sans-serif;
      color: #1f1f1f;
      overflow: hidden;
      animation: phantomSlideIn 0.25s cubic-bezier(0.2, 0, 0, 1);
    ">
      <style>
        @keyframes phantomSlideIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .phantom-content-popup *::-webkit-scrollbar { width: 4px; }
        .phantom-content-popup *::-webkit-scrollbar-track { background: transparent; }
        .phantom-content-popup *::-webkit-scrollbar-thumb { background: #c4c7c5; border-radius: 4px; }
      </style>
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 10px; border-bottom: 1px solid #f1f3f4;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex-shrink: 0;">
            <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#4285F4"/>
            <path d="M18 14L18.62 17.38L22 18L18.62 18.62L18 22L17.38 18.62L14 18L17.38 17.38L18 14Z" fill="#34A853"/>
            <path d="M5 14L5.62 17.38L9 18L5.62 18.62L5 22L4.38 18.62L1 18L4.38 17.38L5 14Z" fill="#FBBC05"/>
          </svg>
          <span style="font-family: 'Google Sans', 'Segoe UI', system-ui, sans-serif; font-size: 14px; font-weight: 500; color: #1f1f1f;">${label}</span>
        </div>
        <button class="phantom-popup-close" style="
          background: transparent;
          border: none;
          color: #747775;
          cursor: pointer;
          font-size: 20px;
          padding: 0;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background 0.15s;
          line-height: 1;
        " onmouseover="this.style.background='#f1f3f4'" onmouseout="this.style.background='transparent'">&times;</button>
      </div>
      <div style="padding: 12px 16px 16px; max-height: 260px; overflow-y: auto; font-size: 13px; line-height: 1.7; color: #444746; white-space: pre-wrap;">${result}</div>
    </div>
  `;

  document.body.appendChild(popup);

  var closeBtn = popup.querySelector(".phantom-popup-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", function() {
      popup.remove();
      el.style.outline = prevOutline;
      el.style.backgroundColor = prevBg;
    });
  }

  setTimeout(function() {
    if (popup.parentNode) {
      popup.remove();
      el.style.outline = prevOutline;
      el.style.backgroundColor = prevBg;
    }
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
      el.style.outline = "2px solid #4285F4";
      el.style.outlineOffset = "2px";
      el.style.backgroundColor = "rgba(66, 133, 244, 0.06)";
      el.style.transition = "all 0.3s";

      if (lbl) {
        const tag = document.createElement("div");
        tag.textContent = lbl;
        tag.style.cssText =
          "position:absolute;z-index:999999;background:#4285F4;color:#fff;font-family:'Google Sans','Segoe UI',system-ui,sans-serif;font-size:11px;font-weight:500;padding:2px 10px;border-radius:100px;pointer-events:none;white-space:nowrap;";
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
