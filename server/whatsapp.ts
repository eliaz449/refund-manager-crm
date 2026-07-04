/**
 * WhatsApp notification helper — Gmail Agent bot (Twilio WhatsApp) only.
 * CallMeBot removed 2026-07. All notifications flow via HMAC-signed webhook to
 * GMAIL_AGENT_WEBHOOK_URL.
 */

// ─── In-memory dedup guard ────────────────────────────────────────────────
const _sentLeadIds = new Map<string, number>();
const DEDUP_TTL_MS = 5 * 60 * 1000;

export function markLeadNotified(clientId: string): void {
  _sentLeadIds.set(clientId, Date.now());
  const cutoff = Date.now() - DEDUP_TTL_MS;
  _sentLeadIds.forEach((ts, id) => {
    if (ts < cutoff) _sentLeadIds.delete(id);
  });
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
  const gaUrl = process.env.GMAIL_AGENT_WEBHOOK_URL?.trim();
  const gaSecret = process.env.GMAIL_AGENT_WEBHOOK_SECRET?.trim();
  console.log("[WhatsApp:Config] ─────────────────────────────────────────");
  console.log(`[WhatsApp:Config] Provider          : Gmail Agent (Twilio WhatsApp)`);
  console.log(`[WhatsApp:Config] GMAIL_AGENT_URL   : ${gaUrl ? gaUrl : "❌ NOT SET"}`);
  console.log(`[WhatsApp:Config] GMAIL_AGENT_SECRET: ${gaSecret ? `SET (${gaSecret.length} chars)` : "❌ NOT SET"}`);
  console.log("[WhatsApp:Config] ─────────────────────────────────────────");
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
