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

### Fase 2.5 — Equipe: o gestor atribui, o coordenador resolve ✅ entregue

Canvas "Atribuir", "Equipe" e "Coordenador". Perfis: **gestor** (owner/admin), **gestor somente leitura** (auditor) e **coordenador** (um por setor: Agendamento, Faturamento, Estoque, Assistencial).

| Campo do canvas | Implementação | Status |
|---|---|---|
| **Atribuir ao coordenador** (setor sugerido pela área do insight, setor sem coordenador desabilitado, prazo Hoje/Amanhã/Sexta/Escolher data, observação) | `AssignDemandModal` → `POST /team/demands` | ✅ |
| Aviso na Home do gestor ("X resolveu… — confirmado pelos dados") + "Ok, visto" | `TeamUpdatesStrip` ← `GET /team/overview` / `POST /team/updates/ack` | ✅ |
| **Equipe**: resumo em frases, **Metas resolvidas por coordenador**, demandas (Em andamento / Devolvidas / Resolvidas), Cobrar, Reatribuir, Dar mais prazo, Encerrar | `TeamPage.tsx` | ✅ |
| **Home do coordenador**: Suas demandas (Começar → Marcar como resolvida "O que foi feito?" / Devolver com motivo), Seu placar do mês, Radar do setor, A agenda de hoje | `CoordinatorHomePage.tsx` ← `GET /team/my-summary` | ✅ |
| Barra do coordenador só com o próprio setor (sem Sala de Comando, Painel, Módulos nem IA da clínica) | `coordinatorNavItems` + `ManagerProfileRoute` | ✅ |
| Coordenadores por setor em Usuários e permissões | `SectorCoordinatorsPanel` → `PUT /team/sectors/{setor}` | ✅ |
| "Confirmado pelos dados" | reaproveita a reavaliação de `insight_outcomes` (0 = sumiu, >0 = voltou) | ✅ |

### Fase 2.6 — Enxugamento: módulos e Sala de Comando ✅ entregue

| Antes | Agora |
|---|---|
| Sala de Comando com 11 abas | **Hoje · Faturamento · Agenda · Estoque · Prontuário**. Cada aba abre com os insights da área e depois os números |
| Diagnóstico | Feed + nota de saúde + números → Faturamento; ocupação e faltas → Agenda |
| CRM | "Pacientes a reativar" (inativos, risco de perder, RFM, upsell) na Agenda. Idade média e aniversariantes: removidos |
| Oportunidades / Rentabilidade | "Contratos para renegociar" em Faturamento / "Rentabilidade por hora" em Agenda |
| Comparativo, Simulador, Capital, ROI | Removidos (o comparativo que importa já vem no insight; a simulação existe em Convênios) |
| Painel | Saiu da barra. A fila de faturamentos de alto risco virou **Fila de correção** (Módulos → Faturamento); `/painel` redireciona |
| Profissionais & agenda | **Horários de atendimento**, no menu do avatar |
| Novo paciente / Nova consulta | Removidos — chegam pela importação. O aviso de paciente VIP foi para o seletor de Consultas |
| Pacientes | Fora da barra do gestor; fica com a coordenação de Agendamento/Assistencial |
| Faturamento & guias | Só na barra do coordenador de Faturamento |
| Central de upload + Setup | Um módulo: **Importar dados** (Enviar arquivos / Mapeamento e linhas rejeitadas) |
| Consolidado da rede | Só aparece para grupo com mais de uma unidade |

Links antigos (`?tab=crm`, `?tab=diagnostico`, `/painel?insurance_plan_id=`) continuam funcionando.

### Fase 2.7 — Insights "nota 9" ✅ entregue

- Card mostra o **passo a passo** da regra, **de onde vem o número** e o **histórico de acerto** nesta clínica.
- Rótulo do valor respeita o que ele é: "Impacto estimado" (perda), "Valor envolvido" (referência), "Valor protegido" (ganho). A Home diz "em jogo" só para perda.
- Atribuir e resolver enviam `rule_id` + chave estável → o motor aprende e a reavaliação não se perde quando um número do título muda.
- Fila de correção aceita `?professional_id=` (vindo do alerta "profissional fora do padrão de glosa").
- Destinos exatos: Faturamento & guias abre na aba pedida (`?tab=coparticipacao`, `?tab=auditoria-opme`); a Sala de Comando troca de aba e rola até a seção quando a URL muda (`?tab=estoque&scrollTo=nao-cobrado`).
- Aba Estoque ganhou a lista **Material usado e não cobrado** e âncoras para os alertas de estoque.

### Fase 3 — Próximos passos 🔜

- [ ] **Configurar produção**: `ANTHROPIC_API_KEY` (Pergunte ao Insighta / argumento com IA) e `SMTP_*` (envio real do briefing). Sem elas, a tela avisa e nada quebra.
- [ ] **Fuso por clínica**: turnos da agenda usam `America/Sao_Paulo` fixo (`briefing_repository.CLINIC_TIMEZONE`).
- [ ] **Trocar de unidade** no seletor da clínica (hoje ele lista as unidades da rede e leva ao Consolidado; o login continua por clínica).
- [ ] **Tempo estimado medido**: `estimated_minutes` é referência por área; passar a medir pelo tempo real entre atribuir e resolver.
- [ ] **Histórico do "Pergunte ao Insighta"** (perguntas frequentes da clínica como sugestões).
- [ ] **Equipe — notificação fora da tela**: e-mail/WhatsApp para o coordenador quando recebe ou é cobrado (hoje: Home + badge).
- [ ] **Equipe — histórico da demanda** (linha do tempo de atualizações; hoje guarda só a última).
- [ ] Revisão de contraste com axe em navegador real (`e2e/`) nas telas novas.
