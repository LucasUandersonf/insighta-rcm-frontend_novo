import { useMemo, useState } from "react";

export interface WindowOption {
  days: number;
  label: string;
}

export const DEFAULT_WINDOW_OPTIONS: WindowOption[] = [
  { days: 7, label: "Últimos 7 dias" },
  { days: 14, label: "Últimos 14 dias" },
  { days: 30, label: "Últimos 30 dias" },
];

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Janela de período (N dias terminando hoje) compartilhada entre Sala de
 * Comando e Painel — os dois consomem os MESMOS endpoints de
 * /analytics/* (executive-summary, agenda-metrics), então extrair este
 * cálculo evita reimplementar "hoje menos N dias" duas vezes e correndo
 * o risco de um dia divergir sutilmente (ex: um lado usando dias
 * corridos e o outro dias úteis).
 */
export function useDateWindow(initialDays = 7) {
  const [windowDays, setWindowDays] = useState(initialDays);
  // Onda 5 do Plano de Ação, item 17 — "ver um dia específico": o
  // backend já aceita date_from == date_to (qualquer endpoint de
  // /analytics/*), só faltava a UI. Quando preenchido, sobrepõe a
  // janela de N dias — não os dois ao mesmo tempo (senão qual dos dois
  // manda vira ambíguo pro usuário).
  const [singleDay, setSingleDay] = useState<string | null>(null);

  const { dateFrom, dateTo } = useMemo(() => {
    if (singleDay) return { dateFrom: singleDay, dateTo: singleDay };
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (windowDays - 1));
    return { dateFrom: toIsoDate(start), dateTo: toIsoDate(end) };
  }, [windowDays, singleDay]);

  return { windowDays, setWindowDays, singleDay, setSingleDay, dateFrom, dateTo };
}
