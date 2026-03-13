import React, { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import { AlertCircle, CheckCircle, Info, X } from "lucide-react";

type ToastType = "error" | "success" | "info";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export const useToast = () => useContext(ToastContext);

const ICONS: Record<ToastType, typeof AlertCircle> = {
  error: AlertCircle,
  success: CheckCircle,
  info: Info,
};

const COLORS: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  error: { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", text: "#fca5a5", icon: "#ef4444" },
  success: { bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.3)", text: "#86efac", icon: "#4ade80" },
  info: { bg: "rgba(103,232,249,0.1)", border: "rgba(103,232,249,0.3)", text: "#a5f3fc", icon: "#67e8f9" },
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev.slice(-4), { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position: "fixed", bottom: 12, left: 12, right: 12, zIndex: 9999, display: "flex", flexDirection: "column", gap: 6, pointerEvents: "none" }}>
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          const c = COLORS[t.type];
          return (
            <div
              key={t.id}
              style={{
                background: c.bg,
                border: `1px solid ${c.border}`,
                borderRadius: 10,
                padding: "8px 12px",
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                pointerEvents: "auto",
                animation: "toast-in 0.2s ease",
              }}
            >
              <Icon style={{ width: 14, height: 14, color: c.icon, flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 11, color: c.text, flex: 1, lineHeight: 1.4 }}>{t.message}</span>
              <button onClick={() => dismiss(t.id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}>
                <X style={{ width: 12, height: 12, color: "#64748b" }} />
              </button>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes toast-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </ToastContext.Provider>
  );
};
