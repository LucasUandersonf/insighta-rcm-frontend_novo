# Ambientes — Insighta (frontend)

O guia completo (ambientes, fluxo de Git, release, hotfix, rollback, migrações e checklist) fica no backend:
**[`insighta-rcm-backend_novo/AMBIENTES.md`](https://github.com/LucasUandersonf/insighta-rcm-backend_novo/blob/main/AMBIENTES.md)**.

Resumo do que é específico do frontend:

| | Produção | Homologação |
|---|---|---|
| Branch | `main` | `develop` |
| Ambiente Railway | `production` | `homologacao` |
| `VITE_API_BASE_URL` / `VITE_API_URL` | API de produção | API de **homologação** |
| `VITE_APP_ENV` | (não definida) | `homologacao` |

`VITE_APP_ENV=homologacao` mostra uma faixa amarela "HOMOLOGAÇÃO — dados fictícios" no topo de todas as telas, inclusive no login, e põe `[HML]` no título da aba (`src/components/layout/EnvironmentBanner.tsx`). As variáveis `VITE_*` entram no **build**, então, depois de mudar uma delas na Railway, faça um novo deploy.

Fluxo: `feature/*` → PR para `develop` (homologação) → PR `develop` → `main` (produção). O CI (`.github/workflows/ci.yml`: lint, testes, tipos, build e audit) roda nas duas branches.
