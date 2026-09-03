# Insighta RCM — Frontend

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

## Build para produção

```bash
npm run build
```
Gera `dist/` — pode ser servido por qualquer host estático (Vercel,
Netlify, ou o próprio Railway como um segundo serviço).
