import "dotenv/config";
import { createServer } from "http";
import { readFileSync } from "fs";
import { scanEmails } from "../../supabase/functions/_shared/scanner.ts";

function readBody(req: import("http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => data += chunk);
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const dashboard = readFileSync(new URL("../../dashboard.html", import.meta.url), "utf-8");

const server = createServer(async (req, res) => {
  const writeJson = (status: number, data: any) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };

  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(dashboard);
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    writeJson(200, { status: "ok" });
    return;
  }

  if (req.method === "POST" && req.url === "/scan") {
    try {
      let filters = undefined;
      try {
        const bodyText = await readBody(req);
        const body = JSON.parse(bodyText);
        if (body && body.filters) filters = body.filters;
      } catch { /* no body */ }

      const result = await scanEmails({
        supabaseUrl: process.env.SUPABASE_URL!,
        supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
        telegramChatId: process.env.TELEGRAM_CHAT_ID,
        zapiInstanceId: process.env.ZAPI_INSTANCE_ID,
        zapiToken: process.env.ZAPI_TOKEN,
        whatsappPhone: process.env.WHATSAPP_PHONE,
        filters,
      });
      writeJson(200, result);
      return;
    } catch (err: any) {
      writeJson(500, { error: err.message });
      return;
    }
  }

  if (req.method === "POST" && req.url === "/update-github-cron") {
    try {
      const bodyText = await readBody(req);
      const body = JSON.parse(bodyText);
      const cron = body.cron;
      if (!cron) throw new Error("Campo 'cron' é obrigatório.");

      const token = process.env.GITHUB_PAT;
      const owner = process.env.GITHUB_OWNER;
      const repo = process.env.GITHUB_REPO;
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

      writeJson(200, { success: true, cron });
      return;
    } catch (err: any) {
      writeJson(500, { error: err.message });
      return;
    }
  }

  res.writeHead(404);
  res.end("Not found");
});

const PORT = parseInt(process.env.PORT || "3000", 10);
server.listen(PORT, () => console.log(`🚀 Servidor em http://localhost:${PORT}`));
