import { LegalDocumentLayout } from "@/components/layout/LegalDocumentLayout";

/**
 * Política de Privacidade — LGPD ("vamos chegar a 9.5"). Conteúdo
 * espelha POLITICA_DE_PRIVACIDADE.md no backend (fonte da verdade do
 * texto, com a tabela completa de dado processado e subprocessadores) —
 * ver DECISÃO lá sobre o que é fato verificado no código vs.
 * `[PENDENTE]`.
 */
export function PrivacyPolicyPage() {
  return (
    <LegalDocumentLayout title="Política de Privacidade" lastUpdated="22/09/2026">
      <h2>1. Quem somos e o papel que exercemos sobre o seu dado</h2>
      <p>
        A Insighta ([PENDENTE — razão social completa], CNPJ [PENDENTE]) opera uma plataforma de inteligência de
        dados para clínicas e redes de saúde.
      </p>
      <p>
        <strong>Se você é paciente de uma clínica que usa a Insighta</strong>, é importante entender a relação: a{" "}
        <strong>clínica é a controladora</strong> do seu dado pessoal — é ela quem decide coletar seu dado, é ela
        quem tem relação direta com você, é ela quem você deve procurar para exercer qualquer direito sobre seu
        dado. <strong>A Insighta atua como operadora</strong>, processando o dado que a clínica já coletou, a
        pedido dela, no contexto de faturamento junto a operadoras de saúde — nunca decide sozinha o que fazer
        com o seu dado além do que a clínica contratou.
      </p>
      <p>
        <strong>Se você é usuário da equipe de uma clínica cliente</strong>, a Insighta trata diretamente seu
        nome, e-mail e senha (hash, nunca em texto puro) para autenticação e controle de acesso — aqui a Insighta
        é controladora desse dado específico de conta de usuário.
      </p>

      <h2>2. Que dado pessoal passa pela Plataforma</h2>
      <ul>
        <li>Identificação do paciente — nome completo, CPF, cartão do convênio.</li>
        <li>
          <strong>Dado de saúde (sensível, Art. 5º II da LGPD)</strong> — código CID-10 do atendimento.
        </li>
        <li>Identificação do profissional de saúde — nome, registro profissional (CRM/CRO/etc).</li>
        <li>Dado financeiro do atendimento — valor cobrado/pago, procedimento (código TUSS).</li>
        <li>Credenciais de acesso da equipe da clínica — e-mail, senha (hash bcrypt/argon2).</li>
        <li>Contato de destinatário de relatório — nome, telefone WhatsApp (membro da equipe, não paciente).</li>
      </ul>

      <h2>3. Base legal</h2>
      <ul>
        <li>
          Dado de identificação/financeiro do paciente: tratado pela clínica sob Art. 7º, V (execução de
          contrato) ou IX (legítimo interesse) da LGPD — <strong>[PENDENTE — jurídico]</strong> qual das duas é a
          base formal de cada contrato.
        </li>
        <li>
          Dado de saúde (CID, sensível): tratado sob Art. 11º, II, "f" (tutela da saúde, em procedimento
          realizado por profissionais de saúde) — <strong>[PENDENTE — jurídico]</strong> confirmação formal com o
          corpo jurídico de cada clínica cliente.
        </li>
        <li>Dado de conta de usuário da equipe da clínica: Art. 7º, V (execução de contrato).</li>
      </ul>

      <h2>4. Como isolamos o dado entre clínicas diferentes</h2>
      <ul>
        <li>
          Row-Level Security (RLS) no banco de dados, não só controle na aplicação — mesmo uma falha na aplicação
          não vaza dado entre clínicas, porque é o próprio banco que recusa a consulta.
        </li>
        <li>Controle de acesso por papel (5 papéis) dentro de cada clínica.</li>
        <li>
          Comparação entre clínicas (benchmark de rede) nunca expõe dado de uma clínica específica para outra —
          só mediana/agregado de um grupo, com amostra mínima.
        </li>
      </ul>

      <h2>5. Para quem seu dado pode sair da nossa infraestrutura</h2>
      <ul>
        <li>
          <strong>Anthropic</strong> (API de IA) — extração de contrato: texto de tabela de preços (sem
          paciente). Rascunho de recurso de glosa: motivo da negativa, tipo de guia, código CID, código de
          procedimento (nunca nome/CPF do paciente), sob demanda explícita de um usuário da clínica.
        </li>
        <li>
          <strong>Meta WhatsApp Business Platform</strong> — relatório semanal / lista de risco (pode conter nome
          de paciente, não CID), enviado a um número da própria equipe da clínica, nunca ao paciente.
        </li>
        <li>
          <strong>Amazon Web Services</strong> (armazenamento de arquivo) — PDF de contrato, anexo de recurso de
          glosa, arquivo de ingestão, conforme o que a clínica anexa.
        </li>
        <li>
          <strong>Railway</strong> (infraestrutura de hospedagem) — todo o dado acima, em repouso e em trânsito.
        </li>
        <li>
          <strong>Sentry</strong> (monitoramento de erro, opcional) — rastro técnico de erro, configurado para
          nunca enviar dado pessoal automaticamente.
        </li>
      </ul>
      <p>
        O único fluxo que envia dado de saúde (CID) para um processador fora da infraestrutura própria é o
        rascunho de recurso de glosa via IA, sempre sob ação explícita de um usuário da clínica.
      </p>

      <h2>6. Segurança técnica</h2>
      <ul>
        <li>Canal criptografado entre a aplicação e o banco de dados (TLS).</li>
        <li>
          Dado em repouso: o banco roda sobre volume gerenciado pela Railway, que declara criptografar todo dado
          em repouso ao nível de armazenamento.
        </li>
        <li>A aplicação recusa subir em produção com segredo de autenticação fraco ou CORS aberto.</li>
        <li>Varredura automática de segredo commitado por engano antes de cada mudança chegar à produção.</li>
        <li>Auditoria de dependências de terceiro contra vulnerabilidades conhecidas a cada mudança de código.</li>
      </ul>

      <h2>7. Por quanto tempo guardamos seu dado</h2>
      <p>
        Enquanto a clínica estiver ativa na Plataforma, o dado permanece armazenado — não há expurgo automático
        de paciente ativo.
      </p>
      <p>
        <strong>Quando a clínica cancela a assinatura</strong>: um administrador da Insighta pode configurar um
        prazo de retenção (em dias) específico para aquele cancelamento. Findo esse prazo, todo dado pessoal
        identificável de paciente daquela clínica é anonimizado automaticamente (nome, CPF, data de nascimento e
        CEP substituídos por um marcador — nunca excluídos fisicamente, por obrigação legal de retenção
        fiscal/contábil enquanto a clínica esteve ativa). <strong>[PENDENTE — jurídico/negócio]</strong>: o prazo
        de retenção padrão em si — o mecanismo já existe e é configurável por clínica cancelada, mas não há um
        número de dias definido como política padrão da empresa; até essa decisão existir, nenhuma clínica
        cancelada tem expurgo automático configurado por padrão.
      </p>

      <h2>8. Seus direitos como titular do dado</h2>
      <p>
        Você tem direito a confirmação de tratamento, acesso, correção, anonimização/eliminação, portabilidade e
        informação sobre com quem seu dado é compartilhado (Art. 18 da LGPD).
      </p>
      <p>
        <strong>Se você é paciente</strong>: como a clínica é quem tem a relação direta com você (controladora),
        o canal para exercer esses direitos é a própria clínica onde você é atendido.
      </p>
      <p>
        <strong>Se você é usuário da equipe de uma clínica cliente</strong>: pode solicitar correção do seu
        próprio cadastro e desativação da própria conta diretamente com o administrador da sua clínica na
        Plataforma.
      </p>

      <h2>9. Contato</h2>
      <p>
        <strong>[PENDENTE — jurídico/negócio]</strong>: canal formal de contato do encarregado de proteção de
        dados (DPO) da Insighta (e-mail dedicado, prazo de resposta) — obrigatório para publicação desta política
        (LGPD Art. 41).
      </p>
    </LegalDocumentLayout>
  );
}
