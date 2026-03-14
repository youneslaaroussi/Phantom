import React, { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Mic, Brain, CheckCircle, Loader2, Volume2 } from "lucide-react";
import { useSession } from "../lib/session";
import { MicSelector } from "./mic-selector";
import { PERSONAS, type Persona } from "../lib/personas";
import { playPersona, playSuccess } from "../lib/sounds";
import { loadEmbeddingModel, isModelReady, type ProgressCallback } from "../lib/memory";

const PERSONA_COLORS: Record<string, { accent: string; bg: string }> = {
  default:   { accent: "#4285F4", bg: "#e8f0fe" },
  detective: { accent: "#e37400", bg: "#fef7e0" },
  royal:     { accent: "#9334E9", bg: "#f3e8ff" },
  nerd:      { accent: "#4285F4", bg: "#e8f0fe" },
  pirate:    { accent: "#EA4335", bg: "#fce8e6" },
  chill:     { accent: "#34A853", bg: "#e6f4ea" },
  wizard:    { accent: "#9334E9", bg: "#f3e8ff" },
  chaos:     { accent: "#EA4335", bg: "#fce8e6" },
};

function getColor(id: string) {
  return PERSONA_COLORS[id] || PERSONA_COLORS.default;
}

interface SettingsScreenProps {
  onBack: () => void;
}

export const SettingsScreen = ({ onBack }: SettingsScreenProps) => {
  const { persona, setPersonaId, disconnect } = useSession();
  const [version, setVersion] = useState("");
  const [selected, setSelected] = useState<Persona>(persona);
  const [micGranted, setMicGranted] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [embeddingReady, setEmbeddingReady] = useState(false);
  const [embeddingLoading, setEmbeddingLoading] = useState(false);
  const [embeddingProgress, setEmbeddingProgress] = useState(0);
  const soundAllowed = true;
  const idx = PERSONAS.findIndex((p) => p.id === selected.id);
  const color = getColor(selected.id);
  const [dragOffset, setDragOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartX = useRef(0);
  const touchDelta = useRef(0);

  useEffect(() => {
    setVersion(chrome.runtime.getManifest().version);
    (async () => {
      try {
        const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
        if (status.state === "granted") setMicGranted(true);
        status.onchange = () => { if (status.state === "granted") setMicGranted(true); };
      } catch {}

      if (isModelReady()) {
        setEmbeddingReady(true);
        setEmbeddingProgress(100);
      } else {
        setEmbeddingLoading(true);
        try {
          await loadEmbeddingModel((p: { status: string; progress?: number }) => {
            if (p.status === "progress" && p.progress) setEmbeddingProgress(Math.round(p.progress));
          });
          setEmbeddingReady(true);
          setEmbeddingProgress(100);
        } catch {
          setEmbeddingLoading(false);
        }
      }
    })();
  }, []);

  const handleRequestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicGranted(true);
      setMicDenied(false);
    } catch {
      setMicDenied(true);
      setMicGranted(false);
    }
  };

  const handleDownloadModel = async () => {
    if (embeddingReady || embeddingLoading) return;
    setEmbeddingLoading(true);
    try {
      await loadEmbeddingModel((p: { status: string; progress?: number }) => {
        if (p.status === "progress" && p.progress) setEmbeddingProgress(Math.round(p.progress));
      });
      setEmbeddingReady(true);
      setEmbeddingProgress(100);
      playSuccess();
    } catch (err) {
      console.error("Embedding model download failed:", err);
    } finally {
      setEmbeddingLoading(false);
    }
  };

  const goTo = useCallback((i: number) => {
    const clamped = Math.max(0, Math.min(PERSONAS.length - 1, i));
    if (clamped !== idx) {
      setIsAnimating(true);
      const p = PERSONAS[clamped];
      setSelected(p);
      setPersonaId(p.id);
      disconnect();
      playPersona(p.id);
      setTimeout(() => setIsAnimating(false), 300);
    }
  }, [idx, setPersonaId, disconnect]);

  const goPrev = useCallback(() => goTo(idx - 1), [goTo, idx]);
  const goNext = useCallback(() => goTo(idx + 1), [goTo, idx]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goPrev, goNext]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDelta.current = 0;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchDelta.current = e.touches[0].clientX - touchStartX.current;
    setDragOffset(touchDelta.current * 0.3);
  };
  const handleTouchEnd = () => {
    if (touchDelta.current > 50) goPrev();
    else if (touchDelta.current < -50) goNext();
    setDragOffset(0);
    touchDelta.current = 0;
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (isAnimating) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      if (e.deltaX > 30) goNext();
      else if (e.deltaX < -30) goPrev();
    }
  }, [isAnimating, goNext, goPrev]);

  return (
    <div className="w-full h-full flex flex-col" style={{ background: "var(--g-surface)", color: "var(--g-on-surface)" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--g-outline-variant)" }}>
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-g-surface-container transition-colors">
          <ArrowLeft className="w-5 h-5" style={{ color: "var(--g-on-surface)" }} />
        </button>
        <span className="font-google text-base font-medium">Settings</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div
          className="select-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          <div className="relative flex flex-col items-center pt-6 pb-4 px-6">
            {idx > 0 && (
              <button
                onClick={goPrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-g-surface-container"
                style={{ background: "var(--g-surface-dim)", border: "1px solid var(--g-outline-variant)" }}
              >
                <ChevronLeft className="w-4 h-4" style={{ color: "var(--g-on-surface-variant)" }} />
              </button>
            )}
            {idx < PERSONAS.length - 1 && (
              <button
                onClick={goNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-g-surface-container"
                style={{ background: "var(--g-surface-dim)", border: "1px solid var(--g-outline-variant)" }}
              >
                <ChevronRight className="w-4 h-4" style={{ color: "var(--g-on-surface-variant)" }} />
              </button>
            )}

            <div
              className="flex flex-col items-center transition-all duration-300 ease-out"
              style={{ transform: `translateX(${dragOffset}px)` }}
            >
              <div className="relative mb-4">
                <div
                  className="absolute inset-0 rounded-full blur-3xl opacity-20 transition-all duration-500"
                  style={{ background: color.accent, transform: "scale(2)" }}
                />
                <img
                  src={chrome.runtime.getURL("assets/" + selected.image)}
                  alt={selected.name}
                  className="relative transition-all duration-300"
                  style={{
                    width: 120,
                    height: 120,
                    imageRendering: "pixelated",
                    filter: `drop-shadow(0 6px 24px ${color.accent}40)`,
                    animation: "float 4s ease-in-out infinite",
                  }}
                />
              </div>

              <div className="text-center space-y-1.5">
                <h2 className="text-lg font-google font-bold tracking-tight transition-colors duration-300" style={{ color: color.accent }}>{selected.name}</h2>
                <p className="text-xs font-google-text" style={{ color: "var(--g-on-surface-variant)" }}>{selected.tagline}</p>
                <span
                  className="inline-block text-[10px] px-2.5 py-0.5 rounded-g-full font-google font-medium"
                  style={{ background: color.bg, color: color.accent }}
                >
                  Voice: {selected.voice}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 mt-4">
              {PERSONAS.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => goTo(i)}
                  className="relative transition-all duration-300"
                  style={{ width: i === idx ? 20 : 6, height: 6 }}
                >
                  <div
                    className="absolute inset-0 rounded-full transition-all duration-300"
                    style={{ background: i === idx ? color.accent : "var(--g-outline-variant)" }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 space-y-6">
          <div className="space-y-3">
            <div className="text-xs font-google font-medium uppercase tracking-wider" style={{ color: "var(--g-blue)" }}>Microphone</div>
            <MicSelector />
          </div>

          <div className="space-y-3">
            <div className="text-xs font-google font-medium uppercase tracking-wider" style={{ color: "var(--g-blue)" }}>Permissions</div>
            <div className="rounded-g-md overflow-hidden" style={{ background: "var(--g-surface-dim)", border: "1px solid var(--g-outline-variant)" }}>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: micGranted ? "var(--g-green-bg)" : micDenied ? "var(--g-red-bg)" : "var(--g-surface-container)" }}>
                    <Mic className="w-3.5 h-3.5" style={{ color: micGranted ? "var(--g-green)" : micDenied ? "var(--g-red)" : "var(--g-outline)" }} />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-google font-medium">Microphone</div>
                    <div className="text-[11px] font-google-text" style={{ color: "var(--g-on-surface-variant)" }}>
                      {micGranted ? "Access granted" : micDenied ? "Access denied" : "For voice conversations"}
                    </div>
                  </div>
                </div>
                {micGranted ? (
                  <CheckCircle className="w-4.5 h-4.5" style={{ color: "var(--g-green)" }} />
                ) : (
                  <button
                    onClick={handleRequestMic}
                    className="px-3 py-1 rounded-g-full text-[11px] font-google font-medium text-white"
                    style={{ background: "var(--g-blue)" }}
                  >
                    Allow
                  </button>
                )}
              </div>
              <div style={{ borderTop: "1px solid var(--g-outline-variant)" }}>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: embeddingReady ? "var(--g-green-bg)" : "var(--g-surface-container)" }}>
                      <Brain className="w-3.5 h-3.5" style={{ color: embeddingReady ? "var(--g-green)" : "var(--g-outline)" }} />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-google font-medium">Memory Model</div>
                      <div className="text-[11px] font-google-text" style={{ color: "var(--g-on-surface-variant)" }}>
                        {embeddingReady ? "Ready" : embeddingLoading ? "Downloading..." : "~30MB local model"}
                      </div>
                    </div>
                  </div>
                  {embeddingReady ? (
                    <CheckCircle className="w-4.5 h-4.5" style={{ color: "var(--g-green)" }} />
                  ) : embeddingLoading ? (
                    <Loader2 className="w-4.5 h-4.5 animate-spin" style={{ color: "var(--g-blue)" }} />
                  ) : (
                    <button
                      onClick={handleDownloadModel}
                      className="px-3 py-1 rounded-g-full text-[11px] font-google font-medium text-white"
                      style={{ background: "var(--g-blue)" }}
                    >
                      Download
                    </button>
                  )}
                </div>
                {embeddingLoading && !embeddingReady && (
                  <div className="px-4 pb-3">
                    <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ background: "var(--g-surface-container-high)" }}>
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${embeddingProgress}%`, background: "var(--g-blue)" }} />
                    </div>
                  </div>
                )}
              </div>
              <div style={{ borderTop: "1px solid var(--g-outline-variant)" }}>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: soundAllowed ? "var(--g-green-bg)" : "var(--g-surface-container)" }}>
                      <Volume2 className="w-3.5 h-3.5" style={{ color: soundAllowed ? "var(--g-green)" : "var(--g-outline)" }} />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-google font-medium">Sound</div>
                      <div className="text-[11px] font-google-text" style={{ color: "var(--g-on-surface-variant)" }}>
                        {soundAllowed ? "Enabled" : "Blocked — enable in browser settings"}
                      </div>
                    </div>
                  </div>
                  {soundAllowed ? (
                    <CheckCircle className="w-4.5 h-4.5" style={{ color: "var(--g-green)" }} />
                  ) : (
                    <button
                      onClick={() => chrome.tabs.create({ url: `chrome://settings/content/siteDetails?site=chrome-extension://${chrome.runtime.id}` })}
                      className="px-3 py-1 rounded-g-full text-[11px] font-google font-medium text-white"
                      style={{ background: "var(--g-blue)" }}
                    >
                      Fix
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-google font-medium uppercase tracking-wider" style={{ color: "var(--g-blue)" }}>Links</div>
            <div className="rounded-g-md overflow-hidden" style={{ background: "var(--g-surface-dim)", border: "1px solid var(--g-outline-variant)" }}>
              {[
                { label: "Permissions", url: "" },
                { label: "Devpost Challenge", url: "https://geminiliveagentchallenge.devpost.com/" },
                { label: "GitHub", url: "https://github.com/youneslaaroussi/Phantom" },
                { label: "Website", url: "https://phantom-server-pio3n3nsna-uc.a.run.app/" },
                { label: "Privacy Policy", url: "https://phantom-server-pio3n3nsna-uc.a.run.app/privacy" },
                { label: "Terms of Service", url: "https://phantom-server-pio3n3nsna-uc.a.run.app/terms" },
              ].map((link, i) => (
                <a
                  key={link.label}
                  href={link.url || "#"}
                  onClick={(e) => {
                    if (!link.url) {
                      e.preventDefault();
                      chrome.tabs.create({ url: `chrome://settings/content/siteDetails?site=chrome-extension://${chrome.runtime.id}` });
                    }
                  }}
                  target={link.url ? "_blank" : undefined}
                  rel={link.url ? "noopener noreferrer" : undefined}
                  className="flex items-center justify-between px-4 py-3 text-sm font-google-text transition-colors hover:bg-g-surface-container"
                  style={{
                    color: "var(--g-on-surface)",
                    borderTop: i > 0 ? "1px solid var(--g-outline-variant)" : "none",
                  }}
                >
                  {link.label}
                  <ExternalLink className="w-3.5 h-3.5" style={{ color: "var(--g-outline)" }} />
                </a>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-google font-medium uppercase tracking-wider" style={{ color: "var(--g-blue)" }}>About</div>
            <div className="rounded-g-md p-4 space-y-3" style={{ background: "var(--g-surface-dim)", border: "1px solid var(--g-outline-variant)" }}>
              <div className="flex justify-between text-sm font-google-text">
                <span style={{ color: "var(--g-on-surface-variant)" }}>Version</span>
                <span style={{ color: "var(--g-on-surface)" }}>{version}</span>
              </div>
              <div className="flex justify-between text-sm font-google-text">
                <span style={{ color: "var(--g-on-surface-variant)" }}>Model</span>
                <span style={{ color: "var(--g-on-surface)" }}>gemini-2.5-flash</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
