# Etapa base com Debian Slim
FROM debian:bookworm-slim

# Instala dependências
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      curl ca-certificates ffmpeg python3 python3-pip \
 && pip install --no-cache-dir yt-dlp \
 && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

ENV DENO_DIR=/deno-dir
RUN mkdir -p $DENO_DIR

WORKDIR /app
COPY server.ts .

EXPOSE 8000

CMD ["deno","run","--allow-net","--allow-run=yt-dlp,ffmpeg","--allow-read=/tmp","--allow-write=/tmp","server.ts"]