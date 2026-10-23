import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SelectField, TextareaField, TextField } from "@/components/ui/FormField";
import { Panel } from "@/components/ui/Panel";
import { getApiErrorMessage } from "@/lib/query-client";
import { platformApiClient, type SourceProfile } from "@/lib/platform-api-client";

const KEY = ["platform", "source-profiles"];

function splitHeaders(line: string): string[] {
  const sep = line.includes(";") ? ";" : line.includes("\t") ? "\t" : ",";
  return line.split(sep).map((h) => h.trim()).filter(Boolean);
}

/** "coluna do arquivo = campo do Insighta", uma por linha. */
function parseMap(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const [k, v] = line.split("=").map((p) => p?.trim());
    if (k && v) out[k] = v;
  }
  return out;
}

/** v1.1: perfis de relatório de origem. Nasce com a 1ª amostra real (o
 * cabeçalho exato do arquivo exportado) e só vale na importação depois de 3
 * amostras distintas. Nenhum perfil vem pronto: sem amostra, sem perfil. */
export function PlatformSourceProfilesPanel() {
  const queryClient = useQueryClient();
  const profiles = useQuery({ queryKey: KEY, queryFn: platformApiClient.getSourceProfiles });
  const [vendor, setVendor] = useState("");
  const [report, setReport] = useState("");
  const [dataType, setDataType] = useState("faturamento");
  const [headerLine, setHeaderLine] = useState("");
  const [mapText, setMapText] = useState("");
  const [steps, setSteps] = useState("");
  const [sampleFor, setSampleFor] = useState<SourceProfile | null>(null);
  const [sampleLine, setSampleLine] = useState("");
  const onRows = (rows: SourceProfile[]) => queryClient.setQueryData(KEY, rows);

  const create = useMutation({
    mutationFn: () =>
      platformApiClient.createSourceProfile({
        vendor, report_name: report, data_type: dataType, headers: splitHeaders(headerLine), column_map: parseMap(mapText),
        export_steps: steps.trim() || null,
      }),
    onSuccess: (rows) => {
      onRows(rows);
      setVendor(""); setReport(""); setHeaderLine(""); setMapText(""); setSteps("");
    },
  });
  const addSample = useMutation({
    mutationFn: () => platformApiClient.addSourceProfileSample(sampleFor!.id, splitHeaders(sampleLine)),
    onSuccess: (rows) => {
      onRows(rows);
      setSampleFor(null);
      setSampleLine("");
    },
  });
  const validate = useMutation({ mutationFn: (id: string) => platformApiClient.validateSourceProfile(id), onSuccess: onRows });
  const error = create.error ?? addSample.error ?? validate.error;

  return (
    <Panel title="Perfis de relatório de origem" subtitle="Reconhecem o relatório pelo cabeçalho. Valem só com 3 amostras reais distintas.">
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          create.mutate();
        }}
        className="grid gap-x-3 sm:grid-cols-3"
      >
        <TextField label="Sistema" required value={vendor} onChange={(e) => setVendor(e.target.value)} />
        <TextField label="Relatório" required value={report} onChange={(e) => setReport(e.target.value)} />
        <SelectField label="Tipo" value={dataType} onChange={(e) => setDataType(e.target.value)}>
          {["faturamento", "agenda", "atendimento", "estoque", "pep"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </SelectField>
        <div className="sm:col-span-3">
          <TextField label="Cabeçalho da 1ª amostra (linha exata do arquivo)" required value={headerLine} onChange={(e) => setHeaderLine(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <TextareaField label="Mapeamento (coluna = campo, uma por linha)" rows={4} value={mapText} onChange={(e) => setMapText(e.target.value)} />
        </div>
        <TextareaField label="Como exportar (opcional)" rows={4} value={steps} onChange={(e) => setSteps(e.target.value)} />
        <div className="sm:col-span-3">
          <Button type="submit" size="sm" disabled={create.isPending}>{create.isPending ? "Criando..." : "Criar rascunho"}</Button>
        </div>
      </form>
      {error && (
        <div role="alert" className="mt-3 rounded-md border border-denied/25 bg-denied-bg px-3 py-2 text-xs text-denied">
          {getApiErrorMessage(error)}
        </div>
      )}
      {(profiles.data ?? []).length > 0 && (
        <ul className="mt-4 divide-y divide-border-hairline">
          {profiles.data!.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div>
                <span className="font-medium text-ink">{p.vendor} · {p.report_name}</span>{" "}
                <span className="text-xs text-ink-faint">({p.data_type}, {p.columns} colunas)</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={p.status === "validado" ? "revenue" : "neutral"}>
                  {p.status === "validado" ? "Validado" : `Rascunho · ${p.samples}/3 amostras`}
                </Badge>
                {p.status === "rascunho" && (
                  <>
                    <Button size="xs" variant="secondary" onClick={() => setSampleFor(p)}>Amostra</Button>
                    <Button size="xs" disabled={p.samples < 3 || validate.isPending} onClick={() => validate.mutate(p.id)}>Validar</Button>
                  </>
                )}
              </div>
              {sampleFor?.id === p.id && (
                <form
                  className="flex w-full flex-wrap items-end gap-2"
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    addSample.mutate();
                  }}
                >
                  <div className="min-w-[260px] flex-1">
                    <TextField label="Cabeçalho de outra exportação real" required value={sampleLine} onChange={(e) => setSampleLine(e.target.value)} />
                  </div>
                  <Button type="submit" size="sm" className="mb-4" disabled={addSample.isPending}>Adicionar</Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
