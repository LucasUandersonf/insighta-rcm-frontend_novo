# Landing page — Insighta

Site estático (HTML + CSS puros, sem framework) servido por `nginx:alpine`. É separado do app React para o Google ler a página inteira e para carregar rápido.

```
landing/
├── site/                  # o que vai para o ar (index.html, styles.css, main.js, assets/, robots.txt, sitemap.xml)
├── nginx.conf.template    # troca __SITE_URL__ / __APP_URL__ / __CONTACT_URL__ e aplica cabeçalhos de segurança
├── start.sh               # valores padrão das variáveis + inicia o nginx
└── Dockerfile             # build context = raiz do repositório
```

## Variáveis (Railway → serviço `landing` → Variables)

| Variável | Homologação | Produção |
|---|---|---|
| `SITE_URL` | domínio da landing de homologação | domínio da landing (depois: `https://insighta.com.br`) |
| `APP_URL` | frontend de homologação | frontend de produção (depois: `https://app.insighta.com.br`) |
| `CONTACT_URL` | igual à produção | link do WhatsApp comercial (`https://wa.me/55DDDNUMERO?text=...`). Sem ele: `APP_URL/signup` |
| `ROBOTS` | `noindex, nofollow` (padrão) | `index, follow` |
| `RAILWAY_DOCKERFILE_PATH` | `landing/Dockerfile` | `landing/Dockerfile` |

Trocar o domínio ou o WhatsApp é só mudar a variável. Não precisa mexer no HTML nem fazer rebuild.

## Regras de conteúdo
- **Nada inventado:** sem depoimentos, logos de clientes ou números de resultado que não existam. A demonstração do painel é marcada como "exemplo ilustrativo com dados fictícios".
- Toda promessa precisa corresponder a algo que o produto faz hoje.
- `src/__tests__/landing.test.ts` protege o SEO (título, descrição, canonical, h1 único, JSON-LD), os CTAs e as âncoras.

## Ver localmente
```bash
cd landing/site && python3 -m http.server 8099   # os marcadores __X__ aparecem crus; em produção o nginx troca
```
