/**
 * Background service worker
 * 
 * Opens side panel on extension icon click.
 * Handles keyboard shortcuts.
 */

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
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

// Tab audio capture — sidepanel requests stream ID from background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "get-tab-audio-stream-id") {
    const tabId = message.tabId;
    chrome.tabCapture.getMediaStreamId({ consumerTabId: tabId }, (streamId) => {
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
