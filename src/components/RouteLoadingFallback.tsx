import { Loader2 } from "lucide-react";

/**
 * Fallback do `<Suspense>` de cada rota lazy-loaded (ver App.tsx/AppShell.tsx)
 * — achado do Laudo de Vistoria Técnica (parecer UX): o pacote crescia
 * sem divisão por tela (quase 1MB), pesado numa conexão ruim (realidade
 * de muita clínica pequena no Brasil). Code-splitting por rota resolve o
 * tamanho; este componente é só o que aparece durante o instante em que
 * o pedaço da tela pedida ainda está baixando.
 *
 * `fullScreen` cobre a página inteira (usado no <Suspense> mais externo,
 * em App.tsx, antes do AppShell sequer montar); sem a prop, ocupa só a
 * área de conteúdo (usado dentro do AppShell, com TopBar/Sidebar já
 * visíveis) — troca de rota nunca deveria "sumir" com a navegação.
 */
export function RouteLoadingFallback({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className={fullScreen ? "flex min-h-screen items-center justify-center bg-canvas" : "flex min-h-[40vh] items-center justify-center"}
    >
      <Loader2 aria-hidden size={20} className="animate-spin text-ink-faint" />
    </div>
  );
}
