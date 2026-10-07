import { useState, type FormEvent } from "react";
import { takeLoginPassword } from "@/lib/loginMemory";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { apiClient, applySessionTokens } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useAuth } from "@/context/AuthContext";
import { AuthLayout, AuthFormHeader } from "@/components/layout/AuthLayout";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";
import { passwordProblem } from "@/lib/password";

const INPUT =
  "w-full rounded-md border border-border-default bg-canvas-raised/60 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15";

/**
 * Troca obrigatória da senha temporária (auditoria V1, rodada 3, A2).
 * Quem entra com a senha gerada pelo dono/admin cai aqui antes de qualquer
 * tela — e a API recusa as demais rotas até a troca (ver app/api/deps.py).
 */
export function ChangeTemporaryPasswordPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  // UX-26: a senha temporária acabou de ser digitada no login — não pede de novo.
  const [remembered] = useState(() => takeLoginPassword());
  const [current, setCurrent] = useState(remembered ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const problem = password.length > 0 ? passwordProblem(password) : null;
  const matches = password === confirm;
  const canSubmit =
    current.length > 0 && password.length > 0 && !problem && matches && !saving;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      // A troca encerra as outras sessões e devolve tokens novos para esta.
      const tokens = await apiClient.post<{
        access_token: string;
        refresh_token?: string | null;
      }>("/api/v1/users/me/change-password", {
        current_password: current,
        new_password: password,
      });
      if (tokens?.access_token) applySessionTokens(tokens);
      await queryClient.invalidateQueries({ queryKey: ["users", "me"] });
      navigate("/", { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthLayout
      headline="Crie a sua senha"
      subheadline="A senha que você recebeu é temporária. Escolha uma senha só sua para continuar."
    >
      <div className="w-full max-w-sm">
        <AuthFormHeader
          title="Trocar senha temporária"
          subtitle="Só depois disso o sistema fica liberado"
        />
        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-xl border border-border-hairline bg-glass p-6 shadow-elevated backdrop-blur-xl"
        >
          {!remembered && (
            <Field
              id="current"
              label="Senha temporária"
              value={current}
              onChange={setCurrent}
              autoComplete="current-password"
            />
          )}
          <Field
            id="new"
            label="Nova senha"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <PasswordStrengthMeter password={password} />
          <Field
            id="confirm"
            label="Confirmar nova senha"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
          />
          {confirm.length > 0 && !matches && (
            <p className="text-2xs text-denied">As senhas não coincidem.</p>
          )}
          {problem && password.length >= 8 && (
            <p className="text-2xs text-denied">{problem}</p>
          )}
          {error && (
            <div
              role="alert"
              className="rounded-md border border-denied/25 bg-denied-bg px-3 py-2 text-xs text-denied"
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-[11px] bg-brand px-4 py-2 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar e continuar"}
          </button>
          <button
            type="button"
            onClick={logout}
            className="w-full text-xs text-ink-muted hover:underline"
          >
            Sair
          </button>
        </form>
      </div>
    </AuthLayout>
  );
}

function Field(props: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  return (
    <div>
      <label
        htmlFor={props.id}
        className="mb-1.5 block text-xs font-medium text-ink-muted"
      >
        {props.label}
      </label>
      <div className="relative">
        <Lock
          aria-hidden
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
        />
        <input
          id={props.id}
          type="password"
          required
          autoComplete={props.autoComplete}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className={INPUT}
          placeholder="••••••••"
        />
      </div>
    </div>
  );
}
