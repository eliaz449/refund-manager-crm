# Session 2026-06-01 — תיקון Lead Pipeline + Refactor landy→lead

**משך:** ~שעה
**Commits:** `d81c4db`

---

## הבעיה
ליד שהגיע בבוקר מהקמפיין החדש של עדן בגוגל הצליח להגיע **רק למייל**.
- ❌ לא נכנס ל-CRM
- ❌ לא הגיעה התראת WhatsApp

---

## דיאגנוזה (5 שלבים)

### 1. איפה מתחיל ה-pipeline?
דף הנחיתה החדש `eden-asulin-cpa.netlify.app` משתמש ב-Netlify Function `/.netlify/functions/submit-form`.

הפונקציה ([submit-form.js](../../eden-asulin-cpa/netlify/functions/submit-form.js)) עושה **3 פעולות**:
1. שולחת מייל דרך Resend
2. שולחת WhatsApp דרך CallMeBot — `fire-and-forget` (`.catch(() => {})`)
3. שולחת ל-CRM webhook — `fire-and-forget` (`.catch(() => {})`)

**זיהינו:** פעולות 2+3 נכשלות בשקט — אין שום הודעת שגיאה, אין log גלוי.

### 2. בדיקת env vars ב-Netlify
דרך Netlify API (טוקן מ-config.json):
```
CALLMEBOT_PHONE     = '13172235170'   ← אמריקאי, אישר המשתמש (WhatsApp עסקי)
CALLMEBOT_APIKEY    = (len=7)         ← OK
CRM_WEBHOOK_SECRET  = e6f3d7...64ba7  ← 64 תווים
RESEND_API_KEY      = re_b52...       ← OK
```
כל ה-vars **מוגדרים**, deploy האחרון של Function היה אחרי הגדרתם.

### 3. בדיקה ישירה של ה-CRM webhook
ירינו `POST /api/webhooks/landy` עם signature מחושב מ-`CRM_WEBHOOK_SECRET`:
```json
{"success":false,"error":"Unauthorized","reason":"LANDY_WEBHOOK_SECRET not configured in env"}
```

**מצאנו את הבעיה:** ב-Railway production **לא היה מוגדר** `LANDY_WEBHOOK_SECRET`. ה-Function ב-Netlify שלחה נכון, ה-CRM דחה ב-401, ה-`.catch(() => {})` בלע את השגיאה.

### 4. למה זה נקרא LANDY?
ה-CRM נבנה במקור לקלוט לידים מ-**Landy** (פלטפורמת דפי נחיתה ישנה). השם נשאר בקוד:
- endpoint: `/api/webhooks/landy`
- env var: `LANDY_WEBHOOK_SECRET`
- log prefix: `[Landy]`
- default source: `"landy"`

המשתמש ביקש לסדר זאת כדי שלא יבלבל בעתיד.

---

## הפתרון — Refactor + Backward-Compat

### שינויי קוד CRM ([server/routes.ts](../server/routes.ts), [client/src/pages/webhook-events.tsx](../client/src/pages/webhook-events.tsx))

| מ | ל | backward-compat |
|---|---|---|
| `POST /api/webhooks/landy` | `POST /api/webhooks/lead` | הישן נשאר alias לאותו handler |
| `process.env.LANDY_WEBHOOK_SECRET` | `process.env.LEAD_WEBHOOK_SECRET` | fallback: `LEAD_WEBHOOK_SECRET ?? LANDY_WEBHOOK_SECRET` |
| header `x-landy-signature` | header `x-lead-signature` | מקבל גם וגם |
| log prefix `[Landy]` | `[Lead]` | — |
| source default `"landy"` | `"website"` | — |
| UI: "לוג Webhooks — Landy" | "לוג Webhooks — לידים" | + עדכון הודעות שגיאה + curl example |

`schema.ts` נשאר עם `source: text("source").default("landy")` — לא נגענו ב-DB schema כדי לא לדרוש migration.

### שינויי Netlify Function ([eden-asulin-cpa/netlify/functions/submit-form.js](../../eden-asulin-cpa/netlify/functions/submit-form.js))
```diff
- fetch('.../api/webhooks/landy', { headers: {'x-landy-signature': sig}, body: payload })
+ fetch('.../api/webhooks/lead',  { headers: {'x-lead-signature':  sig}, body: payload })
- source: 'netlify'
+ source: 'website'
```

### Deploy
1. CRM: `git commit -m "Rename lead webhook..."` + `git push origin main` → Railway auto-deploy
2. Netlify: `netlify deploy --prod --site=f3c6db77...` → live תוך ~10 שניות

### פעולה ידנית (המשתמש)
הוספת ל-Railway Variables:
- Key: `LEAD_WEBHOOK_SECRET`
- Value: `e6f3d714eb1f206fd8e3e1d27fb431fbac7469737ade4fa5b191788061208ba7` (הזהה ל-`CRM_WEBHOOK_SECRET` ב-Netlify)

---

## אימות end-to-end

3 לידי-טסט בוצעו ב-21:09 UTC, **כולם הצליחו**:

| # | מקור | endpoint | clientId |
|---|---|---|---|
| 1 | טופס דף עדן (form submit אמיתי) | submit-form Netlify Function | (יראה ב-/webhook-events) |
| 2 | webhook חדש — `/api/webhooks/lead` + `x-lead-signature` | direct API call | `eb16ed2d-df78-49c8-b11c-d617344113f4` |
| 3 | webhook ישן — `/api/webhooks/landy` + `x-landy-signature` (backward-compat) | direct API call | `72cac9fb-131e-49aa-aa96-4642158af441` |

---

## לסיום (TODO)
- [ ] למחוק 3 לידי-טסט: "ליד בדיקה — Claude", "ליד בדיקה ישיר — Claude", "בדיקת backward compat"
- [ ] לאמת ש-WhatsApp הגיע ל-1-317-223-5170 (3 הודעות)
- [ ] לאמת ב-/webhook-events ש-3 events רשומים עם status "created"

---

## תובנות לעתיד
1. **Fire-and-forget מסוכן בלי monitoring** — ה-`.catch(() => {})` ב-Netlify function "בלע" את הכישלון. לשקול: שמירת כישלונות ב-Netlify Function logs במקום `.catch(() => {})`.
2. **schema source enum**: `VALID_SOURCES = ["referral", "website", "social_media", "direct", "other"]`. כל source אחר הופך ל-"website" (default חדש).
3. **שני חשבונות Netlify של המשתמש**:
   - `eliazasulin@gmail.com` (team `eliaz449`) — eden-asulin-cpa, your-perfect-s, ...
   - `eliezerasulin1@gmail.com` (team `eliezerasulin1's team`) — paglo.app DNS
