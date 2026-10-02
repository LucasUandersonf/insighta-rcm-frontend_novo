import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { ACTIVE_STATES, processingPercent, type DirectUploadStatus } from "@/lib/directUpload";
import { useDirectUploads } from "@/lib/useDirectUploads";

function finishedMessage(upload: DirectUploadStatus): string {
  const name = upload.original_filename ?? "Arquivo";
  if (upload.already_processed) return upload.message ?? `${name}: este conteúdo já tinha sido importado. Nada foi duplicado.`;
  const rejected = upload.error_row_count ?? 0;
  const rows = upload.row_count ?? 0;
  return rejected > 0
    ? `${name} importado: ${rows} linha(s) lida(s), ${rejected} rejeitada(s). Veja o motivo no histórico de importações.`
    : `${name} importado: ${rows} linha(s).`;
}

/**
 * Acompanhamento do processamento em segundo plano, em qualquer tela: um
 * aviso discreto enquanto há importação em andamento (com a porcentagem) e
 * uma notificação quando cada uma termina. Montado uma vez no AppShell.
 */
export function ImportProgressIndicator() {
  const { data } = useDirectUploads();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const location = useLocation();
  const lastStatus = useRef<Map<string, DirectUploadStatus["status"]>>(new Map());

  useEffect(() => {
    if (!data) return;
    let finishedAny = false;
    for (const upload of data) {
      const before = lastStatus.current.get(upload.upload_id);
      const wasActive = before !== undefined && ACTIVE_STATES.includes(before);
      if (wasActive && upload.status === "processado") {
        showSuccess(finishedMessage(upload));
        finishedAny = true;
      } else if (wasActive && upload.status === "falhou") {
        showError(`${upload.original_filename ?? "Arquivo"}: ${upload.error ?? "não foi possível processar."}`);
        finishedAny = true;
      }
      lastStatus.current.set(upload.upload_id, upload.status);
    }
    if (finishedAny) {
      // Números de todas as telas mudaram com a importação.
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "ingestion" || q.queryKey[1] !== "direct-uploads" });
    }
  }, [data, showSuccess, showError, queryClient]);

  const active = (data ?? []).filter((u) => ACTIVE_STATES.includes(u.status));
  if (active.length === 0 || location.pathname === "/upload") return null;
  const first = active[0];
  const percent = processingPercent(first);
  const label =
    active.length > 1
      ? `Importando ${active.length} arquivos…`
      : `Importando ${first.original_filename ?? "arquivo"}${percent !== null ? ` — ${percent}%` : "…"}`;

  return (
    <Link
      to="/upload"
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-40 flex max-w-[calc(100vw-2.5rem)] items-center gap-2 rounded-full border border-border-hairline bg-canvas-surface px-4 py-2 text-sm text-ink shadow-elevated hover:bg-canvas-raised"
    >
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" aria-hidden />
      <span className="truncate">{label}</span>
    </Link>
  );
}
