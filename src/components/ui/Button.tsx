import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
}

// DECISÃO — "primary" usa a mesma marca (bg-aura-line) das telas
// públicas de login/cadastro, não mais bg-revenue.
// -------------------------------------------------------------------
// bg-revenue é uma cor SEMÂNTICA de dado financeiro (receita/positivo —
// ver --revenue em index.css e os badges de status "ativo"/"deferido"
// espalhados pelas telas). Usar a mesma cor para "toda ação primária da
// aplicação" confundia as duas linguagens: um botão "Salvar" comum
// parecia estar comunicando um dado financeiro positivo, e o dia em que
// existir uma ação primária dentro de um contexto "negativo" (ex:
// confirmar um cancelamento) o botão ficaria verde por acidente. A
// marca (bg-aura-line, o mesmo gradiente do CTA de login/cadastro) é
// neutra em relação ao dado e é o que o Design System Specialist marca
// como "a cor de ação primária" — bg-revenue continua reservado para
// dado/estado financeiro, nunca para cromar botão.
const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-aura-line text-white shadow-elevated hover:brightness-110",
  secondary: "border border-border-subtle text-ink hover:border-accent/40 hover:bg-canvas-raised/40 bg-transparent",
  ghost: "text-ink-muted hover:text-ink bg-transparent",
};

export function Button({ variant = "primary", className, disabled, ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={`rounded-md px-3 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${variantClasses[variant]} ${className ?? ""}`}
      {...props}
    />
  );
}
