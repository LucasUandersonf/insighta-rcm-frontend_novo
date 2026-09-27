import { Link } from "react-router-dom";
import { LegalDocumentLayout } from "@/components/layout/LegalDocumentLayout";
import { COMPANY, LEGAL_UPDATED_AT, LEGAL_VERSION } from "@/lib/company";

/**
 * Termos de Uso. Texto espelhado em TERMOS_DE_USO.md no backend (os dois
 * mudam juntos, e LEGAL_VERSION/TERMS_VERSION sobem a cada mudança). Dados
 * da empresa vêm de src/lib/company.ts.
 */
export function TermsOfServicePage() {
  return (
    <LegalDocumentLayout title="Termos de Uso" lastUpdated={LEGAL_UPDATED_AT}>
      <p>Versão {LEGAL_VERSION}.</p>

      <h2>1. Quem somos e quem aceita</h2>
      <p>
        A plataforma Insighta ("Plataforma") é oferecida por <strong>{COMPANY.legalName}</strong>, CNPJ {COMPANY.cnpj},
        com sede em {COMPANY.address} ("Insighta"). Estes Termos valem para a clínica, consultório ou grupo de saúde que
        se cadastra ("Clínica").
      </p>
      <p>
        Quem faz o cadastro declara ter poderes para contratar em nome da Clínica. O cadastro só se completa com o aceite
        destes Termos, da <Link to="/privacidade">Política de Privacidade</Link> e do{" "}
        <Link to="/contrato-de-dados">Contrato de Tratamento de Dados</Link>, que fazem parte deste contrato. A Insighta
        registra a data, a hora e a versão aceita.
      </p>

      <h2>2. O que a Plataforma faz e o que ela não faz</h2>
      <ul>
        <li>
          A Plataforma analisa dados de faturamento, agenda, convênios, estoque e prontuário que a Clínica já tem em seus
          sistemas e envia por planilha ou integração. Ela mostra indicadores, alertas e recomendações de gestão.
        </li>
        <li>
          A Plataforma não é o prontuário eletrônico nem o sistema de faturamento da Clínica, não presta atendimento de
          saúde e não decide tratamento.
        </li>
        <li>
          Recomendações, inclusive as escritas por inteligência artificial, são apoio à decisão. Nenhuma ação sobre
          pacientes, convênios ou pagamentos é tomada sem a confirmação de uma pessoa da Clínica.
        </li>
      </ul>

      <h2>3. Conta e usuários</h2>
      <ul>
        <li>Quem cadastra a Clínica recebe o perfil Diretoria (owner) e pode convidar a equipe com perfis mais restritos.</li>
        <li>
          A Clínica guarda o sigilo das senhas e responde pelo que for feito com os acessos que ela mesma criou. Recomendamos
          ligar a verificação em duas etapas em Segurança da conta.
        </li>
      </ul>

      <h2>4. Assinatura, preço e pagamento</h2>
      <ul>
        <li>
          A assinatura é mensal e recorrente. O pagamento é feito por Pix, boleto ou cartão na fatura do Asaas, empresa de
          pagamentos contratada pela Insighta. A Plataforma é liberada quando o pagamento é confirmado.
        </li>
        <li>A Insighta emite nota fiscal de serviço a cada pagamento, enviada ao e-mail cadastrado.</li>
        <li>
          <strong>Oferta Founders:</strong> as 20 primeiras clínicas a concluir o primeiro pagamento pagam{" "}
          <strong>R$ 800,00 por mês</strong>, sem reajuste por <strong>24 meses</strong> contados do primeiro pagamento.
          A vaga é reservada por 48 horas depois de gerada a primeira fatura. Terminados os 24 meses, passa a valer o preço
          da tabela vigente, com aviso por e-mail pelo menos 30 dias antes.
        </li>
        <li>
          Fora da oferta Founders, vale o preço informado na contratação, reajustado uma vez por ano pelo IPCA, com aviso
          de 30 dias.
        </li>
      </ul>

      <h2>5. Atraso no pagamento</h2>
      <ul>
        <li>
          Vencida a fatura, a Clínica continua usando a Plataforma por <strong>7 dias</strong>, com aviso na tela. Depois
          disso, o acesso fica suspenso até o pagamento. Durante a suspensão continuam abertas a tela de assinatura, os
          dados da conta, a exportação dos dados da Clínica e o suporte.
        </li>
        <li>A fatura em atraso pode ter multa de até 2% e juros de até 1% ao mês, informados na própria fatura.</li>
        <li>Depois de 60 dias de suspensão, a Insighta pode cancelar a assinatura, aplicando a seção 12.</li>
      </ul>

      <h2>6. Cancelamento</h2>
      <ul>
        <li>
          A Clínica pode cancelar quando quiser, sem multa, pelo suporte. O cancelamento vale ao fim do mês já pago; não há
          devolução proporcional do mês em curso.
        </li>
        <li>A clínica Founders que cancela perde o preço Founders. Uma nova assinatura segue o preço da tabela vigente.</li>
      </ul>

      <h2>7. Dados que a Clínica envia</h2>
      <ul>
        <li>
          A Clínica é a controladora dos dados pessoais e de saúde dos seus pacientes. A Insighta atua como operadora e
          trata esses dados só para prestar o serviço, conforme o{" "}
          <Link to="/contrato-de-dados">Contrato de Tratamento de Dados</Link>.
        </li>
        <li>
          Cabe à Clínica ter base legal para tratar e compartilhar esses dados, informar seus pacientes e cuidar da
          exatidão do que envia.
        </li>
      </ul>

      <h2>8. Inteligência artificial</h2>
      <ul>
        <li>
          A inteligência artificial escreve textos (resumos, respostas, minutas de recurso) sobre números calculados pela
          Plataforma. Todo número escrito é conferido com o cálculo; se não bater, o texto é descartado.
        </li>
        <li>Os nomes dos pacientes são trocados por códigos antes de qualquer uso de inteligência artificial.</li>
        <li>
          Cada Clínica tem um limite mensal de uso de inteligência artificial. Atingido o limite, esses recursos pausam
          até o mês seguinte e o restante da Plataforma continua funcionando.
        </li>
      </ul>

      <h2>9. Disponibilidade e suporte</h2>
      <ul>
        <li>
          A meta é manter a Plataforma no ar 99,5% do tempo em horário comercial (segunda a sexta, 7h às 20h). Manutenções
          programadas são feitas, sempre que possível, fora desse horário e avisadas com antecedência. A situação atual
          fica na página de status.
        </li>
        <li>Suporte por WhatsApp, e-mail e pela Central de Ajuda do sistema, em dias úteis, das 9h às 18h.</li>
        <li>A meta de disponibilidade é um compromisso de esforço e não gera desconto automático.</li>
      </ul>

      <h2>10. Responsabilidade</h2>
      <ul>
        <li>
          A Insighta não responde por decisões tomadas com base nas análises, por dados incorretos enviados pela Clínica nem
          por falhas dos sistemas de origem da Clínica.
        </li>
        <li>
          A responsabilidade total da Insighta neste contrato fica limitada ao valor pago pela Clínica nos 12 meses
          anteriores ao fato, exceto nos casos em que a lei não permite limitar, como dolo ou violação da LGPD por culpa da
          Insighta.
        </li>
      </ul>

      <h2>11. Propriedade e dados agregados</h2>
      <ul>
        <li>O software, a marca e a metodologia de cálculo pertencem à Insighta. Os dados enviados continuam da Clínica.</li>
        <li>
          A Insighta pode usar dados agregados e anonimizados de várias clínicas para gerar comparativos de mercado e
          melhorar a Plataforma. Esses dados nunca identificam uma clínica ou um paciente.
        </li>
        <li>
          A Insighta guarda os registros de acesso à Plataforma por 6 meses, como exige o Marco Civil da Internet (Lei
          12.965/2014, art. 15).
        </li>
      </ul>

      <h2>12. Fim do contrato e dados</h2>
      <ul>
        <li>
          Enquanto a conta existir, e por 90 dias depois do cancelamento, a Clínica pode exportar todos os seus dados em
          Minha clínica.
        </li>
        <li>
          Passados os 90 dias, os dados pessoais dos pacientes são anonimizados. As cópias de segurança que os contêm são
          apagadas no ciclo normal de 14 dias. Ficam guardados só os dados que a lei obriga a manter, pelo prazo legal.
        </li>
      </ul>

      <h2>13. Mudanças nestes Termos</h2>
      <p>
        Mudanças importantes são avisadas por e-mail e no sistema com pelo menos 30 dias de antecedência e pedem novo
        aceite. A Clínica que não concordar pode cancelar sem multa antes da mudança valer.
      </p>

      <h2>14. Lei e foro</h2>
      <p>
        Vale a lei brasileira. Fica eleito o foro da comarca de {COMPANY.forumCity} para resolver qualquer questão sobre
        este contrato.
      </p>

      <h2>15. Contato</h2>
      <p>
        Suporte pela Central de Ajuda do sistema. Assuntos de privacidade: {COMPANY.dpoName}, {COMPANY.dpoEmail}.
      </p>
    </LegalDocumentLayout>
  );
}
