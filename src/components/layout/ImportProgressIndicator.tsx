import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Loader2 } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { ACTIVE_STATES, processingPercent, type DirectUploadStatus } from "@/lib/directUpload";
import { useDirectUploads } from "@/lib/useDirectUploads";
import { importOutcome, outcomeSentence } from "@/lib/importOutcome";

function finishedMessage(upload: DirectUploadStatus): string {
  const name = upload.original_filename ?? "Arquivo";
  if (upload.already_processed) return upload.message ?? `${name}: este conteúdo já tinha sido importado. Nada foi duplicado.`;
  // UX-03/UX-34: diz o que entrou (não "linhas lidas") e sem "linha(s)".
  const base = `${name}: ${outcomeSentence(upload.row_count, upload.error_row_count)}${
    (upload.error_row_count ?? 0) > 0 ? " Veja o motivo e como resolver no relatório." : ""
  }`;
  const ignored = upload.ignored_columns ?? [];
  return ignored.length > 0 ? `${base} Colunas ignoradas (fora do modelo): ${ignored.join(", ")}.` : base;
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
  const navigate = useNavigate();
  const lastStatus = useRef<Map<string, DirectUploadStatus["status"]>>(new Map());

  useEffect(() => {
    if (!data) return;
    let finishedAny = false;
    for (const upload of data) {
      const before = lastStatus.current.get(upload.upload_id);
      const wasActive = before !== undefined && ACTIVE_STATES.includes(before);
      if (wasActive && upload.status === "processado") {
        // Verde só quando entrou alguma coisa (UX-03).
        const nothing = !upload.already_processed && importOutcome(upload.row_count, upload.error_row_count) === "nada";
        const fileId = upload.ingestion_file_id;
        const report =
          (upload.error_row_count ?? 0) > 0 && fileId
            ? { label: "Ver relatório", onClick: () => navigate(`/importar?relatorio=${fileId}`) }
            : undefined;
        (nothing ? showError : showSuccess)(finishedMessage(upload), report);
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
  }, [data, showSuccess, showError, queryClient, navigate]);

  const active = (data ?? []).filter((u) => ACTIVE_STATES.includes(u.status));
  if (active.length === 0 || location.pathname === "/importar") return null;
  const first = active[0];
  const percent = processingPercent(first);
  // UX2-09: "Importando" só quando algo está sendo processado de fato; na
  // fila é "Na fila", e atraso aparece aqui também, não só em Importar dados.
  const delayed = active.some((u) => u.queue_delayed);
  const allQueued = active.every((u) => u.status === "na_fila");
  const label = delayed
    ? active.length > 1
      ? `${active.length} arquivos com processamento atrasado`
      : `${first.original_filename ?? "Arquivo"}: processamento atrasado`
    : allQueued
      ? active.length > 1
        ? `${active.length} arquivos na fila…`
        : `Na fila: ${first.original_filename ?? "arquivo"}…`
      : active.length > 1
        ? `Importando ${active.length} arquivos…`
        : `Importando ${first.original_filename ?? "arquivo"}${percent !== null ? ` — ${percent}%` : "…"}`;

  return (
    <Link
      to="/importar"
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-40 flex max-w-[calc(100vw-2.5rem)] items-center gap-2 rounded-full border border-border-hairline bg-canvas-surface px-4 py-2 text-sm text-ink shadow-elevated hover:bg-canvas-raised"
    >
      {delayed ? (
        <Clock className="h-4 w-4 shrink-0 text-pending" aria-hidden />
      ) : (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" aria-hidden />
      )}
      <span className="truncate">{label}</span>
    </Link>
  );
}
