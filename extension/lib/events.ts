let sendEvent: ((text: string) => void) | null = null;
let tabUpdateListener: ((tabId: number, info: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void) | null = null;
let tabActivatedListener: ((info: chrome.tabs.TabActiveInfo) => void) | null = null;
let active = false;
let lastUrl: string | null = null;
let lastTitle: string | null = null;

export function startEvents(send: (text: string) => void): void {
  if (active) stopEvents();
  sendEvent = send;
  active = true;

  tabUpdateListener = (_tabId, info, tab) => {
    if (!tab.active) return;
    if (info.status === "complete" && tab.url && tab.url !== lastUrl) {
      lastUrl = tab.url;
      lastTitle = tab.title || null;
      sendEvent?.(`[EVENT] Page loaded: "${tab.title || ""}" — ${tab.url}`);
    }
    if (info.title && info.title !== lastTitle && !info.url) {
      lastTitle = info.title;
      sendEvent?.(`[EVENT] Page title changed: "${info.title}"`);
    }
  };

  tabActivatedListener = async (info) => {
    try {
      const tab = await chrome.tabs.get(info.tabId);
      lastUrl = tab.url || null;
      lastTitle = tab.title || null;
      sendEvent?.(`[EVENT] Switched to tab: "${tab.title || ""}" — ${tab.url || "unknown"}`);
    } catch {}
  };

  chrome.tabs.onUpdated.addListener(tabUpdateListener);
  chrome.tabs.onActivated.addListener(tabActivatedListener);
}

export function stopEvents(): void {
  active = false;
  sendEvent = null;
  lastUrl = null;
  lastTitle = null;
  if (tabUpdateListener) {
    chrome.tabs.onUpdated.removeListener(tabUpdateListener);
    tabUpdateListener = null;
  }
  if (tabActivatedListener) {
    chrome.tabs.onActivated.removeListener(tabActivatedListener);
    tabActivatedListener = null;
  }
}
