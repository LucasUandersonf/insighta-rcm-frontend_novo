import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
}

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-revenue text-canvas hover:bg-revenue/90",
  secondary: "border border-border-subtle text-ink hover:border-border bg-transparent",
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
