import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Copy, Trash2, ChevronDown, ChevronRight, Terminal, User, Bot, Wrench, Eye, AlertCircle, Info } from "lucide-react";
import { getCurrentSession, getSavedSessions, clearSavedSessions, onTraceUpdate, formatTraceAsText, type SessionTrace, type TraceEntry, type TraceEntryType } from "../lib/trace";
import { MarkdownText } from "./markdown";

interface TraceViewerProps {
  onBack: () => void;
}

const TYPE_CONFIG: Record<TraceEntryType, { icon: typeof User; color: string; label: string }> = {
  user_text: { icon: User, color: "text-green-400", label: "User" },
  user_audio: { icon: User, color: "text-green-400", label: "User (audio)" },
  agent_text: { icon: Bot, color: "text-blue-400", label: "Agent" },
  agent_audio: { icon: Bot, color: "text-blue-400", label: "Agent (audio)" },
  tool_call: { icon: Wrench, color: "text-purple-400", label: "Tool" },
  tool_result: { icon: Terminal, color: "text-purple-300", label: "Result" },
  vision_frame: { icon: Eye, color: "text-cyan-400", label: "Screen" },
  system: { icon: Info, color: "text-gray-500", label: "System" },
  error: { icon: AlertCircle, color: "text-red-400", label: "Error" },
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
    const current = getCurrentSession();
    setSessions(current ? [current] : []);
    setActiveIdx(0);
  };

  return (
    <div className="w-full h-full bg-black text-white flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-900">
        <button onClick={onBack} className="p-1 hover:bg-white/5 rounded">
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </button>
        <span className="font-mono text-xs tracking-widest text-gray-500 flex-1">TRACES</span>
        <button onClick={handleCopy} className="p-1.5 hover:bg-white/5 rounded text-gray-500 hover:text-gray-300" title="Copy session">
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleClear} className="p-1.5 hover:bg-white/5 rounded text-gray-500 hover:text-red-400" title="Clear saved">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {copied && (
        <div className="px-4 py-1.5 bg-green-900/30 text-green-400 text-[10px] font-mono">Copied to clipboard</div>
      )}

      {sessions.length > 1 && (
        <div className="flex gap-1 px-4 py-2 border-b border-gray-900 overflow-x-auto">
          {sessions.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActiveIdx(i)}
              className={`shrink-0 px-2.5 py-1 rounded text-[10px] font-mono transition-colors ${
                i === activeIdx ? "bg-blue-600/20 text-blue-400 border border-blue-500/50" : "bg-gray-900 text-gray-500 border border-gray-800 hover:bg-gray-800"
              }`}
            >
              {i === 0 && getCurrentSession() ? "Live" : new Date(s.startedAt).toLocaleTimeString()}
            </button>
          ))}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {!session && (
          <p className="text-gray-600 text-xs text-center mt-8">No sessions yet. Start a conversation to see traces.</p>
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
  const cfg = TYPE_CONFIG[entry.type];
  const Icon = cfg.icon;

  if (entry.type === "vision_frame") {
    return null;
  }

  const isMarkdown = entry.type === "agent_text";
  const hasMeta = entry.meta && Object.keys(entry.meta).length > 0;

  return (
    <div className="group">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-2 py-1.5 text-left hover:bg-white/[0.02] rounded px-1 -mx-1 transition-colors"
      >
        <span className="text-[9px] font-mono text-gray-700 mt-0.5 w-8 shrink-0">{formatTime(entry.timestamp, baseTime)}</span>
        <Icon className={`w-3 h-3 mt-0.5 shrink-0 ${cfg.color}`} />
        <span className={`text-xs flex-1 ${cfg.color} truncate`}>
          {entry.type === "tool_call" ? entry.content : entry.content.slice(0, 120)}
        </span>
        {(hasMeta || entry.content.length > 120) && (
          expanded
            ? <ChevronDown className="w-3 h-3 text-gray-700 mt-0.5 shrink-0" />
            : <ChevronRight className="w-3 h-3 text-gray-700 mt-0.5 shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="ml-[52px] pb-2">
          {isMarkdown ? (
            <MarkdownText content={entry.content} className="text-xs text-gray-300 leading-relaxed" />
          ) : (
            <p className="text-[11px] text-gray-400 whitespace-pre-wrap break-words">{entry.content}</p>
          )}
          {hasMeta && (
            <pre className="mt-1 text-[9px] text-gray-600 bg-gray-900/50 rounded px-2 py-1 overflow-x-auto">
              {JSON.stringify(entry.meta, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
