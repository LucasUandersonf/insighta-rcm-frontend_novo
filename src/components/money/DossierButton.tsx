import { useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";

/**
 * Baixa o dossiê de negociação do convênio (últimos 12 meses, em PDF):
 * faturado, glosa e motivos, prazo, pago abaixo do contrato, tabela antiga
 * depois de reajuste e quanto vale cada 1% de reajuste.
 */
function fileSlug(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "convenio"
  );
}

export function DossierButton({ planId, planName }: { planId: string; planName: string }) {
  const { showError } = useToast();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const blob = await apiClient.getBlob(`/api/v1/financeiro/dossie/${planId}/pdf`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dossie_${fileSlug(planName)}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="xs"
      variant="secondary"
      className="flex items-center gap-1"
      disabled={busy}
      onClick={() => void download()}
      aria-label={`Dossiê de negociação de ${planName} (PDF)`}
    >
      <FileDown size={12} aria-hidden />
      {busy ? "Gerando…" : "Dossiê"}
    </Button>
  );
}
