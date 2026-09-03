import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { requestPasswordReset, ApiError } from "@/lib/api-client";
import { AuthLayout, AuthFormHeader } from "@/components/layout/AuthLayout";
import { AuthTextField } from "@/components/ui/AuthTextField";

// 30 min = mesmo valor de PASSWORD_RESET_TOKEN_EXPIRE_MINUTES no backend
// (app/core/config.py) — nunca hardcodar um número aqui sem checar lá
// primeiro; um texto "mais transparente" que mentisse sobre o prazo real
// seria pior do que a versão vaga de antes.
const HIGHLIGHTS = [
  { icon: ShieldCheck, text: "O link de redefinição expira em 30 minutos e só pode ser usado uma vez." },
];

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      // O backend SEMPRE responde 202 aqui, exista ou não o e-mail (ver
      // DECISÃO em AuthService.request_password_reset — anti-enumeração).
      // "sent" vira true independentemente do resultado real de negócio.
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      // Só chega aqui por falha de rede/servidor de verdade — o backend
      // nunca devolve erro de negócio para este endpoint.
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar o link agora. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      headline="Redefinir sua senha"
      subheadline="Enviaremos um link de redefinição para o seu e-mail corporativo. O link expira em 30 minutos por segurança."
      highlights={HIGHLIGHTS}
    >
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-sm">
        {sent ? (
          <div className="rounded-xl border border-revenue/25 bg-revenue-bg p-6 text-center shadow-elevated backdrop-blur-xl">
            <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-canvas-surface/70 text-revenue">
              <CheckCircle2 size={20} strokeWidth={2.2} />
            </span>
            <h1 className="font-serif text-lg font-medium text-ink">Verifique seu e-mail</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Se <span className="font-medium text-ink">{email}</span> estiver cadastrado, você vai receber um link para
              criar uma nova senha em instantes.
            </p>
            <Link
              to="/login"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
            >
              <ArrowLeft aria-hidden size={14} />
              Voltar para a tela de login
            </Link>
          </div>
        ) : (
          <>
            <AuthFormHeader title="Esqueci minha senha" subtitle="Informe o e-mail da sua conta para receber o link de redefinição" />

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

              {error && (
                <div role="alert" className="mb-4 rounded-md border border-denied/25 bg-denied-bg px-3 py-2 text-xs text-denied">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-aura-line px-3 py-2.5 text-sm font-medium text-white shadow-elevated transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Enviando..." : "Enviar instruções de acesso"}
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
