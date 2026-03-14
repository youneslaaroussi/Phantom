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
    <div className="w-full h-full flex flex-col" style={{ background: "var(--g-surface)", color: "var(--g-on-surface)" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--g-outline-variant)" }}>
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-g-surface-container transition-colors">
          <ArrowLeft className="w-5 h-5" style={{ color: "var(--g-on-surface)" }} />
        </button>
        <span className="font-google text-base font-medium">Settings</span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="max-w-md mx-auto space-y-6">

          <div className="space-y-3">
            <div className="text-xs font-google font-medium uppercase tracking-wider" style={{ color: "var(--g-blue)" }}>Personality</div>
            <div className="grid grid-cols-4 gap-2">
              {PERSONAS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setPersonaId(p.id); disconnect(); }}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-g-md transition-all border"
                  style={{
                    background: persona.id === p.id ? "var(--g-blue-bg)" : "var(--g-surface-dim)",
                    borderColor: persona.id === p.id ? "var(--g-blue-light)" : "transparent",
                  }}
                >
                  <img
                    src={chrome.runtime.getURL("assets/" + p.image)}
                    alt={p.name}
                    className="w-9 h-9 rounded-full"
                    style={{
                      imageRendering: "pixelated",
                      background: persona.id === p.id ? "var(--g-blue-light)" : "var(--g-surface-container)",
                      boxShadow: persona.id === p.id ? "0 0 0 2px var(--g-blue)" : "none",
                    }}
                  />
                  <span className="text-[10px] font-google font-medium truncate w-full text-center" style={{ color: persona.id === p.id ? "var(--g-blue)" : "var(--g-on-surface-variant)" }}>
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
            <div className="rounded-g-md p-3 flex items-center gap-3" style={{ background: "var(--g-surface-dim)", border: "1px solid var(--g-outline-variant)" }}>
              <img src={chrome.runtime.getURL("assets/" + persona.image)} alt="" className="w-6 h-6 rounded-full" style={{ imageRendering: "pixelated", background: "var(--g-blue-bg)" }} />
              <span className="text-sm font-google font-medium flex-1">{persona.name}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-g-full font-google" style={{ background: "var(--g-blue-bg)", color: "var(--g-blue)" }}>{persona.voice}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-google font-medium uppercase tracking-wider" style={{ color: "var(--g-blue)" }}>Microphone</div>
            <MicSelector />
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
