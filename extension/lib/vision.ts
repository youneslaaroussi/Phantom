/**
 * Vision — periodic screen capture and streaming to Gemini Live
 * 
 * Captures the active tab at low frequency, detects changes,
 * and sends JPEG frames to the Live session.
 */

const CAPTURE_INTERVAL_MS = 3000; // 1 frame every 3 seconds
const JPEG_QUALITY = 50; // 0-100, low to save bandwidth
const MIN_CHANGE_THRESHOLD = 0.02; // 2% pixel difference to count as change

let captureInterval: ReturnType<typeof setInterval> | null = null;
let lastFrameData: string | null = null;
let sendImageFn: ((base64: string, mimeType: string) => void) | null = null;

/**
 * Start streaming tab screenshots to the Live session.
 */
export function startVision(
  sendImage: (base64: string, mimeType: string) => void
) {
  stopVision();
  sendImageFn = sendImage;
  lastFrameData = null;

  // Send an initial frame immediately
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
  sendImageFn = null;
  lastFrameData = null;
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

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "jpeg",
      quality: JPEG_QUALITY,
    });

    const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, "");

    // Simple change detection: compare first 200 chars of base64
    // (full comparison is expensive, this catches most changes)
    const signature = base64.substring(0, 200);
    if (signature === lastFrameData) {
      return; // No visible change, skip
    }
    lastFrameData = signature;

    sendImageFn(base64, "image/jpeg");
  } catch (err) {
    // Tab might be a chrome:// page or capture might fail
    // Silently skip
  }
}
