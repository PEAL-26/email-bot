export async function sendTelegram(
  htmlText: string,
  botToken?: string,
  chatId?: string,
): Promise<void> {
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
    },
  );

  if (!res.ok) {
    console.error("Erro ao enviar Telegram:", await res.text());
  }
}
