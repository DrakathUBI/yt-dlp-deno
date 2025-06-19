# yt-dlp-deno

Minimal Deno server that downloads YouTube videos (mp4) or extracts audio (mp3) using `yt-dlp`.

## Files
- `server.ts` – Deno HTTP server
- `Dockerfile` – builds an image with yt-dlp, ffmpeg and Deno

## Build & Run locally
```bash
docker build -t yt-dlp-deno .
docker run -p 8000:8000 yt-dlp-deno
```"# yt-dlp-deno" 
