import { Link } from "react-router-dom";
import { LegalDocumentLayout } from "@/components/layout/LegalDocumentLayout";
import { COMPANY, LEGAL_UPDATED_AT, LEGAL_VERSION } from "@/lib/company";

const SUBPROCESSORS: { name: string; purpose: string; where: string; data: string }[] = [
  { name: "Railway Corporation", purpose: "Hospedagem da aplicação, banco de dados, arquivos e backups", where: "EUA", data: "Todos" },
  {
    name: "Anthropic PBC",
    purpose: "Inteligência artificial: leitura de contratos, perguntas, resumos e minutas de recurso",
    where: "EUA",
    data: "Textos e números sem nome de paciente; CID na minuta de recurso de glosa",
  },
  { name: "Asaas", purpose: "Cobrança da assinatura e nota fiscal", where: "Brasil", data: "Dados de quem contrata; nenhum dado de paciente" },
  { name: "Resend", purpose: "E-mails do sistema (senha, convites)", where: "EUA", data: "Nome e e-mail de usuários da equipe" },
  { name: "Better Stack", purpose: "Monitoramento de erros e disponibilidade", where: "EUA / UE", data: "Rastro técnico, sem dado pessoal por configuração" },
  {
    name: "Meta Platforms (WhatsApp Business), quando ligado",
    purpose: "Relatórios e alertas para a equipe da Clínica",
    where: "EUA",
    data: "Relatórios que podem conter nome de paciente, sem CID",
  },
  { name: "Cloudflare R2 ou Backblaze B2, quando ligado", purpose: "Segunda cópia do backup", where: "EUA", data: "Todos (arquivo de backup)" },
];

/**
 * Contrato de Tratamento de Dados (DPA), aceito no cadastro junto com os
 * Termos e a Política de Privacidade. Texto espelhado em
 * docs/juridico/DPA_CONTRATO_TRATAMENTO_DADOS.md no backend.
 */
export function DataProcessingAgreementPage() {
  return (
    <LegalDocumentLayout title="Contrato de Tratamento de Dados" lastUpdated={LEGAL_UPDATED_AT}>
      <p>Versão {LEGAL_VERSION}.</p>
      <p>
        <strong>Controladora:</strong> a clínica que se cadastra na Plataforma ("Clínica"), identificada pela razão social
        e CNPJ informados no cadastro. <strong>Operadora:</strong> {COMPANY.legalName}, CNPJ {COMPANY.cnpj}, com sede em{" "}
        {COMPANY.address} ("Insighta"). Este contrato faz parte dos <Link to="/termos">Termos de Uso</Link> e é aceito
        eletronicamente no cadastro, com registro de data, hora e versão.
      </p>

      <h2>1. Objeto e papéis</h2>
      <p>
        A Insighta trata dados pessoais em nome da Clínica para prestar o serviço da Plataforma. A Clínica é a controladora
        (LGPD art. 5º, VI) e decide quais dados envia e para quê. A Insighta é a operadora (art. 5º, VII) e trata os dados
        apenas conforme este contrato e as instruções da Clínica dadas pelo uso da Plataforma.
      </p>

      <h2>2. Dados tratados</h2>
      <ul>
        <li>Identificação de pacientes: nome, CPF, data de nascimento, CEP, telefone.</li>
        <li>
          <strong>Dados de saúde (sensíveis, art. 11)</strong>: CID, procedimentos (TUSS), registros de prontuário,
          atendimentos.
        </li>
        <li>Financeiros: valores faturados, recebidos, glosas, contratos com operadoras.</li>
        <li>Equipe da Clínica: nome, e-mail, papel, registros de acesso.</li>
      </ul>

      <h2>3. Finalidade e limites</h2>
      <ul>
        <li>
          A Insighta trata os dados somente para armazenar e processar os dados da Clínica, gerar análises, relatórios e
          alertas para ela, dar o suporte que ela pedir, e garantir segurança e backup.
        </li>
        <li>
          É proibido à Insighta vender ou ceder os dados, usá-los para finalidade própria, usá-los para treinar modelos de
          inteligência artificial de terceiros, ou cruzá-los com dados de outra clínica de forma que identifique pacientes
          ou a Clínica.
        </li>
        <li>O comparativo entre clínicas usa apenas medianas de grupos com amostra mínima, sem identificar ninguém.</li>
      </ul>

      <h2>4. Segurança (art. 46)</h2>
      <ul>
        <li>Isolamento por clínica no próprio banco de dados (Row-Level Security) e controle de acesso por papel.</li>
        <li>Senhas com argon2, sessões curtas e verificação em duas etapas opcional.</li>
        <li>Criptografia em trânsito (TLS) e em repouso (volume gerenciado pelo provedor).</li>
        <li>Trilha de auditoria das ações sensíveis, sem gravar dado de saúde no registro.</li>
        <li>Nomes de pacientes trocados por códigos antes de qualquer uso de inteligência artificial.</li>
        <li>Backup diário restaurado e conferido automaticamente, guardado por 14 dias.</li>
        <li>Verificação automática de vulnerabilidades e de segredos no código a cada mudança.</li>
        <li>Acesso direto ao banco de produção só por necessidade, registrado com data e motivo.</li>
      </ul>

      <h2>5. Suboperadores</h2>
      <p>
        A Clínica autoriza os suboperadores abaixo. A Insighta avisa com 30 dias de antecedência sobre inclusão ou troca, e
        a Clínica pode se opor de forma fundamentada ou cancelar sem multa. A Insighta exige de cada um proteção
        equivalente à deste contrato.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Suboperador</th>
              <th>Finalidade</th>
              <th>Local</th>
              <th>Dados</th>
            </tr>
          </thead>
          <tbody>
            {SUBPROCESSORS.map((s) => (
              <tr key={s.name}>
                <td>{s.name}</td>
                <td>{s.purpose}</td>
                <td>{s.where}</td>
                <td>{s.data}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>6. Transferência internacional (arts. 33 a 36)</h2>
      <p>
        Para os suboperadores fora do Brasil, a transferência se apoia nas cláusulas-padrão contratuais aprovadas pela ANPD
        (Resolução CD/ANPD nº 19/2024), que as partes incorporam a este contrato por referência, no módulo operador para
        operador, e nos termos de proteção de dados de cada fornecedor. A Insighta mantém o registro dessas garantias e o
        apresenta à Clínica quando pedido.
      </p>

      <h2>7. Direitos dos titulares</h2>
      <ul>
        <li>
          Pedidos de pacientes (acesso, correção, eliminação, portabilidade) são recebidos e decididos pela Clínica. A
          Plataforma dá os meios: correção pelo reenvio do dado, anonimização do paciente e exportação completa em Minha
          clínica.
        </li>
        <li>Se um titular procurar a Insighta diretamente, a Insighta encaminha o pedido à Clínica em até 2 dias úteis.</li>
      </ul>

      <h2>8. Incidentes de segurança</h2>
      <p>
        A Insighta avisa a Clínica em até 24 horas depois de saber de um incidente que envolva seus dados, com as
        informações do art. 48, §1º, disponíveis no momento, e complementa depois. A comunicação à ANPD e aos titulares cabe
        à Clínica, com o apoio da Insighta.
      </p>

      <h2>9. Comprovação</h2>
      <p>
        A Clínica pode pedir, uma vez por ano ou depois de um incidente, informações que comprovem o cumprimento deste
        contrato. A Insighta responde em até 15 dias úteis.
      </p>

      <h2>10. Fim do contrato</h2>
      <p>
        Depois do cancelamento, a Clínica pode exportar todos os seus dados por 90 dias. Passado esse prazo, a Insighta
        anonimiza os dados pessoais de pacientes e apaga os backups que os contenham no ciclo normal de 14 dias. Ficam
        guardados apenas os dados que a lei obriga a manter, pelo prazo legal.
      </p>

      <h2>11. Encarregado</h2>
      <p>
        Encarregado da Insighta: {COMPANY.dpoName}, {COMPANY.dpoEmail}. O encarregado da Clínica pode ser informado pelo
        suporte.
      </p>

      <h2>12. Foro</h2>
      <p>Vale a lei brasileira e o foro da comarca de {COMPANY.forumCity}.</p>
    </LegalDocumentLayout>
  );
}
