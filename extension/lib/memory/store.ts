/**
 * Phantom Memory Store
 *
 * Two-layer memory inspired by OpenClaw:
 * 1. User profile — persistent facts, preferences (like MEMORY.md)
 * 2. Session memories — timestamped notes with embeddings (like memory/YYYY-MM-DD.md)
 *
 * Storage: chrome.storage.local for profile, IndexedDB for vector-indexed memories.
 */

import { generateEmbedding, cosineSimilarity } from "./embeddings";

// ─── Types ───

export interface UserProfile {
  name?: string;
  preferences: string[];      // "prefers concise responses", "uses dark mode"
  facts: string[];             // "works at Acme Corp", "timezone is EST"
  updatedAt: number;
}

export interface MemoryEntry {
  id: string;
  text: string;
  embedding: number[];
  type: "session_summary" | "explicit" | "fact";
  timestamp: number;
  sessionId?: string;
  metadata?: Record<string, string>;
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  similarity: number;
}

// ─── User Profile (chrome.storage.local) ───

const PROFILE_KEY = "phantom_user_profile";

export async function getUserProfile(): Promise<UserProfile> {
  const result = await chrome.storage.local.get(PROFILE_KEY);
  return result[PROFILE_KEY] || {
    preferences: [],
    facts: [],
    updatedAt: 0,
  };
}

export async function updateUserProfile(
  updates: Partial<UserProfile>
): Promise<UserProfile> {
  const current = await getUserProfile();
  const updated: UserProfile = {
    ...current,
    ...updates,
    updatedAt: Date.now(),
  };
  await chrome.storage.local.set({ [PROFILE_KEY]: updated });
  return updated;
}

export async function addProfileFact(fact: string): Promise<void> {
  const profile = await getUserProfile();
  if (!profile.facts.includes(fact)) {
    profile.facts.push(fact);
    profile.updatedAt = Date.now();
    await chrome.storage.local.set({ [PROFILE_KEY]: profile });
  }
}

export async function addProfilePreference(pref: string): Promise<void> {
  const profile = await getUserProfile();
  if (!profile.preferences.includes(pref)) {
    profile.preferences.push(pref);
    profile.updatedAt = Date.now();
    await chrome.storage.local.set({ [PROFILE_KEY]: profile });
  }
}

// ─── Memory Store (IndexedDB) ───

const DB_NAME = "phantom_memory";
const DB_VERSION = 1;
const STORE_NAME = "memories";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("type", "type", { unique: false });
      }
    };
  });
}

/**
 * Store a memory with its embedding.
 */
export async function addMemory(
  text: string,
  type: MemoryEntry["type"],
  metadata?: Record<string, string>
): Promise<MemoryEntry> {
  const embedding = await generateEmbedding(text);
  const entry: MemoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    embedding,
    type,
    timestamp: Date.now(),
    metadata,
  };

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  console.log("[Memory] Stored:", type, text.slice(0, 80));
  return entry;
}

/**
 * Semantic search over memories.
 */
export async function searchMemories(
  query: string,
  limit = 5,
  threshold = 0.3
): Promise<MemorySearchResult[]> {
  const queryEmbedding = await generateEmbedding(query);

  const db = await openDB();
  const entries: MemoryEntry[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (entries.length === 0) return [];

  const results = entries
    .map((entry) => ({
      entry,
      similarity: cosineSimilarity(queryEmbedding, entry.embedding),
    }))
    .filter((r) => r.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return results;
}

/**
 * Get recent memories (newest first).
 */
export async function getRecentMemories(
  limit = 10,
  type?: MemoryEntry["type"]
): Promise<MemoryEntry[]> {
  const db = await openDB();
  const entries: MemoryEntry[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  let filtered = type ? entries.filter((e) => e.type === type) : entries;
  return filtered.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

/**
 * Get all memories count.
 */
export async function getMemoryCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Delete old memories to stay under a limit.
 */
export async function pruneMemories(maxEntries = 200): Promise<number> {
  const db = await openDB();
  const entries: MemoryEntry[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (entries.length <= maxEntries) return 0;

  entries.sort((a, b) => a.timestamp - b.timestamp);
  const toDelete = entries.slice(0, entries.length - maxEntries);

  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  for (const entry of toDelete) {
    store.delete(entry.id);
  }

  return toDelete.length;
}

/**
 * Clear all memories (for testing / reset).
 */
export async function clearAllMemories(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── Memory Context Builder (for system prompt injection) ───

/**
 * Build a memory context string to inject into the system prompt.
 * Includes user profile + recent session summaries.
 */
export async function buildMemoryContext(): Promise<string> {
  const parts: string[] = [];

  // User profile
  const profile = await getUserProfile();
  if (profile.name || profile.facts.length > 0 || profile.preferences.length > 0) {
    parts.push("## What you know about the user");
    if (profile.name) parts.push(`- Name: ${profile.name}`);
    for (const fact of profile.facts.slice(0, 10)) parts.push(`- ${fact}`);
    for (const pref of profile.preferences.slice(0, 5)) parts.push(`- Preference: ${pref}`);
  }

  // Recent session summaries
  const recentSummaries = await getRecentMemories(5, "session_summary");
  if (recentSummaries.length > 0) {
    parts.push("\n## Recent sessions");
    for (const mem of recentSummaries) {
      const date = new Date(mem.timestamp).toLocaleDateString();
      parts.push(`- ${date}: ${mem.text.slice(0, 200)}`);
    }
  }

  // Explicit memories (things user asked to remember)
  const explicit = await getRecentMemories(5, "explicit");
  if (explicit.length > 0) {
    parts.push("\n## Things the user asked you to remember");
    for (const mem of explicit) {
      parts.push(`- ${mem.text}`);
    }
  }

  return parts.length > 0
    ? "\n\n" + parts.join("\n") + "\n"
    : "";
}
