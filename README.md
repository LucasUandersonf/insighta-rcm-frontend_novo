# Insighta — Central de Inteligência de Dados da Operação de Saúde (Frontend)

> **Reposicionamento de produto (21/09/2026): não somos um software de
> RCM — somos dados.** "RCM" descreve um dos domínios de dado que o
> sistema unifica (faturamento, glosa, convênio), não a identidade do
> produto. A Home e a "Sala de Comando" (`ExecutiveOverviewPage.tsx`)
> existem para cruzar, do mesmo paciente/clínica, frentes que
> normalmente vivem em telas isoladas — agenda, CRM (Ficha do
> Paciente), risco de falta/glosa, financeiro e o resultado de cada
> insight ao longo do tempo — e devolver isso como leitura ativa
> (narrativa executiva, fila de prioridade, ação anexada a cada
> indicador), não como um dashboard passivo esperando interpretação.
> Comparativo com a mediana de outras clínicas (efeito de rede que uma
> clínica isolada nunca reproduz sozinha) e previsão de receita são
> parte dessa leitura, não o produto inteiro. Ver o mesmo
> reposicionamento, com mais detalhe técnico, no README do backend
> (`insighta-rcm-backend`).

React + Vite + TypeScript + Tailwind. Conversa com o backend
(`insighta-rcm-backend`) via `VITE_API_BASE_URL`.

## Rodando localmente

```bash
npm install
cp .env.example .env   # já vem apontando para o Railway de produção
npm run dev
```

Abre em `http://localhost:5173`. Como `.env.example` já aponta para o
backend em produção no Railway, você não precisa rodar o backend
localmente para desenvolver o frontend — só copiar o `.env.example` já
funciona.

**Importante**: o backend precisa ter `http://localhost:5173` na lista
de `CORS_ALLOWED_ORIGINS` (já é o valor padrão em
`app/core/config.py` — só confirme que a variável de ambiente
`CORS_ALLOWED_ORIGINS` no Railway não sobrescreveu isso removendo o
localhost).

## Estrutura

```
src/
├── lib/
│   ├── api-client.ts   # fetch tipado, injeta JWT, parseia o envelope
│   │                     de erro do backend ({error_code, message, request_id})
│   ├── jwt.ts          # decodifica payload do JWT no navegador (sem validar
│   │                     assinatura — só para exibir info na UI)
│   └── types.ts        # tipos espelhando os schemas Pydantic do backend
├── context/
│   └── AuthContext.tsx # estado de sessão (login/logout/usuário atual)
├── routes/
│   └── ProtectedRoute.tsx
├── components/
│   ├── ui/              # peças pequenas (KpiCard, RiskBadge)
│   └── layout/           # TopBar
└── pages/
    ├── LoginPage.tsx
    └── DashboardPage.tsx
```

## O que é dado real vs. exemplo, na tela de dashboard

O backend ainda não tem endpoints de agregação para receita
total/mês, taxa de aceitação de guias, ou dias em contas a receber —
esses três KPIs estão marcados com a etiqueta "exemplo" na própria UI
(`isPlaceholder` em `KpiCard`), com dado ilustrativo. O gráfico de
tendência também é dado de exemplo (sem endpoint de série histórica
ainda).

**O que já é 100% real**: a tabela "Faturamentos de alto risco" (busca
`GET /billing/high-risk` de verdade) e o KPI "Valor salvo por correção
automática" (soma calculada a partir desses dados reais, não um número
inventado).

Conforme o backend ganhar os endpoints de agregação que faltam, é só
trocar o `isPlaceholder`/dado de exemplo por uma chamada real — a
estrutura de componentes já está pronta para isso.

## Observabilidade

Erros de JavaScript em produção hoje seriam invisíveis (uma tela em
branco, sem nenhum rastro) se não fosse por duas camadas:

- **`ErrorBoundary`** (`src/components/ErrorBoundary.tsx`): captura
  erros de render em toda a árvore de rotas e mostra uma tela de erro
  real (mesmo espírito da `ConfigurationErrorScreen` em `App.tsx`, mas
  para falha em tempo de execução) com um botão "Recarregar página",
  em vez de tela branca.
- **Sentry (`@sentry/react`), 100% opcional** via `VITE_SENTRY_DSN`
  (ver `.env.example`): quando a variável não está definida,
  `initMonitoring()` (`src/lib/monitoring.ts`) não faz nada — nem
  importa o SDK. Quando está definida, o SDK é importado
  dinamicamente (`import()`, não no topo do bundle) e inicializado com
  `sendDefaultPii: false` — a mesma postura de privacidade já usada no
  backend: por padrão, nenhum dado do navegador (IP, cookies, e
  principalmente dado de paciente) vai para um serviço terceiro. Só
  erros de render e falhas 5xx do backend (não 4xx — validação normal
  do usuário) são reportados.

## Login/cadastro com Google ("Sign in with Google")

`GoogleSignInButton` (`src/components/ui/GoogleSignInButton.tsx`), usado
em `LoginPage` e `SignUpPage`, renderiza o botão OFICIAL do Google
(Google Identity Services, script carregado sob demanda por
`src/lib/googleIdentity.ts`) — não é um botão nosso estilizado, é assim
que o fluxo evita lidar com senha ou client_secret no frontend: o
próprio Google devolve um ID token já assinado no callback, que vai
direto para `POST /auth/google` no backend só para verificação.

Controlado por `VITE_GOOGLE_OAUTH_CLIENT_ID` — sem essa variável, o
botão (e o divisor "ou" ao redor dele) simplesmente não renderiza, e o
formulário tradicional continua funcionando normalmente (mesma
degradação graciosa de `VITE_SENTRY_DSN` ausente, acima). É um valor
PÚBLICO (Client ID do OAuth client criado no Google Cloud Console — ver
seção "Login/cadastro com Google" no README do backend para o passo a
passo), nunca um segredo — pode ir tranquilo no `.env` do frontend.

Fluxo de cadastro via Google (`SignUpPage.tsx`): quando `POST
/auth/google` responde `needs_registration=true` (nenhuma conta com
aquele e-mail), o nome/e-mail resolvidos pelo Google pré-preenchem a
etapa 1 do cadastro (substituindo os campos de nome/e-mail/senha por uma
confirmação "continuando como X · e-mail@... · via Google") — só CNPJ e
plano continuam sendo perguntados, e o cadastro final envia
`google_credential` no lugar de `owner_name`/`email`/`password`.

## Testes automatizados

Achado do Laudo de Vistoria Técnica (parecer Product Designer/UX): até
esta rodada, zero teste automatizado de interface — a única forma de
pegar um botão quebrado era alguém clicar nele manualmente. Vitest +
Testing Library + axe-core cobrem parte real do design system e dos
fluxos mais críticos (login de clínica, login da plataforma interna, o
tour de boas-vindas guiado, navegação por papel na barra lateral).

```bash
npm test          # roda a suíte uma vez (CI)
npm run test:watch  # modo watch, para desenvolvimento
```

Cada arquivo de teste vive ao lado do que testa, em `__tests__/`
(`src/components/ui/__tests__/Button.test.tsx`, por exemplo) — mesmo
padrão de proximidade já usado no backend (`tests/integration/`, ainda
que lá seja uma pasta central por causa do banco de teste compartilhado
entre arquivos).

### Acessibilidade — checagem automatizada dentro dos próprios testes

`src/test/a11y.ts` roda o **axe-core** sobre o container renderizado de
cada teste (`expectNoA11yViolations(container)`) — **100% das páginas
(`src/pages/**/__tests__`) e dos componentes de UI/dashboard
(`src/components/**/__tests__`) chamam isso pelo menos uma vez** (rodada
"UX/acessibilidade vamos chegar a 9.5"; antes cobria só ~23%). Uma
regressão de acessibilidade (label sem associação, botão sem nome
acessível, papel ARIA inválido, ordem de heading pulada) quebra a
suíte, não só "parece certo visualmente".

**Limitação documentada, não escondida**: a regra `color-contrast` do
axe fica desligada nesses testes — jsdom não calcula layout/estilo
computado de verdade (não é um motor de renderização), então essa regra
especificamente produz falso positivo/negativo sob jsdom.

### Auditoria de acessibilidade em navegador real (Playwright) — fecha a lacuna do jsdom

`playwright.config.ts` + `e2e/sala-de-comando.spec.ts` rodam o
**ruleset COMPLETO do axe-core** (incluindo `color-contrast`) contra um
Chromium de verdade, logado com um tenant demo real
(`scripts/seed_demo_data.py`, backend), nas **11 abas da Sala de
Comando** (`hoje`, `diagnostico`, `crm`, `oportunidades`, `comparativo`,
`rentabilidade`, `simulador`, `capital`, `roi`, `estoque`, `clinico`),
em dois viewports (`chromium-desktop` e `chromium-mobile`/Pixel 7) — 22
combinações no total, mais QA visual (screenshot de página inteira por
combinação).

```bash
npm run test:e2e   # precisa de backend + frontend + tenant demo de pé — ver playwright.config.ts
```

Sem `webServer` automático de propósito: os testes dependem de dado
demo real (não é possível simular o cenário de negócio inteiro com
mocks e ainda assim testar acessibilidade "de verdade").

Achados reais desta auditoria (encontrados pelo Chromium real, não pelo
jsdom — cada um corrigido na raiz, não contornado no teste):
- **`landmark-unique` (moderado)** — `<Pagination>` (`Pagination.tsx`)
  usava sempre o mesmo `aria-label="Paginação"` fixo; quando duas listas
  paginadas aparecem na mesma tela (ex: aba Diagnóstico tem duas), os
  dois `<nav>` viravam landmarks indistinguíveis para quem navega por
  leitor de tela. Adicionado prop `label` opcional, com um rótulo
  específico em cada um dos ~17 usos no produto.
- **Abas da Sala de Comando inutilizáveis em mobile** — `Tabs.tsx`
  renderizava a `tablist` como `inline-flex` sem limite de largura nem
  scroll próprio; com 11 abas isso empurrava a PÁGINA INTEIRA além da
  viewport (confirmado: `scrollWidth` 1267px numa tela de 412px), e o
  scroll horizontal resultante fazia elementos de outra parte do layout
  sobreporem e **bloquearem clique nas abas depois da 2ª/3ª** — não é só
  um problema estético, era uma tela realmente inoperável em celular.
  Corrigido: a `tablist` agora tem seu próprio `overflow-x-auto`, a
  página em volta não estica mais.
- **`scrollable-region-focusable` (sério)** — vários contêineres de
  tabela com `overflow-x-auto` (13 ocorrências em 12 arquivos) ficavam
  sem nenhum jeito de rolar por teclado quando a tabela de fato
  transbordava a viewport (só existia rolagem por toque/mouse) — falha
  de WCAG 2.1.1 (Keyboard) que só aparece em telas estreitas o
  suficiente pra tabela transbordar, por isso nunca apareceu nos testes
  jsdom (sem layout real) nem no desktop. Corrigido com `tabIndex={0}`
  em cada um.

### Achados corrigidos na mesma rodada (não só "testado", também consertado)

A auditoria manual que acompanhou a criação desta suíte encontrou e
corrigiu, entre outros:
- **Mensagem de erro de formulário só visual** (`FormField.tsx`) — sem
  `aria-invalid`/`aria-describedby`, um leitor de tela nunca anunciava
  que um campo estava inválido nem por quê. Corrigido, coberto por
  teste.
- **`Tabs.tsx` sem navegação por seta do teclado** — o padrão WAI-ARIA
  de `tablist` espera Seta-Esquerda/Direita/Home/End movendo o foco
  ENTRE abas, com tabindex circulante (só a aba ativa no fluxo normal de
  Tab). Implementado, coberto por teste.
- **`NotificationBell.tsx` com `role="menu"` incorreto** — os itens são
  botões normais navegáveis por Tab, não um menu de comando com setas —
  a promessa ARIA de "menu" nunca foi cumprida. Trocado por
  `role="region"` + rótulo, e o foco agora volta para o sino ao fechar
  (Escape/clique fora), o que não acontecia antes.
- **`OnboardingTour.tsx` prometia `aria-modal="true"`** sem nunca travar
  o resto da página (decisão deliberada de design — ver
  `OnboardingTour.tsx`) — mentia para tecnologia assistiva sobre o
  próprio comportamento. Removido, e o foco agora move para o card a
  cada passo (antes, um usuário de teclado precisava adivinhar que o
  tour tinha aberto).
- Grupos de botões-filtro (`ReportRecipientsPage.tsx`,
  `DenialAppealsPage.tsx`) sem `aria-pressed` — o estado
  selecionado/não-selecionado só existia visualmente.

## Bundle e code-splitting

Achado do Laudo de Vistoria Técnica (parecer UX): o pacote baixado pelo
navegador crescia sem divisão por tela (quase 1MB) — pesado numa conexão
ruim, realidade de muita clínica pequena no Brasil. Duas mudanças, sem
tocar em nenhuma tela:
- Toda página vira seu próprio chunk (`React.lazy` em `App.tsx`, com
  `<Suspense>` em dois níveis — um cobrindo a app inteira antes do
  `AppShell` montar, outro dentro do `AppShell` para trocar de rota sem
  desmontar TopBar/Sidebar).
- `build.rollupOptions.output.manualChunks` (`vite.config.ts`) separa as
  bibliotecas de terceiros (`react`/`react-dom`, `react-router`,
  `framer-motion`, `@tanstack/react-query`, `recharts`, `lucide-react`)
  em arquivos próprios, cacheáveis pelo navegador independentemente do
  código da aplicação.

Resultado prático: quem abre `/login` baixa só o essencial daquela tela
(React + roteador + o próprio LoginPage, ~200KB) — não mais o pacote
inteiro (Recharts, todas as páginas administrativas, etc.) só para ver
um formulário de e-mail/senha.

## react-router-dom v6 -> v7

Achado do Laudo de Vistoria Técnica (parecer AppSec): `npm audit` passou a
apontar 2 CVEs moderadas em `react-router-dom` (redirecionamento aberto via
barra invertida, `GHSA-wrjc-x8rr-h8h6`; e injeção de construtor via
`deserializeErrors()` na hidratação SSR, `GHSA-337j-9hxr-rhxg`) — nenhuma
tinha correção dentro da v6 (`npm audit fix --force` só resolvia subindo
para v7). Migração feita em duas etapas, seguindo o caminho oficialmente
recomendado pelo próprio React Router:

1. Ligar as future flags `v7_startTransition`/`v7_relativeSplatPath` no
   `<BrowserRouter>` ainda na v6 (os dois avisos de depreciação já
   apareciam nos testes) e rodar a suíte inteira + build antes de mudar de
   versão maior — forma segura de expor qualquer mudança de comportamento
   com a versão antiga ainda instalada, fácil de reverter.
2. Com isso limpo, subir `react-router-dom` para `^7.18.3`. Na v7 esses
   dois comportamentos passam a ser o único modo de operar — a prop
   `future` do `<BrowserRouter>` nem aceita mais essas duas chaves, então
   a migração em si ficou em remover a prop de novo.

O app usa só a API "clássica" do React Router (`BrowserRouter`, `Routes`,
`Route`, `Navigate`, `Outlet`, `Link`, `NavLink`, `useNavigate`,
`useLocation`, `useSearchParams`) — nenhuma API de data router
(`createBrowserRouter`, loaders/actions, `useLoaderData`) — o que reduz
bastante a superfície de quebra da v7 (a maior parte das mudanças da major
version é justamente nas APIs de data router). Confirmado depois do bump:
suíte de 77 testes verde, build de produção limpo (typecheck incluso),
`npm audit --omit=dev --audit-level=high` zerado (as 2 CVEs somem), e um
teste de navegação com navegador real (Playwright) contra o `vite preview`
de produção — visita não autenticada em `/` redireciona para `/login`
(guarda de rota), caminho desconhecido cai no catch-all e também redireciona,
navegação client-side via `<Link>` funciona (login -> signup sem reload de
página).

## Build para produção

```bash
npm run build
```
Gera `dist/`. Na Railway, o app é construído pelo `Dockerfile` da raiz e
servido pelo nginx (`ops/app/`), que entrega a Content-Security-Policy,
HSTS e os demais cabeçalhos de segurança, e responde `/health`.

As variáveis `VITE_*` do serviço entram como build args (lista no
`Dockerfile`). Uma variável nova precisa ser declarada lá também.
`CSP_CONNECT_EXTRA` (opcional, em tempo de execução) libera origens extras
no `connect-src`; o padrão cobre o bucket da Railway e o Sentry.

Testar a imagem localmente:

```bash
docker build -t insighta-app --build-arg VITE_API_BASE_URL=http://localhost:8000 .
docker run --rm -p 8080:8080 insighta-app
curl -sI http://localhost:8080/login   # confere os cabeçalhos
```
