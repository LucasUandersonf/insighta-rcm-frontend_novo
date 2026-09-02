import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Building2, LineChart, Lock, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

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
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
      <div className="mb-6 text-center">
        <h1 className="font-serif text-xl font-medium tracking-tightest text-ink">Qual clínica?</h1>
        <p className="mt-1.5 text-sm text-ink-muted">Seu e-mail está cadastrado em mais de uma clínica. Escolha qual quer acessar.</p>
      </div>

      <div className="space-y-2 rounded-lg border border-border-hairline bg-canvas-surface p-3 shadow-elevated">
        {tenantSelection?.map((option) => (
          <button
            key={option.tenant_id}
            type="button"
            disabled={isLoggingIn}
            onClick={() => handleSelect(option.tenant_id)}
            className="flex w-full items-center gap-3 rounded-md border border-border-subtle bg-canvas-raised px-4 py-3 text-left text-sm font-medium text-ink transition-colors hover:border-revenue/40 hover:bg-revenue-bg disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Building2 aria-hidden size={15} className="shrink-0 text-ink-faint" />
            {option.trade_name}
          </button>
        ))}
      </div>

      {loginError && (
        <div role="alert" className="mt-4 rounded-md border border-denied/25 bg-denied-bg px-3 py-2 text-xs text-denied">
          {loginError}
        </div>
      )}

      <button type="button" onClick={cancelTenantSelection} className="mt-4 w-full text-center text-xs text-ink-faint hover:text-ink-muted">
        Voltar
      </button>
    </motion.div>
  );
}

const BRAND_HIGHLIGHTS = [
  { icon: LineChart, text: "Sala de Comando com diagnóstico automático de onde a receita está vazando." },
  { icon: ShieldCheck, text: "Motor anti-glosa audita cada faturamento antes do envio à operadora." },
];

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
    <div className="grid min-h-screen bg-canvas bg-premium-canvas bg-no-repeat lg:grid-cols-2">
      <div className="absolute right-5 top-5 z-10">
        <ThemeToggle />
      </div>

      {/* Painel de marca — só em telas grandes; some no mobile pra não
          empurrar o formulário abaixo da dobra. Editorial, não decorativo:
          reforça em texto o que o produto resolve antes mesmo do login. */}
      <div className="relative hidden overflow-hidden border-r border-border-hairline lg:flex lg:flex-col lg:justify-between lg:p-12">
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }} className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-revenue/10 text-revenue">
            <LineChart size={17} strokeWidth={2.2} />
          </span>
          <span className="font-serif text-lg font-medium tracking-premium text-ink">Insighta RCM</span>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <h2 className="max-w-md font-serif text-3xl font-medium leading-tight tracking-tightest text-ink">
            Onde sua clínica está perdendo dinheiro — antes que a glosa aconteça.
          </h2>
          <div className="mt-8 space-y-4">
            {BRAND_HIGHLIGHTS.map(({ icon: Icon, text }, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}
                className="flex items-start gap-3 rounded-lg border border-border-hairline bg-canvas-surface/70 p-4 shadow-card backdrop-blur-sm"
              >
                <Icon aria-hidden size={16} className="mt-0.5 shrink-0 text-accent" />
                <p className="text-sm leading-relaxed text-ink-muted">{text}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <p className="text-2xs text-ink-faint">© {new Date().getFullYear()} Insighta RCM — Auditoria de Faturamento</p>
      </div>

      {/* Formulário */}
      <div className="flex items-center justify-center px-4 py-16">
        {tenantSelection ? (
          <TenantSelector />
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-sm">
            <div className="mb-8 text-center lg:hidden">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md bg-revenue/10 text-revenue">
                <LineChart size={19} strokeWidth={2.2} />
              </div>
              <h1 className="font-serif text-lg font-medium tracking-premium text-ink">Insighta RCM</h1>
            </div>

            <div className="mb-6 hidden lg:block">
              <h1 className="font-serif text-xl font-medium tracking-tightest text-ink">Bem-vindo de volta</h1>
              <p className="mt-1 text-sm text-ink-muted">Entre com as credenciais da sua clínica</p>
            </div>
            <p className="mb-6 text-sm text-ink-muted lg:hidden">Entre com as credenciais da sua clínica</p>

            <form onSubmit={handleSubmit} className="rounded-lg border border-border-hairline bg-canvas-surface p-6 shadow-elevated">
              <div className="mb-4">
                <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-ink-muted">
                  E-mail
                </label>
                <div className="relative">
                  <Mail aria-hidden size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border border-border-default bg-canvas-raised py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-revenue focus:outline-none focus:ring-2 focus:ring-revenue/15"
                    placeholder="voce@clinica.com"
                  />
                </div>
              </div>

              <div className="mb-5">
                <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-ink-muted">
                  Senha
                </label>
                <div className="relative">
                  <Lock aria-hidden size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md border border-border-default bg-canvas-raised py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-revenue focus:outline-none focus:ring-2 focus:ring-revenue/15"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {loginError && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="alert"
                  className="mb-4 rounded-md border border-denied/25 bg-denied-bg px-3 py-2 text-xs text-denied"
                >
                  {loginError}
                </motion.div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-revenue px-3 py-2.5 text-sm font-medium text-canvas transition-all duration-150 hover:bg-revenue/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
              >
                {isLoggingIn ? "Entrando..." : "Entrar"}
                {!isLoggingIn && <ArrowRight aria-hidden size={14} />}
              </button>
            </form>
          </motion.div>
        )}
      </div>
    </div>
  );
}
