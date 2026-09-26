# Dockerfile — sistema (app React) servido pelo nginx.
#
# Substitui o `vite preview`, que a própria documentação do Vite diz não ser
# servidor de produção. O nginx entrega os cabeçalhos de segurança de verdade
# (CSP com frame-ancestors, HSTS, nosniff, Referrer-Policy, Permissions-Policy),
# o que a <meta> do HTML não consegue, e cacheia os arquivos com hash.
#
# A landing tem o próprio Dockerfile (landing/Dockerfile). Não há
# railway.toml na raiz de propósito: a Railway aplicaria o mesmo arquivo
# aos dois serviços. Cada serviço tem a configuração no painel (app:
# Dockerfile path `Dockerfile`, healthcheck /health).

# Debian (glibc): o package-lock não traz o binário do Rollup para musl (Alpine).
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# A Railway passa as variáveis do serviço como build args quando declaradas
# aqui. O Vite grava os VITE_* no bundle no momento do build.
ARG VITE_API_BASE_URL
ARG VITE_APP_ENV
ARG VITE_GOOGLE_OAUTH_CLIENT_ID
ARG VITE_SENTRY_DSN
ARG VITE_SUPPORT_WHATSAPP
ARG VITE_SUPPORT_EMAIL
RUN npm run build

FROM nginx:1.27-alpine
ARG VITE_API_BASE_URL
# Origem da API liberada no connect-src da CSP (o start.sh tira o caminho).
ENV API_BASE_URL=${VITE_API_BASE_URL}
RUN rm -f /etc/nginx/conf.d/default.conf
COPY ops/app/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY ops/app/start.sh /start.sh
COPY --from=build /app/dist /usr/share/nginx/html
RUN chmod +x /start.sh
CMD ["/start.sh"]
