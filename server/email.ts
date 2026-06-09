/**
 * Outbound email via Resend.
 * Currently used for reminder notifications. Designed to mirror the visual
 * style of the eden-asulin-cpa landing-page lead email so Eden's inbox feels
 * consistent.
 *
 * Env vars:
 *   RESEND_API_KEY        — required. Same key works across projects.
 *   REMINDER_EMAIL_TO     — comma-separated recipients. Default: edenabergel94@gmail.com
 *   REMINDER_EMAIL_FROM   — sender. Default: 'TaxPro CRM — תזכורות <leads@launchflow.ink>'
 *   CRM_PUBLIC_URL        — base URL used in links inside email. Default: prod URL.
 */

const DEFAULT_FROM    = "TaxPro CRM — תזכורות <leads@launchflow.ink>";
const DEFAULT_TO      = "edenabergel94@gmail.com";
const DEFAULT_BASE    = "https://refund-manager-crm-production.up.railway.app";

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatIL(date: Date): string {
  return date.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
}

function intlPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("972")) return cleaned;
  if (cleaned.startsWith("0")) return "972" + cleaned.slice(1);
  return cleaned;
}

export interface ReminderEmailParams {
  clientId: string;
  clientName: string;
  clientPhone?: string | null;
  reminderNote: string;
  scheduledAt: Date;
}

export function buildReminderHtml(p: ReminderEmailParams): string {
  const base    = (process.env.CRM_PUBLIC_URL ?? DEFAULT_BASE).replace(/\/+$/, "");
  const leadUrl = `${base}/clients/${p.clientId}`;
  const phone   = p.clientPhone ?? "";
  const phoneIntl = phone ? intlPhone(phone) : "";

  const sentAt   = formatIL(new Date());
  const dueAt    = formatIL(p.scheduledAt);

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    @media only screen and (max-width:600px){
      .container{width:100%!important;border-radius:0!important;}
      .body-pad{padding:24px 20px!important;}
      .header-pad{padding:28px 20px!important;}
      .footer-pad{padding:16px 20px!important;}
      .cta-btn{display:block!important;text-align:center!important;padding:16px 20px!important;}
      .label-col{width:90px!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;direction:rtl">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:24px 0">
    <tr><td align="center" style="padding:0 12px">
      <table class="container" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);width:100%;max-width:560px">

        <!-- Header -->
        <tr>
          <td class="header-pad" style="background:linear-gradient(135deg,#001F3F 0%,#0a3d6b 100%);padding:36px 40px;text-align:center">
            <div style="font-size:40px;margin-bottom:8px">🔔</div>
            <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px">תזכורת לטיפול</h1>
            <p style="color:#a8c8e8;margin:8px 0 0;font-size:14px">TaxPro CRM — מערכת ניהול לקוחות</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td class="body-pad" style="padding:32px 40px">
            <p style="color:#001F3F;font-size:15px;margin:0 0 20px;font-weight:600">הגיע הזמן לטפל בלקוח/ה — הנה הפרטים:</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
              <tr style="background:#f0f4f8">
                <td class="label-col" style="padding:14px 16px;color:#f59e0b;font-weight:700;font-size:13px;width:120px;border-bottom:1px solid #e2e8f0;white-space:nowrap">לקוח/ה</td>
                <td style="padding:14px 16px;color:#001F3F;font-size:15px;font-weight:600;border-bottom:1px solid #e2e8f0">${escapeHtml(p.clientName)}</td>
              </tr>
              ${phone ? `<tr style="background:#ffffff">
                <td class="label-col" style="padding:14px 16px;color:#f59e0b;font-weight:700;font-size:13px;white-space:nowrap;border-bottom:1px solid #e2e8f0">טלפון</td>
                <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0">
                  <a href="tel:${escapeHtml(phone)}" style="color:#001F3F;font-size:20px;font-weight:800;text-decoration:none;word-break:break-all">${escapeHtml(phone)}</a>
                </td>
              </tr>` : ""}
              <tr style="background:#f0f4f8">
                <td class="label-col" style="padding:14px 16px;color:#f59e0b;font-weight:700;font-size:13px;vertical-align:top;white-space:nowrap;border-bottom:1px solid #e2e8f0">ההערה</td>
                <td style="padding:14px 16px;color:#001F3F;font-size:14px;line-height:1.6;border-bottom:1px solid #e2e8f0;white-space:pre-wrap">${escapeHtml(p.reminderNote)}</td>
              </tr>
              <tr style="background:#ffffff">
                <td class="label-col" style="padding:14px 16px;color:#f59e0b;font-weight:700;font-size:13px;white-space:nowrap">לפי המועד</td>
                <td style="padding:14px 16px;color:#001F3F;font-size:14px">${escapeHtml(dueAt)}</td>
              </tr>
            </table>

            <!-- CTAs -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px">
              <tr>
                <td align="center">
                  ${phone ? `<a href="tel:${escapeHtml(phone)}" class="cta-btn" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#ffffff;text-decoration:none;padding:15px 32px;border-radius:999px;font-size:16px;font-weight:700;min-width:180px;text-align:center;margin:0 4px 8px">📞 התקשר עכשיו</a>` : ""}
                  ${phoneIntl ? `<a href="https://wa.me/${phoneIntl}" class="cta-btn" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:15px 28px;border-radius:999px;font-size:16px;font-weight:700;min-width:140px;text-align:center;margin:0 4px 8px">💬 WhatsApp</a>` : ""}
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-top:8px">
                  <a href="${leadUrl}" style="display:inline-block;color:#0a3d6b;text-decoration:none;padding:10px 20px;border:1px solid #0a3d6b;border-radius:999px;font-size:14px;font-weight:600">פתח את הליד במערכת ←</a>
                </td>
              </tr>
            </table>

            <p style="color:#94a3b8;font-size:12px;margin:24px 0 0;text-align:center">נשלח ב־${escapeHtml(sentAt)}</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td class="footer-pad" style="background:#001F3F;padding:18px 40px;text-align:center">
            <p style="color:#4a6080;font-size:12px;margin:0">TaxPro CRM · תזכורת אוטומטית</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendReminderEmail(p: ReminderEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");

  const toRaw = process.env.REMINDER_EMAIL_TO?.trim() || DEFAULT_TO;
  const to = toRaw.split(",").map(s => s.trim()).filter(Boolean);
  const from = process.env.REMINDER_EMAIL_FROM?.trim() || DEFAULT_FROM;

  const html = buildReminderHtml(p);
  const subject = `🔔 תזכורת — ${p.clientName}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${errText.substring(0, 200)}`);
  }
}
