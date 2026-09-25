import { useEffect } from "react";

/**
 * Faixa "HOMOLOGAÇÃO" — ver AMBIENTES.md.
 *
 * O ambiente de homologação é uma cópia fiel da produção (mesmo código,
 * mesmo visual). Sem um sinal visível, é fácil alguém testar achando que
 * está no ambiente do cliente — ou pior, o contrário. A faixa só aparece
 * quando o build foi feito com VITE_APP_ENV=homologacao; em produção a
 * variável não existe e o componente não renderiza nada.
 */
export const APP_ENV = (import.meta.env.VITE_APP_ENV as string | undefined)?.trim().toLowerCase() ?? "";

export const isHomologacao = APP_ENV === "homologacao" || APP_ENV === "staging";

export function EnvironmentBanner() {
  useEffect(() => {
    if (isHomologacao && !document.title.startsWith("[HML]")) {
      document.title = `[HML] ${document.title}`;
    }
  }, []);

  if (!isHomologacao) return null;

  return (
    <div
      role="status"
      className="relative z-[60] flex items-center justify-center gap-2 bg-amber-500 px-4 py-1 text-center text-xs font-semibold tracking-wide text-black"
    >
      <span aria-hidden="true">●</span>
      HOMOLOGAÇÃO — ambiente de testes com dados fictícios. Não use dados reais de pacientes.
    </div>
  );
}
