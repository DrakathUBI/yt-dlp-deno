/**
 * server.ts – API de download YouTube (yt-dLP + ffmpeg)
 * Aceita:
 *   • POST  { url, format }          (JSON)
 *   • GET   ?p=<JSON url-encoded>    (vindo de redirect 307)
 * Devolve:
 *   • MP4 (720 p máx) ou MP3
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* Utilidade p/ respostas JSON */
function json(msg: unknown, status = 200) {
  return new Response(JSON.stringify(msg), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/* Porta automática (Railway, Render, etc.) */
const PORT = Number(Deno.env.get("PORT") ?? "8000");

/* ─────────────────────────────── serve ─────────────────────────────── */
serve(async (req) => {
  /* Pre-flight CORS */
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  /* 1. Obtém o corpo JSON (POST direto ou redirect GET) */
  let bodyText: string;
  if (req.method === "GET") {
    const p = new URL(req.url).searchParams.get("p");
    bodyText = p ? decodeURIComponent(p) : "";
  } else {
    bodyText = await req.text();
  }

  let data: { url?: string; format?: string };
  try {
    data = JSON.parse(bodyText);
  } catch {
    return json({ error: "Corpo inválido" }, 400);
  }

  const { url: videoUrl, format = "mp4" } = data;
  if (!videoUrl) return json({ error: "URL é obrigatória" }, 400);

  /* 2. Pega info do vídeo */
  const infoRes = await new Deno.Command("yt-dlp", {
    args: ["-j", "--no-playlist", videoUrl],
    stdout: "piped",
  }).output();
  if (infoRes.code !== 0) return json({ error: "Erro ao obter info" }, 500);

  const info = JSON.parse(new TextDecoder().decode(infoRes.stdout));
  const safe = (info.title as string).replace(/[^a-zA-Z0-9]/g, "_").substring(0, 50);
  const ext  = format === "mp3" ? "mp3" : "mp4";
  const outfile = `/tmp/${safe}_${Date.now()}.${ext}`;

  /* 3. Monta args p/ download ou extração */
  const yArgs = [
    "--output", outfile, "--no-playlist",
    ...(format === "mp3"
      ? ["--extract-audio", "--audio-format", "mp3", "--audio-quality", "192K"]
      : ["--format", "best[height<=720]"]),
    videoUrl,
  ];

  const dl = await new Deno.Command("yt-dlp", { args: yArgs }).output();
  if (dl.code !== 0) return json({ error: "Falha no download" }, 500);

  /* 4. Stream do arquivo */
  const file = await Deno.open(outfile, { read: true });
  const ct   = format === "mp3" ? "audio/mpeg" : "video/mp4";

  const response = new Response(file.readable, {
    headers: {
      ...cors,
      "Content-Type": ct,
      "Content-Disposition": `attachment; filename="${outfile.split("/").pop()}"`,
    },
  });

  /* 5. Limpeza assíncrona */
  file.close();
  Deno.remove(outfile).catch(() => {});

  return response;
}, { port: PORT });
