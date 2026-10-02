import { cn } from "@/lib/cn";
import { passwordProblem } from "@/lib/password";

/**
 * Medidor de força de senha. O que bloqueia o envio é `passwordProblem`
 * (lib/password.ts), a mesma regra de validate_password_strength no
 * backend — o medidor mostra esse problema em vermelho, e só quando a
 * senha já é aceita mostra o rótulo qualitativo (Razoável/Boa/Forte).
 *
 * 4 segmentos — número exato de barras do medidor no canvas de design
 * (ver ResetPassword.dc.html): 1 ponto-base por ser aceita + até 3 de bônus.
 */
const BONUS_RULES: Array<(p: string) => boolean> = [
  (p) => /[a-z]/.test(p) && /[A-Z]/.test(p),
  (p) => /\d/.test(p),
  (p) => /[^\w\s]/.test(p),
];

export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;

  const problem = passwordProblem(password);
  const score = problem ? 0 : 1 + BONUS_RULES.filter((rule) => rule(password)).length;

  const barColor = problem ? "bg-denied" : score <= 1 ? "bg-pending" : score === 2 ? "bg-accent" : "bg-revenue";
  const label = score <= 1 ? "Razoável" : score === 2 ? "Boa" : "Forte";

  return (
    <div className="mb-4 -mt-2.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-[3px] flex-1 rounded-full transition-colors", i < score ? barColor : "bg-border-subtle")} />
        ))}
      </div>
      <p className={cn("mt-1.5 text-2xs", problem ? "text-denied" : "text-ink-faint")}>{problem ?? `Força da senha: ${label}`}</p>
    </div>
  );
}
