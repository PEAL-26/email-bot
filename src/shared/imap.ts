import type { EmailAccount, Email } from "./types.ts";

export async function fetchNewEmails(
  account: EmailAccount,
  sinceMinutes = 360,
): Promise<Email[]> {
  const { ImapFlow } = await import("imapflow");

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
    const since = new Date(Date.now() - sinceMinutes * 60 * 1000);

    for await (const msg of client.fetch(
      { since },
      { envelope: true, bodyStructure: true, bodyParts: ["1"] },
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
