FROM debian:bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive

# pacotes básicos + ffmpeg + unzip
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates ffmpeg unzip && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# yt-dlp mais recente (3 MB)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
    -o /usr/local/bin/yt-dlp && chmod +x /usr/local/bin/yt-dlp

# Deno
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh
ENV DENO_DIR=/deno-dir

WORKDIR /app
COPY server.ts .

EXPOSE 8000
CMD ["deno","run","--allow-net","--allow-env=PORT",
     "--allow-run=yt-dlp,ffmpeg","--allow-read=/tmp","--allow-write=/tmp",
     "server.ts"]
