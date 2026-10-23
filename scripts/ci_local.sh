#!/usr/bin/env bash
# CI local — os MESMOS passos de .github/workflows/ci.yml, rodados na
# máquina de quem vai abrir/aprovar o PR.
#
# DECISÃO — por que existe
# -------------------------------------------------------------------
# O GitHub Actions pode ficar indisponível (cobrança da conta, cota de
# minutos). Sem ele, nada pode ir para develop/main "no escuro": este
# script é o portão substituto. Ver ESTEIRA.md do backend, seção "Sem
# GitHub Actions". A jornada no navegador (e2e) roda pelo script do
# backend: scripts/ci_local.sh --e2e, com este repositório ao lado.
#
# Uso:
#   scripts/ci_local.sh
set -uo pipefail

cd "$(dirname "$0")/.."

COMMIT="$(git rev-parse --short HEAD)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
DIRTY=""
[[ -n "$(git status --porcelain --untracked-files=no)" ]] && DIRTY=" (com alterações não commitadas)"

declare -a RESULTS=()
FAILED=0

step() {
  local name="$1"; shift
  echo
  echo "=== $name"
  local start=$SECONDS
  if "$@"; then
    RESULTS+=("OK     $name ($((SECONDS - start))s)")
  else
    RESULTS+=("FALHOU $name ($((SECONDS - start))s)")
    FAILED=1
  fi
}

step "Instalar dependências (npm ci)" npm ci --no-audit --no-fund
step "Lint (ESLint)" npm run lint
step "Testes (Vitest + Testing Library + axe-core)" npm test
step "Tipos e build de produção" npm run build
step "Vulnerabilidades nas dependências de produção" npm audit --omit=dev --audit-level=high

echo
echo "================ CI local — insighta-rcm-frontend ================"
echo "branch: $BRANCH   commit: $COMMIT$DIRTY"
echo "quando: $(date -u '+%Y-%m-%d %H:%M UTC')"
printf '%s\n' "${RESULTS[@]}"
if [[ $FAILED == 0 ]]; then echo "RESULTADO: VERDE"; else echo "RESULTADO: VERMELHO"; fi
exit $FAILED
