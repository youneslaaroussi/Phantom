/**
 * Vision — lets Phantom see the user's screen
 * 
 * Captures what's on the active tab once per second
 * and sends it to the Live session so Phantom can see what the user sees.
 * Shows an indicator on the page so the user knows Phantom is watching.
 */

import { SHOW_INDICATOR_SCRIPT, HIDE_INDICATOR_SCRIPT } from "./vision-indicator";
import { BLUR_SENSITIVE_SCRIPT, UNBLUR_SCRIPT } from "./privacy/inject";

const CAPTURE_INTERVAL_MS = 1000;
const JPEG_QUALITY = 50;

let captureInterval: ReturnType<typeof setInterval> | null = null;
let lastFrameData: string | null = null;
let sendImageFn: ((base64: string, mimeType: string) => void) | null = null;
let indicatorTabId: number | null = null;
let currentPersonaImage: string = "mascot.png";

/**
 * Start letting Phantom see the user's screen.
 */
export function startVision(
  sendImage: (base64: string, mimeType: string) => void,
  personaImage?: string
) {
  stopVision();
  sendImageFn = sendImage;
  lastFrameData = null;
  if (personaImage) currentPersonaImage = personaImage;

  showIndicator();
  captureAndSend();

  captureInterval = setInterval(captureAndSend, CAPTURE_INTERVAL_MS);
  console.log("[Vision] Started — capturing every", CAPTURE_INTERVAL_MS, "ms");
}

/**
 * Stop streaming.
 */
export function stopVision() {
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
  hideIndicator();
  sendImageFn = null;
  lastFrameData = null;
  console.log("[Vision] Stopped");
}

export function isVisionActive(): boolean {
  return captureInterval !== null;
}

async function showIndicator() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || tab.url?.startsWith("chrome://")) return;
    indicatorTabId = tab.id;
    const imgUrl = chrome.runtime.getURL("assets/" + currentPersonaImage);
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: SHOW_INDICATOR_SCRIPT,
      args: [imgUrl],
    });
  } catch (e) {
    console.warn("[Vision] Failed to show indicator:", e);
  }
}

async function hideIndicator() {
  try {
    if (indicatorTabId) {
      await chrome.scripting.executeScript({
        target: { tabId: indicatorTabId },
        func: HIDE_INDICATOR_SCRIPT,
      });
      indicatorTabId = null;
    }
  } catch {}
}

async function captureAndSend() {
  if (!sendImageFn) return;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.windowId) return;

    // If active tab changed, move the indicator
    if (tab.id && tab.id !== indicatorTabId) {
      await hideIndicator();
      indicatorTabId = tab.id;
      if (!tab.url?.startsWith("chrome://")) {
        const imgUrl = chrome.runtime.getURL("assets/" + currentPersonaImage);
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: SHOW_INDICATOR_SCRIPT,
          args: [imgUrl],
        }).catch(() => {});
      }
    }

    if (tab.id && !tab.url?.startsWith("chrome://")) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: BLUR_SENSITIVE_SCRIPT,
      }).catch(() => {});
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "jpeg",
      quality: JPEG_QUALITY,
    });

    if (tab.id && !tab.url?.startsWith("chrome://")) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: UNBLUR_SCRIPT,
      }).catch(() => {});
    }

    const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, "");

    sendImageFn(base64, "image/jpeg");
  } catch {
    // Tab might be a chrome:// page or capture might fail
  }
}
