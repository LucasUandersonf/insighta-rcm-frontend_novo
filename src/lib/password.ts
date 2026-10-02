/**
 * Regra única de senha, espelhada do backend
 * (app/core/security.py::validate_password_strength): pelo menos 8
 * caracteres, no máximo 128, uma letra e um número ou símbolo, e nenhuma
 * das senhas mais comuns. Devolve a mensagem do problema ou null.
 */
const COMMON = new Set(
  `12345678 123456789 1234567890 87654321 11111111 00000000 12341234 qwertyui qwerty123
  password password1 password123 senha123 senha1234 mudar123 trocar123 abcd1234 abc12345
  a1b2c3d4 iloveyou admin123 admin1234 administrador welcome1 bemvindo bemvindo1 brasil123
  clinica123 clinica1 insighta insighta1 insighta123 asdf1234 1q2w3e4r 1qaz2wsx q1w2e3r4`.split(/\s+/)
);

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `A senha pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`;
  const hasLetter = /\p{L}/u.test(password);
  const hasOther = /[^\p{L}\s]/u.test(password);
  if (!hasLetter || !hasOther) return "A senha precisa ter pelo menos uma letra e um número ou símbolo.";
  if (COMMON.has(password.toLowerCase()) || new Set(password).size <= 2) return "Essa senha é muito comum e fácil de adivinhar. Escolha outra.";
  return null;
}
