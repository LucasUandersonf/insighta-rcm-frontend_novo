import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App";
import { queryClient } from "@/lib/query-client";
import { initMonitoring } from "@/lib/monitoring";

// Fully optional (VITE_SENTRY_DSN) — no-op quando não configurado, ver
// src/lib/monitoring.ts. Disparado uma vez no bootstrap, antes do
// primeiro render, sem bloquear o mount do React.
void initMonitoring();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
