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
});

export {};
