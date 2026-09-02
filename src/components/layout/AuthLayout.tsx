import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";
import { AuraPreviewCards } from "@/components/ui/AuraPreviewCards";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface Highlight {
  icon: LucideIcon;
  text: string;
}

/**
 * Casca compartilhada das telas PÚBLICAS (login, cadastro, esqueci/
 * redefinir senha) — painel de marca à esquerda (some no mobile) +
 * card de vidro com o formulário à direita. Extraído para as 4 telas
 * nunca divergirem visualmente por engano (era só o LoginPage antes;
 * agora cadastro/recuperação de senha herdam o mesmo tratamento
 * "Aura Glass", ver DECISÃO v3 em index.css).
 */
export function AuthLayout({
  headline,
  subheadline,
  highlights,
  children,
}: {
  headline: string;
  subheadline: string;
  highlights?: Highlight[];
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-canvas bg-premium-canvas bg-no-repeat lg:grid-cols-2">
      <div className="absolute right-5 top-5 z-10">
        <ThemeToggle />
      </div>

      {/* Painel de marca — só em telas grandes; editorial, não decorativo:
          reforça em texto o que o produto resolve, com os cards de vidro
          flutuantes como assinatura visual da marca (ver AuraPreviewCards). */}
      <div className="relative hidden overflow-hidden border-r border-border-hairline lg:flex lg:flex-col lg:justify-between lg:p-12">
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
          <BrandMark />
        </motion.div>

        <div className="flex items-center gap-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="max-w-sm">
            <h2 className="font-serif text-3xl font-medium leading-tight tracking-tightest text-ink">{headline}</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">{subheadline}</p>
            {highlights && (
              <div className="mt-8 space-y-3">
                {highlights.map(({ icon: Icon, text }, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.25 + i * 0.08 }}
                    className="flex items-start gap-3 rounded-lg border border-border-hairline bg-glass p-3.5 shadow-card backdrop-blur-xl"
                  >
                    <Icon aria-hidden size={15} className="mt-0.5 shrink-0 text-accent" />
                    <p className="text-xs leading-relaxed text-ink-muted">{text}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          <AuraPreviewCards className="hidden xl:block" />
        </div>

        <p className="text-2xs text-ink-faint">© {new Date().getFullYear()} Insighta RCM — Auditoria de Faturamento</p>
      </div>

      {/* Formulário */}
      <div className="flex items-center justify-center px-4 py-16">{children}</div>
    </div>
  );
}

/** Cabeçalho compacto (logo + título), usado dentro de cada card de
 * formulário — some a marca completa no mobile (a AuthLayout já a
 * esconde em telas grandes) e mostra um resumo em telas grandes. */
export function AuthFormHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <div className="mb-8 text-center lg:hidden">
        <div className="mb-3 flex justify-center">
          <BrandMark size="sm" />
        </div>
      </div>
      <div className="mb-6">
        <h1 className="font-serif text-xl font-medium tracking-tightest text-ink">{title}</h1>
        <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
      </div>
    </>
  );
}
