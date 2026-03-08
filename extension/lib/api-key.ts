/**
 * Gemini API key storage
 */

const STORAGE_KEY = "phantom_gemini_api_key";

export async function getApiKey(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      resolve(result[STORAGE_KEY] || null);
    });
  });
}

export async function saveApiKey(key: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: key }, resolve);
  });
}

export async function removeApiKey(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(STORAGE_KEY, resolve);
  });
}

export function isValidKeyFormat(key: string): boolean {
  return key.startsWith("AIza") && key.length >= 30;
}
