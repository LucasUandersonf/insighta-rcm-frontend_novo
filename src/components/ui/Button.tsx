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
      className={`rounded-sm px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${className ?? ""}`}
      {...props}
    />
  );
}
