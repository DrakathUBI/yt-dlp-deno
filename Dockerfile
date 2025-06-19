FROM debian:bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive

# Instala curl, certificados, ffmpeg, yt-dlp e unzip
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl ca-certificates ffmpeg yt-dlp unzip && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Instala Deno
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh
ENV DENO_DIR=/deno-dir

WORKDIR /app
COPY server.ts .

EXPOSE 8000
CMD ["deno","run","--allow-net","--allow-run=yt-dlp,ffmpeg","--allow-read=/tmp","--allow-write=/tmp","server.ts"]
