#!/bin/sh
# Start do app (ver Dockerfile na raiz). Monta as origens da CSP a partir do
# ambiente e entrega ao envsubst da imagem oficial do nginx.
export PORT="${PORT:-8080}"

# Só a origem (esquema + host + porta), sem caminho: https://api.exemplo.com
API_ORIGIN="$(printf '%s' "${API_BASE_URL:-}" | sed -E 's#^(https?://[^/]+).*#\1#')"
case "$API_ORIGIN" in http://*|https://*) ;; *) API_ORIGIN="" ;; esac
export API_ORIGIN

# Origens extras de connect-src, separadas por espaço (ex.: domínio próprio
# do bucket). Padrão: bucket da Railway (upload direto) e Sentry.
export CSP_CONNECT_EXTRA="${CSP_CONNECT_EXTRA:-https://*.storageapi.dev https://*.sentry.io}"

export NGINX_ENVSUBST_FILTER="^(PORT|API_ORIGIN|CSP_CONNECT_EXTRA)$"
exec /docker-entrypoint.sh nginx -g 'daemon off;'
