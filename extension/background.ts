/**
 * Background service worker
 * 
 * Opens side panel on extension icon click.
 */

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);

export {};
