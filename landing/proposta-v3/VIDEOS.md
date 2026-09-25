# Vídeos da landing v3: onde entram e prompts para gerar com IA

Cada espaço de vídeo mostra uma etiqueta 🎬 com o nome do arquivo. Quando o arquivo existe em `landing/proposta-v3/assets/videos/`, a página troca sozinha a ilustração pelo vídeo, que toca mudo e em loop.

**Formato:**
- MP4 (H.264), **5 segundos**, sem áudio;
- 1920×1080 (16:9) para os vídeos da página;
- 1080×1350 (vertical) para os depoimentos;
- até 4 MB cada. Comprima com HandBrake ou com `ffmpeg -crf 28`.

| Arquivo | Onde aparece |
|---|---|
| `hero.mp4` | Vídeo principal, no centro da abertura |
| `glosas.mp4` | Aba Glosas |
| `contratos.mp4` | Aba Contratos |
| `agenda.mp4` | Aba Agenda |
| `faturamento.mp4` | Aba Faturamento |
| `ia.mp4` | Seção escura "analista financeiro com IA" |
| `depoimento-1/2/3.mp4` | Depoimentos, **só com clínicas reais e autorização por escrito** |

## Prompts (para Runway, Pika, Kling, Sora, Veo, entre outros)

Estilo comum para colar no início de todos os prompts:
> Estilo: interface de software moderna e limpa, 3D suave, fundo roxo profundo (#140a33) com brilhos em gradiente laranja → rosa → roxo → azul, câmera lenta e suave, sem pessoas, sem texto legível, sem logotipos de terceiros, 5 segundos, loop contínuo.

1. **hero.mp4:** "Um painel de software flutuando em perspectiva sobre fundo roxo profundo. Cartões de indicadores surgem um a um, uma linha de gráfico cresce da esquerda para a direita e um cartão vermelho de alerta pulsa suavemente. A câmera se aproxima devagar. Partículas de luz em gradiente laranja e roxo."
2. **glosas.mp4:** "Uma pilha de guias médicas digitais passa por um scanner de luz roxa; uma guia fica vermelha, é corrigida e muda para verde com um brilho. Fundo lilás claro, visual limpo e minimalista."
3. **contratos.mp4:** "Um documento PDF abre as páginas no ar; linhas de uma tabela de preços se destacam em roxo e se conectam por fios de luz a cartões de cobrança. Um dos cartões fica vermelho indicando diferença. Fundo claro, estilo 3D suave."
4. **agenda.mp4:** "Um calendário semanal isométrico; alguns horários acendem em rosa (faltas previstas) e são preenchidos por blocos roxos, até a agenda ficar completa. Fundo claro, animação suave."
5. **faturamento.mp4:** "Barras de um gráfico crescem em sequência; a última barra aparece listrada em gradiente roxo como previsão, e uma seta sobe até uma linha tracejada de meta. Fundo claro."
6. **ia.mp4:** "Um núcleo brilhante em gradiente laranja-rosa-roxo no centro, com órbitas tracejadas girando; pequenos documentos e números entram na órbita e se transformam em pontos de luz. Fundo roxo muito escuro."

> Não use pessoas geradas por IA nos depoimentos, nem simulando clientes. Depoimento só com clínica real.
