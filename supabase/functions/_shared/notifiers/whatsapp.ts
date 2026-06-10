export async function sendWhatsApp(
  text: string,
  instanceId?: string,
  token?: string,
  phone?: string,
): Promise<void> {
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
      signal: AbortSignal.timeout(10000),
    },
  );

  if (!res.ok) {
    console.error("Erro ao enviar WhatsApp:", await res.text());
  }
}
