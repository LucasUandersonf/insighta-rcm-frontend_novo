import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
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
  },
});
