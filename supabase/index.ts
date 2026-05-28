import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Cliente Supabase ────────────────────────────────────────────
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ── Buscar emails via IMAP ──────────────────────────────────────
async function fetchNewEmails(account: EmailAccount): Promise<Email[]> {
  const { ImapFlow } = await import("npm:imapflow@1");

  const client = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: true,
    auth: {
      user: account.email,
      pass: account.password,
    },
    logger: false,
  });

  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  const emails: Email[] = [];

  try {
    // Emails das últimas 6 horas
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000);

    for await (const msg of client.fetch(
      { since },
      { envelope: true, bodyStructure: true, bodyParts: ["1"] }
    )) {
      const bodyPart = msg.bodyParts?.get("1");
      const body = bodyPart ? new TextDecoder().decode(bodyPart) : "";

      emails.push({
        messageId: msg.envelope.messageId ?? `${account.id}-${msg.uid}`,
        subject: msg.envelope.subject ?? "(sem assunto)",
        from: msg.envelope.from?.[0]?.address ?? "",
        fromName: msg.envelope.from?.[0]?.name ?? "",
        date: msg.envelope.date ?? new Date(),
        body,
      });
    }
  } finally {
    lock.release();
    await client.logout();
  }

  return emails;
}

// ── Verificar se email casa com uma regra ───────────────────────
function matchesRule(email: Email, rule: FilterRule): boolean {
  if (rule.match_from) {
    if (!email.from.toLowerCase().includes(rule.match_from.toLowerCase())) {
      return false;
    }
  }
  if (rule.match_subject) {
    if (!email.subject.toLowerCase().includes(rule.match_subject.toLowerCase())) {
      return false;
    }
  }
  if (rule.match_keyword) {
    if (!email.body.toLowerCase().includes(rule.match_keyword.toLowerCase())) {
      return false;
    }
  }
  return true;
}

// ── Enviar mensagem no WhatsApp via Z-API ───────────────────────
async function sendWhatsApp(text: string): Promise<void> {
  const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
  const token = Deno.env.get("ZAPI_TOKEN");
  const phone = Deno.env.get("WHATSAPP_PHONE");

  if (!instanceId || !token || !phone) {
    console.warn("WhatsApp não configurado, pulando...");
    return;
  }

  const res = await fetch(
    `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message: text }),
    }
  );

  if (!res.ok) {
    console.error("Erro ao enviar WhatsApp:", await res.text());
  }
}

// ── Enviar mensagem no Telegram ─────────────────────────────────
async function sendTelegram(htmlText: string): Promise<void> {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!botToken || !chatId) {
    console.warn("Telegram não configurado, pulando...");
    return;
  }

  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: htmlText,
        parse_mode: "HTML",
      }),
    }
  );

  if (!res.ok) {
    console.error("Erro ao enviar Telegram:", await res.text());
  }
}

// ── Formatar mensagem de notificação ────────────────────────────
function formatMessage(
  email: Email,
  account: EmailAccount,
  rule: FilterRule
): { plain: string; html: string } {
  const dateStr = new Date(email.date).toLocaleString("pt-BR", {
    timeZone: "Africa/Luanda",
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

// ── Handler principal ───────────────────────────────────────────
Deno.serve(async (_req) => {
  console.log("▶ Iniciando verificação de emails...");

  try {
    const { data: accounts, error: accErr } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("active", true);

    if (accErr) throw accErr;
    if (!accounts?.length) {
      return new Response(JSON.stringify({ message: "Nenhuma conta ativa" }), { status: 200 });
    }

    const { data: rules, error: ruleErr } = await supabase
      .from("filter_rules")
      .select("*")
      .eq("active", true);

    if (ruleErr) throw ruleErr;
    if (!rules?.length) {
      return new Response(JSON.stringify({ message: "Nenhuma regra ativa" }), { status: 200 });
    }

    let totalNotified = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      try {
        console.log(`📬 Verificando: ${account.label}`);
        const emails = await fetchNewEmails(account);
        console.log(`  → ${emails.length} email(s) encontrado(s)`);

        for (const email of emails) {
          // Checar duplicatas
          const { data: existing } = await supabase
            .from("notified_emails")
            .select("id")
            .eq("account_id", account.id)
            .eq("message_id", email.messageId)
            .maybeSingle();

          if (existing) continue;

          // Testar cada regra
          let matched = false;
          for (const rule of rules) {
            if (!matchesRule(email, rule)) continue;

            const { plain, html } = formatMessage(email, account, rule);

            const sends: Promise<void>[] = [];
            if (rule.notify_whatsapp) sends.push(sendWhatsApp(plain));
            if (rule.notify_telegram) sends.push(sendTelegram(html));
            await Promise.all(sends);

            // Registrar notificação
            await supabase.from("notified_emails").upsert({
              account_id: account.id,
              message_id: email.messageId,
              subject: email.subject,
              from_address: email.from,
              matched_rule: rule.name,
            });

            totalNotified++;
            matched = true;
            console.log(`  ✓ Notificado: "${email.subject}" (regra: ${rule.name})`);
            break; // Uma notificação por email
          }

          if (!matched) {
            // Registrar mesmo sem match para não verificar de novo
            await supabase.from("notified_emails").upsert({
              account_id: account.id,
              message_id: email.messageId,
              subject: email.subject,
              from_address: email.from,
              matched_rule: null,
            });
          }
        }
      } catch (err) {
        const msg = `Erro na conta ${account.label}: ${err.message}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    return new Response(
      JSON.stringify({ notificacoes_enviadas: totalNotified, erros: errors }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro geral:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});

// ── Tipos ───────────────────────────────────────────────────────
interface EmailAccount {
  id: string;
  label: string;
  imap_host: string;
  imap_port: number;
  email: string;
  password: string;
}

interface FilterRule {
  id: string;
  name: string;
  match_from: string | null;
  match_subject: string | null;
  match_keyword: string | null;
  notify_whatsapp: boolean;
  notify_telegram: boolean;
}

interface Email {
  messageId: string;
  subject: string;
  from: string;
  fromName: string;
  date: Date;
  body: string;
}