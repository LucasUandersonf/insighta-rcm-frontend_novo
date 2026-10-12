import type { RejectedRow } from "@/lib/types";

// UX2-15: o motivo sozinho ("Data inexistente…") não diz QUAL valor foi
// lido. Mostra o ID da linha e as colunas que combinam com o motivo (data,
// valor, convênio…), como vieram da planilha.
const ID_KEYS = /^(id|id_|.*transa|.*atendimento|.*guia|codigo|cod_)/i;
// Identificador da LINHA (transação, atendimento, guia) vem antes de outros
// "id_" (lote, convênio), que não ajudam a achar a linha na planilha.
const ROW_ID_KEYS = /transa|atendimento|guia/i;
// "(vazio)" só quando o próprio motivo é campo em branco.
const BLANK_REASON = /branco|vazio|obrigat|faltando|ausente/i;
const REASON_KEYS: [RegExp, RegExp][] = [
  [/data|dia|m[eê]s|hor[aá]rio/i, /data|dt_|hora|inicio|fim|nascimento/i],
  [/valor|moeda|R\$/i, /valor|vlr|pre[cç]o|total|pago|glos/i],
  [/conv[eê]nio|plano/i, /conv|plano|operadora/i],
  [/quantidade|n[uú]mero/i, /qtd|quant/i],
];

const isBlank = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

export function valuesRead(row: Pick<RejectedRow, "payload" | "raw_value">): string {
  const payload = row.payload ?? {};
  const reasonText = row.raw_value ?? "";
  // UX3-10: coluna em branco é justamente o valor que causou o erro
  // ("convênio em branco"): aparece como "(vazio)" em vez de sumir.
  const entries = Object.entries(payload)
    .filter(
      ([k, v]) =>
        !isBlank(v) ||
        (BLANK_REASON.test(reasonText) && REASON_KEYS.some(([reasonRe, keyRe]) => reasonRe.test(reasonText) && keyRe.test(k)))
    )
    .map(([k, v]) => [k, isBlank(v) ? "(vazio)" : v] as [string, unknown]);
  const picked: [string, unknown][] = [];
  const idEntry = entries.find(([k]) => ROW_ID_KEYS.test(k)) ?? entries.find(([k]) => ID_KEYS.test(k));
  if (idEntry) picked.push(idEntry);
  const reason = row.raw_value ?? "";
  for (const [reasonRe, keyRe] of REASON_KEYS) {
    if (!reasonRe.test(reason)) continue;
    for (const entry of entries) {
      if (keyRe.test(entry[0]) && !picked.includes(entry)) picked.push(entry);
    }
  }
  if (picked.length <= (idEntry ? 1 : 0)) {
    for (const entry of entries) {
      if (picked.length >= 3) break;
      if (!picked.includes(entry)) picked.push(entry);
    }
  }
  return picked
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(" · ");
}
