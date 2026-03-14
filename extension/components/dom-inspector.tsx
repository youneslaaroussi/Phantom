import React, { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, Copy, RefreshCw, ChevronDown, ChevronRight, Check, Search, Box, Type, FormInput, Link2, ToggleLeft, MousePointerClick, Keyboard, Move, Highlighter, ScrollText, MoreHorizontal, X } from "lucide-react";
import { Tooltip } from "./tooltip";
import { executeTool } from "../lib/tools";

interface DomInspectorProps {
  onBack: () => void;
}

interface DomElement {
  tag: string;
  role: string;
  name: string;
  selector: string;
  attributes: Record<string, string>;
  rect: { x: number; y: number; w: number; h: number };
  children: DomElement[];
}

const ROLE_ICONS: Record<string, typeof Box> = {
  button: ToggleLeft,
  link: Link2,
  textbox: FormInput,
  combobox: FormInput,
  text: Type,
};

const ROLE_COLORS: Record<string, { color: string; bg: string }> = {
  button:  { color: "var(--g-blue)",    bg: "var(--g-blue-bg)" },
  link:    { color: "#9334E9",          bg: "#f3e8ff" },
  textbox: { color: "var(--g-green)",   bg: "var(--g-green-bg)" },
  combobox:{ color: "var(--g-green)",   bg: "var(--g-green-bg)" },
  default: { color: "var(--g-outline)", bg: "var(--g-surface-container)" },
};

async function scanPage(): Promise<DomElement[]> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return [];
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const esc = (s: string) => CSS.escape(s);
      const only = (s: string) => { try { return document.querySelectorAll(s).length === 1; } catch { return false; } };
      const UP = /^(w-|h-|p[xytrbl]?-|m[xytrbl]?-|text-\[|bg-\[|border-|rounded-|shadow-|opacity-|z-|gap-|space-|overflow-|max-|min-|top-|right-|bottom-|left-|inset-|translate-|scale-|rotate-|duration-|delay-|ease-|tracking-|leading-|font-(?:normal|bold|light|thin|medium|semibold|extrabold|black)|disabled:|hover:|focus:|active:|group-hover:|dark:|sm:|md:|lg:|xl:|2xl:)/;
      const isSem = (c: string) => c.length <= 60 && !/^[0-9]/.test(c) && !UP.test(c);
      const uniqueSel = (el: Element): string => {
        if (el.id) { const s = `#${esc(el.id)}`; if (only(s)) return s; }
        const tag = el.tagName.toLowerCase();
        for (const a of ["aria-label", "placeholder", "name", "data-testid", "title", "type", "role"]) {
          const v = el.getAttribute(a); if (v) { const s = `${tag}[${a}="${esc(v)}"]`; if (only(s)) return s; }
        }
        const all = (typeof el.className === "string" ? el.className : "").trim().split(/\s+/).filter(Boolean);
        const sem = all.filter(isSem); const cls = sem.length > 0 ? sem : all.slice(0, 3);
        for (const c of cls) { const s = `${tag}.${esc(c)}`; if (only(s)) return s; }
        for (let i = 0; i < cls.length && i < 5; i++) for (let j = i + 1; j < cls.length && j < 6; j++) { const s = `${tag}.${esc(cls[i])}.${esc(cls[j])}`; if (only(s)) return s; }
        const parts: string[] = [];
        let cur: Element | null = el;
        while (cur && cur !== document.body) {
          let seg = cur.tagName.toLowerCase();
          if (cur.id) { parts.unshift(`#${esc(cur.id)}`); const f = parts.join(" > "); if (only(f)) return f; return f; }
          const p = cur.parentElement;
          if (p) { const sibs = Array.from(p.children).filter(c => c.tagName === cur!.tagName); if (sibs.length > 1) seg = `${seg}:nth-of-type(${sibs.indexOf(cur) + 1})`; }
          parts.unshift(seg);
          const f = parts.join(" > "); if (only(f)) return f;
          cur = cur.parentElement;
        }
        return parts.join(" > ");
      };

      const sels = [
        "button", "a[href]", "input", "textarea", "select",
        '[role="button"]', '[role="link"]', '[role="textbox"]',
        '[tabindex]:not([tabindex="-1"])', "[onclick]",
      ];
      const allEls = document.querySelectorAll(sels.join(","));
      const results: {
        tag: string; role: string; name: string; selector: string;
        attributes: Record<string, string>;
        rect: { x: number; y: number; w: number; h: number };
        children: never[];
      }[] = [];

      allEls.forEach((el) => {
        const h = el as HTMLElement;
        const style = window.getComputedStyle(h);
        if (style.display === "none" || style.visibility === "hidden") return;
        const rect = h.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        let name = h.getAttribute("aria-label") || "";
        if (!name && (h instanceof HTMLInputElement || h instanceof HTMLTextAreaElement)) {
          name = h.labels?.[0]?.textContent?.trim() || h.placeholder || "";
        }
        if (!name) name = h.textContent?.trim() || "";
        name = name.slice(0, 120);

        let role = h.getAttribute("role") || "";
        if (!role) {
          const tag = h.tagName.toLowerCase();
          if (tag === "button") role = "button";
          else if (tag === "a") role = "link";
          else if (tag === "input") role = (h as HTMLInputElement).type === "submit" ? "button" : "textbox";
          else if (tag === "textarea") role = "textbox";
          else if (tag === "select") role = "combobox";
        }

        const attrs: Record<string, string> = {};
        for (const a of ["id", "class", "href", "type", "placeholder", "aria-label", "name", "value", "data-testid", "title"]) {
          const v = h.getAttribute(a);
          if (v) attrs[a] = v.slice(0, 200);
        }

        results.push({
          tag: h.tagName.toLowerCase(),
          role,
          name,
          selector: uniqueSel(h),
          attributes: attrs,
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
          children: [],
        });
      });
      return results.slice(0, 100);
    },
  });
  return (results[0]?.result as DomElement[]) || [];
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Tooltip text={copied ? "Copied!" : (label || "Copy")} position="top">
      <button
        onClick={handleCopy}
        className="p-1 rounded transition-colors shrink-0"
        style={{
          background: copied ? "var(--g-green-bg)" : "transparent",
          color: copied ? "var(--g-green)" : "var(--g-outline)",
        }}
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      </button>
    </Tooltip>
  );
}

interface ActionResult {
  status: "idle" | "running" | "success" | "error";
  message?: string;
}

function ActionPopover({ el, onClose }: { el: DomElement; onClose: () => void }) {
  const [typeValue, setTypeValue] = useState("");
  const [keyValue, setKeyValue] = useState("");
  const [result, setResult] = useState<ActionResult>({ status: "idle" });
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const run = async (name: string, args: Record<string, unknown>) => {
    setResult({ status: "running" });
    try {
      const res = await executeTool(name, args);
      if (res.error) {
        setResult({ status: "error", message: String(res.error) });
      } else {
        setResult({ status: "success", message: JSON.stringify(res).slice(0, 200) });
        setTimeout(() => setResult({ status: "idle" }), 2000);
      }
    } catch (err) {
      setResult({ status: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  const isInput = el.role === "textbox" || el.role === "combobox";

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-lg overflow-hidden"
      style={{
        background: "var(--g-surface)",
        border: "1px solid var(--g-outline-variant)",
        boxShadow: "var(--g-shadow-3)",
        minWidth: 220,
      }}
    >
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid var(--g-outline-variant)" }}>
        <span className="text-[11px] font-google font-medium" style={{ color: "var(--g-on-surface)" }}>Actions</span>
        <button onClick={onClose} className="p-0.5 rounded hover:bg-g-surface-container transition-colors" style={{ color: "var(--g-outline)" }}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-1.5 space-y-0.5">
        <button
          onClick={() => run("clickOn", { selector: el.selector })}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors hover:bg-g-surface-dim"
        >
          <MousePointerClick className="w-3.5 h-3.5" style={{ color: "var(--g-blue)" }} />
          <span className="text-xs font-google-text" style={{ color: "var(--g-on-surface)" }}>Click</span>
        </button>

        <button
          onClick={() => run("highlight", { selector: el.selector })}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors hover:bg-g-surface-dim"
        >
          <Highlighter className="w-3.5 h-3.5" style={{ color: "var(--g-yellow)" }} />
          <span className="text-xs font-google-text" style={{ color: "var(--g-on-surface)" }}>Highlight</span>
        </button>

        <button
          onClick={() => run("scrollTo", { selector: el.selector })}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors hover:bg-g-surface-dim"
        >
          <Move className="w-3.5 h-3.5" style={{ color: "#9334E9" }} />
          <span className="text-xs font-google-text" style={{ color: "var(--g-on-surface)" }}>Scroll to</span>
        </button>

        {isInput && (
          <div className="px-2.5 py-1.5">
            <div className="flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--g-green)" }} />
              <input
                type="text"
                value={typeValue}
                onChange={(e) => setTypeValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && typeValue) run("typeInto", { selector: el.selector, value: typeValue }); }}
                placeholder="Type text..."
                className="flex-1 text-xs font-google-text bg-transparent focus:outline-none h-6 px-1.5 rounded"
                style={{ background: "var(--g-surface-container)", color: "var(--g-on-surface)", border: "1px solid var(--g-outline-variant)" }}
              />
              <button
                onClick={() => { if (typeValue) run("typeInto", { selector: el.selector, value: typeValue }); }}
                className="text-[10px] font-google font-medium px-2 py-1 rounded transition-colors"
                style={{ background: "var(--g-green-bg)", color: "var(--g-green)" }}
              >
                Type
              </button>
            </div>
          </div>
        )}

        <div className="px-2.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <ScrollText className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--g-outline)" }} />
            <input
              type="text"
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && keyValue) run("pressKey", { key: keyValue }); }}
              placeholder="Press key (Enter, Tab...)"
              className="flex-1 text-xs font-google-text bg-transparent focus:outline-none h-6 px-1.5 rounded"
              style={{ background: "var(--g-surface-container)", color: "var(--g-on-surface)", border: "1px solid var(--g-outline-variant)" }}
            />
            <button
              onClick={() => { if (keyValue) run("pressKey", { key: keyValue }); }}
              className="text-[10px] font-google font-medium px-2 py-1 rounded transition-colors"
              style={{ background: "var(--g-surface-container-high)", color: "var(--g-on-surface-variant)" }}
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {result.status !== "idle" && (
        <div
          className="px-3 py-2 text-[10px] font-google-text"
          style={{
            borderTop: "1px solid var(--g-outline-variant)",
            background: result.status === "error" ? "var(--g-red-bg)" : result.status === "success" ? "var(--g-green-bg)" : "var(--g-blue-bg)",
            color: result.status === "error" ? "var(--g-red)" : result.status === "success" ? "var(--g-green)" : "var(--g-blue)",
          }}
        >
          {result.status === "running" ? "Running..." : result.message}
        </div>
      )}
    </div>
  );
}

function ElementRow({ el }: { el: DomElement }) {
  const [expanded, setExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const colors = ROLE_COLORS[el.role] || ROLE_COLORS.default;
  const Icon = ROLE_ICONS[el.role] || Box;
  const attrEntries = Object.entries(el.attributes);

  return (
    <div className="group relative">
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 py-2 px-2 -mx-2 rounded-g-sm cursor-pointer transition-colors hover:bg-g-surface-dim"
      >
        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: colors.bg }}>
          <Icon className="w-3 h-3" style={{ color: colors.color }} />
        </div>
        <span className="text-xs font-google font-medium shrink-0" style={{ color: colors.color }}>
          {el.role.toUpperCase() || el.tag}
        </span>
        <span className="text-xs font-google-text truncate flex-1" style={{ color: "var(--g-on-surface)" }}>
          {el.name || "(unnamed)"}
        </span>
        <CopyButton text={el.selector} label="Copy selector" />
        <div className="relative shrink-0">
          <Tooltip text="Actions" position="top">
            <button
              onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
              className="p-1 rounded transition-colors"
              style={{ color: showActions ? "var(--g-blue)" : "var(--g-outline)", background: showActions ? "var(--g-blue-bg)" : "transparent" }}
            >
              <MoreHorizontal className="w-3 h-3" />
            </button>
          </Tooltip>
          {showActions && (
            <ActionPopover el={el} onClose={() => setShowActions(false)} />
          )}
        </div>
        {attrEntries.length > 0 && (
          expanded
            ? <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--g-outline)" }} />
            : <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--g-outline)" }} />
        )}
      </div>

      {expanded && (
        <div className="ml-7 pb-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-google font-medium" style={{ color: "var(--g-outline)" }}>SELECTOR</span>
            <code
              className="text-[11px] font-mono px-1.5 py-0.5 rounded flex-1 truncate"
              style={{ background: "var(--g-surface-dim)", color: "var(--g-blue)", border: "1px solid var(--g-outline-variant)" }}
            >
              {el.selector}
            </code>
            <CopyButton text={el.selector} label="Copy selector" />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-google font-medium" style={{ color: "var(--g-outline)" }}>POS</span>
            <span className="text-[10px] font-google-text" style={{ color: "var(--g-on-surface-variant)" }}>
              {el.rect.x}, {el.rect.y} — {el.rect.w}x{el.rect.h}
            </span>
          </div>

          {attrEntries.map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="text-[10px] font-google font-medium shrink-0" style={{ color: "var(--g-outline)" }}>{k}</span>
              <code
                className="text-[10px] font-mono px-1.5 py-0.5 rounded truncate flex-1"
                style={{ background: "var(--g-surface-dim)", color: "var(--g-on-surface-variant)", border: "1px solid var(--g-outline-variant)" }}
              >
                {v}
              </code>
              <CopyButton text={v} label={`Copy ${k}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const DomInspector = ({ onBack }: DomInspectorProps) => {
  const [elements, setElements] = useState<DomElement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [copiedAll, setCopiedAll] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const els = await scanPage();
    setElements(els);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = filter
    ? elements.filter(el =>
        el.name.toLowerCase().includes(filter.toLowerCase()) ||
        el.role.toLowerCase().includes(filter.toLowerCase()) ||
        el.tag.toLowerCase().includes(filter.toLowerCase()) ||
        el.selector.toLowerCase().includes(filter.toLowerCase())
      )
    : elements;

  const handleCopyAll = () => {
    const text = filtered.map(el => `[${el.role.toUpperCase()}] "${el.name}" → ${el.selector}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="w-full h-full flex flex-col" style={{ background: "var(--g-surface)", color: "var(--g-on-surface)" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--g-outline-variant)" }}>
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-g-surface-container transition-colors">
          <ArrowLeft className="w-5 h-5" style={{ color: "var(--g-on-surface)" }} />
        </button>
        <span className="font-google text-base font-medium flex-1">DOM Inspector</span>
        <Tooltip text={copiedAll ? "Copied!" : "Copy all"} position="top">
          <button
            onClick={handleCopyAll}
            className="p-2 rounded-full hover:bg-g-surface-container transition-colors"
            style={{ color: copiedAll ? "var(--g-green)" : "var(--g-outline)" }}
          >
            {copiedAll ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </Tooltip>
        <Tooltip text="Refresh" position="top">
          <button
            onClick={refresh}
            className="p-2 rounded-full hover:bg-g-surface-container transition-colors"
            style={{ color: "var(--g-outline)" }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </Tooltip>
      </div>

      {copiedAll && (
        <div className="px-4 py-2 text-xs font-google font-medium" style={{ background: "var(--g-green-bg)", color: "var(--g-green)" }}>
          Copied {filtered.length} elements to clipboard
        </div>
      )}

      <div className="px-4 py-2" style={{ borderBottom: "1px solid var(--g-outline-variant)" }}>
        <div className="flex items-center gap-2 px-3 h-8 rounded-g-full" style={{ background: "var(--g-surface-container)", border: "1px solid var(--g-outline-variant)" }}>
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--g-outline)" }} />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter elements..."
            className="flex-1 text-xs font-google-text bg-transparent focus:outline-none"
            style={{ color: "var(--g-on-surface)" }}
          />
          {filter && (
            <span className="text-[10px] font-google shrink-0" style={{ color: "var(--g-outline)" }}>
              {filtered.length}/{elements.length}
            </span>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-0.5">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin" style={{ color: "var(--g-blue)" }} />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <p className="text-sm font-google-text text-center mt-8" style={{ color: "var(--g-outline)" }}>
            {filter ? "No matching elements" : "No interactive elements found on this page"}
          </p>
        )}
        {!loading && filtered.map((el, i) => (
          <ElementRow key={`${el.selector}-${i}`} el={el} />
        ))}
      </div>

      <div className="px-4 py-2 text-[10px] font-google-text" style={{ borderTop: "1px solid var(--g-outline-variant)", color: "var(--g-outline)" }}>
        {elements.length} interactive elements
      </div>
    </div>
  );
};
