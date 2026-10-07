/**
 * UX-26: no primeiro acesso, a tela "Trocar senha temporária" pedia de novo a
 * senha que a pessoa acabou de digitar no login. A senha fica só em memória
 * (nunca em storage), entre o login e essa troca, e é apagada quando a troca termina.
 */
let lastPassword: string | null = null;

export function rememberLoginPassword(password: string): void {
  lastPassword = password;
}

/** Leitura sem apagar (o React pode chamar o inicializador duas vezes). */
export function peekLoginPassword(): string | null {
  return lastPassword;
}

/** Apagada quando a troca termina ou a tela é deixada. */
export function clearLoginPassword(): void {
  lastPassword = null;
}
