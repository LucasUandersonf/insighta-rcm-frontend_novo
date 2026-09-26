import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { API_BASE_URL } from "@/lib/api-client";

type ServiceState = "ok" | "atrasado" | "fora" | "desconhecido";
interface SystemStatus {
  api: ServiceState;
  database: ServiceState;
  worker: ServiceState;
  checked_at: string;
}

async function fetchStatus(): Promise<SystemStatus> {
  const resp = await fetch(`${API_BASE_URL}/api/v1/status`);
  if (!resp.ok) throw new Error(String(resp.status));
  return resp.json();
}

const LABEL: Record<ServiceState, string> = {
  ok: "Funcionando",
  atrasado: "Com atraso",
  fora: "Fora do ar",
  desconhecido: "Sem informação",
};
const DOT: Record<ServiceState, string> = {
  ok: "bg-revenue",
  atrasado: "bg-pending",
  fora: "bg-denied",
  desconhecido: "bg-ink-faint",
};

function Row({ name, detail, state }: { name: string; detail: string; state: ServiceState }) {
  return (
    <li className="flex items-center justify-between gap-4 px-5 py-4">
      <div>
        <p className="text-sm font-medium text-ink">{name}</p>
        <p className="text-xs text-ink-faint">{detail}</p>
      </div>
      <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
        <span className={`h-2.5 w-2.5 rounded-full ${DOT[state]}`} aria-hidden />
        {LABEL[state]}
      </span>
    </li>
  );
}

/**
 * Status público (sem login): o sistema abriu, então a tela está no ar; a
 * API, o banco e as rotinas automáticas vêm de GET /status. Atualiza a
 * cada 30 s. Link no rodapé da landing e na central de ajuda.
 */
export function StatusPage() {
  const { data, isError, dataUpdatedAt } = useQuery({
    queryKey: ["public-status"],
    queryFn: fetchStatus,
    refetchInterval: 30_000,
    retry: 1,
  });
  const api: ServiceState = isError ? "fora" : (data?.api ?? "desconhecido");
  const database: ServiceState = isError ? "desconhecido" : (data?.database ?? "desconhecido");
  const worker: ServiceState = isError ? "desconhecido" : (data?.worker ?? "desconhecido");
  const allOk = !isError && api === "ok" && database === "ok" && worker === "ok";

  return (
    <div className="min-h-screen bg-canvas-surface">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <Link to="/login" className="mb-8 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft aria-hidden size={14} />
          Entrar no sistema
        </Link>
        <h1 className="font-serif text-2xl font-medium text-ink sm:text-3xl">Status do Insighta</h1>
        <p className="mt-2 text-sm text-ink-muted" aria-live="polite">
          {data || isError
            ? allOk
              ? "Todos os serviços estão funcionando."
              : "Algum serviço está com problema. Já estamos olhando."
            : "Verificando..."}
        </p>
        <ul className="mt-8 divide-y divide-border-hairline rounded-lg border border-border-hairline bg-canvas-raised">
          <Row name="Sistema (telas)" detail="Esta página abriu, então as telas estão no ar" state="ok" />
          <Row name="API" detail="Login, dados e relatórios" state={api} />
          <Row name="Banco de dados" detail="Onde ficam os dados das clínicas" state={database} />
          <Row name="Rotinas automáticas" detail="Relatórios, alertas, importação de arquivos" state={worker} />
        </ul>
        {dataUpdatedAt > 0 && (
          <p className="mt-4 text-xs text-ink-faint">
            Última verificação: {new Date(dataUpdatedAt).toLocaleTimeString("pt-BR")} · atualiza a cada 30 segundos
          </p>
        )}
      </div>
    </div>
  );
}
