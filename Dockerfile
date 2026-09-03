# Vision Ark — build statica Astro servita da nginx.
# Schema allineato agli altri progetti Twobee su Coolify.

FROM node:22-alpine AS builder
WORKDIR /app

# Solo package.json, senza il lockfile: npm install fresco su Linux prende i
# binari nativi corretti (rolldown, sharp). È questa riga il salvagente, non
# il fatto che il lockfile sia o non sia committato.
COPY package.json ./
RUN npm install

# ── Variabili di BUILD, non di runtime ────────────────────────────────────
# Astro inlinea le PUBLIC_* dentro il bundle durante `npm run build`: se
# arrivassero come variabili di runtime, il sito verrebbe costruito con
# l'endpoint vuoto e il form direbbe "invio non configurato".
# In Coolify vanno marcate come *Build Variable*.
ARG PUBLIC_FORM_RELAY_URL
ARG PUBLIC_FORM_RELAY_SITE
ENV PUBLIC_FORM_RELAY_URL=$PUBLIC_FORM_RELAY_URL
ENV PUBLIC_FORM_RELAY_SITE=$PUBLIC_FORM_RELAY_SITE

COPY . .

# Avviso ben visibile nei log di build di Coolify se mancano: il sito si
# costruisce comunque, ma il modulo non invia.
RUN if [ -z "$PUBLIC_FORM_RELAY_URL" ] || [ -z "$PUBLIC_FORM_RELAY_SITE" ]; then \
      echo "################################################################"; \
      echo "  ATTENZIONE: PUBLIC_FORM_RELAY_URL o PUBLIC_FORM_RELAY_SITE"; \
      echo "  non sono impostate come BUILD VARIABLE su Coolify."; \
      echo "  Il sito si costruisce, ma il modulo preventivo non invierà."; \
      echo "################################################################"; \
    fi

RUN npm run build

# ── Runtime: nginx per i file statici ─────────────────────────────────────
FROM nginx:alpine

RUN printf 'server {\n\
    listen 4321;\n\
    server_name _;\n\
    port_in_redirect off;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    location / {\n\
        try_files $uri $uri/ =404;\n\
    }\n\
\n\
    # 404 vero con pagina vera: il sito ha piu pagine, non e una SPA.\n\
    # Rimandare tutto alla home restituirebbe la home con stato 404.\n\
    error_page 404 /404.html;\n\
    location = /404.html { internal; }\n\
\n\
    # I file con hash nel nome (immagini e css generati da Astro) non\n\
    # cambiano mai a parita di nome: si possono cacheare per sempre.\n\
    location /_astro/ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
\n\
    location = /index.html { add_header Cache-Control "no-cache"; }\n\
\n\
    gzip on;\n\
    gzip_vary on;\n\
    gzip_min_length 512;\n\
    gzip_types text/plain text/css application/json application/javascript text/xml image/svg+xml application/wasm;\n\
}\n' > /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 4321
CMD ["nginx", "-g", "daemon off;"]
