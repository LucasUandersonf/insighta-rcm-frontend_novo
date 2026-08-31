import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface Toast {
  id: number;
  message: string;
  tone: "success" | "error";
}

interface ToastContextValue {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: Toast["tone"]) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message, tone }]);
      // Auto-dispensa depois de alguns segundos — usuário não precisa
      // fechar manualmente toda confirmação de sucesso.
      setTimeout(() => remove(id), tone === "error" ? 6000 : 3500);
    },
    [remove]
  );

  const showSuccess = useCallback((message: string) => push(message, "success"), [push]);
  const showError = useCallback((message: string) => push(message, "error"), [push]);

  return (
    <ToastContext.Provider value={{ showSuccess, showError }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            aria-live={t.tone === "error" ? "assertive" : "polite"}
            className={`pointer-events-auto min-w-[280px] max-w-sm rounded border px-3 py-2.5 text-sm shadow-lg ${
              t.tone === "success"
                ? "border-revenue/30 bg-canvas-surface text-revenue"
                : "border-denied/30 bg-canvas-surface text-denied"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return ctx;
}
