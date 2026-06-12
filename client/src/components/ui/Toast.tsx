import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { getActivePreset } from "./preset";

export type ToastVariant = "info" | "success" | "error" | "warning";

export interface ToastOptions {
  /** Toast body message. */
  message: ReactNode;
  /** Visual variant; defaults to `info`. */
  variant?: ToastVariant;
  /** Auto-dismiss duration in ms; defaults to 4000. Pass `null` to disable. */
  durationMs?: number | null;
}

interface ToastEntry extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 4000;

/** Generate a reasonably unique toast id without pulling in uuid. */
function makeId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface ToastItemProps {
  entry: ToastEntry;
  onDismiss: (id: string) => void;
}

function ToastItem({ entry, onDismiss }: ToastItemProps) {
  const { t } = useTranslation("primitives");
  const p = getActivePreset().toast;
  const variant = entry.variant ?? "info";
  const isError = variant === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className={[p.shell, p.variants[variant]].join(" ")}
    >
      <span className={p.message}>{entry.message}</span>
      <button
        type="button"
        className={p.dismissButton}
        onClick={() => onDismiss(entry.id)}
        aria-label={t("toast.dismiss")}
      >
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastEntry[];
  onDismiss: (id: string) => void;
}

/** Internal: renders the toast stack via portal. Mounted by `<ToastProvider>`. */
function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  const p = getActivePreset().toast;
  if (typeof document === "undefined" || toasts.length === 0) return null;
  return createPortal(
    <div className={p.container} data-testid="toast-container">
      {toasts.map((entry) => (
        <ToastItem key={entry.id} entry={entry} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
}

export interface ToastProviderProps {
  children: ReactNode;
}

/**
 * Provides the `useToast` context. Mount once near the root of the app.
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((entry) => entry.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (opts: ToastOptions) => {
      const id = makeId();
      const entry: ToastEntry = { id, ...opts };
      setToasts((prev) => [...prev, entry]);

      const duration = opts.durationMs === undefined
        ? DEFAULT_DURATION_MS
        : opts.durationMs;
      if (duration !== null && duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timersRef.current.set(id, timer);
      }
      return id;
    },
    [dismiss],
  );

  // Cleanup all timers on unmount.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ toast, dismiss }),
    [toast, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/**
 * Access the toast queue. Must be called from inside `<ToastProvider>`.
 *
 * @example
 *   const { toast } = useToast();
 *   toast({ message: "Email verified", variant: "success" });
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}
