"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastType = "success" | "error";
type Toast = { id: number; type: ToastType; message: string };
type Notify = (message: string, type?: ToastType) => void;

const ToastContext = createContext<Notify>(() => {});
export const useToast = () => useContext(ToastContext);

// Turn raw fetch failures into something a human wants to read.
export function friendlyError(err: unknown, fallback = "Something went wrong."): string {
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return "The request timed out — check your connection and try again.";
  }
  if (err instanceof TypeError) {
    return "Can't reach the server — check your connection.";
  }
  return fallback;
}

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const popoverRef = useRef<HTMLDivElement>(null);

  const notify = useCallback<Notify>((message, type = "success") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  // Promote the container to the top layer (Popover API) so toasts render ABOVE
  // a modal <dialog> slide-over — z-index alone can't beat the top layer.
  useEffect(() => {
    const el = popoverRef.current;
    if (!el) return;
    try {
      if (toasts.length > 0) el.showPopover();
      else el.hidePopover();
    } catch {
      // already in the requested state
    }
  }, [toasts.length]);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div
        ref={popoverRef}
        popover="manual"
        role="region"
        aria-live="polite"
        aria-label="Notifications"
        className="fixed inset-auto bottom-4 right-4 left-auto top-auto m-0 flex flex-col gap-2 border-0 bg-transparent p-0"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`animate-rise rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg ${
              t.type === "error" ? "bg-rose-600" : "bg-emerald-600"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
