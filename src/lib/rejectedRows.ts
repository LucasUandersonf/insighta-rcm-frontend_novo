import type { RejectedRow } from "@/lib/types";

// UX2-15: o motivo sozinho ("Data inexistente…") não diz QUAL valor foi
// lido. Mostra o ID da linha e as colunas que combinam com o motivo (data,
// valor, convênio…), como vieram da planilha.
const ID_KEYS = /^(id|id_|.*transa|.*atendimento|.*guia|codigo|cod_)/i;
const REASON_KEYS: [RegExp, RegExp][] = [
  [/data|dia|m[eê]s|hor[aá]rio/i, /data|dt_|hora|inicio|fim|nascimento/i],
  [/valor|moeda|R\$/i, /valor|vlr|pre[cç]o|total|pago|glos/i],
  [/conv[eê]nio|plano/i, /conv|plano|operadora/i],
  [/quantidade|n[uú]mero/i, /qtd|quant/i],
];

export function valuesRead(row: Pick<RejectedRow, "payload" | "raw_value">): string {
  const payload = row.payload ?? {};
  const entries = Object.entries(payload).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "");
  const picked: [string, unknown][] = [];
  const idEntry = entries.find(([k]) => ID_KEYS.test(k));
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
