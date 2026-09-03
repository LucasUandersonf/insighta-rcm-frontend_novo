import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Building2, LineChart, Lock, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AuthLayout, AuthFormHeader } from "@/components/layout/AuthLayout";
import { AuthTextField } from "@/components/ui/AuthTextField";
import { GoogleSignInButton, isGoogleAuthConfigured } from "@/components/ui/GoogleSignInButton";

/**
 * Achado F-04 (Auditoria Go-Live): quando o mesmo e-mail bate a senha em
 * mais de um tenant (consultor multi-clínica), o AuthContext preenche
 * `tenantSelection` em vez de autenticar direto — este seletor aparece
 * no lugar do formulário até o usuário escolher a clínica.
 */
function TenantSelector() {
  // Este seletor é compartilhado por login tradicional e login com
  // Google (ver DECISÃO em AuthContext.tsx) — desabilita os botões
  // enquanto QUALQUER um dos dois estiver em andamento.
  const { tenantSelection, selectTenant, cancelTenantSelection, loginError, isLoggingIn, isLoggingInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const isBusy = isLoggingIn || isLoggingInWithGoogle;

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

      <div className="space-y-2 rounded-lg border border-border-hairline bg-glass p-3 shadow-elevated backdrop-blur-xl">
        {tenantSelection?.map((option) => (
          <button
            key={option.tenant_id}
            type="button"
            disabled={isBusy}
            onClick={() => handleSelect(option.tenant_id)}
            className="flex w-full items-center gap-3 rounded-md border border-border-subtle bg-canvas-raised/60 px-4 py-3 text-left text-sm font-medium text-ink transition-colors hover:border-accent/40 hover:bg-accent-bg disabled:cursor-not-allowed disabled:opacity-60"
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
  const { login, loginError, isLoggingIn, loginWithGoogle, tenantSelection } = useAuth();
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

  async function handleGoogleCredential(credential: string) {
    try {
      const result = await loginWithGoogle(credential);
      if (result.needsRegistration) {
        // Ninguém com este e-mail ainda — manda pro cadastro já
        // pré-preenchido (ver SignUpPage.tsx), sem pedir pra digitar
        // nome/e-mail de novo.
        navigate("/signup", { state: { googleCredential: credential, prefillEmail: result.email, prefillOwnerName: result.suggestedOwnerName } });
        return;
      }
      if (!result.requiresTenantSelection) {
        // Login direto — token já emitido pelo contexto.
        navigate("/", { replace: true });
      }
      // Se exigir seleção de clínica, o AuthContext já preencheu
      // tenantSelection e o TenantSelector assume a tela sozinho.
    } catch {
      // loginError já foi setado pelo contexto — nada a fazer aqui.
    }
  }

  return (
    <AuthLayout
      headline="Identifique gargalos financeiros antes que virem glosas."
      subheadline="Diagnósticos automáticos diários de faturamento e risco de glosa."
      highlights={BRAND_HIGHLIGHTS}
    >
      {tenantSelection ? (
        <TenantSelector />
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-sm">
          <AuthFormHeader title="Bem-vindo de volta" subtitle="Entre com as credenciais da sua clínica" />

          <form onSubmit={handleSubmit} className="rounded-xl border border-border-hairline bg-glass p-6 shadow-elevated backdrop-blur-xl">
            <AuthTextField
              label="E-mail"
              icon={Mail}
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@clinica.com"
            />

            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="block text-xs font-medium text-ink-muted">
                Senha
              </label>
              <Link to="/forgot-password" className="text-2xs text-accent hover:underline">
                Esqueceu a senha?
              </Link>
            </div>
            <div className="relative mb-5">
              <Lock aria-hidden size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border-default bg-canvas-raised/60 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
                placeholder="••••••••"
              />
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

            {isGoogleAuthConfigured && (
              <>
                <div className="mb-4 flex items-center gap-3 text-2xs text-ink-faint">
                  <div className="h-px flex-1 bg-border-subtle" />
                  ou
                  <div className="h-px flex-1 bg-border-subtle" />
                </div>
                <div className="mb-4">
                  {/* Padrão "Continuar com o Google" nas duas telas (login e
                      cadastro) — mesma ação, mesma frase, ver guia de estilo. */}
                  <GoogleSignInButton onCredential={handleGoogleCredential} text="continue_with" />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-aura-line px-3 py-2.5 text-sm font-medium text-white shadow-elevated transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
            >
              {isLoggingIn ? "Entrando..." : "Entrar no sistema"}
              {!isLoggingIn && <ArrowRight aria-hidden size={14} />}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-ink-muted">
            Sua clínica ainda não tem conta?{" "}
            <Link to="/signup" className="font-medium text-accent hover:underline">
              Criar conta
            </Link>
          </p>
        </motion.div>
      )}
    </AuthLayout>
  );
}
