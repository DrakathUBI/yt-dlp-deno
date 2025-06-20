import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const { url: videoUrl, format } = await req.json();
    if (!videoUrl) {
      return new Response(JSON.stringify({
        error: 'URL é obrigatória'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Validate YouTube URL
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeRegex.test(videoUrl)) {
      return new Response(JSON.stringify({
        error: 'URL do YouTube inválida'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(Starting download for: ${videoUrl} in format: ${format});
    // Check if yt-dlp is available
    let ytDlpCommand;
    try {
      const testCommand = new Deno.Command("yt-dlp", {
        args: [
          "--version"
        ],
        stdout: "piped",
        stderr: "piped"
      });
      await testCommand.output();
      ytDlpCommand = "yt-dlp";
    } catch  {
      // Fallback to youtube-dl if yt-dlp is not available
      try {
        const testCommand = new Deno.Command("youtube-dl", {
          args: [
            "--version"
          ],
          stdout: "piped",
          stderr: "piped"
        });
        await testCommand.output();
        ytDlpCommand = "youtube-dl";
      } catch  {
        return new Response(JSON.stringify({
          error: 'yt-dlp ou youtube-dl não está instalado no servidor'
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    }
    // Get video info first
    const infoCommand = new Deno.Command(ytDlpCommand, {
      args: [
        "--print",
        "title,thumbnail,duration",
        "--no-download",
        videoUrl
      ],
      stdout: "piped",
      stderr: "piped"
    });
    const infoResult = await infoCommand.output();
    if (infoResult.code !== 0) {
      const error = new TextDecoder().decode(infoResult.stderr);
      console.error('Info command error:', error);
      return new Response(JSON.stringify({
        error: 'Erro ao obter informações do vídeo'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const infoText = new TextDecoder().decode(infoResult.stdout);
    const lines = infoText.trim().split('\n');
    const title = lines[0] || 'Video do YouTube';
    const thumbnail = lines[1] || '';
    const duration = lines[2] || '';
    // Create a unique filename
    const timestamp = Date.now();
    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const outputTemplate = /tmp/${safeTitle}_${timestamp}.%(ext)s;
    // Prepare download command
    const args = [
      "--output",
      outputTemplate,
      "--no-playlist"
    ];
    if (format === 'mp3') {
      args.push("--extract-audio", "--audio-format", "mp3", "--audio-quality", "192K");
    } else {
      args.push("--format", "best[height<=720]");
    }
    args.push(videoUrl);
    console.log(Running command: ${ytDlpCommand} ${args.join(' ')});
    // Execute download
    const command = new Deno.Command(ytDlpCommand, {
      args,
      stdout: "piped",
      stderr: "piped"
    });
    const result = await command.output();
    if (result.code !== 0) {
      const error = new TextDecoder().decode(result.stderr);
      console.error('Download error:', error);
      return new Response(JSON.stringify({
        error: 'Erro ao baixar o vídeo. Verifique se a URL é válida.'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Find the downloaded file
    const files = [];
    for await (const dirEntry of Deno.readDir("/tmp")){
      if (dirEntry.isFile && dirEntry.name.includes(${safeTitle}_${timestamp})) {
        files.push(dirEntry.name);
      }
    }
    if (files.length === 0) {
      return new Response(JSON.stringify({
        error: 'Arquivo não foi criado corretamente'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const filename = files[0];
    const filepath = /tmp/${filename};
    console.log(File created: ${filename});
    // Read file content
    const fileContent = await Deno.readFile(filepath);
    const contentType = format === 'mp3' ? 'audio/mpeg' : 'video/mp4';
    // Clean up temp file
    try {
      await Deno.remove(filepath);
    } catch (e) {
      console.log('Could not remove temp file:', e);
    }
    // Return file as download
    return new Response(fileContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Disposition': attachment; filename="${filename}"
      }
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({
      error: 'Erro interno do servidor: ' + error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
