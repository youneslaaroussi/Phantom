import { BLUR_SENSITIVE_SCRIPT, UNBLUR_SCRIPT } from "./privacy/inject";
import { compressScreenshot } from "./image";

const CAPTURE_INTERVAL_MS = 1000;
const JPEG_QUALITY = 50;


let captureInterval: ReturnType<typeof setInterval> | null = null;
let lastFrameData: string | null = null;
let sendImageFn: ((base64: string, mimeType: string) => void) | null = null;

export function startVision(
  sendImage: (base64: string, mimeType: string) => void,
  personaImage?: string
) {
  stopVision();
  sendImageFn = sendImage;
  lastFrameData = null;

  captureAndSend();
  captureInterval = setInterval(captureAndSend, CAPTURE_INTERVAL_MS);
  console.log("[Vision] Started — capturing every", CAPTURE_INTERVAL_MS, "ms");
}

export function stopVision() {
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
  sendImageFn = null;
  lastFrameData = null;
  unblurActiveTab();
  console.log("[Vision] Stopped");
}

export function isVisionActive(): boolean {
  return captureInterval !== null;
}

async function captureAndSend() {
  if (!sendImageFn) return;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.windowId) return;

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

    const compressed = await compressScreenshot(dataUrl);
    sendImageFn(compressed.base64, compressed.mimeType);
  } catch {}
}

async function unblurActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && !tab.url?.startsWith("chrome://")) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: UNBLUR_SCRIPT,
      }).catch(() => {});
    }
  } catch {}
}
