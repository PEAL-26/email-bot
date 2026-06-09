import type { Email, EmailAccount, FilterRule } from "./types.ts";

export interface FormattedMessage {
  plain: string;
  html: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function formatMessage(
  email: Email,
  account: EmailAccount,
  rule: FilterRule,
  timezone = "Africa/Luanda",
): FormattedMessage {
  const dateStr = new Date(email.date).toLocaleString("pt-BR", {
    timeZone: timezone,
  });

  const preview = email.body
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);

  const fromDisplay = email.fromName
    ? `${escapeHtml(email.fromName)} &lt;${escapeHtml(email.from)}&gt;`
    : escapeHtml(email.from);

  const html =
    `📧 <b>Novo email — ${escapeHtml(account.label)}</b>\n\n` +
    `<b>De:</b> ${fromDisplay}\n` +
    `<b>Assunto:</b> ${escapeHtml(email.subject)}\n` +
    `<b>Regra:</b> ${escapeHtml(rule.name)}\n` +
    `<b>Data:</b> ${escapeHtml(dateStr)}\n` +
    (preview
      ? `\n<i>${escapeHtml(preview)}${email.body.length > 200 ? "…" : ""}</i>`
      : "");

  const plain = html.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

  return { plain, html };
}
