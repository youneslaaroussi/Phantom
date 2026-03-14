import React from "react";
import { TOOL_ILLUSTRATIONS, getToolCategory, type ToolCategory } from "./tool-illustrations";

interface ToolIndicatorProps {
  toolName: string;
}

export const ToolIndicator = ({ toolName }: ToolIndicatorProps) => {
  const category = getToolCategory(toolName);
  const illustration = TOOL_ILLUSTRATIONS[category];

  return (
    <div
      className="w-full flex flex-col items-center gap-3 px-6 py-5"
      style={{ animation: "fade-in 0.25s ease" }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: illustration.bg }}
      >
        <div
          className="text-3xl"
          style={{ animation: "float 3s ease-in-out infinite" }}
        >
          {illustration.icon}
        </div>
      </div>
      <div className="text-center space-y-0.5">
        <p className="text-sm font-google font-medium" style={{ color: illustration.color }}>
          {illustration.label}
        </p>
        <p className="text-[11px] font-google-text" style={{ color: "var(--g-outline)" }}>
          {toolName}
        </p>
      </div>
      <div className="flex gap-1.5 items-center">
        <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#4285F4", animationDelay: "0ms", animationDuration: "1s" }} />
        <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#EA4335", animationDelay: "150ms", animationDuration: "1s" }} />
        <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#FBBC05", animationDelay: "300ms", animationDuration: "1s" }} />
        <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#34A853", animationDelay: "450ms", animationDuration: "1s" }} />
      </div>
    </div>
  );
};
