import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  /** Preferência salva pelo usuário — pode ser "system" (segue o SO). */
  mode: ThemeMode;
  /** Tema efetivamente aplicado na tela (nunca "system" — já resolvido). */
  resolvedTheme: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const STORAGE_KEY = "insighta-rcm:theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyThemeClass(theme: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
}

/** Provider de tema claro/escuro/sistema. Aplica a classe `.dark` na
 * raiz do documento (consumida por todo o tailwind.config.ts via
 * `darkMode: "class"`) e persiste a preferência em localStorage —
 * sem flash incorreto no primeiro paint porque o valor inicial já lê
 * do localStorage/SO de forma síncrona (ver useState abaixo). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    return stored ?? "dark";
  });

  const resolvedTheme = mode === "system" ? getSystemTheme() : mode;

  useEffect(() => {
    applyThemeClass(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyThemeClass(getSystemTheme());
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggle = useCallback(() => {
    setMode(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setMode]);

  const value = useMemo(() => ({ mode, resolvedTheme, setMode, toggle }), [mode, resolvedTheme, setMode, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme deve ser usado dentro de <ThemeProvider>");
  return ctx;
}
