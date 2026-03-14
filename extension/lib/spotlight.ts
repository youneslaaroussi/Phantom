import { SHOW_INDICATOR_SCRIPT, HIDE_INDICATOR_SCRIPT } from "./vision-indicator";

const SAMPLE_INTERVAL_MS = 800;

let interval: ReturnType<typeof setInterval> | null = null;
let activeTabId: number | null = null;
let onContext: ((context: string) => void) | null = null;
let personaImage = "mascot.png";
let lastContext = "";

export function startSpotlight(
  sendContext: (context: string) => void,
  mascotImage?: string
) {
  stopSpotlight();
  onContext = sendContext;
  if (mascotImage) personaImage = mascotImage;

  showMascot();
  injectTracker();
  interval = setInterval(sampleContext, SAMPLE_INTERVAL_MS);
  console.log("[Spotlight] Started");
}

export function stopSpotlight() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  hideMascot();
  onContext = null;
  lastContext = "";
  console.log("[Spotlight] Stopped");
}

export function isSpotlightActive(): boolean {
  return interval !== null;
}

const TRACKER_SCRIPT = () => {
  if ((window as any).__phantom_spotlight) return;
  (window as any).__phantom_spotlight = { tag: "", text: "", aria: "", parent: "", href: "" };

  document.addEventListener("mousemove", function (e) {
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return;
    var data = (window as any).__phantom_spotlight;
    data.tag = el.tagName.toLowerCase();
    if ((el as HTMLElement).getAttribute) {
      data.aria = (el as HTMLElement).getAttribute("aria-label") || (el as HTMLElement).getAttribute("title") || "";
      data.href = (el as HTMLElement).getAttribute("href") || "";
      data.role = (el as HTMLElement).getAttribute("role") || "";
      data.placeholder = (el as HTMLElement).getAttribute("placeholder") || "";
    }

    var textContent = (el.textContent || "").trim().slice(0, 200);
    data.text = textContent;

    var parent = el.parentElement;
    if (parent) {
      data.parent = parent.tagName.toLowerCase();
      if (parent.className && typeof parent.className === "string") {
        data.parent += "." + parent.className.split(" ").slice(0, 3).join(".");
      }
    }

    var rect = el.getBoundingClientRect();
    data.x = Math.round(rect.left);
    data.y = Math.round(rect.top);
    data.w = Math.round(rect.width);
    data.h = Math.round(rect.height);
  }, { passive: true });
};

const READ_CONTEXT_SCRIPT = (): Record<string, string> => {
  return (window as any).__phantom_spotlight || {};
};

async function injectTracker() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || tab.url?.startsWith("chrome://")) return;
    activeTabId = tab.id;
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: TRACKER_SCRIPT,
    });
  } catch (e) {
    console.warn("[Spotlight] Failed to inject tracker:", e);
  }
}

async function sampleContext() {
  if (!onContext) return;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || tab.url?.startsWith("chrome://")) return;

    if (tab.id !== activeTabId) {
      activeTabId = tab.id;
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: TRACKER_SCRIPT,
      }).catch(() => {});
      const imgUrl = chrome.runtime.getURL("assets/" + personaImage);
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: SHOW_INDICATOR_SCRIPT,
        args: [imgUrl],
      }).catch(() => {});
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: READ_CONTEXT_SCRIPT,
    });

    const data = results?.[0]?.result;
    if (!data || !data.tag) return;

    var parts: string[] = [];
    parts.push("<" + data.tag + ">");
    if (data.aria) parts.push('label="' + data.aria + '"');
    if (data.role) parts.push('role="' + data.role + '"');
    if (data.href) parts.push('href="' + data.href + '"');
    if (data.placeholder) parts.push('placeholder="' + data.placeholder + '"');
    if (data.text) parts.push('"' + data.text.slice(0, 150) + '"');
    if (data.parent) parts.push("inside <" + data.parent + ">");
    if (data.w && data.h) parts.push("at (" + data.x + "," + data.y + " " + data.w + "x" + data.h + ")");

    var context = parts.join(" ");

    if (context !== lastContext) {
      lastContext = context;
      onContext("[SPOTLIGHT] User is pointing at: " + context);
    }
  } catch {}
}

async function showMascot() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || tab.url?.startsWith("chrome://")) return;
    activeTabId = tab.id;
    const imgUrl = chrome.runtime.getURL("assets/" + personaImage);
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: SHOW_INDICATOR_SCRIPT,
      args: [imgUrl],
    });
  } catch (e) {
    console.warn("[Spotlight] Failed to show mascot:", e);
  }
}

async function hideMascot() {
  try {
    if (activeTabId) {
      await chrome.scripting.executeScript({
        target: { tabId: activeTabId },
        func: HIDE_INDICATOR_SCRIPT,
      });
      activeTabId = null;
    }
  } catch {}
}
