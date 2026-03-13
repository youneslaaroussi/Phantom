import React, { useState, useEffect, useCallback } from "react";
import { Mic, ChevronRight, ChevronLeft, Brain, CheckCircle, Loader2, Shield } from "lucide-react";
import { useSession } from "../lib/session";
import { MicSelector } from "./mic-selector";
import { playWake, playConnect, playSuccess } from "../lib/sounds";
import { PERSONAS, savePersonaId, type Persona } from "../lib/personas";
import { loadEmbeddingModel, isModelReady, type ProgressCallback } from "../lib/memory";

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

  useEffect(() => { playWake(); }, []);

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
    <div className="flex gap-2 mt-4">
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
    return (
      <div className="w-full h-full flex flex-col items-center justify-center px-6" style={{ background: "#0a0a12", color: "#e2e8f0" }}>
        <div className="max-w-sm w-full flex flex-col items-center text-center space-y-5">
          <div className="space-y-2">
            <h1 className="text-lg font-bold tracking-tight">Pick my personality</h1>
            <p className="text-xs" style={{ color: "#64748b" }}>Each one talks and behaves differently. You can change this later.</p>
          </div>

          <div className="grid grid-cols-4 gap-3 w-full">
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                onClick={() => handlePersonaPick(p)}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all border"
                style={{
                  background: selectedPersona.id === p.id ? "rgba(99,102,241,0.15)" : "rgba(30,27,75,0.2)",
                  borderColor: selectedPersona.id === p.id ? "rgba(103,232,249,0.5)" : "rgba(99,102,241,0.1)",
                }}
              >
                <img
                  src={chrome.runtime.getURL("assets/" + p.image)}
                  alt={p.name}
                  className="w-10 h-10"
                  style={{ imageRendering: "pixelated", filter: selectedPersona.id === p.id ? "drop-shadow(0 0 8px rgba(103,232,249,0.5))" : "none" }}
                />
                <span className="text-[10px] font-medium truncate w-full">{p.name}</span>
              </button>
            ))}
          </div>

          <div className="w-full rounded-xl p-3 text-left" style={{ background: "rgba(30,27,75,0.3)", border: "1px solid rgba(99,102,241,0.15)" }}>
            <div className="flex items-center gap-2 mb-1">
              <img
                src={chrome.runtime.getURL("assets/" + selectedPersona.image)}
                alt=""
                className="w-6 h-6"
                style={{ imageRendering: "pixelated" }}
              />
              <span className="text-sm font-semibold">{selectedPersona.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(99,102,241,0.2)", color: "#a5b4fc" }}>{selectedPersona.voice}</span>
            </div>
            <p className="text-[11px]" style={{ color: "#64748b" }}>{selectedPersona.tagline}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("meet")}
              className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-xs transition-all"
              style={{ color: "#64748b" }}
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
            <button
              onClick={() => setStep("permissions")}
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
  }

  if (step === "permissions") {
    const handleRequestMic = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        setMicGranted(true);
      } catch {
        setMicGranted(false);
      }
    };

    const handleDownloadModel = async () => {
      if (embeddingReady || embeddingLoading) return;
      setEmbeddingLoading(true);
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
      } finally {
        setEmbeddingLoading(false);
      }
    };

    // Auto-start model download when entering this step
    useEffect(() => {
      if (step === "permissions" && !embeddingReady && !embeddingLoading) {
        handleDownloadModel();
      }
    }, [step]);

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
            <div className="w-full rounded-xl p-3 flex items-center justify-between" style={{ background: "rgba(30,27,75,0.3)", border: "1px solid rgba(99,102,241,0.15)" }}>
              <div className="flex items-center gap-3">
                <Mic className="w-4 h-4" style={{ color: micGranted ? "#4ade80" : "#64748b" }} />
                <div className="text-left">
                  <div className="text-xs font-medium">Microphone</div>
                  <div className="text-[10px]" style={{ color: "#64748b" }}>For voice conversations</div>
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
