# ───────────────────────── Base ─────────────────────────
FROM debian:bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive

# 1) Dependências mínimas + ffmpeg
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      curl ca-certificates ffmpeg \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# 2) yt-dlp binário estático (última versão)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
    -o /usr/local/bin/yt-dlp \
 && chmod +x /usr/local/bin/yt-dlp

# 3) Instala Deno
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh
ENV DENO_DIR=/deno-dir

# ───────────────────────── App ─────────────────────────
WORKDIR /app
COPY server.ts .

EXPOSE 8000
CMD ["deno", "run",
     "--allow-net",
     "--allow-run=yt-dlp,ffmpeg",
     "--allow-read=/tmp",
     "--allow-write=/tmp",
     "server.ts"]
