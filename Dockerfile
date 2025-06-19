# ────────────── Imagem base ──────────────
FROM debian:bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive

# 1) Dependências + yt-dlp via APT  (nenhum pip!)
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      curl ca-certificates ffmpeg yt-dlp \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# 2) Instala Deno
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh
ENV DENO_DIR=/deno-dir   # cache do Deno fora das camadas

# ────────────── Aplicação ──────────────
WORKDIR /app
COPY server.ts .

EXPOSE 8000
CMD ["deno", "run",
     "--allow-net",
     "--allow-run=yt-dlp,ffmpeg",
     "--allow-read=/tmp",
     "--allow-write=/tmp",
     "server.ts"]
