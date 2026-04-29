/**
 * WhatsApp notification helper — backend only.
 *
 * API: POST https://api.tdo.co.il/send
 * Headers:
 *   Authorization: Bearer <WHATSAPP_API_SECRET>
 *   Content-Type: application/json
 * Body:
 *   { "phone": "972XXXXXXXXX", "message": "text" }
 *
 * Config (Replit Secrets / Env Vars):
 *   WHATSAPP_API_SECRET        — Bearer token (Replit Secret)
 *   WHATSAPP_RECIPIENT_PHONES  — Comma-separated, no spaces: 972XXXXXXXXX,972YYYYYYYYY
 *   WHATSAPP_RECIPIENT_PHONE   — Single phone fallback (backward compat)
 */

const API_URL = "https://api.tdo.co.il/send";

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
 * Returns all configured recipient phone numbers (deduped, stripped of +).
 */
export function getRecipientPhones(): string[] {
  const seen = new Set<string>();
  const phones: string[] = [];

  const add = (p: string) => {
    const cleaned = p.trim().replace(/^\+/, "");
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      phones.push(cleaned);
    }
  };

  const multi = process.env.WHATSAPP_RECIPIENT_PHONES?.trim();
  if (multi) multi.split(",").forEach(add);

  const single = process.env.WHATSAPP_RECIPIENT_PHONE?.trim();
  if (single) add(single);

  return phones;
}

/**
 * Print WhatsApp config to server log on startup.
 */
export function logWhatsAppConfig(): void {
  const secret = process.env.WHATSAPP_API_SECRET?.trim();
  const multi = process.env.WHATSAPP_RECIPIENT_PHONES;
  const single = process.env.WHATSAPP_RECIPIENT_PHONE?.trim();
  const phones = getRecipientPhones();

  console.log("[WhatsApp:Config] ─────────────────────────────────────────");
  console.log(`[WhatsApp:Config] API URL                    : ${API_URL}`);
  console.log(`[WhatsApp:Config] WHATSAPP_API_SECRET        : ${secret ? `SET (${secret.length} chars, starts: ${secret.slice(0, 6)}***)` : "❌ NOT SET"}`);
  console.log(`[WhatsApp:Config] WHATSAPP_RECIPIENT_PHONES  : ${multi !== undefined ? `"${multi}"` : "❌ NOT SET"}`);
  console.log(`[WhatsApp:Config] WHATSAPP_RECIPIENT_PHONE   : ${single ? `"${single.slice(0, 6)}***"` : "NOT SET (optional)"}`);
  console.log(`[WhatsApp:Config] Resolved recipients (${phones.length}): ${phones.length ? phones.map((p, i) => `#${i + 1} ${p}`).join(", ") : "none ❌"}`);
  console.log("[WhatsApp:Config] ─────────────────────────────────────────");
}

/**
 * Send ONE WhatsApp message to ONE phone via TDO API.
 *
 * POST https://api.tdo.co.il/send
 * Authorization: Bearer <secret>
 * Content-Type: application/json
 * { "phone": "972XXXXXXXXX", "message": "text" }
 */
export async function sendWhatsAppMessage(
  phone: string,
  message: string,
): Promise<WhatsAppResult> {
  const secret = process.env.WHATSAPP_API_SECRET?.trim();

  if (!secret) {
    console.error("[WhatsApp] ❌ WHATSAPP_API_SECRET not set — cannot send");
    return { success: false, error: "WHATSAPP_API_SECRET not configured" };
  }
  if (!phone) {
    console.error("[WhatsApp] ❌ No phone provided");
    return { success: false, error: "No recipient phone" };
  }

  // Build the exact JSON body the TDO API expects
  const requestBody = { phone, message };

  console.log(`[WhatsApp] ──────────────────────────────────────────────`);
  console.log(`[WhatsApp] → Sending to phone : ${phone}`);
  console.log(`[WhatsApp] → POST ${API_URL}`);
  console.log(`[WhatsApp] → Authorization   : Bearer ${secret.slice(0, 6)}***`);
  console.log(`[WhatsApp] → Content-Type    : application/json`);
  console.log(`[WhatsApp] → Request body    : ${JSON.stringify(requestBody)}`);
  console.log(`[WhatsApp] → Message text    :\n${message}`);

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secret}`,
      },
      body: JSON.stringify(requestBody),
    });

    let responseBody: unknown;
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      responseBody = await res.json().catch(() => null);
    } else {
      responseBody = await res.text().catch(() => null);
    }

    console.log(`[WhatsApp] ← HTTP status     : ${res.status}`);
    console.log(`[WhatsApp] ← Response body   : ${JSON.stringify(responseBody)}`);

    if (res.ok) {
      console.log(`[WhatsApp] ✅ Message accepted for ${phone}`);
      return { success: true, status: res.status, body: responseBody };
    } else {
      console.error(`[WhatsApp] ❌ API error ${res.status} for ${phone}:`, responseBody);
      return { success: false, status: res.status, body: responseBody, error: `HTTP ${res.status}: ${JSON.stringify(responseBody)}` };
    }
  } catch (err: any) {
    // Could not resolve host or network failure
    console.error(`[WhatsApp] ❌ Network error sending to ${phone}: ${err.message}`);
    console.error(`[WhatsApp]    URL attempted: ${API_URL}`);
    console.error(`[WhatsApp]    Hint: verify domain is reachable from this server`);
    return { success: false, error: `Network error: ${err.message}` };
  }
}

/**
 * Broadcast one message to ALL configured recipients.
 * Each phone gets its own separate API request.
 */
export async function sendToAllRecipients(message: string): Promise<WhatsAppBroadcastResult> {
  const phones = getRecipientPhones();

  if (phones.length === 0) {
    console.warn(`[WhatsApp] ❌ No recipients! WHATSAPP_RECIPIENT_PHONES="${process.env.WHATSAPP_RECIPIENT_PHONES ?? "undefined"}"`);
    console.warn(`[WhatsApp]    Set: WHATSAPP_RECIPIENT_PHONES=972XXXXXXXXX,972YYYYYYYYY`);
    return { sent: 0, failed: 0, results: [] };
  }

  console.log(`[WhatsApp] Broadcasting to ${phones.length} recipient(s): ${phones.join(", ")}`);

  const results: WhatsAppBroadcastResult["results"] = [];
  let sent = 0, failed = 0;

  // Sequential (not parallel) to avoid race conditions and rate limits
  for (const phone of phones) {
    const result = await sendWhatsAppMessage(phone, message);
    results.push({ phone, result });
    if (result.success) sent++; else failed++;
  }

  console.log(`[WhatsApp] ✅ Broadcast done — sent: ${sent}, failed: ${failed} (of ${phones.length} total)`);
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
