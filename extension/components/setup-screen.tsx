import React, { useState, useEffect, useCallback, useRef } from "react";
import { Mic, ChevronRight, ChevronLeft, Brain, CheckCircle, Loader2, Shield } from "lucide-react";
import { useSession } from "../lib/session";
import { MicSelector } from "./mic-selector";
import { playWake, playConnect, playSuccess, playPersona } from "../lib/sounds";
import { PERSONAS, savePersonaId, type Persona } from "../lib/personas";
import { loadEmbeddingModel, isModelReady, type ProgressCallback } from "../lib/memory";

const PERSONA_COLORS: Record<string, { glow: string; accent: string; bg: string }> = {
  default:   { glow: "rgba(103,232,249,0.4)", accent: "#67e8f9", bg: "rgba(103,232,249,0.06)" },
  detective: { glow: "rgba(251,191,36,0.4)",  accent: "#fbbf24", bg: "rgba(251,191,36,0.06)" },
  royal:     { glow: "rgba(168,85,247,0.4)",   accent: "#a855f7", bg: "rgba(168,85,247,0.06)" },
  nerd:      { glow: "rgba(34,211,238,0.4)",   accent: "#22d3ee", bg: "rgba(34,211,238,0.06)" },
  pirate:    { glow: "rgba(239,68,68,0.4)",    accent: "#ef4444", bg: "rgba(239,68,68,0.06)" },
  chill:     { glow: "rgba(74,222,128,0.4)",   accent: "#4ade80", bg: "rgba(74,222,128,0.06)" },
  wizard:    { glow: "rgba(139,92,246,0.4)",   accent: "#8b5cf6", bg: "rgba(139,92,246,0.06)" },
  chaos:     { glow: "rgba(244,114,182,0.4)",  accent: "#f472b6", bg: "rgba(244,114,182,0.06)" },
};

function getPersonaColor(id: string) {
  return PERSONA_COLORS[id] || PERSONA_COLORS.default;
}

const PersonaCarousel = ({
  selected,
  onSelect,
  onBack,
  onNext,
  dots,
}: {
  selected: Persona;
  onSelect: (p: Persona) => void;
  onBack: () => void;
  onNext: () => void;
  dots: React.ReactNode;
}) => {
  const idx = PERSONAS.findIndex((p) => p.id === selected.id);
  const touchStartX = useRef(0);
  const touchDelta = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const hasPlayedInitial = useRef(false);

  useEffect(() => {
    if (!hasPlayedInitial.current) {
      hasPlayedInitial.current = true;
      playPersona(selected.id);
    }
  }, []);

  const goTo = useCallback((i: number) => {
    const clamped = Math.max(0, Math.min(PERSONAS.length - 1, i));
    if (clamped !== idx) {
      setIsAnimating(true);
      onSelect(PERSONAS[clamped]);
      playPersona(PERSONAS[clamped].id);
      setTimeout(() => setIsAnimating(false), 300);
    }
  }, [idx, onSelect]);

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

  const color = getPersonaColor(selected.id);

  return (
    <div
      className="w-full h-full flex flex-col select-none overflow-hidden"
      style={{ background: "#0a0a12", color: "#e2e8f0" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      <div className="pt-6 pb-2 text-center px-6">
        <h1 className="text-lg font-bold tracking-tight">Pick my personality</h1>
        <p className="text-xs mt-1" style={{ color: "#64748b" }}>Swipe to explore. You can change this later.</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative px-6">
        {idx > 0 && (
          <button
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <ChevronLeft className="w-4 h-4" style={{ color: "#64748b" }} />
          </button>
        )}
        {idx < PERSONAS.length - 1 && (
          <button
            onClick={goNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <ChevronRight className="w-4 h-4" style={{ color: "#64748b" }} />
          </button>
        )}

        <div
          className="flex flex-col items-center transition-all duration-300 ease-out"
          style={{ transform: `translateX(${dragOffset}px)` }}
        >
          <div className="relative mb-4">
            <div
              className="absolute inset-0 rounded-full blur-3xl opacity-40 transition-all duration-500"
              style={{ background: color.accent, transform: "scale(2)" }}
            />
            <img
              src={chrome.runtime.getURL("assets/" + selected.image)}
              alt={selected.name}
              className="relative transition-all duration-300"
              style={{
                width: 200,
                height: 200,
                imageRendering: "pixelated",
                filter: `drop-shadow(0 0 40px ${color.glow})`,
                animation: "float 4s ease-in-out infinite",
              }}
            />
          </div>
          <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>

          <div className="text-center space-y-1.5 mb-4">
            <h2 className="text-xl font-bold tracking-tight transition-colors duration-300" style={{ color: color.accent }}>{selected.name}</h2>
            <p className="text-sm" style={{ color: "#94a3b8" }}>{selected.tagline}</p>
            <span className="inline-block text-[10px] px-2 py-0.5 rounded-full font-mono" style={{ background: "rgba(255,255,255,0.06)", color: "#64748b" }}>
              voice: {selected.voice}
            </span>
          </div>
        </div>
      </div>

      <div className="px-6 pb-4 space-y-4">
        <div className="flex items-center gap-1.5 justify-center">
          {PERSONAS.map((p, i) => (
            <button
              key={p.id}
              onClick={() => goTo(i)}
              className="relative transition-all duration-300"
              style={{ width: i === idx ? 24 : 8, height: 8 }}
            >
              <div
                className="absolute inset-0 rounded-full transition-all duration-300"
                style={{
                  background: i === idx ? color.accent : "rgba(99,102,241,0.25)",
                  boxShadow: i === idx ? `0 0 8px ${color.glow}` : "none",
                }}
              />
            </button>
          ))}
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-xs transition-all"
            style={{ color: "#64748b" }}
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </button>
          <button
            onClick={onNext}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition-all"
            style={{ background: "#67e8f9", color: "#0a0a12" }}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {dots}
      </div>
    </div>
  );
};

interface SetupScreenProps {
  onComplete: () => void;
}

type Step = "meet" | "persona" | "permissions" | "mic";
const STEPS: Step[] = ["meet", "persona", "permissions", "mic"];

export const SetupScreen = ({ onComplete }: SetupScreenProps) => {
  const { setPersonaId } = useSession();
  const [step, setStep] = useState<Step>("meet");
  const [selectedPersona, setSelectedPersona] = useState<Persona>(PERSONAS[0]);
  const [embeddingProgress, setEmbeddingProgress] = useState(0);
  const [embeddingReady, setEmbeddingReady] = useState(false);
  const [embeddingLoading, setEmbeddingLoading] = useState(false);
  const [micGranted, setMicGranted] = useState(false);
  const [micDenied, setMicDenied] = useState(false);

  useEffect(() => { playWake(); }, []);

  useEffect(() => {
    if (step !== "permissions") return;
    (async () => {
      try {
        const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
        if (status.state === "granted") setMicGranted(true);
        status.onchange = () => { if (status.state === "granted") setMicGranted(true); };
      } catch {}
    })();
  }, [step]);

  const downloadStarted = useRef(false);

  useEffect(() => {
    if (step !== "permissions" || embeddingReady || downloadStarted.current) return;
    downloadStarted.current = true;
    setEmbeddingLoading(true);
    (async () => {
      try {
        const onProgress: ProgressCallback = (p) => {
          if (p.status === "progress" && p.progress) {
            setEmbeddingProgress(Math.round(p.progress));
          }
        };
        await loadEmbeddingModel(onProgress);
        setEmbeddingReady(true);
        setEmbeddingProgress(100);
        playSuccess();
      } catch (err) {
        console.error("Embedding model download failed:", err);
        downloadStarted.current = false;
      } finally {
        setEmbeddingLoading(false);
      }
    })();
  }, [step, embeddingReady]);

  const handlePersonaPick = async (p: Persona) => {
    setSelectedPersona(p);
    await savePersonaId(p.id);
    await setPersonaId(p.id);
  };

  const handleComplete = () => {
    playConnect();
    onComplete();
  };

  const stepIdx = STEPS.indexOf(step);

  const dots = (
    <div className="flex gap-2 mt-4 justify-center">
      {STEPS.map((s, i) => (
        <div key={s} className="w-2 h-2 rounded-full transition-colors" style={{ background: i === stepIdx ? "#67e8f9" : "rgba(99,102,241,0.3)" }} />
      ))}
    </div>
  );

  if (step === "meet") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center px-8" style={{ background: "#0a0a12", color: "#e2e8f0" }}>
        <div className="max-w-sm w-full flex flex-col items-center text-center space-y-6">
          <img
            src={chrome.runtime.getURL("assets/mascot.png")}
            alt="Phantom"
            className="w-24 h-24"
            style={{ imageRendering: "pixelated", filter: "drop-shadow(0 0 24px rgba(103,232,249,0.4))", animation: "float 4s ease-in-out infinite" }}
          />
          <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>

          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight">Hey, I'm Phantom</h1>
            <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>
              A little spirit that lives in your browser. Tell me what to do and I'll click, scroll, type, and navigate for you.
            </p>
          </div>

          <button
            onClick={() => setStep("persona")}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all"
            style={{ background: "#67e8f9", color: "#0a0a12" }}
          >
            Let's get started
            <ChevronRight className="w-4 h-4" />
          </button>

          {dots}
        </div>
      </div>
    );
  }

  if (step === "persona") {
    return <PersonaCarousel
      selected={selectedPersona}
      onSelect={handlePersonaPick}
      onBack={() => setStep("meet")}
      onNext={() => setStep("permissions")}
      dots={dots}
    />;
  }

  if (step === "permissions") {
    const handleRequestMic = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        setMicGranted(true);
        setMicDenied(false);
      } catch (err: any) {
        console.warn("[Setup] Mic permission failed:", err);
        setMicDenied(true);
        setMicGranted(false);
      }
    };

    const openPermissionsPage = () => {
      chrome.tabs.create({ url: `chrome://settings/content/siteDetails?site=chrome-extension://${chrome.runtime.id}` });
    };

    return (
      <div className="w-full h-full flex flex-col items-center justify-center px-8" style={{ background: "#0a0a12", color: "#e2e8f0" }}>
        <div className="max-w-sm w-full flex flex-col items-center text-center space-y-6">
          <div className="p-4 rounded-full" style={{ background: "rgba(103,232,249,0.1)" }}>
            <Shield className="w-8 h-8" style={{ color: "#67e8f9" }} />
          </div>

          <div className="space-y-2">
            <h1 className="text-lg font-bold tracking-tight">Setting things up</h1>
            <p className="text-xs" style={{ color: "#64748b" }}>
              {selectedPersona.name} needs a couple of things to work properly.
            </p>
          </div>

          <div className="w-full space-y-3">
            {/* Microphone permission */}
            <div className="w-full rounded-xl p-3" style={{ background: "rgba(30,27,75,0.3)", border: "1px solid rgba(99,102,241,0.15)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mic className="w-4 h-4" style={{ color: micGranted ? "#4ade80" : micDenied ? "#f87171" : "#64748b" }} />
                  <div className="text-left">
                    <div className="text-xs font-medium">Microphone</div>
                    <div className="text-[10px]" style={{ color: "#64748b" }}>
                      {micGranted ? "Access granted" : micDenied ? "Access denied" : "For voice conversations"}
                    </div>
                  </div>
                </div>
                {micGranted ? (
                  <CheckCircle className="w-4 h-4" style={{ color: "#4ade80" }} />
                ) : (
                  <button
                    onClick={handleRequestMic}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all"
                    style={{ background: "#67e8f9", color: "#0a0a12" }}
                  >
                    Allow
                  </button>
                )}
              </div>
              {micDenied && (
                <button
                  onClick={openPermissionsPage}
                  className="w-full mt-2 px-3 py-1.5 rounded-lg text-[10px] transition-all"
                  style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}
                >
                  Open Browser Settings
                </button>
              )}
            </div>

            {/* Embedding model download */}
            <div className="w-full rounded-xl p-3" style={{ background: "rgba(30,27,75,0.3)", border: "1px solid rgba(99,102,241,0.15)" }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Brain className="w-4 h-4" style={{ color: embeddingReady ? "#4ade80" : "#64748b" }} />
                  <div className="text-left">
                    <div className="text-xs font-medium">Memory Model</div>
                    <div className="text-[10px]" style={{ color: "#64748b" }}>
                      {embeddingReady ? "Ready — memories will persist across sessions" : "Downloads ~30MB for local semantic memory"}
                    </div>
                  </div>
                </div>
                {embeddingReady ? (
                  <CheckCircle className="w-4 h-4" style={{ color: "#4ade80" }} />
                ) : embeddingLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#67e8f9" }} />
                ) : null}
              </div>
              {embeddingLoading && !embeddingReady && (
                <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ background: "rgba(99,102,241,0.2)" }}>
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${embeddingProgress}%`,
                      background: "#67e8f9",
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep("persona")}
              className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-xs transition-all"
              style={{ color: "#64748b" }}
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
            <button
              onClick={() => setStep("mic")}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-40"
              style={{ background: "#67e8f9", color: "#0a0a12" }}
            >
              {embeddingReady ? "Next" : "Skip for now"}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {dots}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-8" style={{ background: "#0a0a12", color: "#e2e8f0" }}>
      <div className="max-w-sm w-full flex flex-col items-center text-center space-y-6">
        <img
          src={chrome.runtime.getURL("assets/" + selectedPersona.image)}
          alt=""
          className="w-16 h-16"
          style={{ imageRendering: "pixelated", filter: "drop-shadow(0 0 16px rgba(103,232,249,0.3))", animation: "float 4s ease-in-out infinite" }}
        />

        <div className="space-y-2">
          <h1 className="text-lg font-bold tracking-tight">One last thing</h1>
          <p className="text-xs" style={{ color: "#64748b" }}>Pick your microphone, then we're good to go.</p>
        </div>

        <div className="w-full">
          <MicSelector />
        </div>

        <button
          onClick={handleComplete}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all"
          style={{ background: "#67e8f9", color: "#0a0a12" }}
        >
          <Mic className="w-4 h-4" />
          Start talking to {selectedPersona.name}
        </button>

        {dots}
      </div>
    </div>
  );
};
