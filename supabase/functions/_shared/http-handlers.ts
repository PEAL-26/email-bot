import { getEnv, readTextFile } from "./runtime.ts";
import { scanEmails } from "./scanner.ts";

let dashboardHtml: string | null = null;

export async function handleDashboard(): Promise<Response> {
  if (!dashboardHtml) {
    dashboardHtml = await readTextFile("./dashboard.html");
  }
  return new Response(dashboardHtml, {
    headers: { "Content-Type": "text/html" },
  });
}

export async function handleHealth(): Promise<Response> {
  return new Response(JSON.stringify({ status: "ok" }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleScan(req: Request): Promise<Response> {
  try {
    let filters = undefined;
    try {
      const body = await req.json().catch(() => null);
      if (body && body.filters) filters = body.filters;
    } catch { /* no body */ }

    const result = await scanEmails({
      supabaseUrl: getEnv("SUPABASE_URL")!,
      supabaseKey: getEnv("SUPABASE_SERVICE_ROLE_KEY")!,
      telegramBotToken: getEnv("TELEGRAM_BOT_TOKEN"),
      telegramChatId: getEnv("TELEGRAM_CHAT_ID"),
      zapiInstanceId: getEnv("ZAPI_INSTANCE_ID"),
      zapiToken: getEnv("ZAPI_TOKEN"),
      whatsappPhone: getEnv("WHATSAPP_PHONE"),
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

export async function handleUpdateCron(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const cron = body.cron;
    if (!cron) throw new Error("Campo 'cron' é obrigatório.");

    const token = getEnv("GITHUB_PAT");
    const owner = getEnv("GITHUB_OWNER");
    const repo = getEnv("GITHUB_REPO");
    if (!token || !owner || !repo) {
      throw new Error("GITHUB_PAT, GITHUB_OWNER e GITHUB_REPO devem estar configurados.");
    }

    const resp = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/variables/SCAN_CRON`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
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
