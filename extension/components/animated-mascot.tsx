import React, { useRef, useEffect, useState } from "react";

type MascotState = "idle" | "listening" | "talking" | "thinking" | "sleeping";

interface AnimatedMascotProps {
  state: MascotState;
  personaId?: string;
  size?: number;
  className?: string;
}

const STATE_FOLDER: Record<string, string> = {
  idle: "idle",
  listening: "listen",
  talking: "talk",
  thinking: "thinking",
  sleeping: "idle",
};

const FPS: Record<string, number> = {
  idle: 3,
  listening: 4,
  talking: 6,
  thinking: 2,
  sleeping: 1.5,
};

function getFolder(personaId: string, state: string): string {
  const stateFolder = STATE_FOLDER[state] || "idle";
  if (personaId === "default") return `frames/${stateFolder}`;
  return `frames/${personaId}_${stateFolder}`;
}

export const AnimatedMascot = ({ state, personaId = "default", size = 64, className = "" }: AnimatedMascotProps) => {
  const [frame, setFrame] = useState(1);
  const frameCountRef = useRef(4);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const folder = getFolder(personaId, state);
  const fps = FPS[state] || 3;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let count = 1;
      for (let i = 1; i <= 10; i++) {
        try {
          const url = chrome.runtime.getURL(`assets/${folder}/${i}.png`);
          const resp = await fetch(url, { method: "HEAD" });
          if (resp.ok) count = i;
          else break;
        } catch { break; }
      }
      if (!cancelled) {
        frameCountRef.current = count;
        setFrame(1);
      }
    })();
    return () => { cancelled = true; };
  }, [folder]);

  useEffect(() => {
    setFrame(1);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setFrame((f) => (f % frameCountRef.current) + 1);
    }, 1000 / fps);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [state, personaId, fps]);

  const src = chrome.runtime.getURL(`assets/${folder}/${frame}.png`);

  return (
    <img
      src={src}
      alt=""
      className={className}
      width={size}
      height={size}
      style={{
        imageRendering: "pixelated",
        filter: "drop-shadow(0 4px 16px rgba(66,133,244,0.2))",
      }}
    />
  );
};
