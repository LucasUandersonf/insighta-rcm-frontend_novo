import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { PhoneCall } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { SelectField, TextareaField } from "@/components/ui/FormField";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type { PatientOutreachChannel, PatientOutreachLogCreateRequest, PatientOutreachLogEntry, PatientOutreachOutcome } from "@/lib/types";

export const OUTREACH_CHANNEL_LABELS: Record<PatientOutreachChannel, string> = {
  telefone: "Telefone",
  whatsapp: "WhatsApp",
  sms: "SMS",
  email: "E-mail",
  presencial: "Presencial",
};

export const OUTREACH_OUTCOME_LABELS: Record<PatientOutreachOutcome, string> = {
  contatado: "Contatado",
  sem_resposta: "Sem resposta",
  agendou: "Agendou",
  recusou: "Recusou",
};

/**
 * Onda 4 do Plano de Ação, item 12 ("CRM de verdade: ação, não só
 * leitura") — botão + modal reaproveitado pelas listas de reativação
 * (InactivePatientsPanel, PatientRfmPanel): registra que a clínica de
 * fato tentou contatar o paciente e o resultado, fechando o ciclo que
 * antes só apontava quem contatar, sem saber quem já foi.
 */
export function RegisterOutreachButton({
  patientId,
  patientName,
  invalidateKeys,
}: {
  patientId: string;
  patientName: string;
  invalidateKeys: QueryKey[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [channel, setChannel] = useState<PatientOutreachChannel>("whatsapp");
  const [outcome, setOutcome] = useState<PatientOutreachOutcome>("contatado");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const mutation = useMutation({
    mutationFn: (payload: PatientOutreachLogCreateRequest) =>
      apiClient.post<PatientOutreachLogEntry>(`/api/v1/patients/${patientId}/outreach-log`, payload),
    onSuccess: () => {
      for (const key of invalidateKeys) queryClient.invalidateQueries({ queryKey: key });
      showSuccess("Contato registrado.");
      resetAndClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function resetAndClose() {
    setChannel("whatsapp");
    setOutcome("contatado");
    setNotes("");
    setIsOpen(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({ channel, outcome, notes: notes.trim() || null });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex shrink-0 items-center gap-1 rounded-md border border-border-hairline px-2 py-1 text-2xs text-ink-muted transition-colors hover:bg-canvas-raised hover:text-ink"
      >
        <PhoneCall size={12} strokeWidth={1.5} />
        Registrar contato
      </button>
      <Modal title={`Registrar contato — ${patientName}`} isOpen={isOpen} onClose={resetAndClose}>
        <form onSubmit={handleSubmit}>
          <SelectField label="Canal" required value={channel} onChange={(e) => setChannel(e.target.value as PatientOutreachChannel)}>
            {(Object.keys(OUTREACH_CHANNEL_LABELS) as PatientOutreachChannel[]).map((c) => (
              <option key={c} value={c}>
                {OUTREACH_CHANNEL_LABELS[c]}
              </option>
            ))}
          </SelectField>
          <SelectField label="Resultado" required value={outcome} onChange={(e) => setOutcome(e.target.value as PatientOutreachOutcome)}>
            {(Object.keys(OUTREACH_OUTCOME_LABELS) as PatientOutreachOutcome[]).map((o) => (
              <option key={o} value={o}>
                {OUTREACH_OUTCOME_LABELS[o]}
              </option>
            ))}
          </SelectField>
          <TextareaField label="Observações (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={resetAndClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Registrar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
