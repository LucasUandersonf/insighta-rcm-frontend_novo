import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * Achado F-04 (Auditoria Go-Live): quando o mesmo e-mail bate a senha em
 * mais de um tenant (consultor multi-clínica), o AuthContext preenche
 * `tenantSelection` em vez de autenticar direto — este seletor aparece
 * no lugar do formulário até o usuário escolher a clínica.
 */
function TenantSelector() {
  const { tenantSelection, selectTenant, cancelTenantSelection, loginError, isLoggingIn } = useAuth();
  const navigate = useNavigate();

  async function handleSelect(tenantId: string) {
    try {
      await selectTenant(tenantId);
      navigate("/", { replace: true });
    } catch {
      // loginError já foi setado pelo contexto — nada a fazer aqui.
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 text-center">
        <h1 className="text-lg font-semibold text-ink">Qual clínica?</h1>
        <p className="mt-1 text-sm text-ink-muted">Seu e-mail está cadastrado em mais de uma clínica. Escolha qual quer acessar.</p>
      </div>

      <div className="space-y-2 rounded border border-border-subtle bg-canvas-surface p-3 shadow-sm">
        {tenantSelection?.map((option) => (
          <button
            key={option.tenant_id}
            type="button"
            disabled={isLoggingIn}
            onClick={() => handleSelect(option.tenant_id)}
            className="w-full rounded-sm border border-border-subtle bg-canvas-raised px-4 py-3 text-left text-sm font-medium text-ink transition-colors hover:border-revenue hover:bg-revenue/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {option.trade_name}
          </button>
        ))}
      </div>

      {loginError && (
        <div role="alert" className="mt-4 rounded-sm border border-denied/30 bg-denied-bg px-3 py-2 text-xs text-denied">
          {loginError}
        </div>
      )}

      <button
        type="button"
        onClick={cancelTenantSelection}
        className="mt-4 w-full text-center text-xs text-ink-faint hover:text-ink-muted"
      >
        Voltar
      </button>
    </div>
  );
}

export function LoginPage() {
  const { login, loginError, isLoggingIn, tenantSelection } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await login(email, password);
      // Se o login exigir seleção de clínica, o AuthContext preenche
      // tenantSelection e este componente troca para o seletor acima —
      // navegar só faz sentido quando o token já foi emitido.
      navigate("/", { replace: true });
    } catch {
      // loginError já foi setado pelo contexto — nada a fazer aqui.
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      {tenantSelection ? (
        <TenantSelector />
      ) : (
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded bg-revenue/10 text-revenue">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18M7 14l4-4 4 4 5-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-ink">Insighta RCM</h1>
            <p className="mt-1 text-sm text-ink-muted">Entre com as credenciais da sua clínica</p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded border border-border-subtle bg-canvas-surface p-6 shadow-sm"
          >
            <div className="mb-4">
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-ink-muted">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-sm border border-border bg-canvas-raised px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-revenue"
                placeholder="voce@clinica.com"
              />
            </div>

            <div className="mb-5">
              <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-ink-muted">
                Senha
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-sm border border-border bg-canvas-raised px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-revenue"
                placeholder="••••••••"
              />
            </div>

            {loginError && (
              <div
                role="alert"
                className="mb-4 rounded-sm border border-denied/30 bg-denied-bg px-3 py-2 text-xs text-denied"
              >
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full rounded-sm bg-revenue px-3 py-2 text-sm font-medium text-canvas transition-colors hover:bg-revenue/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingIn ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
