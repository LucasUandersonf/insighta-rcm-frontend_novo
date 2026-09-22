import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * Layout compartilhado das duas páginas públicas de texto jurídico
 * (Termos de Uso, Política de Privacidade) — LGPD ("vamos chegar a
 * 9.5", épico de Termo de Uso/Política de Privacidade real). Diferente
 * de AuthLayout (pensado para um formulário curto, centralizado): aqui o
 * conteúdo é longo e precisa de largura de leitura confortável (~70ch),
 * não do layout de duas colunas de marketing+form.
 *
 * Sem AppShell (sidebar/topbar) de propósito — estas rotas são públicas,
 * acessíveis sem login (link no rodapé do cadastro e do próprio produto),
 * mesmo espírito de SatisfactionRatingPage.tsx.
 */
export function LegalDocumentLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas-surface">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Link
          to="/signup"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft aria-hidden size={14} />
          Voltar ao cadastro
        </Link>

        <header className="mb-8 border-b border-border-hairline pb-6">
          <h1 className="font-serif text-2xl font-medium text-ink sm:text-3xl">{title}</h1>
          <p className="mt-2 text-xs text-ink-faint">Última atualização: {lastUpdated}</p>
        </header>

        {/* Enquanto os campos "[PENDENTE — jurídico/negócio]" abaixo (razão
            social, CNPJ, contato do encarregado) não forem preenchidos por
            uma revisão jurídica de verdade, este aviso deixa claro que o
            documento ainda é um rascunho técnico — nunca esconder isso do
            leitor, mesmo padrão de honestidade do resto da documentação de
            LGPD do projeto (LGPD_TRATAMENTO_DE_DADOS.md). */}
        <div className="mb-8 rounded-lg border border-accent/25 bg-accent-bg px-4 py-3 text-xs text-ink-muted">
          Este documento está em revisão jurídica e ainda não é a versão final. Trechos marcados{" "}
          <span className="font-medium text-ink">[PENDENTE]</span> aguardam confirmação do time jurídico da
          Insighta.
        </div>

        <article className="space-y-6 text-sm leading-relaxed text-ink-muted [&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-lg [&_h2]:font-medium [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-ink [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-ink [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2">
          {children}
        </article>

        <footer className="mt-12 border-t border-border-hairline pt-6 text-xs text-ink-faint">
          Dúvidas sobre este documento? Fale com a equipe da sua clínica ou, se você é uma clínica avaliando a
          Insighta, entre em contato com nosso time comercial.
        </footer>
      </div>
    </div>
  );
}
