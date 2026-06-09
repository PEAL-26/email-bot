import { sendTelegram } from "../../../src/shared/notifiers/telegram.ts";

const GITHUB_TOKEN = Deno.env.get("GITHUB_PAT")!;
const GITHUB_OWNER = Deno.env.get("GITHUB_OWNER")!;
const GITHUB_REPO = Deno.env.get("GITHUB_REPO")!;
const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");

const WORKFLOW_FILE = "scan-emails.yml";

async function triggerGitHubWorkflow(reason: string): Promise<boolean> {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "email-bot-telegram-webhook",
    },
    body: JSON.stringify({
      ref: "main",
      inputs: { reason },
    }),
    signal: AbortSignal.timeout(10000),
  });

  return res.status === 204;
}

function sanitizeReason(raw: string): string {
  return raw
    .slice(0, 200)
    .replace(/[^\w\sÀ-ÿ-]/g, "")
    .trim();
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const secret = Deno.env.get("TELEGRAM_SECRET_TOKEN");
    if (secret) {
      const header = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (header !== secret) {
        return new Response("Forbidden", { status: 403 });
      }
    }

    const update = await req.json();

    const message = update.message;
    if (!message || !message.text) {
      return new Response("OK");
    }

    const chatId = String(message.chat.id);

    const allowedChats = Deno.env.get("TELEGRAM_ALLOWED_CHAT_IDS");
    if (allowedChats) {
      const allowed = allowedChats.split(",").map((s) => s.trim());
      if (!allowed.includes(chatId)) {
        return new Response("OK");
      }
    }

    const text = (message.text as string).trim();

    if (!text.startsWith("/scan")) {
      return new Response("OK");
    }

    const reason = sanitizeReason(text.replace("/scan", "").trim()) || "Trigger manual via Telegram";
    const success = await triggerGitHubWorkflow(reason);

    const responseText = success
      ? "✅ Varredura de emails iniciada! O resultado será enviado em alguns minutos."
      : "❌ Erro ao iniciar varredura. Verifique os logs.";

    if (TG_TOKEN && chatId) {
      await sendTelegram(responseText, TG_TOKEN, chatId);
    }

    return new Response("OK");
  } catch (err: any) {
    console.error("Erro no webhook Telegram:", err);
    return new Response("OK");
  }
});
