import { LegalDocumentLayout } from "@/components/layout/LegalDocumentLayout";

/**
 * Termos de Uso — LGPD ("vamos chegar a 9.5", épico de Termo de Uso/
 * Política de Privacidade real). Conteúdo espelha TERMOS_DE_USO.md no
 * backend (fonte da verdade do texto) — os dois precisam evoluir juntos;
 * ver DECISÃO completa lá sobre o que é fato verificado no código vs.
 * `[PENDENTE]` (decisão jurídica/negócio ainda não tomada).
 */
export function TermsOfServicePage() {
  return (
    <LegalDocumentLayout title="Termos de Uso" lastUpdated="22/09/2026">
      <h2>1. Quem oferece o serviço e quem aceita estes termos</h2>
      <p>
        <strong>Insighta</strong> ([PENDENTE — razão social completa], inscrita no CNPJ sob o nº [PENDENTE], com
        sede em [PENDENTE — endereço]) opera a plataforma Insighta ("Plataforma", "Serviço"), uma central de
        inteligência de dados da operação de saúde — cruza dado de agenda, faturamento e desfecho
        clínico-operacional já existentes nos sistemas do cliente para produzir diagnóstico e alertas de gestão.
        Estes Termos regulam o uso da Plataforma pela clínica, consultório ou rede de saúde que se cadastra
        ("Cliente", "clínica").
      </p>
      <p>
        Ao concluir o cadastro, o responsável pelo cadastro declara que tem poderes para vincular a clínica a
        estes Termos e à Política de Privacidade em nome dela, e que o cadastro só se completa depois desse
        aceite explícito (ver seção 8).
      </p>

      <h2>2. O que a Plataforma é — e o que ela não é</h2>
      <p>
        <strong>O Insighta não é o sistema primário de prontuário eletrônico, agenda ou faturamento da clínica.</strong>{" "}
        Ele opera sobre dado já existente nesses sistemas, recebido por upload estruturado ou integração
        automática. Isso significa, na prática:
      </p>
      <ul>
        <li>
          A Insighta nunca é a fonte de verdade do prontuário do paciente — uma correção feita no sistema de
          origem da clínica só chega à Plataforma no próximo upload/sincronização, nunca o contrário.
        </li>
        <li>
          A Insighta produz diagnóstico, alerta e recomendação de gestão a partir do dado recebido — não presta
          atendimento à saúde, não decide tratamento, não substitui o sistema onde o profissional de saúde
          registra o atendimento.
        </li>
        <li>
          Toda ação sugerida pela Plataforma (inclusive as geradas por inteligência artificial) é uma
          recomendação para revisão humana, nunca uma ação automática tomada sozinha sobre o negócio ou o
          paciente do Cliente (ver seção 5).
        </li>
      </ul>

      <h2>3. Cadastro, plano e conta</h2>
      <ul>
        <li>
          O cadastro cria a clínica e o primeiro usuário, sempre com papel de proprietário (owner) — quem se
          cadastra não escolhe o próprio papel.
        </li>
        <li>
          A escolha de plano no cadastro registra a intenção de plano; a cobrança em si segue o fluxo de
          pagamento da Plataforma. <strong>[PENDENTE — jurídico/negócio]</strong>: preço, ciclo de cobrança,
          política de reajuste e inadimplência de cada plano.
        </li>
        <li>O owner pode convidar outros usuários da própria clínica, com papéis mais restritos.</li>
        <li>
          A clínica é responsável por manter suas credenciais de acesso em sigilo e por toda atividade realizada
          com elas, inclusive por usuários que ela mesma convidou.
        </li>
      </ul>

      <h2>4. Dado que a clínica envia — responsabilidade pela origem</h2>
      <p>A clínica é a única responsável por:</p>
      <ul>
        <li>
          Ter base legal válida (LGPD) para coletar e tratar o dado pessoal e de saúde que envia à Plataforma — a
          Insighta trata esse dado como <strong>operadora</strong>, a pedido da clínica, nunca como controladora
          (ver Política de Privacidade, seção 2).
        </li>
        <li>
          A exatidão do dado enviado — a Plataforma processa o que recebe; uma inconsistência na origem se
          reflete no diagnóstico gerado.
        </li>
        <li>
          Garantir que só pessoal autorizado da própria clínica tenha acesso às credenciais de login — a
          Plataforma aplica controle de acesso por papel e isolamento técnico entre clínicas, mas não controla
          quem, dentro da clínica, a clínica decide autorizar.
        </li>
      </ul>

      <h2>5. Governança de inteligência artificial</h2>
      <p>
        A Plataforma usa modelos de linguagem para tarefas específicas e delimitadas — nunca para decidir ou
        executar ação sozinha sobre o negócio do Cliente ou sobre um paciente: resumo executivo narrado
        (interpretação de métricas já calculadas, sempre revisável) e rascunho de recurso de glosa (minuta de
        contestação junto a uma operadora, sempre revisada e enviada por decisão humana da clínica). Nenhuma
        delas toma uma ação irreversível sem confirmação explícita de um usuário humano da clínica.
      </p>

      <h2>6. Disponibilidade e suporte</h2>
      <p>
        <strong>[PENDENTE — jurídico/negócio]</strong>: SLA formal de disponibilidade, janela de manutenção
        programada e canal/prazo de suporte por plano.
      </p>

      <h2>7. Propriedade intelectual</h2>
      <p>
        O software, a marca e a metodologia de cálculo dos indicadores da Plataforma pertencem à Insighta. O
        dado que a clínica envia continua sendo do Cliente — o uso da Plataforma não transfere propriedade sobre
        esse dado à Insighta.
      </p>

      <h2>8. Aceite</h2>
      <p>
        Estes Termos e a Política de Privacidade são aceitos no momento do cadastro — o cadastro só se completa
        com esse aceite explícito (checkbox obrigatório na tela de cadastro, nunca marcado por padrão).
        Alterações materiais a este documento exigirão novo aceite.
      </p>

      <h2>9. Cancelamento e retenção de dado após o cancelamento</h2>
      <p>A clínica pode solicitar o cancelamento da assinatura a qualquer momento. Após o cancelamento:</p>
      <ul>
        <li>O tenant é marcado como inativo — acesso à Plataforma é suspenso.</li>
        <li>
          O dado permanece armazenado pelo prazo de retenção configurado para aquele cancelamento — ver Política
          de Privacidade, seção 6.
        </li>
        <li>
          Findo esse prazo, o dado pessoal identificável do paciente é anonimizado automaticamente (nunca
          excluído fisicamente, por obrigação legal de retenção fiscal/contábil de faturamento).
        </li>
      </ul>

      <h2>10. Foro e legislação aplicável</h2>
      <p>
        <strong>[PENDENTE — jurídico]</strong>: foro de eleição e legislação aplicável, a confirmar formalmente
        pelo corpo jurídico da Insighta antes de publicação.
      </p>
    </LegalDocumentLayout>
  );
}
