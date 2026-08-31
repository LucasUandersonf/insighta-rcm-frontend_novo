import { useRef, useState, type DragEvent, type ChangeEvent } from "react";

interface DropzoneProps {
  /** Extensões aceitas, ex: [".csv", ".xml", ".json"] — vira o atributo `accept` do input nativo. */
  accept: string[];
  /** Rótulo curto do que é esperado (ex: "CSV, XML ou JSON — até 20MB"). */
  hint: string;
  /** Arquivo selecionado atualmente (controlado pelo pai — permite mostrar nome/tamanho e um botão "trocar"). */
  file: File | null;
  onFileSelected: (file: File) => void;
  /** Quando true, mostra estado de envio em andamento (spinner + texto), desabilita nova seleção. */
  isUploading?: boolean;
  disabled?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Ícone discreto por formato — só visual, não afeta a validação (o
// backend é a fonte de verdade sobre o que é aceito).
function extensionIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "csv") return "▤";
  if (ext === "xml") return "﹤﹥";
  if (ext === "json") return "{ }";
  if (ext === "pdf") return "▥";
  return "◆";
}

/** Área de arrastar-e-soltar genérica — sem chamada de API embutida; o
 * componente pai decide o que fazer com o arquivo (validar, montar
 * FormData, disparar a mutation). Zero dado embutido, puro comportamento
 * de seleção + apresentação. */
export function Dropzone({ accept, hint, file, onFileSelected, isUploading, disabled }: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled || isUploading) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onFileSelected(dropped);
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) onFileSelected(selected);
    e.target.value = ""; // permite selecionar o mesmo arquivo de novo depois de um erro
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled && !isUploading) setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && !isUploading && inputRef.current?.click()}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Selecionar ou arrastar arquivo para upload"
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled && !isUploading) inputRef.current?.click();
      }}
      className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
        disabled
          ? "cursor-not-allowed border-border-subtle opacity-50"
          : isDragOver
            ? "cursor-pointer border-accent bg-accent-bg"
            : "cursor-pointer border-border-subtle hover:border-border hover:bg-canvas-raised/40"
      }`}
    >
      <input ref={inputRef} type="file" accept={accept.join(",")} className="hidden" onChange={handleInputChange} disabled={disabled || isUploading} />

      {isUploading ? (
        <>
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden />
          <p className="text-sm text-ink">Enviando e processando…</p>
          <p className="text-2xs text-ink-faint">Isso roda de forma síncrona — você recebe o resultado nesta mesma tela.</p>
        </>
      ) : file ? (
        <>
          <span className="text-2xl text-accent" aria-hidden>
            {extensionIcon(file.name)}
          </span>
          <p className="text-sm text-ink">{file.name}</p>
          <p className="text-2xs text-ink-faint">{formatBytes(file.size)} — clique para trocar o arquivo</p>
        </>
      ) : (
        <>
          <span className="text-2xl text-ink-faint" aria-hidden>
            ⇧
          </span>
          <p className="text-sm text-ink">Arraste o arquivo aqui ou clique para selecionar</p>
          <p className="text-2xs text-ink-faint">{hint}</p>
        </>
      )}
    </div>
  );
}
