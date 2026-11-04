# syntax=docker/dockerfile:1
# Build context: loginrek-dashboard/
#   docker build --build-arg VITE_API_URL=https://loginrek-api.bidtech.co.id -t loginrek-dashboard loginrek-dashboard
#
# Dashboard = SPA statis (React + Vite + React Router). Hasil build disajikan Nginx;
# TLS, domain, dan header keamanan ditangani Traefik (lihat docker-compose.prod.yml).

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY . .
# Origin API dibakar ke bundle saat build (Vite membaca VITE_* dari environment), jadi WAJIB diisi:
# CI mengisinya dari env API_URL di workflow, compose dari API_DOMAIN. Tanpa ini request akan
# relatif ke domain dashboard dan gagal (API ada di domain terpisah).
ARG VITE_API_URL
RUN test -n "$VITE_API_URL" || { echo "ERROR: build-arg VITE_API_URL wajib diisi"; exit 1; }
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine
# Nginx hanya menyajikan file statis. try_files ke /index.html dibutuhkan React Router
# (BrowserRouter): URL seperti /employees/new bukan file di disk, jadi tanpanya refresh / link
# langsung ke halaman itu 404. /assets/* bernama hash (aman di-cache lama); index.html jangan di-cache
# agar rilis baru langsung terpakai.
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;
    server_tokens off;
    root /usr/share/nginx/html;
    index index.html;

    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
