/**
 * WhatsApp notification helper — CallMeBot only.
 *
 * API: https://api.callmebot.com/whatsapp.php?phone=PHONE&text=TEXT&apikey=KEY
 * Config (env vars):
 *   CALLMEBOT_PHONE   — phone in international format, no + (e.g. 972501234567)
 *   CALLMEBOT_APIKEY  — API key from CallMeBot activation message
 */

// ─── In-memory dedup guard ────────────────────────────────────────────────
const _sentLeadIds = new Map<string, number>();
const DEDUP_TTL_MS = 5 * 60 * 1000;

export function markLeadNotified(clientId: string): void {
  _sentLeadIds.set(clientId, Date.now());
  const cutoff = Date.now() - DEDUP_TTL_MS;
  for (const [id, ts] of _sentLeadIds.entries()) {
    if (ts < cutoff) _sentLeadIds.delete(id);
  }
}

export function isLeadAlreadyNotified(clientId: string): boolean {
  const ts = _sentLeadIds.get(clientId);
  if (!ts) return false;
  if (Date.now() - ts > DEDUP_TTL_MS) {
    _sentLeadIds.delete(clientId);
    return false;
  }
  return true;
}
// ─────────────────────────────────────────────────────────────────────────

/**
 * Print WhatsApp config to server log on startup.
 */
export function logWhatsAppConfig(): void {
  const phone  = process.env.CALLMEBOT_PHONE?.trim();
  const apikey = process.env.CALLMEBOT_APIKEY?.trim();

  console.log("[WhatsApp:Config] ─────────────────────────────────────────");
  console.log(`[WhatsApp:Config] Provider               : CallMeBot`);
  console.log(`[WhatsApp:Config] CALLMEBOT_PHONE        : ${phone ? `"${phone}"` : "❌ NOT SET"}`);
  console.log(`[WhatsApp:Config] CALLMEBOT_APIKEY       : ${apikey ? `SET (${apikey.length} chars)` : "❌ NOT SET"}`);
  console.log("[WhatsApp:Config] ─────────────────────────────────────────");
}

/**
 * Send a WhatsApp message via CallMeBot.
 */
export async function sendCallMeBot(message: string): Promise<void> {
  const phone  = process.env.CALLMEBOT_PHONE?.trim();
  const apikey = process.env.CALLMEBOT_APIKEY?.trim();
  if (!phone || !apikey) {
    console.warn("[CallMeBot] ⚠️  CALLMEBOT_PHONE or CALLMEBOT_APIKEY not set — skipping");
    return;
  }
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apikey}`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      console.log(`[CallMeBot] ✅ Sent to ${phone} — HTTP ${res.status}`);
    } else {
      const body = await res.text().catch(() => "");
      console.error(`[CallMeBot] ❌ HTTP ${res.status} — ${body.substring(0, 200)}`);
    }
  } catch (err: any) {
    console.error(`[CallMeBot] ❌ Network error: ${err.message}`);
  }
}

/** Format a new-lead WhatsApp message */
export function formatNewLeadMessage(params: {
  name: string;
  phone: string;
  source: string;
  createdAt: Date | string;
}): string {
  const date = new Date(params.createdAt).toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const sourceMap: Record<string, string> = {
    referral: "הפניה",
    website: "אתר",
    social_media: "רשתות חברתיות",
    direct: "ישיר",
    other: "אחר",
    recommended: "המלצה",
    landy: "דף נחיתה",
    netlify: "דף נחיתה",
  };
  const sourceName = sourceMap[params.source] ?? params.source;
  return [
    "🔥 *ליד חדש נכנס למערכת!*",
    "──────────────────",
    `👤 *שם:* ${params.name}`,
    `📞 *טלפון:* ${params.phone}`,
    `📌 *מקור:* ${sourceName}`,
    `🕐 *זמן:* ${date}`,
    "──────────────────",
    "💼 _TaxPro CRM_",
  ].join("\n");
}

/** Format a reminder WhatsApp message */
export function formatReminderMessage(params: {
  taskTitle: string;
  clientName: string;
  reminderAt: Date | string;
  status?: string;
}): string {
  const dt = new Date(params.reminderAt).toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const statusMap: Record<string, string> = {
    not_started: "טרם התחיל",
    in_progress: "בטיפול",
    completed: "הושלם",
  };
  const statusLabel = params.status ? (statusMap[params.status] ?? params.status) : "";
  return [
    "⏰ תזכורת משימה",
    "",
    `📋 משימה: ${params.taskTitle}`,
    `👤 לקוח: ${params.clientName}`,
    `📅 תאריך/שעה: ${dt}`,
    ...(statusLabel ? [`📊 סטטוס: ${statusLabel}`] : []),
  ].join("\n");
}
