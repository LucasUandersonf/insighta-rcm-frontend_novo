import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { clearAllUnsaved, useUnsavedLabels } from "@/lib/unsavedChanges";

function joinLabels(labels: string[]): string {
  const unique = [...new Set(labels)];
  if (unique.length <= 1) return unique[0] ?? "as alterações";
  return `${unique.slice(0, -1).join(", ")} e ${unique[unique.length - 1]}`;
}

/** Guarda único de "alterações não salvas" (ver src/lib/unsavedChanges.ts). */
export function UnsavedChangesGuard() {
  const labels = useUnsavedLabels();
  const navigate = useNavigate();
  const location = useLocation();
  const [pending, setPending] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  dirtyRef.current = labels.length > 0;

  // Mudou de tela por outro caminho (salvou e redirecionou, por exemplo): o
  // aviso não acompanha para a próxima.
  useEffect(() => {
    clearAllUnsaved();
  }, [location.pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const next = url.pathname + url.search + url.hash;
      if (url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(next);
    }
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  const what = joinLabels(labels);
  return (
    <ConfirmDialog
      isOpen={pending !== null}
      title="Sair sem salvar?"
      message={`Você alterou ${what} e não salvou. Se sair agora, a alteração se perde.`}
      confirmLabel="Sair sem salvar"
      cancelLabel="Continuar editando"
      onCancel={() => setPending(null)}
      onConfirm={() => {
        const target = pending;
        setPending(null);
        clearAllUnsaved();
        if (target) navigate(target);
      }}
    />
  );
}
