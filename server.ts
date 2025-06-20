import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), {
    status: s,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const PORT = Number(Deno.env.get("PORT") ?? "8000");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  /* ─── Lê o corpo vindo de duas formas ───────────────────────────────
     1. POST direto  → body JSON
     2. Redirect 307 → GET ?p=<json>
  */
  let bodyText: string;
  if (req.method === "GET") {
    bodyText = decodeURIComponent(new URL(req.url).searchParams.get("p") ?? "");
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

  // info vídeo
  const infoOut = await new Deno.Command("yt-dlp", {
    args: ["-j", "--no-playlist", videoUrl],
    stdout: "piped",
  }).output();
  if (infoOut.code !== 0) return json({ error: "Erro ao obter info" }, 500);

  const info = JSON.parse(new TextDecoder().decode(infoOut.stdout));
  const safe = (info.title as string).replace(/[^a-zA-Z0-9]/g, "_").substring(0, 50);
  const ext = format === "mp3" ? "mp3" : "mp4";
  const outfile = `/tmp/${safe}_${Date.now()}.${ext}`;

  // download / extração
  const args = [
    "--output", outfile, "--no-playlist",
    ...(format === "mp3"
      ? ["--extract-audio", "--audio-format", "mp3", "--audio-quality", "192K"]
      : ["--format", "best[height<=720]"]),
    videoUrl,
  ];
  const dl = await new Deno.Command("yt-dlp", { args }).output();
  if (dl.code !== 0) return json({ error: "Falha no download" }, 500);

  const file = await Deno.open(outfile, { read: true });
  const ct = format === "mp3" ? "audio/mpeg" : "video/mp4";
  const resp = new Response(file.readable, {
    headers: {
      ...cors,
      "Content-Type": ct,
      "Content-Disposition": `attachment; filename="${outfile.split("/").pop()}"`,
    },
  });

  // limpeza em segundo plano
  file.close();
  Deno.remove(outfile).catch(() => {});

  return resp;
}, { port: PORT });
