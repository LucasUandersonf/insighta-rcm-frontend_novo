import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";
import { QrCode } from "@/components/ui/QrCode";
import { getApiErrorMessage } from "@/lib/query-client";
import { partnerApiClient, storePartnerToken, type PartnerLoginResponse } from "@/lib/partner-api-client";

/**
 * Entrada do Insighta Partner (v1.1): escritório de contabilidade ou
 * consultoria que atende várias clínicas. Três passos possíveis: senha,
 * código do autenticador (ou cadastro dele no primeiro acesso) e troca da
 * senha temporária que o Insighta enviou.
 */
export function PartnerLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [mfaStep, setMfaStep] = useState<PartnerLoginResponse | null>(null);
  const [mustChange, setMustChange] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function finish(res: PartnerLoginResponse) {
    if (!res.access_token) {
      setMfaStep(res);
      return;
    }
    storePartnerToken(res.access_token);
    if (res.must_change_password) {
      setMfaStep(null);
      setMustChange(true);
      return;
    }
    navigate("/parceiro", { replace: true });
  }

  async function run(action: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const errorBox = error && (
    <div role="alert" className="mb-4 rounded-md border border-denied/25 bg-denied-bg px-3 py-2 text-xs text-denied">
      {error}
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm rounded-lg border border-border-default bg-canvas-raised p-6 shadow-elevated">
        <div className="mb-1 flex items-center gap-2">
          <Briefcase aria-hidden size={18} className="text-accent" />
          <h1 className="text-sm font-semibold text-ink">Insighta para parceiros</h1>
        </div>
        <p className="mb-5 text-xs text-ink-muted">Contadores e consultorias: todas as clínicas que você atende num lugar só.</p>

        {mustChange ? (
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); void run(async () => {
            const res = await partnerApiClient.changePassword(password, newPassword);
            if (res.access_token) storePartnerToken(res.access_token);
            navigate("/parceiro", { replace: true });
          }); }}>
            <p className="mb-4 text-xs text-ink-muted">Primeiro acesso: troque a senha temporária por uma sua.</p>
            <TextField
              label="Nova senha"
              type="password"
              autoComplete="new-password"
              required
              autoFocus
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            {errorBox}
            <Button type="submit" disabled={busy || newPassword.length < 8} className="w-full text-center">
              {busy ? "Salvando..." : "Salvar e entrar"}
            </Button>
          </form>
        ) : mfaStep ? (
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (mfaStep.mfa_token) void run(async () => {
            try {
              finish(await partnerApiClient.loginMfa(mfaStep.mfa_token!, code.trim()));
            } catch (err) {
              setCode("");
              throw err;
            }
          }); }}>
            {mfaStep.mfa_setup_required && mfaStep.otpauth_uri ? (
              <div className="mb-4 flex flex-col items-center gap-2 text-center text-xs text-ink-muted">
                <p>
                  O acesso de parceiro exige verificação em duas etapas. Leia o QR code com o Google Authenticator,
                  Microsoft Authenticator ou similar e digite o código gerado.
                </p>
                <QrCode value={mfaStep.otpauth_uri} />
                {mfaStep.mfa_secret && (
                  <p>
                    Sem câmera? Chave: <code className="break-all text-ink">{mfaStep.mfa_secret}</code>
                  </p>
                )}
              </div>
            ) : (
              <p className="mb-4 text-xs text-ink-muted">Digite o código de 6 dígitos do seu aplicativo autenticador.</p>
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
            {errorBox}
            <Button type="submit" disabled={busy || code.trim().length < 6} className="w-full text-center">
              {busy ? "Verificando..." : "Verificar"}
            </Button>
          </form>
        ) : (
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); void run(async () => finish(await partnerApiClient.login(email, password))); }}>
            <TextField label="E-mail" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField label="Senha" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            {errorBox}
            <Button type="submit" disabled={busy} className="w-full text-center">
              {busy ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
