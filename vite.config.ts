/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// resolve.alias É NECESSÁRIO aqui, separado do "paths" no tsconfig.json:
// o tsconfig só ensina o TypeScript (checagem de tipos/editor) a entender
// "@/", mas quem resolve o import de verdade em dev/build é o Vite — sem
// isso aqui, todo import "@/..." quebraria em tempo de execução mesmo
// passando na checagem de tipos.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  preview: {
    // Vite bloqueia por padrão Host headers de domínios não reconhecidos
    // (proteção contra DNS rebinding) — sem isso, `vite preview` rejeita
    // as requisições vindas do domínio público do Railway com "Blocked
    // request. This host is not allowed". Sabemos qual é o domínio
    // (Railway serve tudo sob *.up.railway.app), então liberamos esse
    // padrão especificamente, em vez de desligar a proteção por inteiro.
    allowedHosts: [".up.railway.app"],
    // Achado testando a CSP de verdade com um navegador (Playwright,
    // headless): a diretiva frame-ancestors é IGNORADA pelo próprio
    // navegador quando entregue via <meta> no HTML — só funciona como
    // cabeçalho HTTP de verdade (limitação documentada do próprio
    // padrão CSP, não um bug nosso). Como `vite preview` é quem serve
    // a resposta em produção (ver railway.toml), X-Frame-Options aqui
    // é o mecanismo real de proteção contra clickjacking desta parte
    // do sistema — o resto dos cabeçalhos de segurança (que funcionam
    // via <meta> sem problema) continua em index.html.
    headers: {
      "X-Frame-Options": "DENY",
    },
  },
  build: {
    rollupOptions: {
      output: {
        // DECISÃO — divisão do pacote por biblioteca de fornecedor, não
        // só por rota (achado do Laudo de Vistoria Técnica, parecer
        // UX: "quase 1MB, sem divisão por tela" pesa em conexão ruim —
        // realidade de muita clínica pequena no Brasil).
        // ---------------------------------------------------------
        // O code-splitting por ROTA (React.lazy em App.tsx) já separa o
        // código de CADA TELA em seu próprio arquivo — mas todo esse
        // código ainda importava React/Framer Motion/Recharts/Sentry
        // etc. do MESMO chunk vendor gigante, que carregava por inteiro
        // mesmo pra quem só abre a tela de login. Agrupar por biblioteca
        // aqui faz cada vendor virar seu próprio arquivo, cacheável
        // separadamente pelo navegador (framer-motion muda de versão
        // bem menos que o código da aplicação — não faz sentido o
        // usuário rebaixar esse cache a cada deploy).
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-router")) return "vendor-router";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("scheduler")) return "vendor-react";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          // @sentry/react FICA DE FORA de propósito — já é importado
          // dinamicamente (`import("@sentry/react")`) em
          // src/lib/monitoring.ts, só quando VITE_SENTRY_DSN está
          // configurado; forçar aqui só duplicava o mesmo code-split que
          // já existe e gerava um chunk vazio nesta build (sem a
          // variável configurada, o terser já elimina o import inteiro
          // como código morto).
          if (id.includes("lucide-react")) return "vendor-icons";
          return "vendor";
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
