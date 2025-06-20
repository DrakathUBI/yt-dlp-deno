import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const PORT = Number(Deno.env.get("PORT") ?? "8000");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  let body: { url?: string; format?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Corpo inválido, JSON esperado" }, 400);
  }

  const { url: videoUrl, format = "mp4" } = body ?? {};
  if (!videoUrl) return json({ error: "URL é obrigatória" }, 400);

  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
  if (!youtubeRegex.test(videoUrl)) {
    return json({ error: "URL do YouTube inválida" }, 400);
  }

  // Infos do vídeo
  const infoOut = await new Deno.Command("yt-dlp", {
    args: ["-j", "--no-playlist", videoUrl],
    stdout: "piped",
  }).output();
  if (infoOut.code !== 0) return json({ error: "Erro ao obter informações" }, 500);

  const info = JSON.parse(new TextDecoder().decode(infoOut.stdout));
  const safe = (info.title as string).replace(/[^a-zA-Z0-9]/g, "_").substring(0, 50);
  const ext = format === "mp3" ? "mp3" : "mp4";
  const outfile = `/tmp/${safe}_${Date.now()}.${ext}`;

  // Baixa / extrai áudio
  const args = [
    "--output", outfile, "--no-playlist",
    ...(format === "mp3"
      ? ["--extract-audio", "--audio-format", "mp3", "--audio-quality", "192K"]
      : ["--format", "best[height<=720]"]),
    videoUrl,
  ];
  const dl = await new Deno.Command("yt-dlp", { args }).output();
  if (dl.code !== 0) return json({ error: "Falha no download" }, 500);

  // Stream para o cliente
  const file = await Deno.open(outfile, { read: true });
  const ct = format === "mp3" ? "audio/mpeg" : "video/mp4";
  const response = new Response(file.readable, {
    headers: {
      ...cors,
      "Content-Type": ct,
      "Content-Disposition": `attachment; filename="${outfile.split("/").pop()}"`,
    },
  });

  // limpa /tmp em background
  file.close();
  Deno.remove(outfile).catch(() => {});

  return response;
}, { port: PORT });

