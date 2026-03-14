/**
 * Background service worker
 *
 * Icon click opens popup (grants activeTab, pre-captures tab audio stream).
 * Sidepanel opens via keyboard shortcut or right-click context menu.
 * First click also opens sidepanel via onInstalled.
 */

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: false })
  .catch(console.error);

// Keyboard shortcut handling
chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-listening") {
    chrome.runtime.sendMessage({ type: "toggle-listening" }).catch(() => {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (tab?.windowId) {
          chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
        }
      });
    });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "get-tab-audio-stream-id") {
    const tabId = message.tabId;
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId, consumerTabId: tabId }, (streamId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ streamId });
      }
    });
    return true;
  }

  if (message.type === "CDP_CLICK") {
    const { tabId, selector } = message;
    (async () => {
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: (sel: string) => {
            const el = document.querySelector(sel) as HTMLElement | null;
            if (!el) return null;
            const rect = el.getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          },
          args: [selector],
        });
        const pt = results[0]?.result;
        if (!pt) { sendResponse({ error: `Element not found: ${selector}` }); return; }
        const target = { tabId };
        await chrome.debugger.attach(target, "1.3");
        try {
          await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
            type: "mousePressed", x: pt.x, y: pt.y, button: "left", clickCount: 1,
          });
          await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
            type: "mouseReleased", x: pt.x, y: pt.y, button: "left", clickCount: 1,
          });
        } finally {
          await chrome.debugger.detach(target);
        }
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ error: err instanceof Error ? err.message : String(err) });
      }
    })();
    return true;
  }
});

export {};
