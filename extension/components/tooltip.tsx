import React, { useState, useRef, useCallback, type ReactNode } from "react";

interface TooltipProps {
  text: string;
  children: ReactNode;
  position?: "top" | "bottom";
  delay?: number;
}

export const Tooltip = ({ text, children, position = "bottom", delay = 500 }: TooltipProps) => {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  const isTop = position === "top";

  return (
    <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide} onMouseDown={hide}>
      {children}
      {visible && (
        <div
          className="absolute left-1/2 whitespace-nowrap pointer-events-none z-50"
          style={{
            [isTop ? "bottom" : "top"]: "calc(100% + 4px)",
            transform: "translateX(-50%)",
            padding: "4px 10px",
            borderRadius: "var(--g-radius-sm)",
            background: "var(--g-surface-container-high)",
            color: "var(--g-on-surface-variant)",
            border: "1px solid var(--g-outline-variant)",
            boxShadow: "var(--g-shadow-1)",
            fontFamily: "var(--g-font-text)",
            fontSize: "11px",
            fontWeight: 500,
            letterSpacing: "0.01em",
            opacity: 1,
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
};
