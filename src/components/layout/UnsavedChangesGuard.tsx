import { useEffect, useRef } from "react";
import { useBlocker, useLocation } from "react-router-dom";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { clearAllUnsaved, useUnsavedLabels } from "@/lib/unsavedChanges";

function joinLabels(labels: string[]): string {
  const unique = [...new Set(labels)];
  if (unique.length <= 1) return unique[0] ?? "as alterações";
  return `${unique.slice(0, -1).join(", ")} e ${unique[unique.length - 1]}`;
}

/**
 * Guarda único de "alterações não salvas" (ver src/lib/unsavedChanges.ts).
 *
 * S5: `useBlocker` do roteador de dados (App.tsx) segura QUALQUER troca de
 * tela — link, navigate() e o botão Voltar/Avançar do navegador. Fechar ou
 * recarregar a aba continua no `beforeunload` (o navegador mostra o aviso
 * dele; nenhum roteador alcança esse caso).
 */
export function UnsavedChangesGuard() {
  const labels = useUnsavedLabels();
  const location = useLocation();
  const dirtyRef = useRef(false);
  dirtyRef.current = labels.length > 0;

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirtyRef.current && currentLocation.pathname !== nextLocation.pathname
  );

  // Mudou de tela por outro caminho (salvou e redirecionou, por exemplo): o
  // aviso não acompanha para a próxima.
  useEffect(() => {
    clearAllUnsaved();
  }, [location.pathname]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const what = joinLabels(labels);
  return (
    <ConfirmDialog
      isOpen={blocker.state === "blocked"}
      title="Sair sem salvar?"
      message={`Você alterou ${what} e não salvou. Se sair agora, a alteração se perde.`}
      confirmLabel="Sair sem salvar"
      cancelLabel="Continuar editando"
      onCancel={() => blocker.reset?.()}
      onConfirm={() => {
        clearAllUnsaved();
        blocker.proceed?.();
      }}
    />
  );
}
