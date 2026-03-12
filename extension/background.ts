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
    // Send message to side panel / popup to toggle mic
    chrome.runtime.sendMessage({ type: "toggle-listening" }).catch(() => {
      // Side panel might not be open — open it
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (tab?.windowId) {
          chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
        }
      });
    });
  }
});

export {};
