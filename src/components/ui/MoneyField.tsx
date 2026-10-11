import { useEffect, useState, type InputHTMLAttributes } from "react";
import { TextField } from "@/components/ui/FormField";
import { cn } from "@/lib/cn";
import { formatMoneyInput, parseMoneyBR } from "@/lib/money";

interface MoneyFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  label: string;
  value: string;
  onValueChange: (text: string) => void;
  /** Erro vindo de fora (ex.: validação do formulário ou da API). */
  error?: string;
  /** Mostra "Vai ser salvo: R$ …" abaixo do campo enquanto o valor é válido. */
  showPreview?: boolean;
}

/**
 * Campo de valor em reais (ver src/lib/money.ts). Texto livre no formato
 * brasileiro, com teclado numérico no celular; ao sair do campo o valor é
 * reescrito como "2.400.000,00" e, enquanto digita, mostra o valor que vai
 * ser gravado — quem digitou um zero a mais vê antes de salvar.
 */
export function MoneyField({
  label,
  value,
  onValueChange,
  error,
  showPreview = true,
  onBlur,
  placeholder = "Ex.: 2.400.000,00",
  ...props
}: MoneyFieldProps) {
  const [touched, setTouched] = useState(false);
  const parsed = value.trim() ? parseMoneyBR(value) : null;
  const ownError = touched && parsed && !parsed.ok ? parsed.error : undefined;

  return (
    <div>
      <TextField
        {...props}
        label={label}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onBlur={(e) => {
          setTouched(true);
          if (parsed?.ok) onValueChange(formatMoneyInput(parsed.value));
          onBlur?.(e);
        }}
        error={error ?? ownError}
      />
      {showPreview && parsed?.ok && !error && (
        <p className="-mt-3 mb-4 text-2xs text-ink-faint" aria-live="polite">
          Vai ser salvo: <span className="font-mono text-ink-muted">R$ {formatMoneyInput(parsed.value)}</span>
        </p>
      )}
    </div>
  );
}

interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  /** Valor atual em reais (0 = vazio). */
  value: number;
  /** Recebe o valor em reais, ou 0 enquanto o texto não for um valor válido. */
  onValueChange: (value: number) => void;
}

/**
 * Versão sem rótulo do MoneyField, para tabelas editáveis (itens de
 * contrato). Guarda o texto digitado e só entrega número quando ele é um
 * valor válido; texto inválido fica com borda vermelha e entrega 0, que o
 * formulário e a API recusam.
 */
export function MoneyInput({ value, onValueChange, className, onBlur, placeholder = "0,00", ...props }: MoneyInputProps) {
  const [text, setText] = useState(() => (value ? formatMoneyInput(value) : ""));
  const parsed = text.trim() ? parseMoneyBR(text) : null;
  const invalid = parsed !== null && !parsed.ok;
  const typedValue = parsed?.ok ? parsed.value : 0;
  // O formulário mudou o valor por fora (ex.: limpou a tabela depois de
  // salvar): o texto acompanha. Enquanto a pessoa digita, value === typedValue.
  useEffect(() => {
    if (value !== typedValue) setText(value ? formatMoneyInput(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage ao valor vindo de fora
  }, [value]);
  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      value={text}
      aria-invalid={invalid}
      title={invalid && parsed && !parsed.ok ? parsed.error : props.title}
      className={cn(className, invalid && "border-denied/60")}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        const result = next.trim() ? parseMoneyBR(next) : null;
        onValueChange(result?.ok ? result.value : 0);
      }}
      onBlur={(e) => {
        if (parsed?.ok) setText(formatMoneyInput(parsed.value));
        onBlur?.(e);
      }}
    />
  );
}
