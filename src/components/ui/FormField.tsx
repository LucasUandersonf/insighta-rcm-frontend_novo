import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";

interface FieldWrapperProps {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

function FieldWrapper({ label, htmlFor, error, required, children }: FieldWrapperProps) {
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-ink-muted">
        {label}
        {required && <span className="text-denied"> *</span>}
      </label>
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
        className={`w-full rounded-sm border bg-canvas-raised px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-revenue ${
          error ? "border-denied/50" : "border-border"
        } ${className ?? ""}`}
        {...props}
      />
    </FieldWrapper>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  children: ReactNode;
}

export function SelectField({ label, error, id, className, children, ...props }: SelectFieldProps) {
  const fieldId = id ?? `field-${label}`;
  return (
    <FieldWrapper label={label} htmlFor={fieldId} error={error} required={props.required}>
      <select
        id={fieldId}
        className={`w-full rounded-sm border bg-canvas-raised px-3 py-2 text-sm text-ink focus:border-revenue ${
          error ? "border-denied/50" : "border-border"
        } ${className ?? ""}`}
        {...props}
      >
        {children}
      </select>
    </FieldWrapper>
  );
}
