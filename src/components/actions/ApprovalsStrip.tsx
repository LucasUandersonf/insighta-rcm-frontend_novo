import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { brl } from "@/components/money/PreSubmissionIssues";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import type { ApprovalPlan, RiskySlot } from "@/lib/types";

const KEY = ["acoes"] as const;
const CAN_VIEW = ["owner", "admin", "financeiro", "auditor"];
const CAN_APPROVE_AGENDA = ["owner", "admin"];
const CAN_APPROVE_APPEALS = ["owner", "admin"];

function hour(iso: string): string {
  return iso.slice(11, 16);
}

function SlotList({ slots }: { slots: RiskySlot[] }) {
  return (
    <ul className="mt-2 space-y-1 text-xs text-ink-muted">
      {slots.map((s) => (
        <li key={s.appointment_id}>
          <span className="tabular text-ink">{hour(s.at)}</span> · {s.patient}
          {s.professional && ` · ${s.professional}`}
          {s.candidates.length > 0 && (
            <span className="text-ink-faint"> — lista de espera: {s.candidates.map((c) => c.patient).join(", ")}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Row({ text, detail, action, children }: { text: string; detail: string; action: React.ReactNode; children?: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{text}</p>
        <p className="text-xs text-ink-muted">{detail}</p>
        {children}
      </div>
      <div className="shrink-0">{action}</div>
    </li>
  );
}

/**
 * Para aprovar hoje: o que o Insighta já deixou pronto e só precisa do "sim"
 * do gestor — a confirmação das consultas de amanhã com risco alto (com quem
 * da lista de espera serve para a vaga), que vai para o Agendamento, e os
 * recursos das glosas cujo prazo acaba em 7 dias, que vão para o Faturamento
 * protocolar. Nos dois casos o Insighta delega e acompanha; quem executa é
 * a equipe.
 * Some quando não há nada para aprovar.
 */
export function ApprovalsStrip() {
  const { user } = useAuth();
  const role = user?.role ?? "";
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [showSlots, setShowSlots] = useState(false);
  const { data } = useQuery({
    queryKey: KEY,
    queryFn: () => apiClient.get<ApprovalPlan>("/api/v1/acoes"),
    enabled: CAN_VIEW.includes(role),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const confirm = useMutation({
    mutationFn: () => apiClient.post<{ demand_id: string; email_sent: boolean }>("/api/v1/acoes/confirmar-amanha"),
    onSuccess: (res) => {
      showSuccess(
        res.email_sent
          ? "Enviado ao Agendamento, com aviso por e-mail. A demanda aparece em Equipe."
          : "Enviado ao Agendamento. A demanda aparece em Equipe."
      );
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });
  const appeals = useMutation({
    mutationFn: () => apiClient.post<{ demand_id: string; email_sent: boolean }>("/api/v1/acoes/recursos"),
    onSuccess: (res) => {
      showSuccess(
        res.email_sent
          ? "Enviado ao Faturamento, com aviso por e-mail. A demanda aparece em Equipe."
          : "Enviado ao Faturamento. A demanda aparece em Equipe."
      );
      void queryClient.invalidateQueries({ queryKey: KEY });
      void queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  if (!data) return null;
  const pendingSlots = !data.confirm_demand_id && data.slots.length > 0;
  const pendingAppeals = !data.appeals_demand_id && data.appeals.length > 0;
  const withWaitlist = data.slots.filter((s) => s.candidates.length > 0).length;
  if (!pendingSlots && !pendingAppeals) return null;
  const n = data.slots.length;
  const a = data.appeals.length;

  return (
    <section aria-labelledby="para-aprovar" className="py-6">
      <h2 id="para-aprovar" className="text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">
        Para aprovar hoje
      </h2>
      <ul className="divide-y divide-border-hairline">
        {pendingSlots && (
          <Row
            text={`Confirmar ${n} ${n === 1 ? "consulta" : "consultas"} de amanhã com risco alto de falta`}
            detail={
              withWaitlist > 0
                ? `Para ${withWaitlist === 1 ? "uma delas" : `${withWaitlist} delas`} já há quem da lista de espera fique com a vaga. Vai como demanda para o Agendamento.`
                : "Vai como demanda para o Agendamento, com a lista por extenso."
            }
            action={
              <div className="flex gap-2">
                <Button size="xs" variant="secondary" onClick={() => setShowSlots((v) => !v)} aria-expanded={showSlots}>
                  {showSlots ? "Esconder" : "Ver lista"}
                </Button>
                {CAN_APPROVE_AGENDA.includes(role) && (
                  <Button size="xs" disabled={confirm.isPending} onClick={() => confirm.mutate()}>
                    {confirm.isPending ? "Enviando…" : "Aprovar e enviar"}
                  </Button>
                )}
              </div>
            }
          >
            {showSlots && <SlotList slots={data.slots} />}
          </Row>
        )}
        {pendingAppeals && (
          <Row
            text={`Protocolar ${a} ${a === 1 ? "recurso" : "recursos"} de glosa com prazo em até 7 dias`}
            detail={`${brl(data.appeals_value)} em jogo. Vai como demanda para o Faturamento, com cada conta e prazo por extenso.`}
            action={
              CAN_APPROVE_APPEALS.includes(role) ? (
                <Button size="xs" disabled={appeals.isPending} onClick={() => appeals.mutate()}>
                  {appeals.isPending ? "Enviando…" : "Enviar ao Faturamento"}
                </Button>
              ) : (
                <Link to="/recuperacao" className="text-xs text-accent underline">
                  Ver na Central
                </Link>
              )
            }
          />
        )}
      </ul>
    </section>
  );
}
