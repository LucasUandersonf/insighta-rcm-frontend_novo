# Roadmap — Insighta RCM

## Redesign 2026 — "sem sidebar, insights em linguagem natural"

Referência visual: canvas **Insighta RCM — Redesign 2026**
(https://claude.ai/artifact/6cNeqcodaTux1Mme8qpFv7), telas *Início — briefing
do dia*, *Sala de Comando* e *Convênios*.

Regra do projeto para o redesign: **todo campo do canvas existe na tela**, mas
**nenhum número de exemplo do canvas vai para produção** — cada valor vem de
uma rota real do backend, e um dado ausente some da tela em vez de virar
"0" ou exemplo.

### Fase 1 — Navegação e design system ✅ entregue

| Item do canvas | Onde está | Status |
|---|---|---|
| Sem barra lateral, tela em largura total | `AppShell.tsx` | ✅ |
| Barra superior em duas linhas (marca, clínica, busca, notificações, avatar / navegação + Módulos) | `TopBar.tsx` | ✅ |
| Menu **Módulos** agrupado (Faturamento, Agenda & operação, Custos & crescimento, Dados) | `TopBar.tsx`, `lib/navigation.ts` | ✅ |
| Configurações só no menu do avatar (Minha clínica, Usuários e permissões, Integrações e webhooks, Destinatários de relatórios, Logs de auditoria, Tema, Central de ajuda, Sair) | `TopBar.tsx` | ✅ |
| Cores, fontes (Geist + Fraunces), cards, botões, abas sublinhadas | `index.css`, `tailwind.config.ts`, `components/ui/*` | ✅ |

### Fase 2 — Campos que ainda não existiam ✅ entregue

| Campo do canvas | Implementação | Status |
|---|---|---|
| Seletor da clínica (nome + ▾) | `ClinicMenu` na TopBar; unidades da rede via `GET /analytics/organization-summary` | ✅ |
| **Pergunte ao Insighta** (barra superior e "Ficou com dúvida?") | `POST /analytics/ask` — IA narra só números já calculados, com a fonte; o mesmo campo sugere módulos pelo nome | ✅ |
| Contador em **Meus insights** | `GET /analytics/navigation-summary` → `my_open_insights` | ✅ |
| "Dados atualizados há X min · última importação de …" | `navigation-summary` → `last_import_at` / `last_import_source` | ✅ |
| Alertas dentro do menu Módulos ("4 prazos vencem…", "N linhas rejeitadas…") + **Dica** | `navigation-summary` → `module_alerts` (recursos, lotes, lista de espera, contratos vencendo, marketing, setup) | ✅ |
| Tarja **Urgente** com convênio, prazo e valor | `navigation-summary` → `urgent` | ✅ |
| **Comparar com: …** (Home) | janela do panorama (ontem / semana anterior / mês anterior) | ✅ |
| **Enviar por e-mail** (Home) | `POST /analytics/briefing/email` — manda o briefing para o e-mail do próprio usuário | ✅ |
| Panorama com **Glosado** e **Saúde do faturamento** | `GET /analytics/payer-overview` (total glosado) + `GET /analytics/health-score` | ✅ |
| "Leva cerca de N minutos · atribuir a alguém" | campos `estimated_minutes` + fluxo de atribuição existente | ✅ |
| **Por que agora / O que fazer / Se não fizer nada** e "detectado há N dias" | `app/services/insight_guidance.py` (todo insight) + memória contínua (`tracked_alerts`) | ✅ |
| **A agenda de hoje** por turno (manhã cheia, buracos à tarde, lista de espera, lote do fim do dia) | `GET /analytics/today-agenda` | ✅ |
| **Sua fila de hoje** (checklist "X de N feitas") | fila prioritária existente + "marcar como feita" | ✅ |
| **Faturado vs. glosado** (8 semanas, anotação do salto) | `GET /analytics/billed-vs-denied-weekly` | ✅ |
| **O que já mudou por sua causa** / "Recuperado com o Insighta este mês" | `GET /analytics/recovered-value` | ✅ |
| **De onde vem seu faturamento** + alerta de concentração | `payer-overview` → participação + `concentration_text` | ✅ |
| Exportar relatório (ícone ao lado do período) | CSV dos indicadores do período | ✅ |
| **Convênios**: veredictos, desempenho com leitura por linha, abas Glosas / Prazos / Contratos e tabelas | `ContractsPage.tsx` + `PayerOverviewPanel.tsx` + `payer-overview` | ✅ |
| **Simulação de decisão** + **Gerar argumento de renegociação** | cálculo na tela + `POST /analytics/payer-negotiation-argument` (IA, com texto padrão quando a IA não está configurada) | ✅ |

### Fase 3 — Próximos passos 🔜

- [ ] **Configurar produção**: `ANTHROPIC_API_KEY` (Pergunte ao Insighta / argumento com IA) e `SMTP_*` (envio real do briefing). Sem elas, a tela avisa e nada quebra.
- [ ] **Fuso por clínica**: turnos da agenda usam `America/Sao_Paulo` fixo (`briefing_repository.CLINIC_TIMEZONE`).
- [ ] **Trocar de unidade** no seletor da clínica (hoje ele lista as unidades da rede e leva ao Consolidado; o login continua por clínica).
- [ ] **Tempo estimado medido**: `estimated_minutes` é referência por área; passar a medir pelo tempo real entre atribuir e resolver.
- [ ] **Histórico do "Pergunte ao Insighta"** (perguntas frequentes da clínica como sugestões).
- [ ] Revisão de contraste com axe em navegador real (`e2e/`) nas telas novas.
