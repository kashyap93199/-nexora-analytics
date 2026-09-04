import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "../lib/utils";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (kind: ToastKind, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastKind, ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
  info: <Info className="h-4 w-4 text-primary-500" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++counter.current;
      setToasts((prev) => [...prev.slice(-4), { id, kind, message }]);
      window.setTimeout(() => remove(id), 4500);
    },
    [remove]
  );

  const value = useCallback(
    () => ({
      toast,
      success: (m: string) => toast("success", m),
      error: (m: string) => toast("error", m),
      info: (m: string) => toast("info", m),
    }),
    [toast]
  );

  return (
    <ToastContext.Provider value={value()}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-2.5 rounded-lg border bg-card px-3.5 py-3 shadow-pop",
              t.kind === "error" ? "border-red-200 dark:border-red-900/60" : "border-border"
            )}
          >
            <span className="mt-0.5">{ICONS[t.kind]}</span>
            <p className="flex-1 text-sm leading-snug text-ink">{t.message}</p>
            <button
              onClick={() => remove(t.id)}
              className="rounded p-0.5 text-muted transition hover:text-ink"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
