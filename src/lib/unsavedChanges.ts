import { useCallback, useEffect, useId, useState, useSyncExternalStore } from "react";

/**
 * UX3-17: alteração não salva sumia sem aviso ao sair da tela. Cada
 * formulário diz "tenho alteração" com `useUnsavedChanges`; um único guarda
 * (UnsavedChangesGuard, no AppShell) pergunta antes de sair por um link do
 * sistema ou fechando/recarregando a aba.
 */
const dirty = new Map<string, string>();
const listeners = new Set<() => void>();
let snapshot: string[] = [];

function emit() {
  snapshot = [...dirty.values()];
  listeners.forEach((l) => l());
}

export function setUnsaved(key: string, label: string | null) {
  if (label === null) {
    if (!dirty.delete(key)) return;
  } else {
    if (dirty.get(key) === label) return;
    dirty.set(key, label);
  }
  emit();
}

export function clearAllUnsaved() {
  if (dirty.size === 0) return;
  dirty.clear();
  emit();
}

export function useUnsavedLabels(): string[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshot,
    () => snapshot
  );
}

/** `label` descreve o que se perde ("a meta de faturamento"). */
export function useUnsavedChanges(isDirty: boolean, label: string) {
  const key = useId();
  useEffect(() => {
    setUnsaved(key, isDirty ? label : null);
  }, [key, isDirty, label]);
  useEffect(() => () => setUnsaved(key, null), [key]);
}

/**
 * S5: para formulários sem "valor salvo" para comparar (cadastros em modal,
 * lançamentos). Fica "alterado" na primeira edição dentro do <form> e volta
 * a "limpo" no envio — assim o navigate() de sucesso não esbarra no aviso; se
 * o envio falhar, a próxima edição marca de novo. Fechar o modal desmonta o
 * formulário e o aviso some junto.
 *
 * Uso: `const unsaved = useDirtyOnEdit("o cadastro do convênio", isOpen);` e
 * `<form onChange={unsaved.onChange} onSubmitCapture={unsaved.onSubmit}>`.
 */
export function useDirtyOnEdit(label: string, active = true) {
  const [isDirty, setIsDirty] = useState(false);
  // Modal fechado (Cancelar/X) sem desmontar: descarta a edição junto.
  useEffect(() => {
    if (!active) setIsDirty(false);
  }, [active]);
  useUnsavedChanges(active && isDirty, label);
  const onChange = useCallback(() => setIsDirty(true), []);
  const onSubmit = useCallback(() => setIsDirty(false), []);
  return { isDirty, onChange, onSubmit, markClean: onSubmit };
}
