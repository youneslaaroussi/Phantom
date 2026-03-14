import React, { useState, useEffect, useCallback, useRef } from "react";
import { Mic, ChevronRight, ChevronLeft, Brain, CheckCircle, Loader2, Shield, Volume2 } from "lucide-react";
import { useSession } from "../lib/session";
import { MicSelector } from "./mic-selector";
import { playWake, playConnect, playSuccess, playPersona } from "../lib/sounds";
import { PERSONAS, savePersonaId, type Persona } from "../lib/personas";
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
      style={{ background: "var(--g-surface)", color: "var(--g-on-surface)" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      <div className="pt-8 pb-2 text-center px-6">
        <h1 className="text-xl font-google font-bold tracking-tight">Pick a personality</h1>
        <p className="text-sm mt-1.5 font-google-text" style={{ color: "var(--g-on-surface-variant)" }}>Swipe to explore. You can change this later.</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative px-6">
        {idx > 0 && (
          <button
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:bg-g-surface-container"
            style={{ background: "var(--g-surface-dim)", border: "1px solid var(--g-outline-variant)" }}
          >
            <ChevronLeft className="w-4 h-4" style={{ color: "var(--g-on-surface-variant)" }} />
          </button>
        )}
        {idx < PERSONAS.length - 1 && (
          <button
            onClick={goNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:bg-g-surface-container"
            style={{ background: "var(--g-surface-dim)", border: "1px solid var(--g-outline-variant)" }}
          >
            <ChevronRight className="w-4 h-4" style={{ color: "var(--g-on-surface-variant)" }} />
          </button>
        )}

        <div
          className="flex flex-col items-center transition-all duration-300 ease-out"
          style={{ transform: `translateX(${dragOffset}px)` }}
        >
          <div className="relative mb-5">
            <div
              className="absolute inset-0 rounded-full blur-3xl opacity-20 transition-all duration-500"
              style={{ background: color.accent, transform: "scale(2)" }}
            />
            <img
              src={chrome.runtime.getURL("assets/" + selected.image)}
              alt={selected.name}
              className="relative transition-all duration-300"
              style={{
                width: 180,
                height: 180,
                imageRendering: "pixelated",
                filter: `drop-shadow(0 8px 32px ${color.accent}40)`,
                animation: "float 4s ease-in-out infinite",
              }}
            />
          </div>

          <div className="text-center space-y-2 mb-4">
            <h2 className="text-xl font-google font-bold tracking-tight transition-colors duration-300" style={{ color: color.accent }}>{selected.name}</h2>
            <p className="text-sm font-google-text" style={{ color: "var(--g-on-surface-variant)" }}>{selected.tagline}</p>
            <span
              className="inline-block text-xs px-3 py-1 rounded-g-full font-google font-medium"
              style={{ background: color.bg, color: color.accent }}
            >
              Voice: {selected.voice}
            </span>
          </div>
        </div>
      </div>

      <div className="px-6 pb-5 space-y-4">
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
                  background: i === idx ? color.accent : "var(--g-outline-variant)",
                }}
              />
            </button>
          ))}
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-5 py-2.5 rounded-g-full text-sm font-google font-medium transition-all hover:bg-g-surface-container"
            style={{ color: "var(--g-on-surface-variant)" }}
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <button
            onClick={onNext}
            className="flex items-center gap-2 px-6 py-2.5 rounded-g-full font-google font-medium text-sm transition-all text-white"
            style={{ background: "var(--g-blue)", boxShadow: "var(--g-shadow-1)" }}
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
  const soundAllowed = true;

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
        <div
          key={s}
          className="w-2 h-2 rounded-full transition-colors"
          style={{ background: i === stepIdx ? "var(--g-blue)" : "var(--g-outline-variant)" }}
        />
      ))}
    </div>
  );

  if (step === "meet") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center px-8" style={{ background: "var(--g-surface)", color: "var(--g-on-surface)" }}>
        <div className="max-w-sm w-full flex flex-col items-center text-center space-y-6">
          <img
            src={chrome.runtime.getURL("assets/mascot.png")}
            alt="Phantom"
            className="w-24 h-24"
            style={{ imageRendering: "pixelated", filter: "drop-shadow(0 8px 32px rgba(66,133,244,0.25))", animation: "float 4s ease-in-out infinite" }}
          />

          <div className="space-y-2">
            <h1 className="text-2xl font-google font-bold tracking-tight">Hey, I'm Phantom</h1>
            <p className="text-sm font-google-text leading-relaxed" style={{ color: "var(--g-on-surface-variant)" }}>
              A little spirit that lives in your browser. Tell me what to do and I'll click, scroll, type, and navigate for you.
            </p>
          </div>

          <button
            onClick={() => setStep("persona")}
            className="flex items-center gap-2 px-7 py-3 rounded-g-full font-google font-medium text-sm transition-all text-white"
            style={{ background: "var(--g-blue)", boxShadow: "var(--g-shadow-1)" }}
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
      <div className="w-full h-full flex flex-col items-center justify-center px-8" style={{ background: "var(--g-surface)", color: "var(--g-on-surface)" }}>
        <div className="max-w-sm w-full flex flex-col items-center text-center space-y-6">
          <div className="p-4 rounded-full" style={{ background: "var(--g-blue-bg)" }}>
            <Shield className="w-8 h-8" style={{ color: "var(--g-blue)" }} />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-google font-bold tracking-tight">Setting things up</h1>
            <p className="text-sm font-google-text" style={{ color: "var(--g-on-surface-variant)" }}>
              {selectedPersona.name} needs a couple of things to work properly.
            </p>
          </div>

          <div className="w-full space-y-3">
            <div className="w-full rounded-g-md p-3.5" style={{ background: "var(--g-surface-dim)", border: "1px solid var(--g-outline-variant)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: micGranted ? "var(--g-green-bg)" : micDenied ? "var(--g-red-bg)" : "var(--g-surface-container)" }}>
                    <Mic className="w-4 h-4" style={{ color: micGranted ? "var(--g-green)" : micDenied ? "var(--g-red)" : "var(--g-outline)" }} />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-google font-medium">Microphone</div>
                    <div className="text-xs font-google-text" style={{ color: "var(--g-on-surface-variant)" }}>
                      {micGranted ? "Access granted" : micDenied ? "Access denied" : "For voice conversations"}
                    </div>
                  </div>
                </div>
                {micGranted ? (
                  <CheckCircle className="w-5 h-5" style={{ color: "var(--g-green)" }} />
                ) : (
                  <button
                    onClick={handleRequestMic}
                    className="px-4 py-1.5 rounded-g-full text-xs font-google font-medium transition-all text-white"
                    style={{ background: "var(--g-blue)" }}
                  >
                    Allow
                  </button>
                )}
              </div>
              {micDenied && (
                <button
                  onClick={openPermissionsPage}
                  className="w-full mt-2.5 px-3 py-2 rounded-g-sm text-xs font-google font-medium transition-all"
                  style={{ background: "var(--g-red-bg)", color: "var(--g-red)", border: "1px solid #fbc8c3" }}
                >
                  Open Browser Settings
                </button>
              )}
            </div>

            <div className="w-full rounded-g-md p-3.5" style={{ background: "var(--g-surface-dim)", border: "1px solid var(--g-outline-variant)" }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: embeddingReady ? "var(--g-green-bg)" : "var(--g-surface-container)" }}>
                    <Brain className="w-4 h-4" style={{ color: embeddingReady ? "var(--g-green)" : "var(--g-outline)" }} />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-google font-medium">Memory Model</div>
                    <div className="text-xs font-google-text" style={{ color: "var(--g-on-surface-variant)" }}>
                      {embeddingReady ? "Ready" : "Downloads ~30MB for local memory"}
                    </div>
                  </div>
                </div>
                {embeddingReady ? (
                  <CheckCircle className="w-5 h-5" style={{ color: "var(--g-green)" }} />
                ) : embeddingLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--g-blue)" }} />
                ) : null}
              </div>
              {embeddingLoading && !embeddingReady && (
                <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ background: "var(--g-surface-container-high)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${embeddingProgress}%`, background: "var(--g-blue)" }}
                  />
                </div>
              )}
            </div>

            <div className="w-full rounded-g-md p-3.5" style={{ background: "var(--g-surface-dim)", border: "1px solid var(--g-outline-variant)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: soundAllowed ? "var(--g-green-bg)" : "var(--g-surface-container)" }}>
                    <Volume2 className="w-4 h-4" style={{ color: soundAllowed ? "var(--g-green)" : "var(--g-outline)" }} />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-google font-medium">Sound</div>
                    <div className="text-xs font-google-text" style={{ color: "var(--g-on-surface-variant)" }}>
                      {soundAllowed ? "Enabled" : "Enable sound to hear Phantom"}
                    </div>
                  </div>
                </div>
                {soundAllowed ? (
                  <CheckCircle className="w-5 h-5" style={{ color: "var(--g-green)" }} />
                ) : (
                  <button
                    onClick={() => chrome.tabs.create({ url: `chrome://settings/content/siteDetails?site=chrome-extension://${chrome.runtime.id}` })}
                    className="px-4 py-1.5 rounded-g-full text-xs font-google font-medium transition-all text-white"
                    style={{ background: "var(--g-blue)" }}
                  >
                    Fix
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep("persona")}
              className="flex items-center gap-1 px-5 py-2.5 rounded-g-full text-sm font-google font-medium transition-all hover:bg-g-surface-container"
              style={{ color: "var(--g-on-surface-variant)" }}
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={() => setStep("mic")}
              className="flex items-center gap-2 px-6 py-2.5 rounded-g-full font-google font-medium text-sm transition-all text-white"
              style={{ background: "var(--g-blue)", boxShadow: "var(--g-shadow-1)" }}
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
    <div className="w-full h-full flex flex-col items-center justify-center px-8" style={{ background: "var(--g-surface)", color: "var(--g-on-surface)" }}>
      <div className="max-w-sm w-full flex flex-col items-center text-center space-y-6">
        <img
          src={chrome.runtime.getURL("assets/" + selectedPersona.image)}
          alt=""
          className="w-16 h-16"
          style={{ imageRendering: "pixelated", filter: "drop-shadow(0 8px 24px rgba(66,133,244,0.2))", animation: "float 4s ease-in-out infinite" }}
        />

        <div className="space-y-2">
          <h1 className="text-xl font-google font-bold tracking-tight">One last thing</h1>
          <p className="text-sm font-google-text" style={{ color: "var(--g-on-surface-variant)" }}>Pick your microphone, then we're good to go.</p>
        </div>

        <div className="w-full">
          <MicSelector />
        </div>

        <button
          onClick={handleComplete}
          className="flex items-center gap-2 px-7 py-3 rounded-g-full font-google font-medium text-sm transition-all text-white"
          style={{ background: "var(--g-blue)", boxShadow: "var(--g-shadow-1)" }}
        >
          <Mic className="w-4 h-4" />
          Start talking to {selectedPersona.name}
        </button>

        {dots}
      </div>
    </div>
  );
};
