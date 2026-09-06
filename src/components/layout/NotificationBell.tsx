import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Bell } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import { cn } from "@/lib/cn";
import type { Announcement, AnnouncementListResponse } from "@/lib/types";

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "hoje";
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return `${diffDays} dias atrás`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
}

/**
 * Central de Notificações — sino de novidades/changelog da plataforma.
 * Dropdown ancorado (não um <Modal> de tela cheia): é uma lista curta
 * pra consulta rápida, não uma tela própria — mesmo raciocínio que fez
 * o ThemeToggle ser um botão simples em vez de um menu.
 *
 * DECISÃO — marca como lida ITEM A ITEM, ao clicar, não "abrir = lido"
 * -------------------------------------------------------------------
 * Abrir o dropdown e marcar tudo como lido automaticamente esconderia
 * a novidade antes da pessoa realmente ler o corpo do texto. Cada
 * novidade não-lida tem um indicador (ponto de acento) que só some
 * quando o próprio item é clicado — controle explícito do usuário.
 */
export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { showError } = useToast();

  const { data, error } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => apiClient.get<AnnouncementListResponse>("/api/v1/announcements"),
    // Refetch periódico moderado — uma novidade publicada no meio do dia
    // não deveria exigir logout/login pra aparecer, mas também não
    // precisa de tempo real (não é um alerta operacional).
    refetchInterval: 5 * 60 * 1000,
  });

  const markReadMutation = useMutation({
    mutationFn: (announcementId: string) => apiClient.post<void>(`/api/v1/announcements/${announcementId}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["announcements"] }),
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const unreadCount = data?.unread_count ?? 0;
  const items = data?.items ?? [];

  function handleItemClick(item: Announcement) {
    if (!item.is_read) markReadMutation.mutate(item.id);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `Notificações — ${unreadCount} não lida(s)` : "Notificações"}
        aria-expanded={isOpen}
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-canvas-raised/60 text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
      >
        <Bell aria-hidden size={15} strokeWidth={2} />
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold leading-none text-white"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-10 z-30 w-80 rounded-lg border border-border-hairline bg-glass shadow-elevated-lg backdrop-blur-xl"
            role="menu"
          >
            <div className="border-b border-border-hairline px-4 py-3">
              <p className="font-serif text-sm font-medium tracking-premium text-ink">Novidades</p>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {error && <p className="px-4 py-6 text-center text-xs text-ink-faint">{getApiErrorMessage(error)}</p>}
              {!error && items.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-ink-faint">Nenhuma novidade por aqui ainda.</p>
              )}
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className={cn(
                    "flex w-full items-start gap-2.5 border-b border-border-hairline px-4 py-3 text-left transition-colors last:border-0 hover:bg-canvas-raised/60",
                    !item.is_read && "bg-accent-bg/40"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", item.is_read ? "bg-transparent" : "bg-accent")}
                  />
                  <span className="flex-1">
                    <span className="block text-xs font-medium text-ink">{item.title}</span>
                    <span className="mt-0.5 block text-2xs leading-relaxed text-ink-muted">{item.body}</span>
                    <span className="mt-1 block text-[10px] text-ink-faint">{formatRelativeDate(item.published_at)}</span>
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
