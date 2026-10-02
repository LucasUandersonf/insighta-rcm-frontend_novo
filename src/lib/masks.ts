/** Máscara de CNPJ (00.000.000/0000-00), formatada progressivamente
 * enquanto o usuário digita — usada só no cadastro público (SignUpPage),
 * onde o CNPJ ainda não existe em lugar nenhum do sistema. Validação de
 * verdade (14 dígitos) acontece no backend (RegisterRequest.validate_cnpj_format,
 * app/schemas/token.py) — esta função só formata, nunca valida dígito
 * verificador (fora de escopo deste MVP). */
export function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

export function isCompleteCNPJ(value: string): boolean {
  return value.replace(/\D/g, "").length === 14;
}

/** CNPJ com os dois dígitos verificadores corretos (mesma regra do
 * backend, app/schemas/_validators.py). Recusa sequências repetidas. */
export function isValidCNPJ(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;
  const calc = (base: string, weights: number[]) => {
    const rest = base.split("").reduce((sum, d, i) => sum + Number(d) * weights[i], 0) % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = calc(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calc(digits.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digits.endsWith(`${first}${second}`);
}
