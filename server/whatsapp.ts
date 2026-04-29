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
 * Log current WhatsApp config state (no secret values exposed).
 */
export function logWhatsAppConfig(): void {
  const secret = process.env.WHATSAPP_API_SECRET?.trim();
  const phones = getRecipientPhones();
  const multi = process.env.WHATSAPP_RECIPIENT_PHONES?.trim();
  const single = process.env.WHATSAPP_RECIPIENT_PHONE?.trim();

  console.log("[WhatsApp:Config] ─────────────────────────────────");
  console.log(`[WhatsApp:Config] WHATSAPP_API_SECRET   : ${secret ? `SET (${secret.length} chars)` : "❌ NOT SET"}`);
  console.log(`[WhatsApp:Config] WHATSAPP_RECIPIENT_PHONES : ${multi ? `"${multi.slice(0, 20)}${multi.length > 20 ? "…" : ""}"` : "❌ NOT SET"}`);
  console.log(`[WhatsApp:Config] WHATSAPP_RECIPIENT_PHONE  : ${single ? `"${single.slice(0, 6)}***"` : "NOT SET (optional fallback)"}`);
  console.log(`[WhatsApp:Config] Resolved recipients    : ${phones.length} phone(s)${phones.length ? ": " + phones.map(p => p.slice(0, 6) + "***").join(", ") : ""}`);
  console.log("[WhatsApp:Config] ─────────────────────────────────");
}

/**
 * Send a WhatsApp message to a single phone number.
 */
export async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<WhatsAppResult> {
  const secret = process.env.WHATSAPP_API_SECRET?.trim();

  console.log(`[WhatsApp] sendWhatsAppMessage called — phone: ${phone.slice(0, 6)}***, secret: ${secret ? `SET(${secret.length}ch)` : "❌ MISSING"}`);

  if (!secret) {
    console.warn("[WhatsApp] ❌ WHATSAPP_API_SECRET is not configured — cannot send");
    return { success: false, error: "WHATSAPP_API_SECRET not configured" };
  }
  if (!phone) {
    console.warn("[WhatsApp] ❌ No recipient phone provided — cannot send");
    return { success: false, error: "No recipient phone provided" };
  }

  const url = `${API_BASE}/${secret}`;
  const payload = { phone, message };

  console.log(`[WhatsApp] → POST ${API_BASE}/***`);
  console.log(`[WhatsApp] → Payload: phone=${phone.slice(0, 6)}***, message length=${message.length}`);
  console.log(`[WhatsApp] → Message preview: "${message.slice(0, 60)}..."`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let body: unknown;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      body = await res.json().catch(() => null);
    } else {
      body = await res.text().catch(() => null);
    }

    console.log(`[WhatsApp] ← Response status: ${res.status}`);
    console.log(`[WhatsApp] ← Response body:`, JSON.stringify(body));

    if (res.ok) {
      console.log(`[WhatsApp] ✓ Successfully sent to ${phone.slice(0, 6)}***`);
      return { success: true, status: res.status, body };
    } else {
      console.error(`[WhatsApp] ✗ API error ${res.status} for ${phone.slice(0, 6)}***:`, body);
      return { success: false, status: res.status, body, error: `API returned ${res.status}: ${JSON.stringify(body)}` };
    }
  } catch (err: any) {
    console.error(`[WhatsApp] ✗ Network/fetch error for ${phone.slice(0, 6)}***:`, err.message);
    console.error(`[WhatsApp] ✗ Full error:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Broadcast a message to ALL configured recipients.
 * Sends to each phone independently; one failure doesn't stop others.
 */
export async function sendToAllRecipients(message: string): Promise<WhatsAppBroadcastResult> {
  const phones = getRecipientPhones();

  console.log(`[WhatsApp] sendToAllRecipients — ${phones.length} recipient(s) found`);

  if (phones.length === 0) {
    const multi = process.env.WHATSAPP_RECIPIENT_PHONES;
    const single = process.env.WHATSAPP_RECIPIENT_PHONE;
    console.warn(`[WhatsApp] ❌ No recipients configured!`);
    console.warn(`[WhatsApp]   WHATSAPP_RECIPIENT_PHONES = ${multi ? `"${multi}"` : "undefined"}`);
    console.warn(`[WhatsApp]   WHATSAPP_RECIPIENT_PHONE  = ${single ? `"${single}"` : "undefined"}`);
    console.warn(`[WhatsApp]   → Set WHATSAPP_RECIPIENT_PHONES in Replit Env Vars`);
    return { sent: 0, failed: 0, results: [] };
  }

  console.log(`[WhatsApp] Broadcasting to ${phones.length} recipient(s): ${phones.map(p => p.slice(0, 6) + "***").join(", ")}`);

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
