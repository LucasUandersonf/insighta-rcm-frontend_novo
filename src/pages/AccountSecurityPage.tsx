import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { Panel, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { apiClient, logoutAllSessionsRequest } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type { MfaStatus } from "@/lib/types";

interface MfaSetup {
  secret: string;
  otpauth_uri: string;
}

/** QR code gerado no próprio navegador (o segredo nunca sai para outro serviço). */
function QrCode({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    import("qrcode")
      .then((mod) => mod.toDataURL(value, { margin: 1, width: 200 }))
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [value]);
  if (!src) return <div className="h-[200px] w-[200px] rounded-md bg-canvas-inset" aria-hidden />;
  return <img src={src} width={200} height={200} alt="QR code para o aplicativo autenticador" className="rounded-md bg-white p-1" />;
}

function CodeField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <input
      id={id}
      inputMode="numeric"
      autoComplete="one-time-code"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="000000"
      className="w-40 rounded-md border border-border-default bg-canvas-raised px-3 py-2 text-center font-mono tracking-[0.25em] text-ink focus:border-accent focus:outline-none"
    />
  );
}

function MfaPanel() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disableCode, setDisableCode] = useState("");

  const { data: status, isLoading, error } = useQuery({
    queryKey: ["mfa-status"],
    queryFn: () => apiClient.get<MfaStatus>("/api/v1/auth/mfa/status"),
  });

  const setupMutation = useMutation({
    mutationFn: () => apiClient.post<MfaSetup>("/api/v1/auth/mfa/setup"),
    onSuccess: (data) => setSetup(data),
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  const enableMutation = useMutation({
    mutationFn: (c: string) => apiClient.post<{ recovery_codes: string[] }>("/api/v1/auth/mfa/enable", { code: c }),
    onSuccess: (data) => {
      setRecoveryCodes(data.recovery_codes);
      setSetup(null);
      setCode("");
      queryClient.invalidateQueries({ queryKey: ["mfa-status"] });
      showSuccess("Verificação em duas etapas ligada.");
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  const disableMutation = useMutation({
    mutationFn: (c: string) => apiClient.post<void>("/api/v1/auth/mfa/disable", { code: c }),
    onSuccess: () => {
      setDisableCode("");
      setRecoveryCodes(null);
      queryClient.invalidateQueries({ queryKey: ["mfa-status"] });
      showSuccess("Verificação em duas etapas desligada.");
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function handleEnable(e: FormEvent) {
    e.preventDefault();
    enableMutation.mutate(code);
  }

  function handleDisable(e: FormEvent) {
    e.preventDefault();
    disableMutation.mutate(disableCode);
  }

  return (
    <Panel title="Verificação em duas etapas">
      <div className="space-y-4 p-4">
        {isLoading && <LoadingState />}
        {error && <ErrorState message={getApiErrorMessage(error)} />}
        {status && (
          <div className="flex items-center gap-2">
            <Badge tone={status.enabled ? "revenue" : "neutral"}>{status.enabled ? "Ligada" : "Desligada"}</Badge>
            {status.enabled && (
              <span className="text-xs text-ink-faint">{status.recovery_codes_left} códigos de recuperação restantes</span>
            )}
          </div>
        )}
        <p className="max-w-xl text-xs leading-relaxed text-ink-faint">
          Além da senha, o login pede um código de 6 dígitos gerado no seu celular (Google Authenticator, Microsoft
          Authenticator, Authy ou 1Password). Recomendado para quem é dono da clínica: mesmo que alguém descubra a
          senha, não entra sem o celular.
        </p>

        {recoveryCodes && (
          <div className="rounded-md border border-pending/30 bg-pending-bg p-4">
            <p className="text-sm font-medium text-ink">Guarde estes códigos de recuperação</p>
            <p className="mt-1 text-xs text-ink-muted">
              Cada um funciona uma vez, no lugar do código do celular. Eles não aparecem de novo: salve num gerenciador de
              senhas ou imprima.
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-sm text-ink sm:grid-cols-4">
              {recoveryCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {status && !status.enabled && !setup && (
          <Button type="button" onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending}>
            <ShieldCheck className="h-4 w-4" aria-hidden />
            {setupMutation.isPending ? "Preparando..." : "Ligar verificação em duas etapas"}
          </Button>
        )}

        {setup && (
          <form onSubmit={handleEnable} className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <QrCode value={setup.otpauth_uri} />
            <div className="space-y-3">
              <ol className="list-decimal space-y-1 pl-4 text-xs text-ink-muted">
                <li>No aplicativo autenticador, toque em adicionar conta e leia o QR code.</li>
                <li>
                  Sem câmera? Digite a chave: <code className="break-all font-mono text-ink">{setup.secret}</code>
                </li>
                <li>Digite abaixo o código de 6 dígitos que aparecer.</li>
              </ol>
              <div className="flex items-center gap-2">
                <label htmlFor="mfa-enable-code" className="sr-only">
                  Código do aplicativo
                </label>
                <CodeField id="mfa-enable-code" value={code} onChange={setCode} />
                <Button type="submit" disabled={enableMutation.isPending || code.trim().length < 6}>
                  {enableMutation.isPending ? "Conferindo..." : "Confirmar"}
                </Button>
              </div>
            </div>
          </form>
        )}

        {status?.enabled && (
          <form onSubmit={handleDisable} className="flex flex-wrap items-center gap-2 border-t border-border-hairline pt-4">
            <label htmlFor="mfa-disable-code" className="text-xs text-ink-muted">
              Para desligar, digite um código do aplicativo (ou de recuperação):
            </label>
            <CodeField id="mfa-disable-code" value={disableCode} onChange={setDisableCode} />
            <Button type="submit" variant="secondary" disabled={disableMutation.isPending || disableCode.trim().length < 6}>
              Desligar
            </Button>
          </form>
        )}
      </div>
    </Panel>
  );
}

function SessionsPanel() {
  const { showSuccess, showError } = useToast();
  const mutation = useMutation({
    mutationFn: () => logoutAllSessionsRequest(),
    onSuccess: (data) =>
      showSuccess(data.revoked_count > 0 ? `${data.revoked_count} sessão(ões) encerrada(s).` : "Nenhuma outra sessão aberta."),
    onError: (err) => showError(getApiErrorMessage(err)),
  });
  return (
    <Panel title="Sessões">
      <div className="space-y-3 p-4">
        <p className="max-w-xl text-xs leading-relaxed text-ink-faint">
          Perdeu o celular ou entrou num computador que não é seu? Encerre todas as sessões: qualquer aparelho conectado
          precisa entrar de novo em até 30 minutos.
        </p>
        <Button type="button" variant="secondary" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          <LogOut className="h-4 w-4" aria-hidden />
          {mutation.isPending ? "Encerrando..." : "Encerrar todas as sessões"}
        </Button>
      </div>
    </Panel>
  );
}

/** Segurança da conta (qualquer papel): MFA e encerrar sessões. */
export function AccountSecurityPage() {
  return (
    <div className="space-y-6">
      <PageHeader icon={KeyRound} title="Segurança da conta" subtitle="Proteja o seu acesso ao Insighta." />
      <div className="space-y-4">
        <MfaPanel />
        <SessionsPanel />
      </div>
    </div>
  );
}
