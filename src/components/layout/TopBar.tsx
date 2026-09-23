import { useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, Building2, ChevronDown, CircleHelp, LogOut, Menu, Moon, Search, Sun } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useOnboardingTour } from "@/context/OnboardingTourContext";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useCurrentUserProfile } from "@/lib/useCurrentUserProfile";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import {
  ACCOUNT_TOUR_ID,
  ADMIN_NAV_ITEMS,
  MODULES_TOUR_ID,
  MODULE_GROUPS,
  NAV_ITEMS,
  visibleItems,
  type NavItem,
} from "@/lib/navigation";
import type { Tenant } from "@/lib/types";
import { NotificationBell } from "./NotificationBell";
import { HelpCenterModal } from "./HelpCenterModal";

/**
 * DECISÃO — Redesign 2026 ("sem sidebar"), ver canvas de design
 * "Insighta RCM — Redesign 2026":
 *
 *   linha 1: marca, clínica, busca rápida, notificações e avatar;
 *   linha 2: navegação principal + dropdown "Módulos" (a antiga sidebar,
 *            agrupada) + estado do sistema.
 *
 * Configurações da conta (clínica, usuários, integrações/webhooks,
 * destinatários, auditoria), tema, ajuda e sair moram EXCLUSIVAMENTE no
 * menu do avatar — nunca soltos na barra.
 */

type SystemStatus = "checking" | "operational" | "degraded";

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário(a)",
  admin: "Administrador(a)",
  financeiro: "Financeiro",
  atendimento: "Atendimento",
  auditor: "Auditor(a)",
};

const STATUS_CONFIG: Record<SystemStatus, { label: string; dot: string }> = {
  checking: { label: "Verificando conexão…", dot: "bg-ink-faint" },
  operational: { label: "Sistema operacional · dados sincronizados", dot: "bg-revenue" },
  degraded: { label: "Sistema com instabilidade", dot: "bg-denied" },
};

/** Fecha um popover ao clicar fora dele ou apertar Esc. */
function useDismiss(refs: RefObject<HTMLElement>[], isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (refs.some((ref) => ref.current?.contains(target))) return;
      onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [refs, isOpen, onClose]);
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Busca rápida de módulos — digite parte do nome ("glosa", "lotes") e
 * Enter leva direto à tela. ⌘K / Ctrl+K foca o campo de qualquer lugar.
 */
function QuickJump({ items }: { items: NavItem[] }) {
  const navigate = useNavigate();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const matches = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return items.filter((item) => normalize(`${item.label} ${item.description ?? ""}`).includes(q)).slice(0, 6);
  }, [items, query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const refs = useMemo(() => [wrapperRef as RefObject<HTMLElement>], []);
  useDismiss(refs, isOpen, () => setIsOpen(false));

  function go(item: NavItem) {
    navigate(item.to);
    setQuery("");
    setIsOpen(false);
    inputRef.current?.blur();
  }

  const showList = isOpen && query.trim().length > 0;

  return (
    <div ref={wrapperRef} className="relative ml-3 hidden max-w-[520px] flex-1 md:block">
      <label className="flex h-[38px] items-center gap-2.5 rounded-[11px] border border-border-hairline bg-canvas-raised/40 px-3 focus-within:border-accent/50">
        <Search aria-hidden size={15} className="shrink-0 text-accent-muted" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Ir para um módulo"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder="Ir para… (ex.: recurso de glosa, lotes, custos)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, Math.max(matches.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && matches[activeIndex]) {
              e.preventDefault();
              go(matches[activeIndex]);
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-faint"
        />
        <kbd className="shrink-0 rounded-md border border-border-hairline px-1.5 py-0.5 font-sans text-[11px] text-ink-faint">⌘K</kbd>
      </label>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Módulos encontrados"
          className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-border-hairline bg-canvas-overlay p-1.5 shadow-elevated-lg backdrop-blur-2xl"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-3 text-[13px] text-ink-faint">Nenhum módulo com esse nome.</li>
          ) : (
            matches.map((item, index) => (
              <li
                key={item.to}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(item);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex cursor-pointer flex-col gap-0.5 rounded-[10px] px-3 py-2.5",
                  index === activeIndex && "bg-canvas-raised/70"
                )}
              >
                <span className="text-[13px] font-medium text-ink">{item.label}</span>
                {item.description && <span className="text-xs text-ink-muted">{item.description}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function AccountMenu({ onOpenHelp }: { onOpenHelp: () => void }) {
  const { user, logout } = useAuth();
  const { resolvedTheme, toggle } = useTheme();
  const { data: profile } = useCurrentUserProfile();
  const location = useLocation();
  const menuId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const refs = useMemo(() => [buttonRef as RefObject<HTMLElement>, panelRef as RefObject<HTMLElement>], []);
  useDismiss(refs, isOpen, () => setIsOpen(false));

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const adminItems = visibleItems(ADMIN_NAV_ITEMS, user?.role);
  const fullName = profile?.full_name ?? user?.role ?? "?";
  const isDark = resolvedTheme === "dark";
  const itemClass =
    "flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left text-[13px] text-ink transition-colors hover:bg-canvas-raised/70";

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        data-tour-id={ACCOUNT_TOUR_ID}
        aria-label="Conta e configurações"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          "flex h-11 items-center gap-2.5 rounded-xl border pl-1.5 pr-2.5 transition-colors",
          isOpen ? "border-border-default bg-canvas-raised/70" : "border-border-hairline hover:bg-canvas-raised/50"
        )}
      >
        <UserAvatar fullName={fullName} />
        <span className="hidden flex-col items-start leading-tight sm:flex">
          <span className="text-[13px] font-medium text-ink">{profile?.full_name ?? "…"}</span>
          <span className="text-[11px] text-ink-faint">{ROLE_LABELS[user?.role ?? ""] ?? user?.role}</span>
        </span>
        <ChevronDown aria-hidden size={14} className={cn("text-ink-muted transition-transform", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            id={menuId}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-full z-40 mt-2 flex w-[300px] flex-col gap-0.5 rounded-2xl border border-border-hairline bg-canvas-overlay p-2 shadow-elevated-lg backdrop-blur-2xl"
          >
            <div className="mb-1.5 flex items-center gap-3 border-b border-border-hairline px-3 py-3">
              <UserAvatar fullName={fullName} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{profile?.full_name ?? "…"}</p>
                <p className="truncate text-xs text-ink-faint">{profile?.email ?? ROLE_LABELS[user?.role ?? ""]}</p>
              </div>
            </div>

            {adminItems.length > 0 && (
              <>
                <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">Administração</p>
                {adminItems.map((item) => {
                  const Icon = item.icon!;
                  return (
                    <NavLink key={item.to} to={item.to} className={itemClass}>
                      <Icon aria-hidden size={15} className="text-ink-muted" />
                      {item.label}
                    </NavLink>
                  );
                })}
                <span aria-hidden className="mx-1 my-1.5 h-px bg-border-hairline" />
              </>
            )}

            <button type="button" onClick={toggle} className={itemClass}>
              {isDark ? <Moon aria-hidden size={15} className="text-ink-muted" /> : <Sun aria-hidden size={15} className="text-ink-muted" />}
              {isDark ? "Tema escuro" : "Tema claro"}
              <span className="ml-auto text-[11px] text-ink-faint">{isDark ? "Mudar para claro" : "Mudar para escuro"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenHelp();
              }}
              className={itemClass}
            >
              <CircleHelp aria-hidden size={15} className="text-ink-muted" />
              Central de ajuda
            </button>
            <button type="button" onClick={logout} className={cn(itemClass, "text-denied")}>
              <LogOut aria-hidden size={15} />
              Sair
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ModulesPanel({
  id,
  items,
  panelRef,
}: {
  id: string;
  items: NavItem[];
  panelRef: RefObject<HTMLDivElement>;
}) {
  const groups = MODULE_GROUPS.map((group) => ({ ...group, items: items.filter((item) => item.group === group.id) })).filter(
    (group) => group.items.length > 0
  );

  return (
    <motion.div
      ref={panelRef}
      id={id}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.14 }}
      className="absolute inset-x-3 top-full z-40 mt-2 grid max-h-[70vh] grid-cols-1 gap-6 overflow-y-auto rounded-[18px] border border-border-hairline bg-canvas-overlay p-6 shadow-elevated-lg backdrop-blur-2xl sm:grid-cols-2 lg:left-8 lg:right-auto lg:w-[min(1060px,calc(100vw-4rem))] lg:grid-cols-4"
    >
      {groups.map((group) => (
        <nav key={group.id} aria-label={group.label} className="flex flex-col gap-1">
          <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">{group.label}</p>
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn("flex flex-col gap-0.5 rounded-[10px] p-2.5 transition-colors hover:bg-canvas-raised/70", isActive && "bg-brand/15")
              }
            >
              <span className="text-[13px] font-medium text-ink">{item.label}</span>
              {item.description && <span className="text-xs leading-snug text-ink-muted">{item.description}</span>}
            </NavLink>
          ))}
        </nav>
      ))}
    </motion.div>
  );
}

export function TopBar() {
  const { user } = useAuth();
  const { startTour } = useOnboardingTour();
  const location = useLocation();
  const modulesId = useId();
  const [status, setStatus] = useState<SystemStatus>("checking");
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isModulesOpen, setIsModulesOpen] = useState(false);
  const modulesButtonRef = useRef<HTMLButtonElement>(null);
  const modulesPanelRef = useRef<HTMLDivElement>(null);
  const modulesRefs = useMemo(
    () => [modulesButtonRef as RefObject<HTMLElement>, modulesPanelRef as RefObject<HTMLElement>],
    []
  );
  useDismiss(modulesRefs, isModulesOpen, () => setIsModulesOpen(false));

  // Mesma queryKey ["tenant"] de TenantPage.tsx — cache compartilhado.
  const { data: tenant } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => apiClient.get<Tenant>("/api/v1/tenant"),
  });

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL as string;
    fetch(`${apiBase}/health`)
      .then((r) => setStatus(r.ok ? "operational" : "degraded"))
      .catch(() => setStatus("degraded"));
  }, []);

  useEffect(() => {
    setIsModulesOpen(false);
  }, [location.pathname]);

  const primaryItems = visibleItems(
    NAV_ITEMS.filter((item) => item.placement === "primary"),
    user?.role
  );
  const moduleItems = visibleItems(
    NAV_ITEMS.filter((item) => item.placement === "modules"),
    user?.role
  );
  const jumpItems = [...visibleItems(NAV_ITEMS, user?.role), ...visibleItems(ADMIN_NAV_ITEMS, user?.role)];
  const currentModule = moduleItems.find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));

  return (
    <header className="sticky top-0 z-30 border-b border-border-hairline bg-canvas/75 backdrop-blur-[18px]">
      {/* Linha 1 — marca, clínica, busca rápida, notificações e conta */}
      <div className="flex h-16 items-center gap-3 px-4 sm:gap-5 sm:px-8">
        <NavLink to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Insighta RCM — Início">
          <span aria-hidden className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-brand">
            <Activity size={16} strokeWidth={2.4} className="text-white" />
          </span>
          <span className="text-base font-semibold tracking-[-0.01em] text-ink">Insighta RCM</span>
        </NavLink>
        {tenant?.trade_name && (
          <>
            <span aria-hidden className="hidden h-[22px] w-px bg-border-default md:block" />
            <span className="hidden h-9 max-w-[220px] items-center gap-2 rounded-[10px] border border-border-hairline px-3 text-[13px] text-ink md:flex">
              <Building2 aria-hidden size={15} className="shrink-0 text-ink-muted" />
              <span className="truncate">{tenant.trade_name}</span>
            </span>
          </>
        )}

        <QuickJump items={jumpItems} />

        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          <NotificationBell />
          <AccountMenu onOpenHelp={() => setIsHelpOpen(true)} />
        </div>
      </div>

      {/* Linha 2 — navegação principal + Módulos */}
      <div className="relative border-t border-border-hairline">
        <nav aria-label="Navegação principal" className="flex h-14 items-center gap-1 overflow-x-auto px-3 sm:px-7">
          {primaryItems.map((item) => {
            const Icon = item.icon!;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                data-tour-id={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex h-9 shrink-0 items-center gap-2 rounded-[10px] border px-3 text-[13px] font-medium transition-colors",
                    isActive
                      ? "border-accent/35 bg-brand/[0.18] text-ink"
                      : "border-transparent text-ink-muted hover:bg-canvas-raised/60 hover:text-ink"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon aria-hidden size={15} className={isActive ? "text-accent-muted" : undefined} />
                    {item.label}
                  </>
                )}
              </NavLink>
            );
          })}

          {moduleItems.length > 0 && (
            <>
              <span aria-hidden className="mx-1.5 h-5 w-px shrink-0 bg-border-default" />
              <button
                ref={modulesButtonRef}
                type="button"
                data-tour-id={MODULES_TOUR_ID}
                aria-expanded={isModulesOpen}
                aria-controls={modulesId}
                onClick={() => setIsModulesOpen((open) => !open)}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-2 rounded-[10px] border px-3 text-[13px] font-medium transition-colors",
                  currentModule
                    ? "border-accent/35 bg-brand/[0.18] text-ink"
                    : isModulesOpen
                      ? "border-border-default bg-canvas-raised/70 text-ink"
                      : "border-transparent text-ink-muted hover:bg-canvas-raised/60 hover:text-ink"
                )}
              >
                <Menu aria-hidden size={15} />
                Módulos
                {currentModule && (
                  <>
                    <span aria-hidden className="text-ink-faint">/</span>
                    {currentModule.label}
                  </>
                )}
                <ChevronDown aria-hidden size={14} className={cn("transition-transform", isModulesOpen && "rotate-180")} />
              </button>
            </>
          )}

          <span className="ml-auto hidden shrink-0 items-center gap-2 pl-4 text-xs text-ink-faint lg:flex">
            <span aria-hidden className={cn("h-[7px] w-[7px] rounded-full", STATUS_CONFIG[status].dot)} />
            {STATUS_CONFIG[status].label}
          </span>
        </nav>

        <AnimatePresence>
          {isModulesOpen && <ModulesPanel id={modulesId} items={moduleItems} panelRef={modulesPanelRef} />}
        </AnimatePresence>
      </div>

      <HelpCenterModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        onStartTour={() => {
          setIsHelpOpen(false);
          startTour();
        }}
      />
    </header>
  );
}
