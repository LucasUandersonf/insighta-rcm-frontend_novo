import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Compass, LifeBuoy } from "lucide-react";
import { useLocation } from "react-router-dom";
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
import { SupportContactLinks } from "./SupportContactLinks";
import { useDirtyOnEdit } from "@/lib/unsavedChanges";

// Perguntas frequentes — conteúdo estático de propósito nesta primeira
// versão (sem CMS de FAQ ainda): cobre as dúvidas mais prováveis sobre
// os módulos já em produção. Quando um padrão recorrente aparecer nas
// perguntas reais enviadas pelo formulário abaixo, vale promovê-lo para
// cá.
// `routes`: telas onde a pergunta aparece primeiro, já aberta (Central
// contextual: quem pede ajuda em Importar dados vê antes as dúvidas de lá).
const FAQ_ITEMS: { question: string; answer: string; routes?: string[] }[] = [
  {
    question: "A planilha foi recusada por coluna faltando. E agora?",
    routes: ["/importar"],
    answer:
      "A mensagem diz quais colunas faltam pelo nome do modelo. Se o seu sistema usa outro nome (ex.: “Dt Atend” em vez de data do atendimento), clique em Mapear colunas e diga qual é qual: o Insighta lembra para os próximos arquivos. Se faltar a coluna mesmo, baixe o modelo na própria tela e copie os dados para ele. Para conferir sem importar nada, use Conferir antes de importar.",
  },
  {
    question: "O que é o limite de atendimentos do plano?",
    routes: ["/assinatura", "/importar"],
    answer:
      "O Basic acompanha até 1.500 atendimentos por mês e o Pro até 8.000 (contam os atendimentos dos últimos 30 dias). Aos 80% aparece um aviso; acima de 100% as importações continuam até 120%; acima disso, novas importações ficam pausadas até a troca de plano. Nada do que já foi importado é apagado. O consumo está em Plano e assinatura › Uso do plano.",
  },
  {
    question: "Por que o sistema está em modo leitura?",
    routes: ["/assinatura"],
    answer:
      "O teste de 14 dias terminou ou há uma fatura da assinatura em aberto. Você continua vendo e exportando tudo; para importar e editar, escolha um plano ou pague a fatura em Plano e assinatura. Pix e cartão liberam em minutos; boleto, em até 3 dias úteis.",
  },
  {
    question: "Pedi o Pro e ele ainda não liberou.",
    routes: ["/assinatura"],
    answer:
      "A troca para o Pro gera uma cobrança da diferença proporcional e o Pro é liberado quando ela é paga. Pix e cartão liberam em minutos; boleto compensa em até 3 dias úteis. Depois de pagar, use Já paguei, conferir agora em Plano e assinatura. Se não quiser mais, clique em Desistir da troca.",
  },
  {
    question: "Por que o Extrato de Resultado está zerado?",
    routes: ["/resultado", "/"],
    answer:
      "No primeiro mês é normal: o Extrato precisa do faturamento importado e do primeiro retorno do convênio (pagamento ou glosa) para medir o que voltou ao caixa. Ele fecha no dia 1 de cada mês. Cada linha tem Como calculamos, com a fonte do número.",
  },
  {
    question: "Como importo minha primeira planilha?",
    routes: ["/importar", "/"],
    answer:
      "Em Importar dados (barra de cima), escolha o tipo da planilha (Faturamento, Agenda, Atendimento, Estoque ou Prontuário), selecione o arquivo como ele sai do seu sistema (.xlsx ou .csv) e clique em Enviar arquivo. Convênios novos são cadastrados sozinhos. O resultado aparece na mesma tela e você pode sair enquanto processa.",
  },
  {
    question: "Minha planilha teve linhas que não entraram — o que fazer?",
    routes: ["/importar"],
    answer:
      "Abra Importar dados › Linhas para corrigir. Convênio desconhecido se resolve ali mesmo, com um clique. Linha com data, valor ou campo obrigatório inválido mostra o número da linha (como no Excel), o valor que foi lido e o que corrigir; baixe a lista, corrija na planilha e envie o arquivo de novo — só as linhas que faltavam entram.",
  },
  {
    question: "Onde mudo a meta anual de faturamento?",
    answer: "No menu da sua foto › Minha clínica › Meta de faturamento anual. Digite no formato brasileiro (ex.: 2.400.000,00); o campo mostra o valor que vai ser salvo antes de você confirmar.",
  },
  {
    question: "Como cadastro a tabela de preço de um convênio?",
    answer:
      "Em Importar dados › Contratos de convênio (PDF), escolha o convênio, a vigência e o PDF do contrato. O Insighta lê a tabela de preços e abre a conferência: revise os itens e clique em Aprovar tabela. Só depois disso a tabela passa a valer para a conferência de glosa. Para poucos itens, use Convênios › Contratos e tabelas › Cadastro manual.",
  },
  {
    question: "Como convido alguém da equipe?",
    routes: ["/admin/usuarios"],
    answer:
      "No menu da sua foto › Usuários › Novo usuário. Escolha o papel da pessoa (cada papel mostra o que ela pode ver), crie o acesso e copie o convite com o link e a senha temporária. No primeiro acesso ela cria a própria senha.",
  },
  {
    question: "Onde vejo quanto cada convênio glosa e quanto demora para pagar?",
    answer: "Em Convênios: a aba Glosas mostra o valor e a taxa por convênio, e a aba Prazos e retenções mostra os dias médios e o imposto que cada convênio retém. Você também pode perguntar no campo do topo, por exemplo “quanto a Unimed glosou?”.",
  },
  {
    question: "Por que um faturamento aparece com risco de glosa alto?",
    routes: ["/faturamento", "/fila-correcao"],
    answer:
      "O sistema aplica regras antes do envio ao convênio: CID ausente, procedimento não informado, convênio sem tabela de preço aprovada ou valor cobrado acima do contratado. O motivo específico aparece no próprio registro — é uma regra concreta que bateu, não uma estimativa.",
  },
  {
    question: "Como funciona o cálculo de risco de falta do paciente?",
    answer:
      "Pelo histórico real do próprio paciente: taxa geral de falta e, quando há amostra suficiente, o padrão do mesmo dia da semana e período. Paciente sem histórico recebe risco “indeterminado”, nunca “baixo”: falta de dado não é baixo risco.",
  },
  {
    question: "Como recebo o resumo semanal?",
    answer:
      "No menu da sua foto › Destinatários de relatórios, cadastre o e-mail de quem deve receber e escolha os tipos (resumo semanal, alerta de risco de falta). O envio por WhatsApp ainda não está disponível. Dá para mandar o resumo na hora pelo botão Enviar relatório agora.",
  },
  {
    question: "O que acontece depois que abro um recurso de glosa?",
    answer:
      "O recurso percorre aberto → protocolado → deferido/indeferido, com prazo calculado a partir do contrato com a operadora. Você gera o documento do recurso em PDF com os dados do caso preenchidos; falta só revisar a justificativa e protocolar pelo canal da operadora.",
  },
  {
    question: "Quem pode ver os Logs de auditoria e o que fica registrado?",
    answer:
      "Proprietário(a), administrador(a) e auditor(a). Ficam registradas a criação de paciente e de faturamento, a aprovação de contrato, mudanças de papel de usuário e cada etapa do recurso de glosa — quem fez, o quê e quando. O log não guarda cópia de dado sensível (CPF, valores, senha).",
  },
  {
    question: "Um paciente pediu para remover seus dados — como faço?",
    answer:
      "Proprietário(a) ou administrador(a) pode anonimizar o cadastro do paciente (troca nome, CPF e data de nascimento por um código). O histórico de agenda e faturamento fica, porque a clínica é obrigada a guardá-lo — a LGPD permite. A ação não pode ser desfeita.",
  },
  {
    question: "Como registro um atendimento particular, sem convênio?",
    answer:
      "Em Convênios › Novo convênio, marque “É particular”. Use esse convênio no faturamento do atendimento: ele aparece separado nos indicadores. Se quiser, cadastre também uma tabela de preços para ele em Convênios › Contratos.",
  },
];

async function _createSupportRequest(payload: SupportRequestCreateRequest): Promise<SupportRequest> {
  return apiClient.post<SupportRequest>("/api/v1/support-requests", payload);
}

function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function matchesRoute(routes: string[] | undefined, pathname: string): boolean {
  return !!routes?.some((r) => (r === "/" ? pathname === "/" : pathname === r || pathname.startsWith(`${r}/`)));
}

function FaqAccordion() {
  const { pathname } = useLocation();
  // Suporte zero: as perguntas da tela atual vêm primeiro e a primeira já abre.
  const ordered = [...FAQ_ITEMS.filter((i) => matchesRoute(i.routes, pathname)), ...FAQ_ITEMS.filter((i) => !matchesRoute(i.routes, pathname))];
  const hasContext = matchesRoute(ordered[0]?.routes, pathname);
  const [openIndex, setOpenIndex] = useState<number | null>(hasContext ? 0 : null);
  const [search, setSearch] = useState("");
  // UX2-26: busca nas perguntas e respostas (sem acento, sem maiúscula).
  const terms = normalizeText(search).split(/\s+/).filter(Boolean);
  const items = ordered.filter((item) => {
    const hay = normalizeText(`${item.question} ${item.answer}`);
    return terms.every((t) => hay.includes(t));
  });
  return (
    <div className="space-y-2">
      <TextField
        id="faq-search"
        label="Buscar na ajuda"
        placeholder="Ex.: meta, agenda, convidar, contrato"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpenIndex(null);
        }}
      />
      {items.length === 0 && (
        <p className="text-xs text-ink-muted">Nada encontrado. Envie sua pergunta na aba ao lado — a equipe responde por e-mail.</p>
      )}
      {items.map((item, i) => {
        const isOpen = openIndex === i || (terms.length > 0 && items.length === 1);
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
  const unsaved = useDirtyOnEdit("a mensagem para o suporte");
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
      <form onChange={unsaved.onChange} onSubmitCapture={unsaved.onSubmit} onSubmit={handleSubmit}>
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
      <SupportContactLinks className="mb-4" />
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
