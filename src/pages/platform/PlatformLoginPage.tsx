import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";
import { getApiErrorMessage } from "@/lib/query-client";
import {
  platformApiClient,
  storePlatformToken,
  type PlatformLoginResponse,
} from "@/lib/platform-api-client";
import { QrCode } from "@/components/ui/QrCode";

/**
 * Deliberadamente SEM a identidade visual de marketing do LoginPage.tsx
 * (marca, ilustrações, "esqueci minha senha") — esta tela não é para
 * cliente nenhum ver. Login individual da equipe Insighta
 * (core.platform_users — ver DECISÃO em app/sql/029_platform_users.sql
 * no backend), nunca linkada de nenhum lugar dentro do produto. Contas
 * são criadas/resetadas via `python -m app.scripts.create_platform_user`
 * — não existe self-signup nem "esqueci minha senha" aqui.
 */
export function PlatformLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Segundo passo (MFA): código do aplicativo, ou cadastro no 1º login.
  const [mfaStep, setMfaStep] = useState<PlatformLoginResponse | null>(null);
  const [code, setCode] = useState("");

  function finish(res: PlatformLoginResponse): boolean {
    if (res.access_token) {
      storePlatformToken(res.access_token);
      navigate("/plataforma", { replace: true });
      return true;
    }
    return false;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await platformApiClient.login(email, password);
      if (!finish(res)) setMfaStep(res);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCode(e: FormEvent) {
    e.preventDefault();
    if (!mfaStep?.mfa_token) return;
    setError(null);
    setIsSubmitting(true);
    try {
      finish(await platformApiClient.loginMfa(mfaStep.mfa_token, code.trim()));
    } catch (err) {
      setError(getApiErrorMessage(err));
      setCode("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm rounded-lg border border-border-default bg-canvas-raised p-6 shadow-elevated">
        <div className="mb-5 flex items-center gap-2">
          <ShieldCheck aria-hidden size={18} className="text-accent" />
          <h1 className="text-sm font-semibold text-ink">
            Painel interno — Insighta
          </h1>
        </div>
        {mfaStep ? (
          <form onSubmit={handleCode}>
            {mfaStep.mfa_setup_required && mfaStep.otpauth_uri ? (
              <div className="mb-4 flex flex-col items-center gap-2 text-center text-xs text-ink-muted">
                <p>
                  O painel exige verificação em duas etapas. Leia o QR code com
                  o Google Authenticator, Microsoft Authenticator ou similar e
                  digite o código gerado.
                </p>
                <QrCode value={mfaStep.otpauth_uri} />
                {mfaStep.mfa_secret && (
                  <p>
                    Sem câmera? Chave:{" "}
                    <code className="break-all text-ink">
                      {mfaStep.mfa_secret}
                    </code>
                  </p>
                )}
              </div>
            ) : (
              <p className="mb-4 text-xs text-ink-muted">
                Digite o código de 6 dígitos do seu aplicativo autenticador.
              </p>
            )}
            <TextField
              label="Código"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            {error && (
              <div
                role="alert"
                className="mb-4 rounded-md border border-denied/25 bg-denied-bg px-3 py-2 text-xs text-denied"
              >
                {error}
              </div>
            )}
            <Button
              type="submit"
              disabled={isSubmitting || code.trim().length < 6}
              className="w-full text-center"
            >
              {isSubmitting ? "Verificando..." : "Verificar"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <TextField
              label="E-mail"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label="Senha"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <div
                role="alert"
                className="mb-4 rounded-md border border-denied/25 bg-denied-bg px-3 py-2 text-xs text-denied"
              >
                {error}
              </div>
            )}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full text-center"
            >
              {isSubmitting ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
