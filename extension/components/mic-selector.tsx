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
        className="flex items-center gap-2 w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-xs text-gray-300 hover:bg-gray-800 transition-colors"
      >
        <Mic className="w-3.5 h-3.5 text-gray-500 shrink-0" />
        <span className="truncate flex-1 text-left">{selectedLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-800 rounded-lg shadow-xl py-1 max-h-[160px] overflow-y-auto z-30">
          {devices.map((d) => (
            <button
              key={d.deviceId}
              onClick={() => handleSelect(d.deviceId)}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-800 transition-colors truncate ${
                d.deviceId === selected ? "text-blue-400" : "text-gray-300"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
