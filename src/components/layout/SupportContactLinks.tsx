import { Mail, MessageCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { SUPPORT_CONTACTS, type SupportContacts } from "@/lib/support";

/**
 * Atalhos para falar com uma pessoa do suporte (WhatsApp e e-mail). Usado
 * na Central de Ajuda e embaixo do formulário de login, para quem não
 * consegue entrar. Não renderiza nada quando o suporte não foi configurado.
 */
export function SupportContactLinks({
  variant = "card",
  className,
  contacts = SUPPORT_CONTACTS,
}: {
  variant?: "card" | "inline";
  className?: string;
  contacts?: SupportContacts;
}) {
  const { whatsappUrl, email } = contacts;
  if (!whatsappUrl && !email) return null;

  const linkClass =
    "inline-flex items-center gap-1.5 font-medium text-accent underline-offset-2 hover:underline focus-visible:underline";

  if (variant === "inline") {
    return (
      <p className={cn("text-center text-2xs text-ink-faint", className)}>
        Precisa de ajuda?{" "}
        {whatsappUrl && (
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
            <MessageCircle aria-hidden size={12} /> WhatsApp
          </a>
        )}
        {whatsappUrl && email && <span aria-hidden> · </span>}
        {email && (
          <a href={`mailto:${email}`} className={linkClass}>
            <Mail aria-hidden size={12} /> {email}
          </a>
        )}
      </p>
    );
  }

  return (
    <div className={cn("rounded-md border border-border-subtle bg-canvas-raised/60 px-3.5 py-3", className)}>
      <p className="text-xs font-medium text-ink">Falar com o suporte agora</p>
      <p className="mb-2 text-2xs text-ink-faint">Uma pessoa da equipe Insighta responde em horário comercial.</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {whatsappUrl && (
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
            <MessageCircle aria-hidden size={14} /> Chamar no WhatsApp
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`} className={linkClass}>
            <Mail aria-hidden size={14} /> {email}
          </a>
        )}
      </div>
    </div>
  );
}
