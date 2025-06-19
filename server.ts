import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  let data;
  try {
    data = await req.json();
  } catch {
    return json({ error: "Corpo inválido, JSON esperado" }, 400);
  }

  const { url: videoUrl, format = "mp4" } = data;
  if (!videoUrl) return json({ error: "URL é obrigatória" }, 400);

  try {
    await new Deno.Command("yt-dlp", { args: ["--version"], stdout: "null" }).output();
  } catch {
    return json({ error: "yt-dlp não está instalado" }, 500);
  }

  const infoRaw = await new Deno.Command("yt-dlp", {
    args: ["-j", "--no-playlist", videoUrl],
    stdout: "piped",
  }).output();
  const info = JSON.parse(new TextDecoder().decode(infoRaw.stdout));

  const safe = info.title.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 50);
  const ext = format === "mp3" ? "mp3" : "mp4";
  const outfile = `/tmp/${safe}_${Date.now()}.${ext}`;

  const args = [
    "--output", outfile, "--no-playlist",
    ...(format === "mp3"
      ? ["--extract-audio", "--audio-format", "mp3", "--audio-quality", "192K"]
      : ["--format", "best[height<=720]"]),
    videoUrl,
  ];
  const dl = await new Deno.Command("yt-dlp", { args }).output();
  if (dl.code !== 0) return json({ error: "Falha ao baixar" }, 500);

  const file = await Deno.open(outfile, { read: true });
  const contentType = format === "mp3" ? "audio/mpeg" : "video/mp4";
  return new Response(file.readable, {
    headers: {
      ...cors,
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${outfile.split("/").pop()}"`,
    },
  });
});
