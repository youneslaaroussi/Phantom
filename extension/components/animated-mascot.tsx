import React, { useRef, useEffect, useState } from "react";

type MascotState = "idle" | "listening" | "talking" | "thinking" | "sleeping";

interface AnimatedMascotProps {
  state: MascotState;
  size?: number;
  className?: string;
}

const SHEETS: Record<string, { src: string; cols: number; rows: number; frames: number; fps: number }> = {
  idle: { src: "idle_sheet.png", cols: 2, rows: 2, frames: 4, fps: 3 },
  listening: { src: "listen_sheet.png", cols: 2, rows: 2, frames: 4, fps: 4 },
  talking: { src: "talk_sheet.png", cols: 2, rows: 2, frames: 4, fps: 6 },
  thinking: { src: "spritesheet.png", cols: 3, rows: 2, frames: 6, fps: 2 },
  sleeping: { src: "idle_sheet.png", cols: 2, rows: 2, frames: 4, fps: 1.5 },
};

export const AnimatedMascot = ({ state, size = 64, className = "" }: AnimatedMascotProps) => {
  const [frame, setFrame] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const sheet = SHEETS[state] || SHEETS.idle;

  useEffect(() => {
    setFrame(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setFrame((f) => (f + 1) % sheet.frames);
    }, 1000 / sheet.fps);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [state, sheet.frames, sheet.fps]);

  const col = frame % sheet.cols;
  const row = Math.floor(frame / sheet.cols);
  const bgX = -(col * 100);
  const bgY = -(row * 100);

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${chrome.runtime.getURL("assets/" + sheet.src)})`,
        backgroundSize: `${sheet.cols * 100}% ${sheet.rows * 100}%`,
        backgroundPosition: `${bgX}% ${bgY}%`,
        imageRendering: "pixelated" as const,
        filter: "drop-shadow(0 0 12px rgba(103,232,249,0.4)) drop-shadow(0 0 24px rgba(99,102,241,0.2))",
      }}
    />
  );
};
