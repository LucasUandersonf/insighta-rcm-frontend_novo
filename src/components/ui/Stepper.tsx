import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

interface Step {
  id: number;
  label: string;
}

/** Indicador de progresso do cadastro público (SignUpPage) — passos
 * concluídos ganham um check, o passo atual fica em destaque com o
 * degradê de marca (ver DECISÃO v3 em index.css). */
export function Stepper({ steps, current }: { steps: Step[]; current: number }) {
  return (
    <ol className="mb-6 flex items-center gap-2">
      {steps.map((step, index) => {
        const active = step.id === current;
        const done = step.id < current;
        return (
          <li key={step.id} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-2xs font-medium transition-colors",
                done ? "bg-aura-line text-white" : active ? "border-2 border-accent text-accent" : "border border-border-default text-ink-faint"
              )}
            >
              {done ? <Check size={12} strokeWidth={3} /> : step.id}
            </span>
            <span className={cn("hidden text-2xs font-medium sm:block", active || done ? "text-ink" : "text-ink-faint")}>{step.label}</span>
            {index < steps.length - 1 && <span className={cn("h-px flex-1", done ? "bg-aura-2" : "bg-border-default")} />}
          </li>
        );
      })}
    </ol>
  );
}
