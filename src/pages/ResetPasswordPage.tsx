import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { confirmPasswordReset, ApiError } from "@/lib/api-client";
import { AuthLayout, AuthFormHeader } from "@/components/layout/AuthLayout";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";

// Mesmo padrão de HIGHLIGHTS das outras 3 telas públicas (ver
// LoginPage/SignUpPage/ForgotPasswordPage) — sem isso, o painel de
// marca à esquerda ficava "vazio" nesta tela, quebrando a consistência
// visual do conjunto.
const HIGHLIGHTS = [
  { icon: ShieldCheck, text: "Assim que salva, a nova senha já vale — você entra com ela na sequência, sem precisar de um novo link." },
];

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const passwordsMatch = password.length > 0 && password === passwordConfirm;
  const canSubmit = !!token && password.length >= 8 && passwordsMatch;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await confirmPasswordReset(token, password);
      setDone(true);
    } catch (err) {
      // 400 do backend = "link inválido ou expirado" (ver
      // AuthService.confirm_password_reset) — mensagem já em português,
      // pronta pra mostrar.
      setError(err instanceof ApiError ? err.message : "Não foi possível redefinir a senha. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout headline="Link de redefinição" subheadline="Confira se você abriu o link mais recente enviado por e-mail." highlights={HIGHLIGHTS}>
        <div className="w-full max-w-sm rounded-xl border border-denied/25 bg-denied-bg p-6 text-center shadow-elevated backdrop-blur-xl">
          <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-canvas-surface/70 text-denied">
            <ShieldAlert size={20} strokeWidth={2} />
          </span>
          <h1 className="font-serif text-lg font-medium text-ink">Link inválido</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Este link de redefinição não tem um token válido. Peça um novo link na tela de recuperação de senha.
          </p>
          <Link to="/forgot-password" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
            <ArrowLeft aria-hidden size={14} />
            Solicitar novo link
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout headline="Escolha sua nova senha" subheadline="Uma senha forte protege o faturamento de toda a clínica — capriche." highlights={HIGHLIGHTS}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-sm">
        {done ? (
          <div className="rounded-xl border border-revenue/25 bg-revenue-bg p-6 text-center shadow-elevated backdrop-blur-xl">
            <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-canvas-surface/70 text-revenue">
              <CheckCircle2 size={20} strokeWidth={2} />
            </span>
            <h1 className="font-serif text-lg font-medium text-ink">Senha redefinida</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">Sua senha foi atualizada. Já dá para entrar com ela.</p>
            <button
              type="button"
              onClick={() => navigate("/login", { replace: true })}
              className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-aura-line px-4 py-2 text-sm font-medium text-white shadow-elevated transition-all hover:brightness-110 active:scale-[0.98]"
            >
              Ir para o login
            </button>
          </div>
        ) : (
          <>
            <AuthFormHeader title="Criar nova senha" subtitle="Escolha uma senha forte para proteger a sua conta" />

            <form onSubmit={handleSubmit} className="rounded-xl border border-border-hairline bg-glass p-6 shadow-elevated backdrop-blur-xl">
              <div className="mb-1.5">
                <label htmlFor="password" className="block text-xs font-medium text-ink-muted">
                  Nova senha
                </label>
              </div>
              <div className="relative mb-2">
                <Lock aria-hidden size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-border-default bg-canvas-raised/60 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
                  placeholder="••••••••"
                />
              </div>
              <PasswordStrengthMeter password={password} />

              <div className="mb-1.5">
                <label htmlFor="passwordConfirm" className="block text-xs font-medium text-ink-muted">
                  Confirmar nova senha
                </label>
              </div>
              <div className="relative mb-5">
                <Lock aria-hidden size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  id="passwordConfirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="w-full rounded-md border border-border-default bg-canvas-raised/60 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
                  placeholder="••••••••"
                />
                {passwordConfirm.length > 0 && !passwordsMatch && <p className="mt-1 text-2xs text-denied">As senhas não coincidem.</p>}
              </div>

              {error && (
                <div role="alert" className="mb-4 rounded-md border border-denied/25 bg-denied-bg px-3 py-2 text-xs text-denied">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !canSubmit}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-aura-line px-3 py-2.5 text-sm font-medium text-white shadow-elevated transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Salvando..." : "Salvar nova senha"}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-ink-muted">
              <Link to="/login" className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline">
                <ArrowLeft aria-hidden size={13} />
                Voltar para a tela de login
              </Link>
            </p>
          </>
        )}
      </motion.div>
    </AuthLayout>
  );
}
