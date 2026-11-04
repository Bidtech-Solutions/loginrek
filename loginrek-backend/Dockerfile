# syntax=docker/dockerfile:1
# Build context: loginrek-backend/   (docker build -t loginrek-backend loginrek-backend)
#
# Binary statis (tanpa CGO): SQLite memakai driver pure-Go dan WebP di-encode lewat Go murni,
# jadi image runtime cukup alpine kecil.

ARG GO_VERSION=1.22

FROM golang:${GO_VERSION}-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

FROM alpine:3.20
# tzdata: backend menghitung "hari ini" dengan zona Asia/Jakarta. wget: untuk HEALTHCHECK.
RUN apk add --no-cache ca-certificates tzdata wget \
 && adduser -D -u 10001 app
WORKDIR /app
COPY --from=build /out/api /app/api
# public/uploads = fallback penyimpanan foto saat RustFS tidak aktif dan tempat aset bawaan; di compose
# production di-mount sebagai volume. tmp = lokasi SQLite hanya bila DB_DRIVER=sqlite.
RUN mkdir -p public/uploads/attendances public/uploads/avatars tmp \
 && chown -R app:app /app
USER app

# Semua konfigurasi lain (DB_*, JWT_SECRET, RUSTFS_*, CORS_ORIGINS, SEED_ADMIN_*) disuntik lewat
# environment oleh docker-compose.prod.yml; tidak ada .env di dalam image.
ENV PORT=3333 APP_ENV=production TZ=Asia/Jakarta
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3333/health >/dev/null || exit 1
CMD ["/app/api"]
