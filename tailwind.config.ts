import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

// DECISÃO DE DESIGN — v2 (refactor 2026, "Bento / Tactile Precision")
// -----------------------------------------------------------------
// Migração de hex fixo -> HSL via CSS custom properties (ver
// src/index.css, blocos `:root` e `.dark`). Isso é o que permite o
// tema claro e escuro conviverem SEM duplicar a árvore de componentes:
// cada classe (`bg-canvas-surface`, `text-ink-muted`, `border-denied`…)
// resolve para uma variável diferente dependendo da classe `.dark` no
// <html>. Nomes dos tokens continuam INTOCADOS — só a fonte do valor
// mudou de hex estático pra `hsl(var(--x) / <alpha-value>)`, então
// nenhum arquivo que já consome essas classes precisa mudar.
//
// Paleta continua deliberadamente restrita: fundo neutro (petrol no
// escuro, gelo/branco no claro) + 3 cores semânticas (emerald=receita,
// âmbar=pendente, red=glosado) fazendo todo o trabalho de comunicação,
// mais 1 acento dourado não-semântico para marca/destaque editorial.
function withOpacity(variable: string) {
  return `hsl(var(${variable}) / <alpha-value>)`;
}

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: withOpacity("--canvas"),
          surface: withOpacity("--canvas-surface"),
          raised: withOpacity("--canvas-raised"),
          overlay: withOpacity("--canvas-overlay"),
          inset: withOpacity("--canvas-inset"),
        },
        border: {
          subtle: withOpacity("--border-subtle"),
          DEFAULT: withOpacity("--border-default"),
          hairline: "hsl(var(--border-hairline-base) / var(--border-hairline-alpha))",
        },
        ink: {
          DEFAULT: withOpacity("--ink"),
          muted: withOpacity("--ink-muted"),
          faint: withOpacity("--ink-faint"),
        },
        revenue: {
          DEFAULT: withOpacity("--revenue"),
          dim: withOpacity("--revenue-dim"),
          bg: "hsl(var(--revenue) / var(--tint-alpha))",
        },
        pending: {
          DEFAULT: withOpacity("--pending"),
          dim: withOpacity("--pending-dim"),
          bg: "hsl(var(--pending) / var(--tint-alpha))",
        },
        denied: {
          DEFAULT: withOpacity("--denied"),
          dim: withOpacity("--denied-dim"),
          bg: "hsl(var(--denied) / var(--tint-alpha))",
        },
        accent: {
          DEFAULT: withOpacity("--accent"),
          dim: withOpacity("--accent-dim"),
          muted: withOpacity("--accent-muted"),
          bg: "hsl(var(--accent) / var(--tint-alpha))",
        },
        // Gradiente de marca (céu/índigo/violeta) — ver DECISÃO v3 em
        // index.css. Usado no logo, avatares e nas auras de fundo; nunca
        // para comunicar estado de dado (isso continua sendo trabalho
        // exclusivo de revenue/pending/denied).
        aura: {
          1: withOpacity("--aura-1"),
          2: withOpacity("--aura-2"),
          3: withOpacity("--aura-3"),
        },
        // Superfície "vidro fosco" dos cards — mesma cor de canvas-surface,
        // com a opacidade controlada por --glass-alpha (quase opaca no
        // claro, translúcida no escuro). Combinar sempre com
        // backdrop-blur-xl (ver BentoCard.tsx) para o efeito de vidro.
        glass: "hsl(var(--canvas-surface) / var(--glass-alpha))",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["\"Fraunces\"", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Roboto Mono", "monospace"],
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 2px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 6px)",
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
        // Número "manchete" de KPI em bento cards — grande o bastante
        // pra ser lido a 2 metros de distância, com tracking negativo
        // pra compensar o peso visual em tamanhos display. Clamp exato
        // do canvas de design (22px a 34px, ver Main.dc.html/.kpi-value).
        display: ["clamp(22px, 1.4rem + 1.1vw, 34px)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
      },
      letterSpacing: {
        premium: "0.02em",
        tightest: "-0.03em",
      },
      // Sombras com realce sutil de borda (inset highlight de 1px branco
      // translúcido) — o "efeito vidro" pedido explicitamente: sem ele, o
      // card lê como uma superfície opaca comum; com ele, a borda
      // superior pega uma luz de canto que vende a ideia de painel de
      // vidro sobre um fundo iluminado. Valores exatos do canvas de
      // design (ver Main.dc.html: .card / .card-lg-shadow / .btn-primary).
      boxShadow: {
        card: "0 1px 2px hsl(var(--shadow-tint) / 0.08), 0 0 0 1px hsl(var(--shadow-tint) / 0.03), inset 0 1px 0 hsl(0 0% 100% / 0.05)",
        elevated: "0 16px 40px -12px hsl(var(--shadow-tint) / 0.28), 0 0 0 1px hsl(var(--shadow-tint) / 0.05)",
        "elevated-lg": "0 24px 64px -16px hsl(var(--shadow-tint) / 0.4), 0 0 0 1px hsl(var(--shadow-tint) / 0.06), inset 0 1px 0 hsl(0 0% 100% / 0.06)",
      },
      backgroundImage: {
        // Fundo de página em camadas — três auras de gradiente coloridas
        // (céu/índigo/violeta, ver --aura-1/2/3 em index.css) flutuando
        // sobre um degradê de base neutro. Os stops de opacidade mudam de
        // valor entre claro/escuro via --glow-alpha* (index.css), então a
        // MESMA classe funciona nos dois temas — sutil no claro, vívida
        // no escuro (identidade "Aura Glass", ver DECISÃO v3 em index.css).
        "premium-canvas":
          "radial-gradient(ellipse 65% 50% at 8% -10%, hsl(var(--aura-1) / var(--glow-alpha)), transparent 60%), radial-gradient(ellipse 60% 45% at 100% 0%, hsl(var(--aura-2) / var(--glow-alpha)), transparent 60%), radial-gradient(ellipse 55% 45% at 50% 105%, hsl(var(--aura-3) / var(--glow-alpha-soft)), transparent 65%), linear-gradient(180deg, hsl(var(--canvas-surface)) 0%, hsl(var(--canvas)) 55%, hsl(var(--canvas-deep)) 100%)",
        "accent-line": "linear-gradient(180deg, hsl(var(--accent)), hsl(var(--accent) / 0))",
        // Gradiente de marca sólido — logo, avatares, botão primário em
        // destaque (ex: CTA de cadastro).
        "aura-line": "linear-gradient(135deg, hsl(var(--aura-1)), hsl(var(--aura-2)), hsl(var(--aura-3)))",
        // Texto em gradiente (combinar com bg-clip-text text-transparent)
        // para os números de destaque do KpiCard (prop `gradient`) — nunca
        // cor sólida nesses casos, ver DECISÃO no canvas de design
        // (Main.dc.html: .grad-revenue/.grad-pending/.grad-denied). Usado
        // com parcimônia (só a métrica principal de cada dashboard), não
        // em todo KPI colorido — mesmo critério do canvas.
        "grad-revenue": "linear-gradient(135deg, hsl(150 85% 58%), hsl(var(--revenue)))",
        "grad-pending": "linear-gradient(135deg, hsl(45 95% 62%), hsl(var(--pending)))",
        "grad-denied": "linear-gradient(135deg, hsl(8 92% 68%), hsl(var(--denied)))",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out both",
        shimmer: "shimmer 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
