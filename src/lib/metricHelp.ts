/**
 * Suporte zero: como cada indicador é calculado, em uma frase, pelo nome que
 * aparece na tela. O KpiCard mostra o "i" sozinho quando o rótulo está aqui;
 * para um texto específico, passe `help` direto no card.
 */
export const METRIC_HELP: Record<string, string> = {
  "Total faturado":
    "Soma do valor das guias com data de atendimento no período escolhido, pela planilha de faturamento. A seta compara com o período anterior do mesmo tamanho.",
  "Cobrado abaixo do contrato":
    "Quanto as guias do período foram cobradas abaixo do preço da tabela homologada do convênio (preço do contrato menos o cobrado, só quando o cobrado é menor). Convênio sem tabela homologada fica de fora.",
  "Caixa protegido":
    "Soma do valor das guias que tinham risco de glosa e foram corrigidas antes do envio ao convênio, no período.",
  "Você faturou do que podia":
    "Total faturado dividido pelo total faturado mais o que foi cobrado abaixo do contrato. 100% quer dizer tudo cobrado pelo preço da tabela. Só aparece com pelo menos uma tabela homologada.",
  "Faturamentos travados por risco":
    "Guias ainda não enviadas ao convênio em que uma regra de glosa bateu (CID ausente, procedimento não informado, sem tabela aprovada ou valor acima do contratado).",
  "Faturamentos de alto risco em aberto":
    "Guias ainda não enviadas ao convênio em que uma regra de glosa bateu (CID ausente, procedimento não informado, sem tabela aprovada ou valor acima do contratado).",
  "Prazo médio de recebimento":
    "Média de dias entre o atendimento e o pagamento do convênio, nas guias pagas no período. Depende do valor e da data de recebimento na planilha.",
  "Agenda ocupada":
    "Horários ocupados divididos pelos horários disponíveis dos profissionais no período, pela agenda importada.",
  "Valor salvo por correção automática (nesta página)":
    "Soma do valor corrigido antes do envio nas guias que aparecem nesta página da fila.",
};
