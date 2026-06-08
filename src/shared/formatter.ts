import type { Email, EmailAccount, FilterRule } from "./types.ts";

export interface FormattedMessage {
  plain: string;
  html: string;
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

  const html =
    `📧 <b>Novo email — ${account.label}</b>\n\n` +
    `<b>De:</b> ${email.fromName ? `${email.fromName} &lt;${email.from}&gt;` : email.from}\n` +
    `<b>Assunto:</b> ${email.subject}\n` +
    `<b>Regra:</b> ${rule.name}\n` +
    `<b>Data:</b> ${dateStr}\n` +
    (preview ? `\n<i>${preview}${email.body.length > 200 ? "…" : ""}</i>` : "");

  const plain = html.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

  return { plain, html };
}
