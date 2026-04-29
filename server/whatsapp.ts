/**
 * WhatsApp notification helper — backend only.
 * Uses buzagloidan.com API. Secret key and recipient phones
 * are read from environment variables only (never exposed to frontend).
 *
 * Config (Replit Secrets / Env Vars):
 *   WHATSAPP_API_SECRET        — API secret key (Replit Secret)
 *   WHATSAPP_RECIPIENT_PHONES  — Comma-separated, no spaces: 972501234567,972509876543
 *   WHATSAPP_RECIPIENT_PHONE   — Single phone fallback (backward compat)
 */

const API_BASE = "https://api.buzagloidan.com/api/v1";

export interface WhatsAppResult {
  success: boolean;
  status?: number;
  body?: unknown;
  error?: string;
}

export interface WhatsAppBroadcastResult {
  sent: number;
  failed: number;
  results: Array<{ phone: string; result: WhatsAppResult }>;
}

// ─── In-memory dedup guard ────────────────────────────────────────────────
// Prevents sending duplicate WhatsApp messages for the same lead/client ID
// even if two code paths (manual create + Landy webhook) both fire.
const _sentLeadIds = new Map<string, number>(); // clientId → timestamp ms
const DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function markLeadNotified(clientId: string): void {
  _sentLeadIds.set(clientId, Date.now());
  // Cleanup old entries
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
 * Returns all configured recipient phone numbers.
 * Merges WHATSAPP_RECIPIENT_PHONES (comma-separated) and
 * WHATSAPP_RECIPIENT_PHONE (single, backward-compat). Deduplicates.
 */
export function getRecipientPhones(): string[] {
  const seen = new Set<string>();
  const phones: string[] = [];

  const addPhone = (p: string) => {
    const cleaned = p.trim().replace(/^\+/, "");
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      phones.push(cleaned);
    }
  };

  const multi = process.env.WHATSAPP_RECIPIENT_PHONES?.trim();
  if (multi) multi.split(",").forEach(addPhone);

  const single = process.env.WHATSAPP_RECIPIENT_PHONE?.trim();
  if (single) addPhone(single);

  return phones;
}

/**
 * Log current WhatsApp config state (no secret values exposed).
 */
export function logWhatsAppConfig(): void {
  const secret = process.env.WHATSAPP_API_SECRET?.trim();
  const multi = process.env.WHATSAPP_RECIPIENT_PHONES;
  const single = process.env.WHATSAPP_RECIPIENT_PHONE?.trim();
  const phones = getRecipientPhones();

  console.log("[WhatsApp:Config] ─────────────────────────────────────");
  console.log(`[WhatsApp:Config] WHATSAPP_API_SECRET        : ${secret ? `SET (${secret.length} chars)` : "❌ NOT SET"}`);
  console.log(`[WhatsApp:Config] WHATSAPP_RECIPIENT_PHONES  : ${multi !== undefined ? `"${multi}"` : "❌ NOT SET"}`);
  console.log(`[WhatsApp:Config] WHATSAPP_RECIPIENT_PHONE   : ${single ? `"${single.slice(0, 6)}***"` : "NOT SET (optional)"}`);
  console.log(`[WhatsApp:Config] Resolved recipients (${phones.length}): ${phones.map((p, i) => `#${i + 1} ${p.slice(0, 6)}*** (${p.length} digits)`).join(", ") || "none"}`);
  console.log("[WhatsApp:Config] ─────────────────────────────────────");
}

/**
 * Send a WhatsApp message to a single phone number via Buzaglo API.
 */
export async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<WhatsAppResult> {
  const secret = process.env.WHATSAPP_API_SECRET?.trim();

  if (!secret) {
    console.error("[WhatsApp] ❌ WHATSAPP_API_SECRET is not configured — cannot send");
    return { success: false, error: "WHATSAPP_API_SECRET not configured" };
  }
  if (!phone) {
    console.error("[WhatsApp] ❌ No recipient phone provided");
    return { success: false, error: "No recipient phone provided" };
  }

  const url = `${API_BASE}/${secret}`;

  // IMPORTANT: Buzaglo API requires application/x-www-form-urlencoded.
  // Sending JSON causes the raw JSON string to appear as the WhatsApp message text.
  const formBody = new URLSearchParams({ phone, message }).toString();

  console.log(`[WhatsApp] ─── Sending to ${phone.slice(0, 6)}*** ──────────────`);
  console.log(`[WhatsApp] → Recipient phone : ${phone}`);
  console.log(`[WhatsApp] → Message (${message.length} chars):\n${message}`);
  console.log(`[WhatsApp] → POST ${API_BASE}/[secret]`);
  console.log(`[WhatsApp] → Content-Type: application/x-www-form-urlencoded`);
  console.log(`[WhatsApp] → Form params: phone=${phone}, message=[${message.length} chars]`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody,
    });

    let body: unknown;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      body = await res.json().catch(() => null);
    } else {
      body = await res.text().catch(() => null);
    }

    console.log(`[WhatsApp] ← Status: ${res.status} | Body: ${JSON.stringify(body)}`);

    if (res.ok) {
      console.log(`[WhatsApp] ✅ Delivered to ${phone.slice(0, 6)}***`);
      return { success: true, status: res.status, body };
    } else {
      console.error(`[WhatsApp] ❌ API error ${res.status} for ${phone.slice(0, 6)}***:`, body);
      return { success: false, status: res.status, body, error: `API ${res.status}: ${JSON.stringify(body)}` };
    }
  } catch (err: any) {
    console.error(`[WhatsApp] ❌ Network error for ${phone.slice(0, 6)}***:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Broadcast a message to ALL configured recipients.
 */
export async function sendToAllRecipients(message: string): Promise<WhatsAppBroadcastResult> {
  const phones = getRecipientPhones();

  if (phones.length === 0) {
    const raw = process.env.WHATSAPP_RECIPIENT_PHONES;
    console.warn(`[WhatsApp] ❌ No recipients configured! Raw env value: "${raw ?? "undefined"}"`);
    console.warn(`[WhatsApp]   Set WHATSAPP_RECIPIENT_PHONES=972XXXXXXXXX,972YYYYYYYYY`);
    return { sent: 0, failed: 0, results: [] };
  }

  console.log(`[WhatsApp] Broadcasting to ${phones.length} recipient(s): ${phones.map((p, i) => `#${i + 1}=${p}`).join(", ")}`);

  const results: WhatsAppBroadcastResult["results"] = [];
  let sent = 0;
  let failed = 0;

  await Promise.all(
    phones.map(async (phone) => {
      const result = await sendWhatsAppMessage(phone, message);
      results.push({ phone, result });
      if (result.success) sent++; else failed++;
    })
  );

  console.log(`[WhatsApp] Broadcast complete — ✅ ${sent} sent, ❌ ${failed} failed`);
  return { sent, failed, results };
}

/** @deprecated Use sendToAllRecipients instead */
export async function sendToDefaultRecipient(message: string): Promise<WhatsAppResult> {
  const result = await sendToAllRecipients(message);
  const first = result.results[0];
  return first?.result ?? { success: result.sent > 0, error: result.sent === 0 ? "No recipients" : undefined };
}

/** Format a new-lead WhatsApp message (requested format with emojis) */
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
  };
  const sourceName = sourceMap[params.source] ?? params.source;
  return [
    "🔥 ליד חדש נכנס למערכת",
    "",
    `👤 שם: ${params.name}`,
    `📞 טלפון: ${params.phone}`,
    `📌 מקור: ${sourceName}`,
    `📅 תאריך: ${date}`,
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
