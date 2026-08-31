# Plano de Evolução — Frontend Insighta RCM

**Contexto**: hoje o frontend tem uma única tela (dashboard), com 3 dos 6
indicadores sendo dado de exemplo, sem navegação para nenhuma outra
parte do sistema. O backend tem 10 grupos de endpoints funcionais; o
frontend usa 2. Este plano fecha essa distância.

## Inventário — o que o backend já oferece (e o frontend ainda não usa)

| Domínio | Endpoints reais no backend | Usado no frontend hoje? |
|---|---|---|
| Pacientes | `POST/GET /patients` | ❌ |
| Consultas | `POST /appointments`, `GET /appointments/by-patient/{id}` | ❌ |
| Faturamento | `POST /billing`, `GET /billing/high-risk` | 🟡 só leitura de alto risco |
| Contratos | `POST /contracts`, `GET /contracts/active` | ❌ |
| Profissionais | `POST/GET /professionals` | ❌ |
| Capacidade | `GET /capacity/utilization/{id}` | ❌ |
| Resolução de convênio | `GET/POST /ingestion/rejected` | ❌ |
| Relatório semanal | `POST /reports/weekly/send` | ❌ |

## Fases

### Fase 0 — Navegação (pré-requisito de tudo abaixo)
Hoje só existe `/` (dashboard) e `/login`. Sem uma casca de navegação
(sidebar + rotas), nenhuma tela nova é alcançável. **Bloqueador de tudo
o resto — feito primeiro.**

### Fase 1 — Operação do dia a dia (o que uma recepção/financeiro usa todo dia)
1. **Pacientes**: listar + cadastrar.
2. **Consultas**: cadastrar (ligada a um paciente), listar por paciente.
3. **Faturamento**: cadastrar (aciona o motor de glosa de verdade) +
   listar (não só os de alto risco — todos).
4. **Backend**: endpoint novo de resumo (`GET /dashboard/summary`),
   reaproveitando `ReportingRepository.billing_summary` (já existe,
   construído para o relatório semanal) — mata 2 dos 3 KPIs de
   exemplo (receita do mês, taxa de aceitação). "Dias em contas a
   receber" continua marcado como exemplo *de propósito*: calcular
   isso de forma correta exige rastrear quando cada faturamento foi
   efetivamente pago, dado que o modelo atual não captura bem ainda —
   fica para uma fase futura, não por preguiça.

### Fase 2 — Configuração (o que a clínica cadastra uma vez, não todo dia)
5. **Profissionais**: listar + cadastrar (com grade de horários).
6. **Contratos**: listar ativos + cadastrar (tabela de repasse por convênio).
7. **Capacidade**: tela de consulta de utilização por profissional/período.

### Fase 3 — Administração
8. **Resolução de convênio desconhecido** (tela de Setup): listar
   linhas rejeitadas da ingestão, resolver manualmente.
9. **Relatório semanal sob demanda**: botão que aciona
   `POST /reports/weekly/send`.

### Fase 4 — Robustez e polimento
10. Sessão expirada → redireciona pro login com mensagem clara, em vez
    de erro cru.
11. Toasts de sucesso/erro em vez de só texto estático.
12. Estados de carregamento (skeleton) em vez de só "Carregando...".
13. Erros de validação (422 do backend, `campos: [...]`) destacando o
    campo certo no formulário, não só uma mensagem genérica.

---

## Status — o que foi concluído nesta rodada

✅ **Fase 0 (Navegação)** — `AppShell` (TopBar + Sidebar) envolvendo
todas as rotas autenticadas; navegação real entre Painel/Pacientes/
Profissionais/Consultas.

✅ **Fase 1, itens 1-2 (Pacientes, Consultas)** — completos: listar +
cadastrar pacientes; selecionar paciente → ver consultas dele → cadastrar
nova consulta (mostra o risco de falta calculado na hora, via toast).

🟡 **Fase 1, item 3 (Faturamento)** — parcial: o dashboard já lista
faturamentos de alto risco (dado real). Cadastro de faturamento
avulso (fora do fluxo de consulta) e listagem completa (não só
alto risco) ainda não têm tela própria.

❌ **Fase 1, item 4 (endpoint de resumo no backend)** — não implementado
ainda. Os 3 KPIs de exemplo no dashboard continuam sendo exemplo.

✅ **Fase 4, parcial** — sessão expirada agora desloga automaticamente
(evento global `auth:unauthorized`); toasts de sucesso/erro substituem
texto estático; erros de validação (422) já mapeiam pro campo certo do
formulário (`PatientsPage`). Loading skeleton ainda não — continua só
"Carregando...".

**Também mudou de arquitetura**: `@tanstack/react-query` substituiu o
`useEffect`+`useState` manual que cada tela reimplementaria — cache,
invalidação e estado de loading/erro agora vêm de um único lugar,
consistente em toda tela nova.

**Ainda pendente**: Fase 2 inteira (Contratos, Capacidade), Fase 3
inteira (resolução de convênio, relatório sob demanda), e o restante da
Fase 4 (skeleton de carregamento).
