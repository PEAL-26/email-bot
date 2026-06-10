import { scanEmails } from "./supabase/functions/_shared/scanner.ts";

const dashboard = await Deno.readTextFile("./dashboard.html");

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname === "/") {
    return new Response(dashboard, {
      headers: { "Content-Type": "text/html" },
    });
  }

  if (req.method === "GET" && url.pathname === "/health") {
    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method === "POST" && url.pathname === "/scan") {
    try {
      let filters = undefined;
      try {
        const body = await req.json().catch(() => null);
        if (body && body.filters) filters = body.filters;
      } catch { /* no body */ }

      const result = await scanEmails({
        supabaseUrl: Deno.env.get("SUPABASE_URL")!,
        supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        telegramBotToken: Deno.env.get("TELEGRAM_BOT_TOKEN"),
        telegramChatId: Deno.env.get("TELEGRAM_CHAT_ID"),
        zapiInstanceId: Deno.env.get("ZAPI_INSTANCE_ID"),
        zapiToken: Deno.env.get("ZAPI_TOKEN"),
        whatsappPhone: Deno.env.get("WHATSAPP_PHONE"),
        filters,
      });
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (req.method === "POST" && url.pathname === "/update-github-cron") {
    try {
      const body = await req.json();
      const cron = body.cron;
      if (!cron) throw new Error("Campo 'cron' é obrigatório.");

      const token = Deno.env.get("GITHUB_PAT");
      const owner = Deno.env.get("GITHUB_OWNER");
      const repo = Deno.env.get("GITHUB_REPO");
      if (!token || !owner || !repo) throw new Error("GITHUB_PAT, GITHUB_OWNER e GITHUB_REPO devem estar configurados.");

      const resp = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/variables/SCAN_CRON`,
        {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: "SCAN_CRON", value: cron }),
        },
      );

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`GitHub API: ${resp.status} ${errText}`);
      }

      return new Response(JSON.stringify({ success: true, cron }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Not found", { status: 404 });
});
