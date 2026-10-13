# Landing Insighta: estratégia completa

Status: **v6 publicada em `landing/site/` em 13/10/2026** (v5 no mesmo dia), a partir da copy aprovada pelo Lucas (caderno de copy v2). A v4 (25/09/2026) foi a base visual. Preço em vigor: oferta Founders, R$ 800/mês com preço travado por 24 meses (20 vagas, contagem ao vivo pela API).

## v6.1 (13/10/2026): oferta Founders e integração pelo ERP

Decisões do Lucas: os Founders levam **todas as funcionalidades novas** dos 24 meses sem custo extra e, depois, decidem se continuam; o preço regular aparece como âncora quando for definido; não há implantação acompanhada nem suporte de integração: a equipe do ERP da clínica integra pela documentação técnica da API (`docs/integracao/API_INTEGRACAO.md` no backend).

| Mudança | Onde |
|---|---|
| "Seja uma das 20 clínicas fundadoras": preço travado, funcionalidades novas incluídas, decisão aos 24 meses, cancelamento sem multa | Planos |
| Três razões para entrar agora (preço de fundador, tudo o que vier incluído, sem amarra) | Planos |
| Preço regular ao lado do Founders, lido de `regular_price_cents` em `/public/founders` (escondido enquanto `REGULAR_PRICE_CENTS` estiver vazio) | Planos |
| "Suporte prioritário" saiu do plano de redes; entrou "Integração por API em todas as unidades" | Planos |
| Integração pelo ERP com API documentada; planilha pelo navegador enquanto isso | Como começar, módulo Integração, diagrama |
| Perguntas novas: "Quem faz a integração?" e "O que acontece depois dos 24 meses?" | FAQ |
| Termos de Uso, cadastro e versão dos documentos (2026-10-13) com a cláusula nova | App e backend |

Nota de conversão: 7,8 → **8,5**. A oferta passa a responder ao medo de ser o primeiro cliente.

## v6 (13/10/2026): de "RCM com IA" para "a inteligência da clínica"

Feedback do Lucas sobre a v5: a página ainda lia como um sistema de faturamento médico (RCM). O Insighta é um sistema de inteligência para a clínica inteira; faturamento é um dos módulos.

| Mudança | Onde |
|---|---|
| Tese: "Para onde a sua clínica está indo? O Insighta sabe, e diz o que fazer hoje." | Hero, título e descrição |
| Palco atravessa as áreas: agenda ociosa, paciente que sumiu, risco de glosa, estoque vencendo; etapa 4 vira "Melhora" | Hero |
| Manifesto com quatro frentes: agenda, pacientes, financeiro, equipe | `#dores` |
| Ciclo da inteligência: Detecta, Explica, Prioriza, Age, Mede, Aprende | `#inteligencia` |
| Histórias com exemplos de pacientes, insights de cinco áreas e demanda para a recepção | `#inteligencia` |
| Seção própria da agenda: risco de falta, agenda de risco, alerta, lista de espera, grade ociosa, atraso e espera | `#agenda` |
| Módulos agrupados em cinco áreas com o mesmo peso (Agenda e operação, Pacientes e crescimento, Financeiro e convênios, Margem e estoque, Gestão e equipe); entram os cartões Operação e qualidade, Marketing e Estoque e OPME | `#recursos` |
| Equipe de IA abre pelo Jornalista da manhã e pelo Previsor de agenda | `#equipe-ia` |
| Contraste "Painéis mostram o passado. O Insighta diz o que fazer." com dez áreas | `#comparativo` |
| Pergunta frequente nova: "O Insighta é só para faturamento?" e "Como o Insighta ajuda na agenda?" | `#faq` |

Nota: 8,5 (v5) → **8,6** (v6). O ganho vem de posicionamento e clareza; o que falta para 9+ continua sendo prova social real e IA/WhatsApp ligados antes do anúncio.

## v5 (13/10/2026): o que mudou e por quê

Nota da v4 no diagnóstico: **7,0/10**. Faltava a dor do gestor na abertura, metade do produto ficava de fora, o WhatsApp aparecia como "em breve", a demonstração citava "autorização prévia" (que o motor não confere) e o único caminho era a compra.

| Mudança | Onde |
|---|---|
| Abertura pela dor: "Sua clínica atende muito. O Insighta mostra quanto fica e recupera o que está escapando." | Hero |
| CTA duplo: "Ver quanto minha clínica perde" (cadastro) + "Agendar demonstração" (WhatsApp comercial; sem `CONTACT_URL`, vira "Ver tudo o que ele faz") | Hero, Como começar, Chamada final |
| Manifesto "Para onde está indo a receita?" com os quatro vazamentos | `#dores` |
| Dez pilares no formato dor → solução → "No bolso", cobrindo todo o produto | `#recursos` |
| Rotina do gestor (5h15, segunda 7h, a cada 2h, demanda, reavaliação) | `#relatorios` |
| Tabela de contraste com 10 linhas (cartões no celular) | `#comparativo` |
| Segurança com 2FA/Google, auditoria de 5 anos, exportação e documentos LGPD | Confiança |
| "Autorização prévia" trocada por "CID ausente" nas demonstrações | Palco, Pergunte, Detecta, Equipe de IA |
| "Em breve" removido de WhatsApp, IA e relatório (decisão do Lucas) | Relatórios, diagrama, perguntas frequentes |
| JSON-LD: oferta Founders R$ 800 no lugar de 297/697; FAQ com 9 perguntas | `<head>` |

**Ativações antes de ligar o tráfego pago** (a página já vende estes recursos):

| Recurso | Falta |
|---|---|
| Jornal da manhã, Pergunte (perguntas complexas), leitura de contrato escaneado, minuta redigida pela IA | Chave da API de IA na produção |
| Relatório semanal e alertas no WhatsApp | Conta WhatsApp Business e modelo de mensagem aprovado na Meta (envio para números individuais) |
| Briefing por e-mail | SMTP (a página já esconde este item enquanto o e-mail estiver desligado) |
| Elegibilidade e autorização com as operadoras | Conector com cada operadora; marcado "em integração" na página |
| ROI de marketing | Funciona; o investimento por campanha é lançado pela clínica |

## 0. Diagnóstico da v3 (feedback do Lucas + gravações da Hostinger)

| Problema da v3 | Correção na v4 |
|---|---|
| Vendia painel e glosa; não vendia **inteligência** | Posicionamento novo: *"A inteligência que trabalha pela sua clínica enquanto você atende"*. A IA aparece em todas as seções |
| Relatório semanal sem destaque | Seção inteira "A diretoria informada sem abrir o sistema": celular com WhatsApp, PDF, resumo e alerta, mais a linha do tempo dos envios |
| Seção de depoimentos sem nenhuma clínica parceira | **Removida.** Nenhuma prova social inventada |
| Faltavam os mecanismos das gravações | Palco com 4 etapas que se revezam; abas fixas que acompanham a rolagem; digitação da pergunta à IA; sanfona escura da "Equipe de IA"; diagrama de nós com pulsos animados |

## 1. Sem achismo: cada promessa e sua comprovação no código

| O que a página diz | Onde está no sistema |
|---|---|
| **47 análises automáticas**, cada uma com "Como calculamos" | `app/services/insight_methods.py`: 47 métodos, cada um com a fonte e a regra |
| 5 fontes de dados | Importação: faturamento, agenda, atendimento, estoque e prontuário (modelos `.xlsx`) |
| Alerta de risco **a cada 2 horas** | `app/worker/scheduler.py`: `daily_alert` com `Every(minutes=120)` |
| Relatório semanal **segunda às 7h**, PDF no WhatsApp | `weekly_report` com `Weekly(0, 10)` em UTC, que dá 7h em Brasília; `report_pdf_builder.py`; `report_send_service.py` com vários destinatários |
| Conteúdo do relatório: faturado, valor salvo, alto risco, agenda, faltas | Seções do `report_pdf_builder.py` |
| Jornal da manhã **antes das 6h**, escrito pela IA | `morning_edition_submit` com `Daily(8, 15)` em UTC (5h15 em Brasília), via Batch API + coleta a cada 5 min (`morning_edition.py`) |
| **"A IA não inventa número"** | `morning_edition.py`: `numbers_grounded`. Número que não bate descarta o texto |
| Nomes de pacientes mascarados antes da IA | `pii_masking.py`; "Paciente A" no Jornal da manhã |
| Perguntas comuns respondidas pelo sistema, as complexas pela IA | `ask_router.py` (roteador sem custo) + `insighta_ask_service.py` com escalonamento |
| Modelo de glosa **retreinado todo dia** | `denial_model_training` com `Daily(7)` |
| Risco de falta **recalibrado toda semana** | `no_show_calibration` com `Weekly(6, 7, 30)` |
| Reavalia todo dia se o problema foi resolvido | `insight_reevaluation` com `Daily(8)` (`insight_outcome_service.py`) |
| Lê contrato em PDF, até escaneado | `contract_extraction_service.py`, `contract_pdf_text.py` (leitura em camadas) |
| Minuta de recurso com prazo e PDF | `denial_appeal_draft_service.py`, `appeal_deadline_calculator.py`, `denial_appeal_pdf_builder.py` |
| Demanda para o coordenador do setor | Fluxo de demandas validado na jornada (passo 8, 36/36) |
| Comparativo com a rede (anonimizado) | `network_benchmark_service.py` |
| Webhooks | `webhook_retry_job` + Central de integrações |
| Backup diário testado | `app/scripts/ops/pg_backup.py`, com `BACKUP_OK` na produção em 25/09 |
| Seis conferências anti-glosa (v5) | `denial_risk_engine.py`: CID ausente, código faltando, sem contrato, duplicada, valor fora da tabela, procedimento × paciente |
| Rentabilidade, custos, Health Score (v5) | `analytics/rentabilidade.py`, `cost_entry_service.py`, `health_score_engine.py` |
| Pacientes e marketing (v5) | `rfm_engine.py`, `public_satisfaction_service.py`, `marketing_spend_service.py`, `patient_outreach_log_service.py` |
| Lista de espera (v5) | `waitlist_entry_service.py` (paciente, profissional e janela de horário) |
| Consolidado de unidades (v5) | `organization_service.py` (convite com verificação) |
| 2FA, login com Google, auditoria 5 anos, exportação (v5) | `mfa_service.py`, `google_oauth_client.py`, job de retenção da auditoria, `tenant_export_service.py` |
| Elegibilidade com operadoras (v5, "em integração") | `payer_eligibility_service.py` com `NotConfiguredTissEligibilityClient` |
| Preços R$ 297 / R$ 697 / sob consulta | `payment_provider.py`: `PLAN_CATALOG`, **marcado como PLACEHOLDER** |
| Itens de cada plano | Mesma lista da tela de cadastro (`SignUpPage.tsx`) |

**Limites honestos**
1. **WhatsApp e IA precisam das chaves ligadas** (C3 e C5 do roadmap) antes de rodar anúncio. Sem elas, o Jornal da manhã usa o texto-modelo e o relatório não chega no WhatsApp. **Não ligue tráfego pago antes disso.**
2. Os números das demonstrações (R$ 5.706, R$ 18.430 etc.) são fictícios, e a página avisa isso ao lado de cada demonstração.
3. Não há bloqueio de recurso por plano no código. A lista de cada plano repete a tela de cadastro; se for decidido limitar recursos por plano, isso é uma tarefa de desenvolvimento.

## 2. Copywriting

- **Público:** dono ou diretor de clínica que atende convênios; o coordenador de faturamento influencia a compra.
- **Dores, em ordem:**
  1. dinheiro perdido que ninguém vê (glosa, pagamento abaixo do contrato);
  2. falta de tempo para analisar;
  3. informação espalhada;
  4. equipe que não sabe o que fazer primeiro.
- **Desejo:** ter "um diretor financeiro" sem contratar um. Saber sem precisar abrir o sistema.
- **Big Idea:** *"A inteligência que trabalha pela sua clínica enquanto você atende."* O Insighta vira um **membro da equipe**, e não uma ferramenta.

**Arco da página**

| Etapa | Seção |
|---|---|
| Promessa | Abertura |
| Prova de capacidade | 47 análises · 5 fontes · 24/7 · 0 inventado |
| Demonstração | Pergunta / Detecta / Prevê / Age |
| Personificação | Equipe de IA |
| Rotina que dá desejo | Relatórios |
| Encaixe técnico | Diagrama de conexões |
| Abrangência | Letreiro com 47 análises |
| Confiança | "Não inventa número" + LGPD |
| Preço | Planos |
| Ação | Diagnóstico |
| Objeções | Perguntas frequentes |
| Fechamento | Chamada final |

**Objeções e onde a página responde**

| Objeção | Seção |
|---|---|
| "IA inventa coisa" | Seção de confiança + primeira pergunta frequente |
| "Vou ter que trocar de sistema?" | Selos da abertura + diagrama + perguntas frequentes |
| "Dados de paciente na IA?" | Nota da Equipe de IA + LGPD + perguntas frequentes |
| "Quanto custa?" | Planos |

- **CTA único:** "Fazer diagnóstico gratuito", em 8 pontos da página e na barra fixa do celular. CTA secundário, para quem não se autosserve: "Prefiro que um especialista me mostre" (WhatsApp).
- **Manchetes para teste A/B:**
  - A (atual): "A inteligência que trabalha pela sua clínica enquanto você atende."
  - B: "Sua clínica já atendeu. A inteligência artificial agora recupera o que é seu."
  - C: "O diretor financeiro com IA que a sua clínica não precisa contratar."

## 3. Funil e oferta

```
Google (busca por glosa/faturamento) ─┐
LinkedIn (cargo: gestor de clínica) ──┼─▶ Landing ─▶ Diagnóstico gratuito ─▶ Conta criada + faturamento importado
Meta (remarketing de visitantes) ─────┘                  │                              │
                                                         └─▶ WhatsApp (especialista)    ▼
                                                                          Resultado em minutos (R$ em risco)
                                                                                        │
                                                                    Jornal da manhã no dia seguinte (gancho de retorno)
                                                                                        ▼
                                                                          Assinatura (Starter / Professional)
```

- **Isca:** o diagnóstico gratuito. O cadastro já funciona sem cobrança.
- **Gancho de retorno:** o Jornal da manhã do dia seguinte e, na segunda, o relatório semanal. A própria rotina do produto traz o usuário de volta.
- **Ofertas que dependem de você** (não estão na página v4, que não promete desconto nem garantia ainda):
  - desconto para as clínicas fundadoras;
  - garantia de 30 dias.

## 4. UX/UI e design visual

- Hierarquia: uma ideia por seção, título de até 2 linhas, o CTA sempre visível (menu e barra no celular).
- Paleta: roxo profundo (`#140a33` → `#673de6`, a base da Hostinger) com o **gradiente da marca Insighta** (laranja → rosa → roxo → azul) nas palavras-chave e nos elementos de IA. Verde só para dinheiro recuperado e vermelho só para risco.
- Tipografia: Geist, a mesma do app, com peso 800 nos títulos.
- Movimento, seguindo as gravações:
  - palco que se reveza a cada 3,6 s e pausa com o mouse;
  - pergunta digitada letra a letra;
  - abas que acompanham a rolagem;
  - sanfona que gira sozinha até o visitante interagir;
  - pulsos no diagrama;
  - letreiro;
  - contadores.
  
  Tudo fica parado para quem configurou o sistema para reduzir movimento.
- Imagens: todas as telas são HTML/SVG (nítidas em qualquer tela e leves). Nenhuma foto de banco de imagens nem pessoa gerada por IA.

## 5. CRO

- **Métrica norte:** porcentagem de visitantes que iniciam o diagnóstico. Métricas de apoio:
  - cadastro concluído;
  - faturamento importado em até 24h;
  - assinatura em até 14 dias.
- **Ferramentas gratuitas:** Microsoft Clarity (mapas de calor e gravações) e GA4, com eventos por botão (`data-cta`).
  - **Exigem aviso de cookies (LGPD) antes de ligar.**
- **Testes A/B, na ordem:**
  1. manchete A × B × C;
  2. CTA "Fazer diagnóstico gratuito" × "Ver quanto minha clínica perde";
  3. planos com preço × "sob consulta";
  4. abertura com palco × abertura com vídeo.
  
  Um teste por vez, com cerca de 300 visitas por variante.
- **Onde medir travamento:** rolagem até a seção de planos, cliques nas abas e na sanfona, e abandono no cadastro.

## 6. Tráfego pago (quando C1, C2, C3 e C5 estiverem ligados)

| Canal | Público e palavras | Anúncio | Verba de teste |
|---|---|---|---|
| Google Search | "glosa médica", "recurso de glosa", "auditoria de contas médicas", "faturamento TISS", "software para clínica convênio" | "Descubra quanto os convênios glosaram — diagnóstico gratuito com IA" | R$ 40/dia |
| LinkedIn | Cargos: diretor/gestor de clínica, coordenador de faturamento; setor Hospitais e Saúde | Carrossel com as 4 etapas do palco | R$ 50/dia |
| Meta | Remarketing de quem visitou (30 dias) + público semelhante | Vídeo de 5 s do celular recebendo o relatório de segunda | R$ 25/dia |

São 14 dias de teste (cerca de R$ 1.600). A verba vai para o canal com menor **custo por diagnóstico iniciado**. Todo anúncio leva UTM.

## 7. SEO

- `title` e `description` com as palavras de intenção: *inteligência artificial para clínicas, glosas, convênios, agenda*.
- JSON-LD: SoftwareApplication + FAQPage, com as perguntas reais da página.
- HTML semântico: um h1 e h2 por seção; o texto todo está no HTML, sem depender de JavaScript. O Google lê tudo.
- Velocidade: CSS e JS próprios, sem framework; imagens são SVG/HTML; só as fontes vêm do Google Fonts.
- **Próximo passo de SEO (conteúdo):** páginas de apoio para "o que é glosa médica", "como fazer recurso de glosa" e "como reduzir faltas em clínica", cada uma levando ao diagnóstico. Isso depende do domínio próprio (C1).
- Homologação: `noindex` (já configurado), para não duplicar a página no Google.

## 8. Decisões pendentes do Lucas

1. Aprovar a v4 (texto e visual).
2. Preços: manter R$ 297 / R$ 697 do catálogo atual ou definir outros.
3. Oferta de fundadores e garantia: sim ou não, e em quais termos.
4. WhatsApp comercial para o botão "Falar com especialista".
