export type TraceEntryType = "user_text" | "user_audio" | "agent_text" | "agent_audio" | "tool_call" | "tool_result" | "vision_frame" | "system" | "error";

export interface TraceEntry {
  id: string;
  timestamp: number;
  type: TraceEntryType;
  content: string;
  meta?: Record<string, unknown>;
}

export interface SessionTrace {
  id: string;
  startedAt: number;
  endedAt?: number;
  entries: TraceEntry[];
}

const TRACE_STORAGE_KEY = "phantom_traces";
const MAX_SESSIONS = 20;

let currentSession: SessionTrace | null = null;
let listeners: (() => void)[] = [];

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function startSession(): SessionTrace {
  currentSession = {
    id: genId(),
    startedAt: Date.now(),
    entries: [],
  };
  notify();
  return currentSession;
}

export function endSession(): void {
  if (currentSession) {
    currentSession.endedAt = Date.now();
    persistSession(currentSession);
    currentSession = null;
    notify();
  }
}

export function addTrace(type: TraceEntryType, content: string, meta?: Record<string, unknown>): void {
  if (!currentSession) return;
  currentSession.entries.push({
    id: genId(),
    timestamp: Date.now(),
    type,
    content,
    meta,
  });
  notify();
}

export function getCurrentSession(): SessionTrace | null {
  return currentSession;
}

export function clearCurrentSession(): void {
  if (currentSession) {
    currentSession.entries = [];
  }
  notify();
}

export function onTraceUpdate(fn: () => void): () => void {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
}

function notify(): void {
  listeners.forEach((fn) => fn());
}

async function persistSession(session: SessionTrace): Promise<void> {
  const stored = await getSavedSessions();
  stored.unshift(session);
  if (stored.length > MAX_SESSIONS) stored.length = MAX_SESSIONS;
  await chrome.storage.local.set({ [TRACE_STORAGE_KEY]: stored });
}

export async function getSavedSessions(): Promise<SessionTrace[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(TRACE_STORAGE_KEY, (r) => {
      resolve(r[TRACE_STORAGE_KEY] || []);
    });
  });
}

export async function clearSavedSessions(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [TRACE_STORAGE_KEY]: [] }, () => {
      notify();
      resolve();
    });
  });
}

export function formatTraceAsText(session: SessionTrace): string {
  const lines: string[] = [];
  lines.push(`Session ${session.id}`);
  lines.push(`Started: ${new Date(session.startedAt).toISOString()}`);
  if (session.endedAt) lines.push(`Ended: ${new Date(session.endedAt).toISOString()}`);
  lines.push("");

  for (const entry of session.entries) {
    const ts = new Date(entry.timestamp).toISOString().slice(11, 23);
    switch (entry.type) {
      case "user_text":
        lines.push(`[${ts}] USER: ${entry.content}`);
        break;
      case "user_audio":
        lines.push(`[${ts}] USER (audio): ${entry.content}`);
        break;
      case "agent_text":
        lines.push(`[${ts}] AGENT: ${entry.content}`);
        break;
      case "agent_audio":
        lines.push(`[${ts}] AGENT (audio): ${entry.content}`);
        break;
      case "tool_call":
        lines.push(`[${ts}] TOOL CALL: ${entry.content}`);
        if (entry.meta?.args) lines.push(`  args: ${JSON.stringify(entry.meta.args)}`);
        break;
      case "tool_result":
        lines.push(`[${ts}] TOOL RESULT: ${entry.content}`);
        break;
      case "vision_frame":
        lines.push(`[${ts}] VISION: frame sent`);
        break;
      case "system":
        lines.push(`[${ts}] SYSTEM: ${entry.content}`);
        break;
      case "error":
        lines.push(`[${ts}] ERROR: ${entry.content}`);
        break;
    }
  }

  return lines.join("\n");
}
