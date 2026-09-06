import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";
import { getApiErrorMessage } from "@/lib/query-client";
import { platformApiClient, storePlatformToken } from "@/lib/platform-api-client";

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { access_token } = await platformApiClient.login(email, password);
      storePlatformToken(access_token);
      navigate("/plataforma", { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm rounded-lg border border-border-default bg-canvas-raised p-6 shadow-elevated">
        <div className="mb-5 flex items-center gap-2">
          <ShieldCheck aria-hidden size={18} className="text-accent" />
          <h1 className="text-sm font-semibold text-ink">Painel interno — Insighta</h1>
        </div>
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
            <div role="alert" className="mb-4 rounded-md border border-denied/25 bg-denied-bg px-3 py-2 text-xs text-denied">
              {error}
            </div>
          )}
          <Button type="submit" disabled={isSubmitting} className="w-full text-center">
            {isSubmitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
