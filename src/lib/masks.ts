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
