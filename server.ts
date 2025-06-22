// Removed: /// <reference lib="deno.ns" />
declare var Deno: any; // Added to inform TypeScript about the Deno global

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(x: unknown, s = 200) {
  return new Response(JSON.stringify(x), {
    status: s,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const PORT = Number(Deno.env.get("PORT") ?? "8000");
console.log(`[INFO] Servidor Deno escutando na porta ${PORT}`);

// Define o caminho para o arquivo de cookies DENTRO do contêiner
const COOKIES_FILE_PATH = "/app/cookies.txt"; // Ajuste se você copiou para outro local

serve(async (req: Request) => { // Added type Request for req
  const requestTimestamp = new Date().toISOString();
  console.log(`[${requestTimestamp}] Recebida requisição: ${req.method} ${req.url}`);

  if (req.method === "OPTIONS") {
    console.log(`[${requestTimestamp}] Respondendo à requisição OPTIONS (preflight)`);
    return new Response(null, { headers: cors });
  }

  let body;
  try {
    body = await req.json();
    // console.log(`[${requestTimestamp}] Corpo da requisição (JSON):`, body);
  } catch (e) {
    console.error(`[${requestTimestamp}] Erro ao fazer parse do corpo da requisição:`, e);
    return json({ error: "Corpo inválido, JSON esperado" }, 400);
  }

  const { url: videoUrl, format = "mp4" } = body;
  if (!videoUrl) {
    console.warn(`[${requestTimestamp}] URL do vídeo não fornecida.`);
    return json({ error: "URL é obrigatória" }, 400);
  }
  console.log(`[${requestTimestamp}] Processando URL: ${videoUrl}, Formato: ${format}`);

  // Tenta verificar se o arquivo de cookies existe (opcional, mas bom para debug)
  try {
    await Deno.stat(COOKIES_FILE_PATH);
    console.log(`[${requestTimestamp}] Arquivo de cookies encontrado em: ${COOKIES_FILE_PATH}`);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      console.warn(`[${requestTimestamp}] AVISO: Arquivo de cookies não encontrado em ${COOKIES_FILE_PATH}. yt-dlp pode falhar em alguns vídeos.`);
    } else {
      console.warn(`[${requestTimestamp}] AVISO: Erro ao verificar arquivo de cookies em ${COOKIES_FILE_PATH}:`, e.message);
    }
    // Prossegue mesmo se o arquivo de cookies não for encontrado, yt-dlp tentará sem ele.
  }


  // Verificar se yt-dlp está instalado
  try {
    const check = await new Deno.Command("yt-dlp", {
      args: ["--version"],
      stdout: "piped",
      stderr: "piped",
    }).output();

    if (check.code !== 0) {
      const errorMsg = new TextDecoder().decode(check.stderr);
      console.error(`[${requestTimestamp}] yt-dlp não parece estar instalado ou funcionando: ${errorMsg}`);
      return json({ error: `yt-dlp não está instalado ou operacional: ${errorMsg}` }, 500);
    }
    // console.log(`[${requestTimestamp}] Versão do yt-dlp: ${new TextDecoder().decode(check.stdout).trim()}`);
  } catch (e) {
    console.error(`[${requestTimestamp}] Erro ao verificar a versão do yt-dlp:`, e);
    return json({ error: "Não foi possível verificar a instalação do yt-dlp." }, 500);
  }

  // Obter informações do vídeo
  console.log(`[${requestTimestamp}] Obtendo informações para: ${videoUrl}`);
  const infoArgs = ["-j", "--no-playlist", "--cookies", COOKIES_FILE_PATH, videoUrl];
  console.log(`[${requestTimestamp}] Argumentos para info: yt-dlp ${infoArgs.join(" ")}`);
  const infoRaw = await new Deno.Command("yt-dlp", {
    args: infoArgs,
    stdout: "piped",
    stderr: "piped",
  }).output();

  if (infoRaw.code !== 0) {
    const errorMsg = new TextDecoder().decode(infoRaw.stderr);
    console.error(`[${requestTimestamp}] yt-dlp falhou ao obter informações do vídeo. Código: ${infoRaw.code}. Erro: ${errorMsg}`);
    return json({ error: `Falha ao obter informações do vídeo do yt-dlp: ${errorMsg || 'Erro desconhecido'}` }, 500);
  }

  let info;
  try {
    const stdoutDecoded = new TextDecoder().decode(infoRaw.stdout);
    if (!stdoutDecoded.trim()) {
      console.error(`[${requestTimestamp}] Saída do yt-dlp para informações do vídeo está vazia.`);
      return json({ error: "Não foi possível obter informações do vídeo (resposta vazia do yt-dlp)." }, 500);
    }
    info = JSON.parse(stdoutDecoded);
    console.log(`[${requestTimestamp}] Informações do vídeo obtidas: Título - ${info.title ? String(info.title).substring(0, 100) : 'N/A'}`);
  } catch (e) {
    const rawOutput = new TextDecoder().decode(infoRaw.stdout);
    console.error(`[${requestTimestamp}] Falha ao fazer parse do JSON da saída do yt-dlp (info):`, e);
    console.error(`[${requestTimestamp}] Saída bruta do yt-dlp (info) que falhou no parse (primeiros 500 chars):`, rawOutput.substring(0, 500) + (rawOutput.length > 500 ? "..." : ""));
    return json({ error: "Formato de resposta inesperado ao obter informações do vídeo. Verifique os logs do servidor." }, 500);
  }

  // Sanitizar título e preparar nome do arquivo
  const safeTitle = info.title ? String(info.title).replace(/[^a-zA-Z0-9À-ú\s_-]/g, "_").replace(/\s+/g, "_").substring(0, 80) : "video_sem_titulo";
  const ext = format === "mp3" ? "mp3" : "mp4";
  const filename = `${safeTitle}_${Date.now()}.${ext}`;
  const outfile = `/tmp/${filename}`; // yt-dlp escreve em /tmp

  console.log(`[${requestTimestamp}] Preparando para baixar como: ${outfile}`);

  const baseDlArgs = [
    "--cookies", COOKIES_FILE_PATH, // <-- ADICIONADO AQUI
    "--output", outfile,
    "--no-playlist",
  ];
  
  const formatArgs = format === "mp3"
      ? ["--extract-audio", "--audio-format", "mp3", "--audio-quality", "192K"]
      : ["--format", "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best[height<=720]/best"];
      
  const dlArgs = [...baseDlArgs, ...formatArgs, videoUrl];
  console.log(`[${requestTimestamp}] Argumentos do yt-dlp para download: yt-dlp ${dlArgs.join(" ")}`);


  const dl = await new Deno.Command("yt-dlp", {
    args: dlArgs,
    stdout: "piped",
    stderr: "piped",
  }).output();

  if (dl.code !== 0) {
    const errorMsg = new TextDecoder().decode(dl.stderr);
    const stdoutMsg = new TextDecoder().decode(dl.stdout);
    console.error(`[${requestTimestamp}] yt-dlp falhou ao baixar o vídeo. Código: ${dl.code}. Erro: ${errorMsg}`);
    console.error(`[${requestTimestamp}] Saída stdout do yt-dlp (download): ${stdoutMsg}`);
    // Tenta remover o arquivo parcial se existir
    try { await Deno.remove(outfile); } catch { /* ignora erro ao remover */ }
    return json({ error: `Falha ao baixar o vídeo: ${errorMsg || stdoutMsg || 'Erro desconhecido no yt-dlp'}` }, 500);
  }

  console.log(`[${requestTimestamp}] Download concluído para: ${outfile}.`);

  let fileStat;
  try {
    fileStat = await Deno.stat(outfile);
    if (!fileStat.isFile || fileStat.size === 0) {
      console.error(`[${requestTimestamp}] Arquivo baixado ${outfile} não é válido ou está vazio. Tamanho: ${fileStat.size}`);
      try { await Deno.remove(outfile); } catch { /* ignora erro ao remover */ }
      return json({ error: "Arquivo baixado parece inválido ou vazio." }, 500);
    }
  } catch (e) {
    console.error(`[${requestTimestamp}] Erro ao verificar o arquivo baixado ${outfile}:`, e);
    return json({ error: "Não foi possível acessar o arquivo baixado no servidor." }, 500);
  }
  
  console.log(`[${requestTimestamp}] Servindo arquivo: ${outfile}, Tamanho: ${fileStat.size}`);
  const file = await Deno.open(outfile, { read: true });
  const ct = format === "mp3" ? "audio/mpeg" : "video/mp4";

  const responseHeaders = new Headers(cors);
  responseHeaders.set("Content-Type", ct);
  responseHeaders.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  responseHeaders.set("Content-Length", String(fileStat.size));

  // O arquivo será removido após ser enviado.
  // Envolve a resposta em uma forma que permite a remoção após o stream ser consumido.
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of file.readable) {
        controller.enqueue(chunk);
      }
      controller.close();
      // Tenta remover o arquivo após o stream ser fechado
      try {
        await Deno.remove(outfile);
        console.log(`[${requestTimestamp}] Arquivo temporário ${outfile} removido com sucesso.`);
      } catch (e) {
        console.error(`[${requestTimestamp}] Falha ao remover o arquivo temporário ${outfile}:`, e);
      }
    },
    cancel() {
      // Se o stream for cancelado (ex: cliente desconecta), tenta fechar o arquivo e remover.
      try {
        file.close();
      } catch (e) {
        // Ignora
      }
      try {
        Deno.remove(outfile); // Tenta remover mesmo em caso de cancelamento
        console.log(`[${requestTimestamp}] Arquivo temporário ${outfile} removido devido ao cancelamento do stream.`);
      } catch (e) {
        // Ignora
      }
    }
  });


  return new Response(stream, {
    status: 200,
    headers: responseHeaders,
  });
}, { port: PORT });
