/**
 * Connection mode — "hosted" (server proxy) or "byok" (bring your own key)
 */

const MODE_KEY = "phantom_connection_mode";
const SERVER_URL_KEY = "phantom_server_url";

export type ConnectionMode = "hosted" | "byok";

// Default server URL — update after Cloud Run deploy
const DEFAULT_SERVER_URL = "wss://phantom-server-175557989181.us-central1.run.app";

export async function getConnectionMode(): Promise<ConnectionMode> {
  return new Promise((resolve) => {
    chrome.storage.local.get(MODE_KEY, (r) => {
      resolve((r[MODE_KEY] as ConnectionMode) || "byok");
    });
  });
}

export async function setConnectionMode(mode: ConnectionMode): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [MODE_KEY]: mode }, resolve);
  });
}

export async function getServerUrl(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get(SERVER_URL_KEY, (r) => {
      resolve(r[SERVER_URL_KEY] || DEFAULT_SERVER_URL);
    });
  });
}

export async function setServerUrl(url: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [SERVER_URL_KEY]: url }, resolve);
  });
}
