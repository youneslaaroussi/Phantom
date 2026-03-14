import React, { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useSession } from "../lib/session";
import { MicSelector } from "./mic-selector";
import { PERSONAS, type Persona } from "../lib/personas";
import { playPersona } from "../lib/sounds";

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
  const idx = PERSONAS.findIndex((p) => p.id === selected.id);
  const color = getColor(selected.id);
  const [dragOffset, setDragOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartX = useRef(0);
  const touchDelta = useRef(0);

  useEffect(() => {
    setVersion(chrome.runtime.getManifest().version);
  }, []);

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
            <div className="text-xs font-google font-medium uppercase tracking-wider" style={{ color: "var(--g-blue)" }}>Links</div>
            <div className="rounded-g-md overflow-hidden" style={{ background: "var(--g-surface-dim)", border: "1px solid var(--g-outline-variant)" }}>
              {[
                { label: "Devpost Challenge", url: "https://geminiliveagentchallenge.devpost.com/" },
                { label: "GitHub", url: "https://github.com/youneslaaroussi/Phantom" },
                { label: "Website", url: "https://phantom-server-pio3n3nsna-uc.a.run.app/" },
                { label: "Privacy Policy", url: "https://phantom-server-pio3n3nsna-uc.a.run.app/privacy" },
                { label: "Terms of Service", url: "https://phantom-server-pio3n3nsna-uc.a.run.app/terms" },
              ].map((link, i) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
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
