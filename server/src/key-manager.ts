const apiKeys: string[] = (
  process.env.GOOGLE_GENERATIVE_AI_API_KEYS ||
  process.env.GEMINI_API_KEY ||
  ""
)
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

const failedKeys = new Map<string, number>();

const FAIL_TTL_MS = 60_000;

function isKeyFailed(key: string): boolean {
  const failedAt = failedKeys.get(key);
  if (!failedAt) return false;
  if (Date.now() - failedAt > FAIL_TTL_MS) {
    failedKeys.delete(key);
    return false;
  }
  return true;
}

let keyIndex = 0;

export function nextApiKey(): string | undefined {
  if (apiKeys.length === 0) return undefined;
  const len = apiKeys.length;
  for (let i = 0; i < len; i++) {
    const key = apiKeys[keyIndex % len];
    keyIndex++;
    if (!isKeyFailed(key)) return key;
  }
  failedKeys.clear();
  const key = apiKeys[keyIndex % len];
  keyIndex++;
  return key;
}

export function markKeyFailed(key: string): void {
  failedKeys.set(key, Date.now());
  console.warn(`[key-manager] Key ...${key.slice(-6)} marked failed (${failedKeys.size}/${apiKeys.length} failed)`);
}

export function markKeySuccess(key: string): void {
  if (failedKeys.has(key)) {
    failedKeys.delete(key);
  }
}

export function getKeyCount(): number {
  return apiKeys.length;
}
