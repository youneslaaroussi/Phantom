import React, { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { AlertCircle, CheckCircle, Info, X } from "lucide-react";

type ToastType = "error" | "success" | "info";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
  leaving?: boolean;
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
  error:   { bg: "#fce8e6", border: "#fbc8c3", text: "#c5221f", icon: "#EA4335" },
  success: { bg: "#e6f4ea", border: "#a8dab5", text: "#137333", icon: "#34A853" },
  info:    { bg: "#e8f0fe", border: "#d2e3fc", text: "#1967d2", icon: "#4285F4" },
};

const EXIT_DURATION = 250;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const startExit = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, EXIT_DURATION);
  }, []);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev.slice(-4), { id, type, message }]);
    setTimeout(() => startExit(id), 4000);
  }, [startExit]);

  const dismiss = useCallback((id: number) => {
    startExit(id);
  }, [startExit]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position: "fixed", top: 64, left: 12, right: 12, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          const c = COLORS[t.type];
          return (
            <div
              key={t.id}
              style={{
                background: c.bg,
                border: `1px solid ${c.border}`,
                borderRadius: 28,
                padding: "10px 16px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                pointerEvents: "auto",
                animation: t.leaving
                  ? `toast-exit ${EXIT_DURATION}ms ease forwards`
                  : "toast-enter 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.06)",
                fontFamily: "'Google Sans Text', 'Google Sans', system-ui, sans-serif",
              }}
            >
              <Icon style={{ width: 16, height: 16, color: c.icon, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: c.text, flex: 1, lineHeight: 1.4 }}>{t.message}</span>
              <button onClick={() => dismiss(t.id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}>
                <X style={{ width: 14, height: 14, color: c.text, opacity: 0.6 }} />
              </button>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes toast-enter {
          from { opacity: 0; transform: translateY(-16px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes toast-exit {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(-8px) scale(0.95); }
        }
      `}</style>
    </ToastContext.Provider>
  );
};
