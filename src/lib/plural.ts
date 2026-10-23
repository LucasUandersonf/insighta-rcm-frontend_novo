/** Plural pela contagem ("1 linha", "3 linhas") — UX-34: a interface não
 * mostra mais "linha(s)", "profissional(is)". */
export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;
}

/** Só a palavra, para frases com o número em outro elemento. */
export function word(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}
