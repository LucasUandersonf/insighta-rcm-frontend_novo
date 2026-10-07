import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/context/AuthContext";
import { useCurrentUserProfile } from "@/lib/useCurrentUserProfile";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";
import { ApiError } from "@/lib/api-client";

/**
 * Auditoria de UX (UX-24): a sessão que cai com a tela aberta não leva mais a
 * pessoa para o login (perdendo o que estava digitado). Este aviso pede a
 * senha por cima da tela; depois de entrar, é só clicar de novo em “Salvar”.
 */
export function SessionExpiredDialog() {
  const { reauthRequired, reauthenticate, abandonSession } = useAuth();
  const { data: profile } = useCurrentUserProfile();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!reauthRequired) return null;
  const knownEmail = profile?.email ?? "";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await reauthenticate(knownEmail || email, password);
      if (result === "mfa") abandonSession();
      setPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível entrar. Confira a senha e tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="session-expired-title" className="fixed inset-0 z-[90] flex items-center justify-center bg-canvas-deep/70 px-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border border-border-default bg-canvas-raised p-5 shadow-elevated">
        <h2 id="session-expired-title" className="text-base font-semibold text-ink">
          Sua sessão expirou
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Por segurança, entre de novo para continuar. A tela e o que você digitou continuam aqui — depois é só salvar de novo.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {knownEmail ? (
            <p className="text-sm text-ink">{knownEmail}</p>
          ) : (
            <TextField label="E-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          )}
          <TextField label="Senha" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
          {error && (
            <p role="alert" className="text-xs text-denied">
              {error}
            </p>
          )}
        </div>
        <div className="mt-5 flex justify-between gap-2">
          <Button type="button" variant="ghost" onClick={abandonSession}>
            Sair
          </Button>
          <Button type="submit" disabled={busy || !password}>
            {busy ? "Entrando…" : "Continuar"}
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}
