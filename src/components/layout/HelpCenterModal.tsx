import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Compass, LifeBuoy } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { TextField, TextareaField } from "@/components/ui/FormField";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/Panel";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import { cn } from "@/lib/cn";
import type { SupportRequest, SupportRequestCreateRequest } from "@/lib/types";

// Perguntas frequentes — conteúdo estático de propósito nesta primeira
// versão (sem CMS de FAQ ainda): cobre as dúvidas mais prováveis sobre
// os módulos já em produção. Quando um padrão recorrente aparecer nas
// perguntas reais enviadas pelo formulário abaixo, vale promovê-lo para
// cá.
const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: "Por que um faturamento aparece com risco de glosa alto?",
    answer:
      "O sistema aplica regras determinísticas antes do envio ao convênio: CID ausente, procedimento não informado, convênio sem tabela de preço homologada, ou valor cobrado acima do contratado. O motivo específico aparece no próprio registro — não é uma estimativa, é uma regra concreta que bateu.",
  },
  {
    question: "Como funciona o cálculo de risco de falta (no-show) do paciente?",
    answer:
      "Calculado a partir do histórico real do próprio paciente — taxa geral de falta e, quando há amostra suficiente, o padrão específico do mesmo dia da semana e período. Paciente sem histórico nenhum recebe risco 'indeterminado', nunca 'baixo': ausência de dado não é a mesma coisa que baixo risco.",
  },
  {
    question: "Como habilito o relatório semanal e o alerta de risco por WhatsApp?",
    answer:
      "Em Setup > Destinatários de Relatório, cadastre o WhatsApp de quem deve receber — cada destinatário escolhe quais tipos de relatório recebe (resumo semanal, alerta de risco de falta, ou ambos). Também dá para disparar os dois sob demanda, sem esperar o próximo ciclo automático.",
  },
  {
    question: "O que acontece depois que abro um recurso de glosa?",
    answer:
      "O recurso percorre aberto → protocolado → deferido/indeferido, com prazo calculado automaticamente a partir do contrato com a operadora. É possível gerar o documento do recurso em PDF já com os dados do caso preenchidos — só falta revisar a justificativa e protocolar pelo canal da operadora.",
  },
  {
    question: "Minha planilha foi rejeitada — o que fazer?",
    answer:
      "Se o cabeçalho das colunas não bate exatamente com o esperado, a Central de Upload sugere automaticamente a correspondência certa e lembra da decisão para os próximos envios — não precisa reformatar a planilha toda vez.",
  },
  {
    question: "Como funciona a leitura automática de contrato por IA?",
    answer:
      "Você sobe o PDF do contrato com o convênio; a IA extrai uma sugestão de tabela de preços, mas nada é gravado até você revisar e confirmar na Tela de Conferência. Só depois da homologação a tabela passa a valer para o motor de glosa.",
  },
  {
    question: "Quem pode ver o Log de Auditoria e o que fica registrado?",
    answer:
      "Owner, admin e auditor. Toda criação de paciente, faturamento, homologação de contrato, mudança de papel/status de usuário e cada etapa do recurso de glosa fica registrada — quem fez, o quê, quando. O log nunca guarda uma segunda cópia do dado sensível em si (CPF, valores, senha).",
  },
  {
    question: "Um paciente pediu para remover seus dados — como faço?",
    answer:
      "Um admin ou owner pode anonimizar o cadastro do paciente (substitui nome/CPF/data de nascimento por um placeholder). O histórico de agendamento e faturamento vinculado é preservado, porque a clínica é obrigada a mantê-lo por obrigação legal — a LGPD permite isso. A ação é irreversível.",
  },
];

async function _createSupportRequest(payload: SupportRequestCreateRequest): Promise<SupportRequest> {
  return apiClient.post<SupportRequest>("/api/v1/support-requests", payload);
}

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={item.question} className="overflow-hidden rounded-md border border-border-subtle">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-xs font-medium text-ink transition-colors hover:bg-canvas-raised/60"
            >
              <span>{item.question}</span>
              <ChevronDown aria-hidden size={13} className={cn("shrink-0 text-ink-faint transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && <p className="border-t border-border-hairline px-3.5 py-2.5 text-2xs leading-relaxed text-ink-muted">{item.answer}</p>}
          </div>
        );
      })}
    </div>
  );
}

const SUPPORT_STATUS_LABELS: Record<SupportRequest["status"], string> = {
  aberto: "Aguardando resposta",
  respondido: "Respondido",
};

function AskQuestionPanel() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const { data: history, isLoading, error, refetch } = useQuery({
    queryKey: ["support-requests"],
    queryFn: () => apiClient.get<SupportRequest[]>("/api/v1/support-requests"),
  });

  const mutation = useMutation({
    mutationFn: _createSupportRequest,
    onSuccess: () => {
      showSuccess("Pergunta enviada — a equipe responde por e-mail.");
      setSubject("");
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["support-requests"] });
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({ subject, message });
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <TextField label="Assunto" required value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
        <TextareaField
          label="Sua dúvida"
          required
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Descreva o que você precisa — quanto mais contexto, mais rápida a resposta."
        />
        <div className="mt-1 flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Enviando..." : "Enviar pergunta"}
          </Button>
        </div>
      </form>

      <div className="mt-6 border-t border-border-hairline pt-4">
        <p className="mb-2 text-xs font-medium text-ink-muted">Suas perguntas anteriores</p>
        {isLoading && <LoadingState variant="table" rows={2} />}
        {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}
        {!isLoading && !error && (history ?? []).length === 0 && (
          <EmptyState icon={<LifeBuoy size={16} strokeWidth={1.5} />} message="Nenhuma pergunta enviada ainda." />
        )}
        {!isLoading && (history ?? []).length > 0 && (
          <ul className="space-y-2">
            {(history ?? []).map((r) => (
              <li key={r.id} className="rounded-md border border-border-subtle px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-ink">{r.subject}</span>
                  <Badge tone={r.status === "respondido" ? "revenue" : "pending"}>{SUPPORT_STATUS_LABELS[r.status]}</Badge>
                </div>
                <p className="mt-1 text-2xs text-ink-faint">{r.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Central de Ajuda — "tirar dúvida sem sair do sistema". Duas abas:
 * Perguntas Frequentes (estático, resposta imediata) e Enviar Pergunta
 * (formulário + histórico, para o que a FAQ não cobre). Modal de tela
 * cheia (diferente do sino, que é um dropdown leve) porque aqui tem
 * conteúdo de verdade para ler — FAQ + formulário + histórico.
 */
export function HelpCenterModal({
  isOpen,
  onClose,
  onStartTour,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Reabre o tour de boas-vindas guiado (ver OnboardingTour.tsx) — quem
   * já concluiu o tour uma vez também pode revisitá-lo por aqui, não só
   * na primeira sessão. */
  onStartTour: () => void;
}) {
  const [tab, setTab] = useState<"faq" | "ask">("faq");

  return (
    <Modal title="Central de Ajuda" isOpen={isOpen} onClose={onClose} size="2xl">
      <button
        type="button"
        onClick={onStartTour}
        className="mb-4 flex w-full items-center gap-2.5 rounded-md border border-border-subtle bg-canvas-raised/60 px-3.5 py-2.5 text-left text-xs text-ink transition-colors hover:border-accent/40"
      >
        <Compass aria-hidden size={15} className="shrink-0 text-accent" />
        <span className="flex-1">
          <span className="font-medium">Rever tour de boas-vindas</span>
          <span className="block text-2xs text-ink-faint">Um passeio guiado pelos módulos principais do sistema.</span>
        </span>
      </button>
      <Tabs
        groupId="help-center"
        active={tab}
        onChange={(id) => setTab(id as "faq" | "ask")}
        items={[
          { id: "faq", label: "Perguntas frequentes" },
          { id: "ask", label: "Enviar pergunta" },
        ]}
        className="mb-4"
      />
      <TabPanel id="faq" groupId="help-center">
        {tab === "faq" && <FaqAccordion />}
      </TabPanel>
      <TabPanel id="ask" groupId="help-center">
        {tab === "ask" && <AskQuestionPanel />}
      </TabPanel>
    </Modal>
  );
}
