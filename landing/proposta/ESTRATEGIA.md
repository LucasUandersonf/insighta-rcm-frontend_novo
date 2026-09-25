# Proposta de landing v2 (modelo Hostinger): estratégia para aprovação

Status: **PROPOSTA, não publicada.** Prévia em `landing/proposta/`. Nada vai para o ar antes da aprovação.

## 1. Copywriting: a mensagem
- **Público:** dono ou gestor de clínica médica que atende convênios e o faturista/coordenador financeiro.
- **Dor principal:** dinheiro que a clínica já ganhou (atendeu) e não recebeu (glosa, pagamento abaixo do contrato). Dores secundárias: faltas na agenda e informação espalhada.
- **Desejo:** receber tudo o que é devido, sem trocar de sistema e sem mais trabalho.
- **Objeções e respostas na página:**

| Objeção | Onde a página responde |
|---|---|
| "Vou ter que trocar de sistema?" | Seção principal, faixa de confiança e FAQ |
| "Dá muito trabalho" | Como funciona em 3 passos; "resultado em minutos" |
| "E se não achar nada?" | Garantia de 30 dias |
| "Meus dados estão seguros?" | Bloco LGPD e FAQ |
| "Quanto custa?" | Planos com preço visível |

- **Big Idea:** *"Sua clínica já atendeu. Agora receba o que os convênios devem."* O dinheiro já é da clínica; o Insighta só mostra onde ele está.
- **Manchetes para teste A/B:**
  - A: "Sua clínica já atendeu. Agora receba o que os convênios devem." (escolhida para a v2)
  - B: "Descubra em minutos quanto os convênios deixaram de pagar à sua clínica."
  - C: "Pare de perder dinheiro em glosas que ninguém viu."
- **CTA principal:** "Quero meu diagnóstico gratuito". É o menor passo possível, sem cartão. O CTA repete em 6 pontos da página, e no celular há uma barra fixa.

## 2. Funil e oferta
```
Anúncio (Google/Meta/LinkedIn) ─▶ Landing ─▶ "Diagnóstico gratuito" (cria a conta e importa o faturamento)
                                                   │
                                                   ▼
                               Resultado em minutos: R$ em risco por convênio
                                                   │
                                  ┌────────────────┴────────────────┐
                                  ▼                                 ▼
                    Assina (Starter/Professional)       WhatsApp com você: demonstração guiada
```
- **Isca:** diagnóstico gratuito. O sistema já permite criar a conta e importar sem pagamento, porque ainda não há cobrança automática.
- **Oferta Clínica Parceira:** 50% de desconto nos 6 primeiros meses para as 10 primeiras clínicas.
- **Urgência verdadeira:** o contador de vagas precisa refletir o número real.
- **Garantia de resultado:** se em 30 dias o Insighta não encontrar, em glosas e cobranças abaixo do contrato, um valor maior que a mensalidade, a clínica não paga.

### ⚠️ Decisões do Lucas (preços, número de vagas e garantia são compromissos comerciais)

| # | Decisão | Proposta |
|---|---|---|
| D1 | Preço Starter | R$ 397/mês (R$ 198,50 com o desconto de parceira) |
| D2 | Preço Professional | R$ 797/mês (R$ 398,50 com o desconto de parceira) |
| D3 | Enterprise | Sob consulta |
| D4 | Desconto e prazo da parceira | 50% por 6 meses |
| D5 | Número de vagas e vagas restantes | 10 vagas. O "restam 7" da prévia é só exemplo |
| D6 | Garantia de resultado em 30 dias | Sim |
| D7 | Manchete | A |

**Racional do preço:** cobrar pelo valor gerado.

| | Valor |
|---|---|
| Faturamento mensal com convênios (clínica do exemplo) | R$ 250 mil |
| Glosa de 4% | R$ 10 mil/mês perdidos |
| Professional a R$ 797 | pago se recuperar 8% do que é glosado |
| Starter a R$ 397 | pago se recuperar 4% do que é glosado |

A garantia torna isso explícito. Os valores são hipótese para validar com as primeiras clínicas.

## 3. UX/UI e design (referência Hostinger)
1. Faixa de oferta com urgência
2. Seção principal com lista de benefícios e **caixa de oferta** (R$ 0, CTA grande, garantia) + demonstração do produto
3. Faixa de confiança
4. "Faça a conta" (custo da dor)
5. Como funciona
6. Recursos em blocos alternados
7. **Planos** com preço riscado e selo "Mais escolhido"
8. **Selo de garantia**
9. Segurança
10. Perguntas frequentes
11. Chamada final com a oferta repetida
12. Barra fixa no celular

**Diferença consciente em relação à Hostinger:** sem nota de avaliações, número de clientes, depoimentos ou logos. Ainda não existem, e inventar é antiético e arriscado. Depois dos pilotos, a seção de depoimentos entra com casos reais, com números e autorização.

## 4. CRO: otimização de conversão
- **Métrica-alvo:** porcentagem de visitantes que iniciam o diagnóstico. Meta inicial para B2B: 3% a 8%. Métricas de apoio:
  - diagnóstico concluído (importou o arquivo);
  - diagnóstico → assinatura.
- **Ferramentas gratuitas:**
  - Microsoft Clarity: mapas de calor e gravações;
  - Google Analytics 4: funil.
  - As duas exigem **aviso de cookies (LGPD)** antes de ligar. O banner entra junto.
- **Primeiros testes A/B** (um por vez, cerca de 2 semanas ou 300 visitas por variante):
  1. manchete A × B;
  2. "R$ 0" em destaque × sem preço na seção principal;
  3. planos com preço × "sob consulta".
- Parâmetros UTM em todos os anúncios, para saber qual canal converte.

## 5. Tráfego pago: sugestão para o teste inicial
| Canal | Por quê | Segmentação | Verba de teste |
|---|---|---|---|
| **Google Ads (Pesquisa)** | Quem busca já tem a dor | "glosa médica", "recurso de glosa", "auditoria de contas médicas", "faturamento TISS", "glosa convênio" | R$ 40/dia |
| **LinkedIn Ads** | Cargo exato (B2B) | Gestor de clínica, diretor administrativo, coordenador de faturamento; setor de saúde | R$ 50/dia |
| **Meta Ads** | Alcance barato, bom para remarketing | Remarketing de quem visitou a landing + interesses em gestão de clínicas | R$ 25/dia |

- 14 dias de teste com cerca de R$ 1.600 no total. Depois, a verba vai para o canal com menor custo por diagnóstico iniciado.
- **Pré-requisitos antes de ligar os anúncios:**
  - domínio próprio (C1 do roadmap);
  - e-mail (C2), para "esqueci a senha" e o contato;
  - aviso de cookies e analytics;
  - número de WhatsApp comercial.
