import React, { useState, useEffect } from "react";
import { ArrowLeft, Trash2, Brain, User, MessageSquare, BookOpen, Search, X } from "lucide-react";
import { getUserProfile, getRecentMemories, clearAllMemories, type MemoryEntry, type UserProfile } from "../lib/memory/store";
import { Tooltip } from "./tooltip";

interface MemoryScreenProps {
  onBack: () => void;
}

type Tab = "summaries" | "memories" | "profile";

const TAB_CONFIG: Record<Tab, { label: string; icon: typeof Brain }> = {
  summaries: { label: "Sessions", icon: MessageSquare },
  memories:  { label: "Memories", icon: BookOpen },
  profile:   { label: "Profile", icon: User },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const MemoryScreen = ({ onBack }: MemoryScreenProps) => {
  const [tab, setTab] = useState<Tab>("summaries");
  const [summaries, setSummaries] = useState<MemoryEntry[]>([]);
  const [explicit, setExplicit] = useState<MemoryEntry[]>([]);
  const [facts, setFacts] = useState<MemoryEntry[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, e, f, p] = await Promise.all([
        getRecentMemories(50, "session_summary"),
        getRecentMemories(50, "explicit"),
        getRecentMemories(50, "fact"),
        getUserProfile(),
      ]);
      setSummaries(s);
      setExplicit(e);
      setFacts(f);
      setProfile(p);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleClear = async () => {
    await clearAllMemories();
    load();
  };

  const allMemories = tab === "summaries" ? summaries : [...explicit, ...facts].sort((a, b) => b.timestamp - a.timestamp);
  const filtered = searchQuery
    ? allMemories.filter((m) => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : allMemories;

  return (
    <div className="w-full h-full flex flex-col" style={{ background: "var(--g-surface)", color: "var(--g-on-surface)" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--g-outline-variant)" }}>
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-g-surface-container transition-colors">
          <ArrowLeft className="w-5 h-5" style={{ color: "var(--g-on-surface)" }} />
        </button>
        <Brain className="w-5 h-5" style={{ color: "var(--g-blue)" }} />
        <span className="font-google text-base font-medium flex-1">Memory</span>
        <Tooltip text="Clear all" position="top">
          <button onClick={handleClear} className="p-2 rounded-full hover:bg-g-surface-container transition-colors" style={{ color: "var(--g-outline)" }}>
            <Trash2 className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>

      <div className="flex gap-1.5 px-4 py-2.5" style={{ borderBottom: "1px solid var(--g-outline-variant)" }}>
        {(Object.keys(TAB_CONFIG) as Tab[]).map((t) => {
          const cfg = TAB_CONFIG[t];
          const Icon = cfg.icon;
          const active = t === tab;
          return (
            <button
              key={t}
              onClick={() => { setTab(t); setSearchQuery(""); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-g-full text-xs font-google font-medium transition-colors"
              style={{
                background: active ? "var(--g-blue-bg)" : "var(--g-surface-dim)",
                color: active ? "var(--g-blue)" : "var(--g-on-surface-variant)",
                border: active ? "1px solid var(--g-blue-light)" : "1px solid var(--g-outline-variant)",
              }}
            >
              <Icon className="w-3 h-3" />
              {cfg.label}
            </button>
          );
        })}
      </div>

      {tab !== "profile" && (
        <div className="px-4 pt-2.5 pb-1">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-g-sm" style={{ background: "var(--g-surface-dim)", border: "1px solid var(--g-outline-variant)" }}>
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--g-outline)" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search memories..."
              className="flex-1 bg-transparent text-xs font-google-text outline-none"
              style={{ color: "var(--g-on-surface)" }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="p-0.5">
                <X className="w-3 h-3" style={{ color: "var(--g-outline)" }} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading && (
          <p className="text-sm font-google-text text-center mt-8" style={{ color: "var(--g-outline)" }}>Loading...</p>
        )}

        {!loading && tab === "profile" && profile && (
          <div className="space-y-3">
            <div className="rounded-g-sm p-3" style={{ background: "var(--g-surface-dim)", border: "1px solid var(--g-outline-variant)" }}>
              <div className="text-[10px] font-google font-medium uppercase tracking-wider mb-2" style={{ color: "var(--g-outline)" }}>Name</div>
              <div className="text-sm font-google-text" style={{ color: "var(--g-on-surface)" }}>
                {profile.name || "Unknown"}
              </div>
            </div>
            {profile.facts.length > 0 && (
              <div className="rounded-g-sm p-3" style={{ background: "var(--g-surface-dim)", border: "1px solid var(--g-outline-variant)" }}>
                <div className="text-[10px] font-google font-medium uppercase tracking-wider mb-2" style={{ color: "var(--g-outline)" }}>Facts</div>
                <div className="space-y-1">
                  {profile.facts.map((f, i) => (
                    <div key={i} className="text-xs font-google-text" style={{ color: "var(--g-on-surface-variant)" }}>• {f}</div>
                  ))}
                </div>
              </div>
            )}
            {profile.preferences.length > 0 && (
              <div className="rounded-g-sm p-3" style={{ background: "var(--g-surface-dim)", border: "1px solid var(--g-outline-variant)" }}>
                <div className="text-[10px] font-google font-medium uppercase tracking-wider mb-2" style={{ color: "var(--g-outline)" }}>Preferences</div>
                <div className="space-y-1">
                  {profile.preferences.map((p, i) => (
                    <div key={i} className="text-xs font-google-text" style={{ color: "var(--g-on-surface-variant)" }}>• {p}</div>
                  ))}
                </div>
              </div>
            )}
            {profile.facts.length === 0 && profile.preferences.length === 0 && !profile.name && (
              <p className="text-xs font-google-text text-center mt-4" style={{ color: "var(--g-outline)" }}>
                No profile data yet. The agent learns about you over time.
              </p>
            )}
          </div>
        )}

        {!loading && tab !== "profile" && filtered.length === 0 && (
          <p className="text-sm font-google-text text-center mt-8" style={{ color: "var(--g-outline)" }}>
            {searchQuery ? "No matches found." : tab === "summaries" ? "No session summaries yet." : "No stored memories yet."}
          </p>
        )}

        {!loading && tab !== "profile" && filtered.map((entry) => (
          <div
            key={entry.id}
            className="rounded-g-sm p-3"
            style={{ background: "var(--g-surface-dim)", border: "1px solid var(--g-outline-variant)" }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span
                className="text-[10px] font-google font-medium uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{
                  background: entry.type === "session_summary" ? "var(--g-blue-bg)" : entry.type === "explicit" ? "var(--g-green-bg)" : "#fef7e0",
                  color: entry.type === "session_summary" ? "var(--g-blue)" : entry.type === "explicit" ? "var(--g-green)" : "#e37400",
                }}
              >
                {entry.type === "session_summary" ? "Session" : entry.type === "explicit" ? "Remember" : "Fact"}
              </span>
              <span className="text-[10px] font-google-text" style={{ color: "var(--g-outline)" }}>
                {timeAgo(entry.timestamp)}
              </span>
            </div>
            <p className="text-xs font-google-text leading-relaxed" style={{ color: "var(--g-on-surface-variant)" }}>
              {entry.text}
            </p>
          </div>
        ))}
      </div>

      {!loading && tab !== "profile" && (
        <div className="px-4 py-2 text-center" style={{ borderTop: "1px solid var(--g-outline-variant)" }}>
          <span className="text-[10px] font-google-text" style={{ color: "var(--g-outline)" }}>
            {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
            {searchQuery ? ` matching "${searchQuery}"` : ""}
          </span>
        </div>
      )}
    </div>
  );
};
