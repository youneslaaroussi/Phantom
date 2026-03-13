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
  const [frameCount, setFrameCount] = useState(4);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const folder = getFolder(personaId, state);
  const fps = FPS[state] || 3;

  useEffect(() => {
    let count = 1;
    const probe = async () => {
      for (let i = 1; i <= 20; i++) {
        try {
          const url = chrome.runtime.getURL(`assets/${folder}/${i}.png`);
          const resp = await fetch(url, { method: "HEAD" });
          if (resp.ok) count = i;
          else break;
        } catch {
          break;
        }
      }
      setFrameCount(count);
      setFrame(1);
    };
    probe();
  }, [folder]);

  useEffect(() => {
    if (frameCount < 1) return;
    setFrame(1);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setFrame((f) => (f % frameCount) + 1);
    }, 1000 / fps);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [state, personaId, frameCount, fps]);

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
        filter: "drop-shadow(0 0 12px rgba(103,232,249,0.4)) drop-shadow(0 0 24px rgba(99,102,241,0.2))",
      }}
    />
  );
};
