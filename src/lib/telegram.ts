/**
 * Alertes Telegram — canal d'alerte opérateur (pannes image, budget, canary).
 *
 * RÈGLE ABSOLUE (MONITORING_SPEC) : ne JAMAIS throw. Si Telegram est down ou
 * non configuré, l'alerte est silencieusement abandonnée — le flux client
 * ne doit jamais dépendre du monitoring.
 *
 * Config : TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (absents = alertes désactivées,
 * les événements restent enregistrés en base).
 */
export async function sendTelegramAlert(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    /* jamais de throw — le monitoring ne casse jamais le flux */
  }
}
