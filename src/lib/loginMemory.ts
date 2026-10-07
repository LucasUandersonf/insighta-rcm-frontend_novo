/**
 * UX-26: no primeiro acesso, a tela "Trocar senha temporária" pedia de novo a
 * senha que a pessoa acabou de digitar no login. A senha fica só em memória
 * (nunca em storage), entre o login e essa troca, e é apagada ao ser lida.
 */
let lastPassword: string | null = null;

export function rememberLoginPassword(password: string): void {
  lastPassword = password;
}

export function takeLoginPassword(): string | null {
  const value = lastPassword;
  lastPassword = null;
  return value;
}
