import React, { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useSession } from "../lib/session";
import { MicSelector } from "./mic-selector";
import { PERSONAS } from "../lib/personas";

interface SettingsScreenProps {
  onBack: () => void;
}

export const SettingsScreen = ({ onBack }: SettingsScreenProps) => {
  const { persona, setPersonaId, disconnect } = useSession();
  const [version, setVersion] = useState("");

  useEffect(() => {
    setVersion(chrome.runtime.getManifest().version);
  }, []);

  return (
    <div className="w-full h-full flex flex-col" style={{ background: "#0a0a12", color: "#e2e8f0" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid rgba(99,102,241,0.1)" }}>
        <button onClick={onBack} className="p-1 rounded hover:bg-white/5">
          <ArrowLeft className="w-4 h-4" style={{ color: "#64748b" }} />
        </button>
        <span className="font-mono text-xs tracking-widest" style={{ color: "#64748b" }}>SETTINGS</span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-md mx-auto space-y-6">

          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#475569" }}>Personality</div>
            <div className="grid grid-cols-4 gap-2">
              {PERSONAS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setPersonaId(p.id); disconnect(); }}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all border"
                  style={{
                    background: persona.id === p.id ? "rgba(99,102,241,0.15)" : "rgba(30,27,75,0.2)",
                    borderColor: persona.id === p.id ? "rgba(103,232,249,0.5)" : "rgba(99,102,241,0.1)",
                  }}
                >
                  <img
                    src={chrome.runtime.getURL("assets/" + p.image)}
                    alt={p.name}
                    className="w-8 h-8"
                    style={{ imageRendering: "pixelated", filter: persona.id === p.id ? "drop-shadow(0 0 6px rgba(103,232,249,0.5))" : "none" }}
                  />
                  <span className="text-[9px] font-medium truncate w-full text-center">{p.name}</span>
                </button>
              ))}
            </div>
            <div className="rounded-lg p-2.5 flex items-center gap-2" style={{ background: "rgba(30,27,75,0.3)", border: "1px solid rgba(99,102,241,0.1)" }}>
              <img src={chrome.runtime.getURL("assets/" + persona.image)} alt="" className="w-5 h-5" style={{ imageRendering: "pixelated" }} />
              <span className="text-xs font-medium">{persona.name}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full ml-auto" style={{ background: "rgba(99,102,241,0.2)", color: "#a5b4fc" }}>{persona.voice}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#475569" }}>Microphone</div>
            <MicSelector />
          </div>

          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#475569" }}>About</div>
            <div className="rounded-lg p-4 space-y-2" style={{ background: "rgba(30,27,75,0.2)", border: "1px solid rgba(99,102,241,0.1)" }}>
              <div className="flex justify-between text-xs">
                <span style={{ color: "#64748b" }}>Version</span>
                <span className="font-mono" style={{ color: "#94a3b8" }}>{version}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: "#64748b" }}>Model</span>
                <span className="font-mono" style={{ color: "#94a3b8" }}>gemini-2.5-flash</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
