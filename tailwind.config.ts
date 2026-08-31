import type { Config } from "tailwindcss";

// DECISÃO DE DESIGN — tokens do brief (dashboard de RCM/glosa)
// -----------------------------------------------------------------
// Paleta deliberadamente restrita: fundo NAVY/PETROL profundo + 3 cores
// semânticas (emerald=aprovado/receita, âmbar=pendente de auditoria,
// red=glosado) fazendo TODO o trabalho de comunicação — sem uma 4ª
// cor de "acento" arbitrária por cima. Ações primárias reaproveitam o
// emerald (reforça "isso move receita na direção certa"), não uma cor
// nova sem relação com o domínio.
//
// Passo 2 do rebrand visual: o grafite neutro (#0B0F19/#10141F/#161B2B)
// virou "banco/fundo petrol" — mesmo grau de escuridão, hue deslocado
// pra azul-petróleo (não grafite neutro, não azul genérico de dev tool).
// Nomes dos tokens INTOCADOS — só os valores hex mudaram — porque
// dezenas de arquivos consomem essas classes exatas.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: "#050B14", // fundo — navy/petrol quase preto
          surface: "#0B1420", // cards
          raised: "#132436", // elementos sobre cards (hover, inputs)
          // Camadas adicionais — mesma família tonal, mais profundidade
          // (fundo de página com leve gradiente, e "buracos" — inputs
          // dentro de card, trilhos de tabela) sem introduzir nova cor.
          overlay: "#081019", // véu por trás de modais/gradiente de fundo
          inset: "#04080F", // elementos "afundados" (trilho de progresso, inputs aninhados)
        },
        border: {
          subtle: "#182535", // petrol-tinted, não cinza neutro
          DEFAULT: "#22364B",
          // Borda "fio de cabelo" — separadores premium quase invisíveis
          // (headers de tabela, divisórias finas) em vez do 1px padrão.
          // Levemente tingida de teal pra ficar na mesma família do fundo.
          hairline: "rgba(210, 235, 235, 0.07)",
        },
        ink: {
          DEFAULT: "#F5F7FA", // texto principal — branco gelo
          muted: "#8B93A7", // texto secundário
          // WCAG AA fix: #5B6478 media ~3.1:1 contra canvas.surface/DEFAULT
          // (reprova texto normal, que exige 4.5:1) e era usado em dezenas
          // de lugares como texto visível (captions, timestamps,
          // placeholders, dicas de empty state) — não decoração. #7A8498
          // mede ~4.9:1 sobre canvas.surface e ~5.2:1 sobre canvas.DEFAULT,
          // passa AA com folga e continua visivelmente mais apagado que
          // ink.muted (#8B93A7). Nome do token INTOCADO.
          faint: "#7A8498", // texto terciário / placeholders
        },
        revenue: {
          DEFAULT: "#16C98D", // aprovado / receita / positivo — emerald mais saturado, harmoniza com o navy
          dim: "#0A5C44",
          bg: "rgba(22, 201, 141, 0.1)",
        },
        pending: {
          DEFAULT: "#F5A524", // auditoria pendente — âmbar mais quente
          dim: "#8A5A12",
          bg: "rgba(245, 165, 36, 0.1)",
        },
        denied: {
          DEFAULT: "#EF4444", // glosado
          dim: "#991B1B",
          bg: "rgba(239, 68, 68, 0.1)",
        },
        // Acento premium — NÃO participa do vocabulário semântico de
        // status (isso continua 100% revenue/pending/denied). Usado com
        // moderação em marca, ação primária de destaque e realces
        // editoriais (ex: NarrativeInsight, active-state da sidebar) —
        // um dourado que lê como "gestão financeira de alto nível" e
        // ganhou um pouco mais de brilho pra contrastar com o navy mais
        // escuro, não o azul genérico de dashboard de dev tool.
        accent: {
          DEFAULT: "#D4AF6A",
          dim: "#8A6E3D",
          muted: "#E3CBA0",
          bg: "rgba(212, 175, 106, 0.1)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        // Serifada editorial — reservada para títulos de seção/página e
        // números de destaque em relatórios, dando o peso de "relatório
        // financeiro de alta gestão" sem tirar o Inter do resto da UI
        // (dado tabular continua em sans/mono, que lê melhor em tabela).
        serif: ["\"Fraunces\"", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Roboto Mono", "monospace"],
      },
      borderRadius: {
        DEFAULT: "6px",
        sm: "4px",
        lg: "10px",
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      letterSpacing: {
        premium: "0.02em",
      },
      boxShadow: {
        // Sombras suaves e de baixa opacidade — elevação por profundidade
        // sutil, não o "drop shadow" pesado de dashboard genérico.
        card: "0 1px 2px rgba(0, 0, 0, 0.24), 0 0 0 1px rgba(245, 247, 250, 0.03)",
        elevated: "0 12px 32px -8px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(245, 247, 250, 0.04)",
      },
      backgroundImage: {
        // Fundo de página em camadas — glow de teal sutil no canto
        // superior esquerdo (ecoa o mock "Insighta" de referência) sobre
        // um degradê navy → petrol quase preto nas bordas. Profundidade
        // real, não um "flat fill" de dashboard genérico.
        "premium-canvas":
          "radial-gradient(ellipse 80% 55% at 12% -8%, rgba(45, 212, 191, 0.10), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 0%, rgba(212, 175, 106, 0.05), transparent 60%), linear-gradient(180deg, #0B1420 0%, #050B14 55%, #030609 100%)",
        "accent-line": "linear-gradient(180deg, #D4AF6A, rgba(212, 175, 106, 0))",
      },
    },
  },
  plugins: [],
} satisfies Config;
