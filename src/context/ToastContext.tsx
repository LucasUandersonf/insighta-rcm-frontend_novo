import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, X, XCircle } from "lucide-react";

/** UX3-15: ação opcional no aviso ("Ver relatório"), em vez de mandar a pessoa procurar. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: number;
  message: string;
  tone: "success" | "error";
  durationMs: number;
  action?: ToastAction;
}

interface ToastContextValue {
  showSuccess: (message: string, action?: ToastAction) => void;
  showError: (message: string, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let nextId = 1;

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const isSuccess = toast.tone === "success";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      role={toast.tone === "error" ? "alert" : "status"}
      aria-live={toast.tone === "error" ? "assertive" : "polite"}
      className="pointer-events-auto relative min-w-[280px] max-w-sm overflow-hidden rounded-lg border border-border-hairline bg-canvas-surface shadow-elevated-lg"
    >
      <div className="flex items-start gap-2.5 px-4 py-3">
        <span aria-hidden className={isSuccess ? "mt-0.5 shrink-0 text-revenue" : "mt-0.5 shrink-0 text-denied"}>
          {isSuccess ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
        </span>
        <div className="flex-1">
          <p className="text-sm leading-relaxed text-ink">{toast.message}</p>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick();
                onDismiss();
              }}
              className="mt-1.5 text-sm font-medium text-accent hover:underline"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          onClick={onDismiss}
          aria-label="Fechar notificação"
          className="mt-0.5 shrink-0 text-ink-faint transition-colors hover:text-ink"
        >
          <X size={13} />
        </button>
      </div>
      {/* Barra de progresso — comunica visualmente quanto tempo falta
          para o toast sumir sozinho, em vez do usuário só "confiar". */}
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: toast.durationMs / 1000, ease: "linear" }}
        style={{ transformOrigin: "left" }}
        className={isSuccess ? "h-0.5 bg-revenue/60" : "h-0.5 bg-denied/60"}
      />
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // UX2-32: quando a sessão cai, o diálogo "Sua sessão expirou" já explica
  // e guarda o que foi digitado; o erro 401 da mesma requisição não vira
  // também um aviso no canto.
  const suppressErrorsUntil = useRef(0);
  useEffect(() => {
    const onUnauthorized = () => {
      suppressErrorsUntil.current = Date.now() + 3000;
    };
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, []);

  const push = useCallback(
    (message: string, tone: Toast["tone"], action?: ToastAction) => {
      if (tone === "error" && Date.now() < suppressErrorsUntil.current) return;
      const id = nextId++;
      // Auto-dispensa depois de alguns segundos — usuário não precisa
      // fechar manualmente toda confirmação de sucesso.
      // Com ação, mais tempo para a pessoa ler e clicar.
      const durationMs = action ? 9000 : tone === "error" ? 6000 : 3500;
      // UX2-22: o mesmo aviso não empilha (clique duplo, duas respostas
      // iguais): se já está na tela, fica só o que já existe.
      setToasts((prev) =>
        prev.some((t) => t.message === message && t.tone === tone) ? prev : [...prev, { id, message, tone, durationMs, action }]
      );
      setTimeout(() => remove(id), durationMs);
    },
    [remove]
  );

  const showSuccess = useCallback((message: string, action?: ToastAction) => push(message, "success", action), [push]);
  const showError = useCallback((message: string, action?: ToastAction) => push(message, "error", action), [push]);

  return (
    <ToastContext.Provider value={{ showSuccess, showError }}>
      {children}
      {/* UX3-15: no alto, à direita, abaixo da barra — embaixo cobria o botão
          principal dos formulários ("Enviar arquivo"). */}
      <div className="pointer-events-none fixed right-4 top-[76px] z-50 flex flex-col gap-2 max-sm:left-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <ToastCard key={t.id} toast={t} onDismiss={() => remove(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return ctx;
}
