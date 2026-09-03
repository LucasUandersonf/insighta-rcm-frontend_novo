import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Conta quantos <Modal isOpen> estão montados neste instante — não
 * "há um modal ou não" como boolean direto, porque um modal pode abrir
 * um segundo por cima (ex: confirmação dentro de um formulário) e o
 * fundo só deve voltar a ficar nítido quando o ÚLTIMO fechar.
 *
 * Por que isso existe: o canvas de design borra e dessatura o CONTEÚDO
 * da página por trás do modal (`.shell{filter:blur(1.5px) saturate(.85)}`),
 * não só escurece com o scrim — ver ModalNovaConsulta.dc.html. O scrim
 * sozinho (fundo escuro + seu próprio backdrop-blur) já dá profundidade,
 * mas não desfoca o conteúdo real por trás dele. Como o Modal usa
 * portal para `document.body` (ver Modal.tsx — precisa estar FORA da
 * árvore do AppShell pra não ser borrado junto), o AppShell não tem
 * como "ver" se um modal está aberto olhando pros próprios filhos —
 * precisa deste contexto.
 */
const ModalStackContext = createContext<{ register: (open: boolean) => void; count: number } | undefined>(undefined);

export function ModalStackProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);

  const register = useCallback((open: boolean) => {
    setCount((current) => Math.max(0, current + (open ? 1 : -1)));
  }, []);

  const value = useMemo(() => ({ register, count }), [register, count]);

  return <ModalStackContext.Provider value={value}>{children}</ModalStackContext.Provider>;
}

/** Chamado pelo Modal.tsx — registra/desregistra este modal específico
 * na contagem global conforme `isOpen` muda. */
export function useRegisterModalOpen(isOpen: boolean): void {
  const ctx = useContext(ModalStackContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.register(isOpen);
    return () => {
      // Se desmontar enquanto aberto (ex: navegação com o modal ainda
      // visível), desregistra também — nunca deixar a contagem "presa".
      if (isOpen) ctx.register(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
}

/** Consumido pelo AppShell — true enquanto pelo menos um modal está aberto. */
export function useIsAnyModalOpen(): boolean {
  const ctx = useContext(ModalStackContext);
  return (ctx?.count ?? 0) > 0;
}
