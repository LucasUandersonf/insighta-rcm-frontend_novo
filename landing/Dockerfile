# landing/Dockerfile — site estático da landing page (build context = raiz do repo).
FROM nginx:1.27-alpine
RUN rm -f /etc/nginx/conf.d/default.conf
COPY landing/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY landing/site /usr/share/nginx/html
COPY landing/start.sh /start.sh
RUN chmod +x /start.sh
CMD ["/start.sh"]
