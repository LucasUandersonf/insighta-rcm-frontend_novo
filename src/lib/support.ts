/**
 * Contato direto com o suporte, sem nenhuma API paga: link comum do
 * WhatsApp (wa.me) e mailto. Os valores vêm do build
 * (VITE_SUPPORT_WHATSAPP só com dígitos, com DDI: 5511999999999;
 * VITE_SUPPORT_EMAIL). Sem eles, nada aparece, e a Central de Ajuda
 * continua com o formulário "Enviar pergunta", que grava no banco.
 */
export interface SupportContacts {
  whatsappUrl: string | null;
  email: string | null;
}

export function buildSupportContacts(
  whatsapp: string | undefined,
  email: string | undefined,
  message = "Olá! Preciso de ajuda com o Insighta.",
): SupportContacts {
  const digits = (whatsapp ?? "").replace(/\D/g, "");
  const cleanEmail = (email ?? "").trim();
  return {
    whatsappUrl: digits.length >= 10 ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ? cleanEmail : null,
  };
}

export const SUPPORT_CONTACTS = buildSupportContacts(
  import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined,
  import.meta.env.VITE_SUPPORT_EMAIL as string | undefined,
);

export const hasSupportContacts = Boolean(SUPPORT_CONTACTS.whatsappUrl || SUPPORT_CONTACTS.email);
