import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import { Button } from "@/components/ui/Button";
import type { SubscriptionCancelResponse, Tenant } from "@/lib/types";

/**
 * Cancelar a assinatura pelo próprio sistema (auditoria V1, rodada 4, A4 —
 * Decreto 11.034/2022: cancelar pelo mesmo canal da contratação). A
 * cobrança para na hora; o acesso continua até o fim do período pago. O
 * dono confirma digitando o nome da clínica.
 */
export function CancelSubscriptionPanel() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [reason, setReason] = useState("");

  const tenantQuery = useQuery({
    queryKey: ["tenant"],
    queryFn: () => apiClient.get<Tenant>("/api/v1/tenant"),
    enabled: open,
  });
  const tradeName = tenantQuery.data?.trade_name ?? "";
  const matches =
    tradeName.length > 0 &&
    confirmName.trim().toLowerCase() === tradeName.trim().toLowerCase();

  const cancel = useMutation({
    mutationFn: () =>
      apiClient.post<SubscriptionCancelResponse>(
        "/api/v1/subscription/cancel",
        {
          confirm_trade_name: confirmName,
          reason: reason.trim() || null,
        },
      ),
    onSuccess: (res) => {
      showSuccess(res.message);
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (matches && !cancel.isPending) cancel.mutate();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-center text-2xs text-ink-faint underline-offset-2 hover:text-denied hover:underline"
      >
        Cancelar assinatura
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Cancelar assinatura"
      className="flex flex-col gap-3 rounded-xl border border-denied/25 bg-glass p-5 text-sm shadow-elevated"
    >
      <p className="font-medium text-ink">Cancelar a assinatura</p>
      <ul className="list-disc space-y-1 pl-4 text-xs text-ink-muted">
        <li>Nenhuma cobrança nova é feita a partir de agora.</li>
        <li>O acesso continua até o fim do período já pago.</li>
        <li>
          Depois disso, você ainda pode entrar para exportar os dados por 90
          dias; então eles são anonimizados.
        </li>
      </ul>
      <label
        htmlFor="cancel-reason"
        className="text-xs font-medium text-ink-muted"
      >
        Por que está saindo? (opcional)
      </label>
      <textarea
        id="cancel-reason"
        value={reason}
        maxLength={1000}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        className="rounded-md border border-border-default bg-canvas-raised/60 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
      />
      <label
        htmlFor="cancel-confirm"
        className="text-xs font-medium text-ink-muted"
      >
        Para confirmar, digite o nome da clínica
        {tradeName ? `: ${tradeName}` : ""}
      </label>
      <input
        id="cancel-confirm"
        value={confirmName}
        onChange={(e) => setConfirmName(e.target.value)}
        autoComplete="off"
        className="rounded-md border border-border-default bg-canvas-raised/60 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          className="bg-denied hover:brightness-110"
          disabled={!matches || cancel.isPending}
        >
          {cancel.isPending ? "Cancelando..." : "Cancelar assinatura"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setOpen(false)}
        >
          Voltar
        </Button>
      </div>
    </form>
  );
}
