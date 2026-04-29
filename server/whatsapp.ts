/**
 * WhatsApp notification helper — backend only.
 * Uses buzagloidan.com API. Secret key and recipient phones
 * are read from environment variables only (never exposed to frontend).
 *
 * Config (Replit Secrets / Env Vars):
 *   WHATSAPP_API_SECRET        — API secret key (Replit Secret)
 *   WHATSAPP_RECIPIENT_PHONES  — Comma-separated list, e.g. 972501234567,972509876543 (Env Var)
 *   WHATSAPP_RECIPIENT_PHONE   — Single phone fallback for backward compatibility (Env Var)
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

  // Multi-phone env var (primary)
  const multi = process.env.WHATSAPP_RECIPIENT_PHONES?.trim();
  if (multi) multi.split(",").forEach(addPhone);

  // Single-phone env var (backward compat / fallback)
  const single = process.env.WHATSAPP_RECIPIENT_PHONE?.trim();
  if (single) addPhone(single);

  return phones;
}

/**
 * Send a WhatsApp message to a single phone number.
 */
export async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<WhatsAppResult> {
  const secret = process.env.WHATSAPP_API_SECRET?.trim();
  if (!secret) {
    console.warn("[WhatsApp] WHATSAPP_API_SECRET is not configured — skipping send");
    return { success: false, error: "WHATSAPP_API_SECRET not configured" };
  }
  if (!phone) {
    return { success: false, error: "No recipient phone provided" };
  }

  const url = `${API_BASE}/${secret}`;
  try {
    console.log(`[WhatsApp] Sending to ${phone.slice(0, 6)}***`);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message }),
    });
    const body = await res.json().catch(() => res.text());
    if (res.ok) {
      console.log(`[WhatsApp] ✓ Sent to ${phone.slice(0, 6)}*** — status ${res.status}`);
      return { success: true, status: res.status, body };
    } else {
      console.error(`[WhatsApp] ✗ API error ${res.status} for ${phone.slice(0, 6)}***:`, body);
      return { success: false, status: res.status, body, error: `API returned ${res.status}` };
    }
  } catch (err: any) {
    console.error(`[WhatsApp] ✗ Network error for ${phone.slice(0, 6)}***:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Broadcast a message to ALL configured recipients.
 * Sends to each phone independently; one failure doesn't stop others.
 */
export async function sendToAllRecipients(message: string): Promise<WhatsAppBroadcastResult> {
  const phones = getRecipientPhones();
  if (phones.length === 0) {
    console.warn("[WhatsApp] No recipients configured (set WHATSAPP_RECIPIENT_PHONES)");
    return { sent: 0, failed: 0, results: [] };
  }

  console.log(`[WhatsApp] Broadcasting to ${phones.length} recipient(s)`);
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

  console.log(`[WhatsApp] Broadcast done — ✓ ${sent} sent, ✗ ${failed} failed`);
  return { sent, failed, results };
}

/** @deprecated Use sendToAllRecipients instead */
export async function sendToDefaultRecipient(message: string): Promise<WhatsAppResult> {
  const result = await sendToAllRecipients(message);
  const first = result.results[0];
  return first?.result ?? { success: result.sent > 0, error: result.sent === 0 ? "No recipients" : undefined };
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
  };
  const sourceName = sourceMap[params.source] ?? params.source;
  return [
    "🔥 ליד חדש נכנס למערכת",
    `שם: ${params.name}`,
    `טלפון: ${params.phone}`,
    `מקור: ${sourceName}`,
    `תאריך: ${date}`,
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
    `משימה: ${params.taskTitle}`,
    `לקוח: ${params.clientName}`,
    `תאריך/שעה: ${dt}`,
    ...(statusLabel ? [`סטטוס: ${statusLabel}`] : []),
  ].join("\n");
}
