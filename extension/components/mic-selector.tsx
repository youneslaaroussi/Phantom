import React, { useState, useEffect } from "react";
import { Mic, ChevronDown } from "lucide-react";
import { getAudioInputDevices, type AudioDevice } from "../lib/live/audio";

const MIC_KEY = "phantom_mic_device";

export async function getSavedMicId(): Promise<string | undefined> {
  return new Promise((resolve) => {
    chrome.storage.local.get(MIC_KEY, (r) => resolve(r[MIC_KEY] || undefined));
  });
}

export async function saveMicId(deviceId: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [MIC_KEY]: deviceId }, resolve);
  });
}

interface MicSelectorProps {
  className?: string;
}

export const MicSelector = ({ className = "" }: MicSelectorProps) => {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const devs = await getAudioInputDevices();
      setDevices(devs);
      const saved = await getSavedMicId();
      if (saved && devs.some((d) => d.deviceId === saved)) {
        setSelected(saved);
      } else if (devs.length > 0) {
        setSelected(devs[0].deviceId);
      }
    })();
  }, []);

  const handleSelect = async (deviceId: string) => {
    setSelected(deviceId);
    await saveMicId(deviceId);
    setOpen(false);
  };

  if (devices.length <= 1) return null;

  const selectedLabel = devices.find((d) => d.deviceId === selected)?.label || "Default";

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-google-text rounded-g-md transition-colors"
        style={{
          background: "var(--g-surface-dim)",
          border: "1px solid var(--g-outline-variant)",
          color: "var(--g-on-surface)",
        }}
      >
        <Mic className="w-4 h-4 shrink-0" style={{ color: "var(--g-outline)" }} />
        <span className="truncate flex-1 text-left">{selectedLabel}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "var(--g-outline)" }} />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 rounded-g-md py-1 max-h-[160px] overflow-y-auto z-30"
          style={{
            background: "var(--g-surface)",
            border: "1px solid var(--g-outline-variant)",
            boxShadow: "var(--g-shadow-3)",
          }}
        >
          {devices.map((d) => (
            <button
              key={d.deviceId}
              onClick={() => handleSelect(d.deviceId)}
              className="w-full text-left px-4 py-2.5 text-sm font-google-text transition-colors truncate hover:bg-g-surface-dim"
              style={{ color: d.deviceId === selected ? "var(--g-blue)" : "var(--g-on-surface)" }}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
