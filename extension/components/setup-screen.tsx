import React, { useState, useEffect } from "react";
import { Key, ArrowRight, Eye, EyeOff, ExternalLink, Globe, Mic, ChevronRight } from "lucide-react";
import { saveApiKey, isValidKeyFormat } from "../lib/api-key";
import { setConnectionMode } from "../lib/connection-mode";
import { useSession } from "../lib/session";
import { MicSelector } from "./mic-selector";
import { AnimatedMascot } from "./animated-mascot";
import { playWake, playConnect } from "../lib/sounds";

interface SetupScreenProps {
  onComplete: () => void;
}

type Step = "meet" | "connect" | "mic";

export const SetupScreen = ({ onComplete }: SetupScreenProps) => {
  const { checkApiKey } = useSession();
  const [step, setStep] = useState<Step>("meet");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    playWake();
  }, []);

  const handleHosted = async () => {
    await setConnectionMode("hosted");
    playConnect();
    setStep("mic");
  };

  const handleByok = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) { setError("Paste your API key here"); return; }
    if (!isValidKeyFormat(trimmed)) { setError("That doesn't look right — should start with AIza..."); return; }
    setError("");
    await saveApiKey(trimmed);
    await setConnectionMode("byok");
    await checkApiKey();
    playConnect();
    setStep("mic");
  };

  if (step === "meet") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center px-8" style={{ background: "#0a0a12", color: "#e2e8f0" }}>
        <div className="max-w-sm w-full flex flex-col items-center text-center space-y-6">
          <AnimatedMascot state="idle" size={96} />

          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight">Hey, I'm Phantom</h1>
            <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>
              A little spirit that lives in your browser. Tell me what to do and I'll click, scroll, type, and navigate for you.
            </p>
          </div>

          <button
            onClick={() => setStep("connect")}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all"
            style={{ background: "#67e8f9", color: "#0a0a12" }}
          >
            Let's get started
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="flex gap-2 mt-4">
            {["meet", "connect", "mic"].map((s, i) => (
              <div key={s} className="w-2 h-2 rounded-full transition-colors" style={{ background: i === 0 ? "#67e8f9" : "rgba(99,102,241,0.3)" }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (step === "connect") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center px-8" style={{ background: "#0a0a12", color: "#e2e8f0" }}>
        <div className="max-w-sm w-full space-y-6">
          <div className="text-center space-y-2">
            <AnimatedMascot state="thinking" size={64} className="mx-auto mb-2" />
            <h1 className="text-lg font-bold tracking-tight">How should I connect?</h1>
            <p className="text-xs" style={{ color: "#64748b" }}>Pick one. You can change this later in settings.</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleHosted}
              className="w-full py-4 px-5 rounded-xl text-left transition-all border"
              style={{ background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)" }}
            >
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 shrink-0" style={{ color: "#67e8f9" }} />
                <div>
                  <div className="font-medium text-sm">Use hosted</div>
                  <div className="text-xs mt-0.5" style={{ color: "#64748b" }}>No API key needed. I handle it.</div>
                </div>
              </div>
            </button>

            <div className="relative">
              <div className="w-full py-4 px-5 rounded-xl border space-y-3" style={{ background: "rgba(30,27,75,0.3)", borderColor: "rgba(99,102,241,0.15)" }}>
                <div className="flex items-center gap-3">
                  <Key className="w-5 h-5 shrink-0" style={{ color: "#a855f7" }} />
                  <div>
                    <div className="font-medium text-sm">Bring your own key</div>
                    <div className="text-xs mt-0.5" style={{ color: "#64748b" }}>Use your Gemini API key directly.</div>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => { setApiKey(e.target.value); setError(""); }}
                    placeholder="AIza..."
                    className="w-full rounded-lg px-4 py-2.5 text-xs font-mono focus:outline-none pr-10 transition-colors"
                    style={{ background: "rgba(10,10,18,0.8)", border: "1px solid rgba(99,102,241,0.15)", color: "#e2e8f0" }}
                    onKeyDown={(e) => e.key === "Enter" && handleByok()}
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "#64748b" }}
                  >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => chrome.tabs.create({ url: "https://aistudio.google.com/apikey" })}
                    className="text-[10px] flex items-center gap-1 transition-colors hover:opacity-80"
                    style={{ color: "#67e8f9" }}
                  >
                    Get a free key <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={handleByok}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{ background: "#a855f7", color: "white" }}
                  >
                    Connect
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-2">
            {["meet", "connect", "mic"].map((s, i) => (
              <div key={s} className="w-2 h-2 rounded-full transition-colors" style={{ background: i === 1 ? "#67e8f9" : "rgba(99,102,241,0.3)" }} />
            ))}
          </div>

          <p className="text-center text-[10px]" style={{ color: "#334155" }}>
            Your key stays on your device. Never shared.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-8" style={{ background: "#0a0a12", color: "#e2e8f0" }}>
      <div className="max-w-sm w-full flex flex-col items-center text-center space-y-6">
        <AnimatedMascot state="listening" size={80} />

        <div className="space-y-2">
          <h1 className="text-lg font-bold tracking-tight">One last thing</h1>
          <p className="text-xs" style={{ color: "#64748b" }}>
            Pick your microphone, then we're good to go.
          </p>
        </div>

        <div className="w-full">
          <MicSelector />
        </div>

        <button
          onClick={onComplete}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all"
          style={{ background: "#67e8f9", color: "#0a0a12" }}
        >
          <Mic className="w-4 h-4" />
          Start talking
        </button>

        <div className="flex gap-2">
          {["meet", "connect", "mic"].map((s, i) => (
            <div key={s} className="w-2 h-2 rounded-full transition-colors" style={{ background: i === 2 ? "#67e8f9" : "rgba(99,102,241,0.3)" }} />
          ))}
        </div>
      </div>
    </div>
  );
};
