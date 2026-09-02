import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

interface FieldWrapperProps {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

function FieldWrapper({ label, htmlFor, error, required, children, className }: FieldWrapperProps) {
  return (
    <div className={cn("mb-4", className)}>
      {label && (
        <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-ink-muted">
          {label}
          {required && <span className="text-denied"> *</span>}
        </label>
      )}
      {children}
      {error && <p className="mt-1 text-2xs text-denied">{error}</p>}
    </div>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function TextField({ label, error, id, className, ...props }: TextFieldProps) {
  const fieldId = id ?? `field-${label}`;
  return (
    <FieldWrapper label={label} htmlFor={fieldId} error={error} required={props.required}>
      <input
        id={fieldId}
        className={cn(
          "w-full rounded-md border bg-canvas-raised px-3 py-2 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-revenue focus:outline-none focus:ring-2 focus:ring-revenue/15",
          error ? "border-denied/50" : "border-border-default",
          className
        )}
        {...props}
      />
    </FieldWrapper>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  className?: string;
}

export function SelectField({ label, error, id, className, children, ...props }: SelectFieldProps) {
  const fieldId = id ?? `field-${label}`;
  return (
    <FieldWrapper label={label} htmlFor={fieldId} error={error} required={props.required} className={className}>
      <div className="relative">
        <select
          id={fieldId}
          className={cn(
            "w-full appearance-none rounded-md border bg-canvas-raised px-3 py-2 pr-8 text-sm text-ink transition-colors focus:border-revenue focus:outline-none focus:ring-2 focus:ring-revenue/15",
            error ? "border-denied/50" : "border-border-default"
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown aria-hidden size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
      </div>
    </FieldWrapper>
  );
}
