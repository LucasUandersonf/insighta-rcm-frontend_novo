import { ApiError } from "@/lib/api-client";

/** A pessoa viu o aviso e preferiu não continuar: não é erro para mostrar. */
export class ConfirmationDeclined extends Error {
  constructor() {
    super("Ação cancelada.");
    this.name = "ConfirmationDeclined";
  }
}

/**
 * Auditoria V1, rodada 5: algumas ações são válidas, mas pedem um "tem
 * certeza?" com o motivo — recadastrar quem pediu eliminação (M7), encaixe
 * num horário ocupado (M3). A API responde 409 com `confirm_field`; aqui a
 * mensagem é mostrada e, se a pessoa confirmar, a chamada é refeita com o
 * campo de confirmação.
 */
export async function withConfirmation<T>(
  run: (confirmation: Record<string, boolean>) => Promise<T>,
  ask: (message: string) => boolean = (message) => window.confirm(message),
): Promise<T> {
  try {
    return await run({});
  } catch (err) {
    if (err instanceof ApiError && err.status === 409 && err.confirmField) {
      if (ask(`${err.message}\n\nDeseja continuar mesmo assim?`)) {
        return run({ [err.confirmField]: true });
      }
      throw new ConfirmationDeclined();
    }
    throw err;
  }
}
