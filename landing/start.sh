#!/bin/sh
# Valores padrão para rodar sem configuração; na Railway cada ambiente define os seus.
export PORT="${PORT:-8080}"
export SITE_URL="${SITE_URL:-http://localhost:${PORT}}"
export APP_URL="${APP_URL:-https://insighta-rcm-frontendnovo-production.up.railway.app}"
export CONTACT_URL="${CONTACT_URL:-${APP_URL}/signup}"
export CLARITY_ID="${CLARITY_ID:-}"
export GA4_ID="${GA4_ID:-}"
export ROBOTS="${ROBOTS:-noindex, nofollow}"
export NGINX_ENVSUBST_FILTER="^(PORT|SITE_URL|APP_URL|CONTACT_URL|ROBOTS|CLARITY_ID|GA4_ID)$"
exec /docker-entrypoint.sh nginx -g 'daemon off;'
