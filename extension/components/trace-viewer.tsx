import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Copy, Trash2, ChevronDown, ChevronRight, Terminal, User, Bot, Wrench, Eye, AlertCircle, Info, RotateCw } from "lucide-react";
import { getCurrentSession, getSavedSessions, clearSavedSessions, clearCurrentSession, onTraceUpdate, formatTraceAsText, type SessionTrace, type TraceEntry, type TraceEntryType } from "../lib/trace";
import { executeTool } from "../lib/tools";
import { MarkdownText } from "./markdown";
import { Tooltip } from "./tooltip";

interface TraceViewerProps {
  onBack: () => void;
}

const TYPE_CONFIG: Record<TraceEntryType, { icon: typeof User; color: string; bgColor: string; label: string }> = {
  user_text:    { icon: User,        color: "var(--g-green)",  bgColor: "var(--g-green-bg)",  label: "User" },
  user_audio:   { icon: User,        color: "var(--g-green)",  bgColor: "var(--g-green-bg)",  label: "User (audio)" },
  agent_text:   { icon: Bot,         color: "var(--g-blue)",   bgColor: "var(--g-blue-bg)",   label: "Agent" },
  agent_audio:  { icon: Bot,         color: "var(--g-blue)",   bgColor: "var(--g-blue-bg)",   label: "Agent (audio)" },
  tool_call:    { icon: Wrench,      color: "#9334E9",         bgColor: "#f3e8ff",            label: "Tool" },
  tool_result:  { icon: Terminal,    color: "#9334E9",         bgColor: "#f3e8ff",            label: "Result" },
  vision_frame: { icon: Eye,         color: "var(--g-blue)",   bgColor: "var(--g-blue-bg)",   label: "Screen" },
  system:       { icon: Info,        color: "var(--g-outline)", bgColor: "var(--g-surface-container)", label: "System" },
  error:        { icon: AlertCircle, color: "var(--g-red)",    bgColor: "var(--g-red-bg)",    label: "Error" },
};

function formatTime(ts: number, base: number): string {
  const diff = Math.round((ts - base) / 1000);
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const TraceViewer = ({ onBack }: TraceViewerProps) => {
  const [sessions, setSessions] = useState<SessionTrace[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const saved = await getSavedSessions();
      const current = getCurrentSession();
      const all = current ? [current, ...saved] : saved;
      setSessions(all);
    };
    load();
    return onTraceUpdate(load);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sessions, activeIdx]);

  const session = sessions[activeIdx];

  const handleCopy = () => {
    if (!session) return;
    navigator.clipboard.writeText(formatTraceAsText(session));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = async () => {
    await clearSavedSessions();
    clearCurrentSession();
    setSessions([]);
    setActiveIdx(0);
  };

  return (
    <div className="w-full h-full flex flex-col" style={{ background: "var(--g-surface)", color: "var(--g-on-surface)" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--g-outline-variant)" }}>
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-g-surface-container transition-colors">
          <ArrowLeft className="w-5 h-5" style={{ color: "var(--g-on-surface)" }} />
        </button>
        <span className="font-google text-base font-medium flex-1">Traces</span>
        <Tooltip text="Copy session" position="top">
          <button onClick={handleCopy} className="p-2 rounded-full hover:bg-g-surface-container transition-colors" style={{ color: "var(--g-outline)" }}>
            <Copy className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip text="Clear all" position="top">
          <button onClick={handleClear} className="p-2 rounded-full hover:bg-g-surface-container transition-colors" style={{ color: "var(--g-outline)" }}>
            <Trash2 className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>

      {copied && (
        <div className="px-4 py-2 text-xs font-google font-medium" style={{ background: "var(--g-green-bg)", color: "var(--g-green)" }}>
          Copied to clipboard
        </div>
      )}

      {sessions.length > 1 && (
        <div className="flex gap-1.5 px-4 py-2.5 overflow-x-auto" style={{ borderBottom: "1px solid var(--g-outline-variant)" }}>
          {sessions.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActiveIdx(i)}
              className="shrink-0 px-3 py-1.5 rounded-g-full text-xs font-google font-medium transition-colors"
              style={{
                background: i === activeIdx ? "var(--g-blue-bg)" : "var(--g-surface-dim)",
                color: i === activeIdx ? "var(--g-blue)" : "var(--g-on-surface-variant)",
                border: i === activeIdx ? "1px solid var(--g-blue-light)" : "1px solid var(--g-outline-variant)",
              }}
            >
              {i === 0 && getCurrentSession() ? "Live" : new Date(s.startedAt).toLocaleTimeString()}
            </button>
          ))}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {!session && (
          <p className="text-sm font-google-text text-center mt-8" style={{ color: "var(--g-outline)" }}>
            No sessions yet. Start a conversation to see traces.
          </p>
        )}
        {session?.entries.map((entry) => (
          <TraceEntryRow key={entry.id} entry={entry} baseTime={session.startedAt} />
        ))}
      </div>
    </div>
  );
};

const TraceEntryRow = ({ entry, baseTime }: { entry: TraceEntry; baseTime: number }) => {
  const [expanded, setExpanded] = useState(entry.type === "agent_text" || entry.type === "tool_call");
  const [rerunResult, setRerunResult] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState(false);
  const cfg = TYPE_CONFIG[entry.type];
  if (!cfg) return null;
  const Icon = cfg.icon;

  if (entry.type === "vision_frame") {
    return null;
  }

  const isToolCall = entry.type === "tool_call";
  const isMarkdown = entry.type === "agent_text";
  const hasMeta = entry.meta && Object.keys(entry.meta).length > 0;

  const handleRerun = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (rerunning) return;
    setRerunning(true);
    setRerunResult(null);
    try {
      const args = (entry.meta?.args as Record<string, unknown>) || {};
      const result = await executeTool(entry.content, args);
      setRerunResult(JSON.stringify(result, null, 2));
    } catch (err) {
      setRerunResult("Error: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setRerunning(false);
      setExpanded(true);
    }
  };

  return (
    <div className="group">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-2.5 py-2 text-left rounded-g-sm px-2 -mx-2 transition-colors hover:bg-g-surface-dim"
      >
        <span className="text-[10px] font-google-text mt-0.5 w-8 shrink-0" style={{ color: "var(--g-outline)" }}>
          {formatTime(entry.timestamp, baseTime)}
        </span>
        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: cfg.bgColor }}>
          <Icon className="w-3 h-3" style={{ color: cfg.color }} />
        </div>
        <span className="text-xs font-google-text flex-1 truncate" style={{ color: cfg.color }}>
          {isToolCall ? entry.content : entry.type === "agent_text" ? "Response" : entry.content.slice(0, 120)}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {isToolCall && (
            <Tooltip text="Rerun tool" position="top">
              <span
                onClick={handleRerun}
                className="p-0.5 rounded-full transition-colors hover:bg-g-surface-container-high"
                style={{ color: "var(--g-outline)" }}
              >
                <RotateCw className={`w-3 h-3 ${rerunning ? "animate-spin" : ""}`} />
              </span>
            </Tooltip>
          )}
          {(hasMeta || entry.content.length > 120) && (
            expanded
              ? <ChevronDown className="w-3.5 h-3.5 mt-0.5" style={{ color: "var(--g-outline)" }} />
              : <ChevronRight className="w-3.5 h-3.5 mt-0.5" style={{ color: "var(--g-outline)" }} />
          )}
        </div>
      </button>
      {expanded && (
        <div className="ml-[56px] pb-2">
          {isMarkdown ? (
            <MarkdownText content={entry.content} className="text-xs font-google-text leading-relaxed" />
          ) : (
            <p className="text-xs font-google-text whitespace-pre-wrap break-words" style={{ color: "var(--g-on-surface-variant)" }}>{entry.content}</p>
          )}
          {hasMeta && (
            <pre className="mt-1.5 text-[10px] rounded-g-sm px-2.5 py-1.5 overflow-x-auto" style={{ background: "var(--g-surface-dim)", color: "var(--g-outline)", border: "1px solid var(--g-outline-variant)" }}>
              {JSON.stringify(entry.meta, null, 2)}
            </pre>
          )}
          {rerunResult && (
            <pre className="mt-1.5 text-[10px] rounded-g-sm px-2.5 py-1.5 overflow-x-auto" style={{ background: "var(--g-blue-bg)", color: "var(--g-blue)", border: "1px solid var(--g-blue-light)" }}>
              {rerunResult}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
