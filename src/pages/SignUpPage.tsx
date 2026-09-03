import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Building2, Check, CircleUserRound, IdCard, Lock, Mail, ShieldCheck, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AuthLayout, AuthFormHeader } from "@/components/layout/AuthLayout";
import { AuthTextField } from "@/components/ui/AuthTextField";
import { GoogleSignInButton, isGoogleAuthConfigured } from "@/components/ui/GoogleSignInButton";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";
import { Stepper } from "@/components/ui/Stepper";
import { formatCNPJ, isCompleteCNPJ } from "@/lib/masks";
import type { PlanTier } from "@/lib/types";

/** Estado de navegação vindo do LoginPage quando "Continuar com Google"
 * detecta que ainda não existe conta com aquele e-mail (ver
 * AuthContext.loginWithGoogle: needsRegistration=true) — permite chegar
 * aqui já com nome/e-mail resolvidos, sem pedir pra digitar de novo. */
interface SignUpLocationState {
  googleCredential?: string;
  prefillEmail?: string;
  prefillOwnerName?: string;
}

const STEPS = [
  { id: 1, label: "Sua clínica" },
  { id: 2, label: "Escolha um plano" },
];

const PLANS: { id: PlanTier; name: string; recommended?: boolean; description: string; features: string[] }[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Para validar a Sala de Comando com dado real, sem compromisso grande de início.",
    features: ["1 clínica", "Sala de Comando e Painel completos", "Motor anti-glosa", "Upload manual de faturamento"],
  },
  {
    id: "professional",
    name: "Professional",
    recommended: true,
    description: "Para operar o dia a dia com o ciclo de glosa fechado, ponta a ponta.",
    features: ["Tudo do Starter", "Recurso de Glosa (conformidade ANS)", "Central de Integrações & Webhooks", "Relatório semanal automático"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Para grupos e redes de clínicas com times maiores e governança própria.",
    features: ["Tudo do Professional", "Usuários ilimitados", "Trilha de auditoria avançada", "Suporte prioritário"],
  },
];

const HIGHLIGHTS = [
  { icon: ShieldCheck, text: "Sem cartão de crédito para começar — o plano fica registrado, o pagamento é combinado depois com nosso time." },
];

interface FieldErrors {
  trade_name?: string;
  cnpj?: string;
  owner_name?: string;
  email?: string;
  password?: string;
  passwordConfirm?: string;
}

export function SignUpPage() {
  const { register, registerError, isRegistering, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const googleState = location.state as SignUpLocationState | null;

  const [step, setStep] = useState(1);
  const [tradeName, setTradeName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [planTier, setPlanTier] = useState<PlanTier>("professional");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [googleError, setGoogleError] = useState<string | null>(null);

  // "Continuar com Google" já resolvido (via LoginPage ou pelo próprio
  // botão logo abaixo) — nome/e-mail vêm do Google, senha nem existe
  // mais neste cadastro (ver DECISÃO em RegisterRequest.validate_auth_method
  // no backend: os dois grupos são mutuamente exclusivos).
  const [googleCredential, setGoogleCredential] = useState<string | null>(googleState?.googleCredential ?? null);
  const [googlePrefill, setGooglePrefill] = useState<{ email: string; ownerName: string } | null>(
    googleState?.googleCredential && googleState.prefillEmail
      ? { email: googleState.prefillEmail, ownerName: googleState.prefillOwnerName ?? googleState.prefillEmail }
      : null
  );

  function validateStep1(): boolean {
    const errors: FieldErrors = {};
    if (!tradeName.trim()) errors.trade_name = "Informe o nome da clínica.";
    if (!isCompleteCNPJ(cnpj)) errors.cnpj = "Informe os 14 dígitos do CNPJ.";
    if (!googleCredential) {
      if (!ownerName.trim()) errors.owner_name = "Informe seu nome completo.";
      if (!email.trim()) errors.email = "Informe seu e-mail.";
      if (password.length < 8) errors.password = "A senha precisa ter pelo menos 8 caracteres.";
      if (password !== passwordConfirm) errors.passwordConfirm = "As senhas não coincidem.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleContinue() {
    if (validateStep1()) setStep(2);
  }

  async function handleGoogleCredential(credential: string) {
    setGoogleError(null);
    try {
      const result = await loginWithGoogle(credential);
      if (result.needsRegistration) {
        // Confirma o que já era esperado (é por isso que a pessoa está
        // aqui) — só guarda localmente pra trocar a etapa 1 pela
        // confirmação em vez dos campos de nome/e-mail/senha.
        setGoogleCredential(credential);
        setGooglePrefill({ email: result.email ?? "", ownerName: result.suggestedOwnerName ?? result.email ?? "" });
        return;
      }
      // Já existe conta com este e-mail — isto é LOGIN, não cadastro.
      // tenantSelection (se preciso) e o token (se não) já foram
      // resolvidos pelo AuthContext; /login reconhece esse estado
      // compartilhado sozinho, sem precisar duplicar o seletor de
      // clínica aqui.
      navigate("/login", { replace: true });
    } catch {
      setGoogleError("Não foi possível continuar com esta conta Google. Tente novamente ou use e-mail e senha.");
    }
  }

  function handleChangeGoogleAccount() {
    setGoogleCredential(null);
    setGooglePrefill(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await register(
        googleCredential
          ? { trade_name: tradeName, cnpj, plan_tier: planTier, google_credential: googleCredential }
          : { trade_name: tradeName, cnpj, owner_name: ownerName, email, password, plan_tier: planTier }
      );
      navigate("/", { replace: true });
    } catch {
      // registerError já foi setado pelo contexto — nada a fazer aqui.
    }
  }

  return (
    <AuthLayout
      headline="Comece a fechar o ciclo de glosa da sua clínica"
      subheadline="Cadastre a clínica, escolha um plano e entre direto na Sala de Comando — sem espera de aprovação."
      highlights={HIGHLIGHTS}
    >
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-md">
        <AuthFormHeader title="Criar conta" subtitle="Sua clínica, sua conta de proprietário(a) e o plano — em dois passos" />

        <div className="rounded-xl border border-border-hairline bg-glass p-6 shadow-elevated backdrop-blur-xl">
          <Stepper steps={STEPS} current={step} />

          {step === 1 && (
            <div>
              <AuthTextField
                label="Nome da clínica"
                icon={Building2}
                id="trade_name"
                required
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                error={fieldErrors.trade_name}
                placeholder="Ex: Clínica Vida Plena"
              />
              <AuthTextField
                label="CNPJ"
                icon={IdCard}
                id="cnpj"
                required
                inputMode="numeric"
                value={cnpj}
                onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                error={fieldErrors.cnpj}
                placeholder="00.000.000/0000-00"
              />

              {googleCredential && googlePrefill ? (
                <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-accent/25 bg-accent-bg px-3.5 py-3">
                  <div className="flex items-center gap-2.5">
                    <CircleUserRound aria-hidden size={18} className="shrink-0 text-accent" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{googlePrefill.ownerName}</p>
                      <p className="truncate text-2xs text-ink-faint">{googlePrefill.email} · via Google</p>
                    </div>
                  </div>
                  <button type="button" onClick={handleChangeGoogleAccount} className="shrink-0 text-2xs text-accent hover:underline">
                    Trocar
                  </button>
                </div>
              ) : (
                <>
                  <AuthTextField
                    label="Seu nome completo"
                    icon={User}
                    id="owner_name"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    error={fieldErrors.owner_name}
                    placeholder="Quem vai administrar a conta"
                  />
                  <AuthTextField
                    label="E-mail"
                    icon={Mail}
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={fieldErrors.email}
                    placeholder="voce@clinica.com"
                  />
                  <AuthTextField
                    label="Senha"
                    icon={Lock}
                    id="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    error={fieldErrors.password}
                    placeholder="••••••••"
                  />
                  <PasswordStrengthMeter password={password} />
                  <AuthTextField
                    label="Confirmar senha"
                    icon={Lock}
                    id="passwordConfirm"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    error={fieldErrors.passwordConfirm}
                    placeholder="••••••••"
                  />

                  {isGoogleAuthConfigured && (
                    <>
                      <div className="my-4 flex items-center gap-3 text-2xs text-ink-faint">
                        <div className="h-px flex-1 bg-border-subtle" />
                        ou
                        <div className="h-px flex-1 bg-border-subtle" />
                      </div>
                      <div className="mb-4">
                        <GoogleSignInButton onCredential={handleGoogleCredential} text="signup_with" />
                      </div>
                      {googleError && <p className="mb-4 text-2xs text-denied">{googleError}</p>}
                    </>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={handleContinue}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-aura-line px-3 py-2.5 text-sm font-medium text-white shadow-elevated transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
              >
                Continuar
                <ArrowRight aria-hidden size={14} />
              </button>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit}>
              <div className="space-y-2.5">
                {PLANS.map((plan) => {
                  const selected = planTier === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setPlanTier(plan.id)}
                      className={
                        "w-full rounded-lg border p-3.5 text-left transition-colors " +
                        (selected ? "border-accent bg-accent-bg" : "border-border-default hover:border-border")
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 " +
                              (selected ? "border-accent bg-accent" : "border-border-default")
                            }
                          >
                            {selected && <Check aria-hidden size={10} strokeWidth={3.5} className="text-canvas-surface" />}
                          </span>
                          <span className="text-sm font-medium text-ink">{plan.name}</span>
                        </div>
                        {plan.recommended && (
                          <span className="rounded-full bg-aura-line px-2 py-0.5 text-2xs font-medium text-white">Mais escolhido</span>
                        )}
                      </div>
                      <p className="mt-1.5 pl-6 text-xs text-ink-muted">{plan.description}</p>
                      <ul className="mt-2 space-y-1 pl-6 text-2xs text-ink-faint">
                        {plan.features.map((feature) => (
                          <li key={feature}>• {feature}</li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>

              <p className="mt-4 text-2xs text-ink-faint">
                Sem cartão de crédito agora — o plano escolhido fica registrado na sua conta e nosso time entra em contato para
                combinar a forma de pagamento.
              </p>

              {registerError && (
                <div role="alert" className="mt-4 rounded-md border border-denied/25 bg-denied-bg px-3 py-2 text-xs text-denied">
                  {registerError}
                </div>
              )}

              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 rounded-md border border-border-subtle px-3 py-2.5 text-sm text-ink-muted transition-colors hover:border-border hover:text-ink"
                >
                  <ArrowLeft aria-hidden size={14} />
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={isRegistering}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-aura-line px-3 py-2.5 text-sm font-medium text-white shadow-elevated transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRegistering ? "Criando conta..." : "Criar conta"}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="mt-5 text-center text-sm text-ink-muted">
          Já tem uma conta?{" "}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Entrar
          </Link>
        </p>
      </motion.div>
    </AuthLayout>
  );
}
