# Dockerfile simplificado e mais robusto
FROM debian:bookworm-slim

# Evita prompts interativos (ex.: tzdata)
ENV DEBIAN_FRONTEND=noninteractive
# cria cache do Deno fora das camadas principais
ENV DENO_DIR=/deno-dir

# ── 1. Atualiza APT e instala dependências ──
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      curl ca-certificates ffmpeg python3 python3-pip \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# ── 2. Instala yt-dlp via pip ──
RUN pip install --no-cache-dir yt-dlp

# ── 3. Instala o binário do Deno ──
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh

# ── 4. Configura app ──
WORKDIR /app
COPY server.ts .

EXPOSE 8000
CMD ["deno", "run", "--allow-net", "--allow-run=yt-dlp,ffmpeg", "--allow-read=/tmp", "--allow-write=/tmp", "server.ts"]
