import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  /** Frase curta explicando a consequência real — nunca só "Tem certeza?"
   * (ex: "O lançamento de custo será removido e não pode ser desfeito."). */
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** true enquanto a mutação está em voo — desabilita os dois botões e
   * troca o texto do de confirmar, pra impedir duplo clique/duplo delete. */
  isConfirming?: boolean;
}

/** Achado da Auditoria de Prontidão v1 ("ações destrutivas sem
 * confirmação"): praticamente toda exclusão do produto disparava na
 * hora do clique, sem aviso e sem desfazer — este é o único ponto de
 * confirmação do app a partir de agora, usado por toda ação destrutiva
 * (remover custo, revogar chave de API, excluir webhook, etc.).
 * Nunca usar `window.confirm` (estilo inconsistente entre navegadores,
 * quebra o focus trap dos outros modais) — sempre este componente. */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Remover",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
  isConfirming = false,
}: ConfirmDialogProps) {
  return (
    <Modal title={title} isOpen={isOpen} onClose={onCancel}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-denied-bg text-denied">
          <AlertTriangle aria-hidden size={16} />
        </span>
        <p className="text-sm leading-relaxed text-ink-muted">{message}</p>
      </div>
      <div className="mt-5 flex justify-end gap-2.5">
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={isConfirming}>
          {cancelLabel}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="!border-denied/40 !text-denied hover:!bg-denied/10"
          onClick={onConfirm}
          disabled={isConfirming}
        >
          {isConfirming ? "Removendo…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
