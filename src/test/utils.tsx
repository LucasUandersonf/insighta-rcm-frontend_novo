import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/context/ThemeContext";
import { ToastProvider } from "@/context/ToastContext";

/**
 * Provedores mínimos que a maioria dos componentes/páginas espera achar
 * na árvore (tema, roteador, cache de query, toasts) — sem AuthProvider
 * nem ModalStackProvider, que cada teste monta/mocka como precisar (ver
 * DECISÃO em LoginPage.test.tsx sobre por que AuthContext é mockado, não
 * usado de verdade).
 */
function AllProviders({ children, route = "/" }: { children: ReactNode; route?: string }) {
  // Uma QueryClient NOVA por render — evita um teste "vazar" cache de
  // dado para o próximo (mesmo raciocínio de _TEST_DB_NAME único por
  // execução no backend).
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export function renderWithProviders(ui: ReactElement, options: { route?: string } = {}) {
  return render(ui, { wrapper: ({ children }) => <AllProviders route={options.route}>{children}</AllProviders> });
}
