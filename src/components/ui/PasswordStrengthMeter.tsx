import { cn } from "@/lib/cn";

/**
 * Medidor de força de senha — só INFORMATIVO. O único requisito que de
 * fato bloqueia o envio é "pelo menos 8 caracteres" (mesma regra
 * validada pelo backend, ver validate_password_strength em
 * app/core/security.py) — os demais critérios (maiúscula/minúscula,
 * número, símbolo) só influenciam o rótulo qualitativo (Fraca/Boa/
 * Forte), nunca impedem o cadastro. Duas listas de regras aqui, uma no
 * backend, mas SEMPRE a mesma regra mínima nas duas — o resto é
 * cosmético de propósito, para nunca divergir do que o backend realmente
 * aceita ou rejeita.
 */
const BONUS_RULES: Array<(p: string) => boolean> = [
  (p) => /[a-z]/.test(p) && /[A-Z]/.test(p),
  (p) => /\d/.test(p),
  (p) => /[^\w\s]/.test(p),
  (p) => p.length >= 12,
];

const MIN_LENGTH = 8;

export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;

  const meetsMinimum = password.length >= MIN_LENGTH;
  const score = meetsMinimum ? 1 + BONUS_RULES.filter((rule) => rule(password)).length : 0;

  const barColor = !meetsMinimum ? "bg-denied" : score <= 2 ? "bg-pending" : score <= 3 ? "bg-accent" : "bg-revenue";
  const label = !meetsMinimum ? "" : score <= 2 ? "Razoável" : score <= 3 ? "Boa" : "Forte";

  return (
    <div className="mb-4 -mt-2.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i < score ? barColor : "bg-border-subtle")} />
        ))}
      </div>
      <p className={cn("mt-1.5 text-2xs", meetsMinimum ? "text-ink-faint" : "text-denied")}>
        {meetsMinimum ? `Força da senha: ${label}` : `Faltam ${MIN_LENGTH - password.length} caractere(s) para o mínimo exigido.`}
      </p>
    </div>
  );
}
