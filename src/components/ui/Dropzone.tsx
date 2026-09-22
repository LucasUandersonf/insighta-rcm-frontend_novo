import { useId, useState, type DragEvent, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { FileCode2, FileJson2, FileSpreadsheet, FileText, Loader2, UploadCloud } from "lucide-react";
import { cn } from "@/lib/cn";

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
function ExtensionIcon({ name, className }: { name: string; className?: string }) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "csv") return <FileSpreadsheet aria-hidden className={className} />;
  if (ext === "xml") return <FileCode2 aria-hidden className={className} />;
  if (ext === "json") return <FileJson2 aria-hidden className={className} />;
  return <FileText aria-hidden className={className} />;
}

/** Área de arrastar-e-soltar genérica — sem chamada de API embutida; o
 * componente pai decide o que fazer com o arquivo (validar, montar
 * FormData, disparar a mutation). Zero dado embutido, puro comportamento
 * de seleção + apresentação. */
export function Dropzone({ accept, hint, file, onFileSelected, isUploading, disabled }: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputId = useId();

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
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
    // Achado da auditoria de acessibilidade ("UX/acessibilidade vamos chegar
    // a 9.5") — `nested-interactive` do axe-core: a versão anterior usava
    // `<div role="button">` envolvendo um `<input type="file">` nativo
    // (escondido via `hidden`/display:none) — dois elementos interativos
    // aninhados, violação de ARIA independente de o input estar
    // visualmente oculto (a regra olha a estrutura do DOM, não o CSS
    // computado). `<label htmlFor>` é o padrão nativo pra isso: o clique
    // no label já ativa o input sem precisar de onClick/role/tabIndex
    // manuais, e o Enter/Espaço no input focado já abre o seletor de
    // arquivo nativamente — nada disso precisa ser reimplementado à mão.
    // `sr-only` (não `hidden`) mantém o input alcançável por Tab/leitor de
    // tela, só oculto visualmente (o `label` é quem carrega o visual).
    <motion.label
      htmlFor={inputId}
      animate={isDragOver ? { scale: 1.01 } : { scale: 1 }}
      transition={{ duration: 0.15 }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled && !isUploading) setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center justify-center gap-2.5 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors",
        disabled
          ? "cursor-not-allowed border-border-subtle opacity-50"
          : isDragOver
            ? "cursor-pointer border-accent bg-accent-bg"
            : "cursor-pointer border-border-subtle hover:border-accent/40 hover:bg-canvas-raised/50"
      )}
    >
      <input
        id={inputId}
        type="file"
        accept={accept.join(",")}
        className="sr-only"
        onChange={handleInputChange}
        disabled={disabled || isUploading}
        aria-label="Selecionar ou arrastar arquivo para upload"
      />

      {isUploading ? (
        <>
          <Loader2 aria-hidden size={22} className="animate-spin text-accent" />
          <p className="text-sm text-ink">Enviando e processando…</p>
          <p className="text-2xs text-ink-faint">Isso roda de forma síncrona — você recebe o resultado nesta mesma tela.</p>
        </>
      ) : file ? (
        <>
          <ExtensionIcon name={file.name} className="h-7 w-7 text-accent" />
          <p className="text-sm text-ink">{file.name}</p>
          <p className="text-2xs text-ink-faint">{formatBytes(file.size)} — clique para trocar o arquivo</p>
        </>
      ) : (
        <>
          <UploadCloud aria-hidden size={22} className="text-ink-faint" />
          <p className="text-sm text-ink">Arraste o arquivo aqui ou clique para selecionar</p>
          <p className="text-2xs text-ink-faint">{hint}</p>
        </>
      )}
    </motion.label>
  );
}
