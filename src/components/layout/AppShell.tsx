import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useIsAnyModalOpen } from "@/context/ModalStackContext";
import { cn } from "@/lib/cn";

/** Casca comum de toda tela autenticada: TopBar + Sidebar + conteúdo da rota. */
export function AppShell() {
  // Achado F-05 (Auditoria Go-Live): key=pathname reseta o boundary ao
  // trocar de rota — sem isso, um erro travado em /contracts continuaria
  // "preso" mesmo depois do usuário navegar para /appointments, porque
  // o state hasError=true do boundary sobreviveria à troca de children.
  const location = useLocation();

  // Ver DECISÃO em ModalStackContext.tsx: com algum <Modal isOpen> aberto
  // em algum lugar da árvore (renderizado via portal em document.body,
  // fora daqui), desfoca e dessatura o conteúdo real por trás — mesmo
  // tratamento do canvas de design (`.shell{filter:blur(1.5px) saturate(.85)}`
  // em qualquer artboard de modal), não só o escurecimento do scrim.
  const isModalOpen = useIsAnyModalOpen();

  return (
    <div className="min-h-screen bg-canvas bg-premium-canvas bg-no-repeat">
      {/* Link "pular para o conteúdo" — invisível até receber foco de
          teclado (Tab), permite pular TopBar + Sidebar direto para o
          conteúdo principal. Deve ser o primeiro elemento focável da página. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-canvas-raised focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-elevated"
      >
        Pular para o conteúdo
      </a>
      <div className={cn("transition-[filter] duration-200", isModalOpen && "blur-[1.5px] saturate-[0.85]")}>
        <TopBar />
        <div className="flex">
          <Sidebar />
          <main id="main-content" className="mx-auto w-full max-w-[1400px] px-6 py-6">
            <ErrorBoundary scope="route" key={location.pathname}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  );
}
