import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Corpo inválido (JSON esperado)" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { url: videoUrl, format = "mp4" } = body;
  if (!videoUrl) {
    return new Response(JSON.stringify({ error: "URL é obrigatória" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1) Confere yt-dlp
  try {
    await new Deno.Command("yt-dlp", { args: ["--version"], stdout: "null" }).output();
  } catch {
    return new Response(JSON.stringify({ error: "yt-dlp não está instalado no servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2) Obtém info em JSON
  const info = JSON.parse(
    new TextDecoder().decode(
      (
        await new Deno.Command("yt-dlp", {
          args: ["-j", "--no-playlist", videoUrl],
          stdout: "piped",
        }).output()
      ).stdout,
    ),
  );
  const safeBase = info.title.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 50);
  const outfile = `/tmp/${safeBase}_${Date.now()}.${format === "mp3" ? "mp3" : "mp4"}`;

  // 3) Monta args de download
  const ytdlpArgs = [
    "--output",
    outfile,
    "--no-playlist",
    ...(format === "mp3"
      ? ["--extract-audio", "--audio-format", "mp3", "--audio-quality", "192K"]
      : ["--format", "best[height<=720]"]),
    videoUrl,
  ];

  const dlp = await new Deno.Command("yt-dlp", { args: ytdlpArgs }).output();
  if (dlp.code !== 0) {
    return new Response(JSON.stringify({ error: "Falha ao baixar o vídeo" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 4) Stream do arquivo
  const file = await Deno.open(outfile, { read: true });
  const contentType = format === "mp3" ? "audio/mpeg" : "video/mp4";

  return new Response(file.readable, {
    headers: {
      ...corsHeaders,
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${outfile.split("/").pop()}"`,
    },
  });
});