> 🎯 **כלל ראשוני — ראיון לפני ביצוע**
> לפני שאתה מתכנן או מבצע משהו — ראיין אותי כדי להבין את המטרה האמיתית של המשימה.
> שאל אותי שאלות עד שתבין איזו החלטה / פעולה / תוצאה רצויה העבודה הזאת אמורה לשרת, ורק אז גש לתכנון או ביצוע.

---
# Refund Manager CRM — מערכת ניהול לקוחות לעדן

**עדכון אחרון:** 2026-06-03
**מיקום:** `C:\Users\Lenovo\Desktop\refund-manager-crm\`
**Production:** https://refund-manager-crm-production.up.railway.app
**Repo:** https://github.com/eliaz449/refund-manager-crm
**Stack:** React 18 + Express 5 + PostgreSQL + Drizzle + Railway

---

## תיאור קצר
**מערכת CRM מלאה ב-production** לעדן (רואת חשבון/יועצת מס). ניהול לקוחות, תיקי החזרי מס, הנהלת חשבונות, משימות, תשלומים. קבלת לידים אוטומטית מדפי נחיתה (Landy webhook) + WhatsApp notifications. עברית RTL.

**משתמשים:**
- `eliazasulin@gmail.com` — admin (אליעז)
- `edenabergel94@gmail.com` — admin (עדן)

---

## סטטוס נוכחי
**רץ ב-production על Railway. Pipeline לידים + documents + partner sharing.**
Commit אחרון: `279aead` (Documents + ID details + auto-migration runner).

### עובד ✅
- Auth (Passport + bcrypt, sessions ב-memory)
- 60+ API endpoints (CRUD + documents + special)
- 13 דפים: dashboard, clients, client-detail, transactions, settings, webhook-events, login וכו'
- Drizzle ORM + **12 טבלאות** (+ documents)
- **Lead webhook (HMAC-SHA256)** — קולט מדפי נחיתה, מאוחסן ב-audit log
- **Partner dashboard** — shared leads + activity tracking + onboarding card + filters/search
- **"Share with partner" button** על כל לקוח ברשימה
- **Twilio WhatsApp inbound bot** — command parser
- **CallMeBot** — לכל ה-WhatsApp notifications (החליף את Buzagloidan)
- **End-to-end lead flow מאומת** — דף נחיתה → Netlify Function → CRM webhook → DB + WhatsApp
- **🆕 Documents upload (Supabase Storage)** — admin uploads + partner read-only על לידים משותפים
- **🆕 ID details on client** — תאריך לידה, תאריך הנפקת ת.ז., מספר תעודה (מאחור)
- **🆕 Refund tracking** — סכום שהוצאנו ללקוח/ה ממס הכנסה
- **🆕 Auto-migrations** — `runMigrations()` רץ בעלייה, מפעיל כל `migrations/*.sql` (idempotent)
- Auto-deploy מ-main branch → Railway

### שינויים אחרונים (commits)
1. `279aead` 🆕 Add document uploads + ID details + auto-migration runner (2026-06-03)
2. `d81c4db` Rename lead webhook from 'landy' to generic 'lead' (backward-compat)
3. `ae4e608` Add 'share with partner' button on each client in clients list
4. `31f2438` Enhance partner dashboard: stats, filters, search, onboarding card
5. `e7a9593` Add SQL migration script for partner dashboard tables
6. `a5fb98c` Add partner dashboard with shared leads + activity tracking
7. `87dbd72` Add Twilio WhatsApp inbound bot with command parser
8. `e52b45d` Improve WhatsApp lead message formatting
9. `b5dbf92` Replace Buzagloidan with CallMeBot for all WhatsApp notifications
10. `e9da5d8` Add CallMeBot as secondary WhatsApp channel

---

## משימות פתוחות 🔲

### 🟡 ניקוי מהסשן של 2026-06-10 (תזכורות מייל)
- [ ] **לאמת שעדן קיבלה את 4 מיילי הבדיקה** ב-Gmail (1 טסט + 3 תזכורות אמיתיות). אם הגיע לספאם — להוציא + לסמן "לא ספאם" כדי שבעתיד יגיע ל-Inbox
- [ ] **בדיקה end-to-end של תיקון ה-timezone**: ליצור תזכורת חדשה דרך ה-UI לזמן 2 דקות בעתיד (שעון ישראל), לוודא שהמייל מגיע בזמן הנכון (לא 3 שעות מאוחר יותר)
- [ ] **לחזק את ה-debug endpoints** — כרגע פתוחים בלי auth: `/api/debug/send-test-email`, `/api/debug/send-reminder-now/:id`, `/api/debug/run-email-scheduler`, `/api/debug/email-reminder-status`. להוסיף `requireAuth` או למחוק
- [ ] **לנקות 3 תזכורות הטסט** ב-DB (על הלקוח אודי בניטה, content: "להתקשר מחר/שוב מחר/מחר שוב")

### 🔴 לחיבור Supabase Storage (פתוח מ-2026-06-03)
- [ ] **משתמש: ליצור פרויקט Supabase חדש** (`refund-manager-crm`) + bucket `crm-documents` (private)
- [ ] **משתמש: לשלוח URL + service_role key**
- [ ] להוסיף ב-Railway: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- [ ] בדיקה end-to-end: העלאת מסמך → הורדה (admin + partner)

### לסיום (מ-2026-06-01)
- [ ] מחיקת 3 לידי-טסט שנוצרו ב-2026-06-01 (ראה [sessions/2026-06-01-lead-pipeline-fix.md](sessions/2026-06-01-lead-pipeline-fix.md))

### בהמשך
- [ ] בדיקת WhatsApp inbound bot של Twilio end-to-end
- [ ] שיפורים נוספים — ראה TODO.md

---

## איך להמשיך
```powershell
cd C:\Users\Lenovo\Desktop\refund-manager-crm
npm install
npm run db:push        # מיגרציה (אם schema השתנה)
npm run dev            # http://localhost:3000
```

**Production logs:** Railway dashboard.
**DB חיצוני (debug):** `trolley.proxy.rlwy.net:50633`

### סקריפטים לדיבוג
- `check-login.mjs` — בדיקת login נגד DB
- `check-session.mjs` — בדיקת session state

---

## מבנה
```
refund-manager-crm/
├── client/                 ← React + Vite + Tailwind + shadcn/ui
│   └── src/components/DocumentsSection.tsx   ← רכיב מסמכים (admin + partner)
├── server/                 ← Express + Drizzle
│   ├── routes.ts           ← 60+ API endpoints (כולל documents)
│   ├── auth.ts             ← Passport + sessions
│   ├── storage.ts          ← Drizzle queries
│   ├── whatsapp.ts         ← WhatsApp scheduler
│   ├── supabaseStorage.ts  ← upload/signed-URL/delete via Supabase
│   ├── migrations.ts       ← runs migrations/*.sql on boot (idempotent)
│   └── seed.ts             ← admin ראשוני
├── migrations/             ← SQL migrations (auto-applied on startup)
│   ├── partner-dashboard.sql
│   └── documents-and-id-fields.sql
├── sessions/               ← session logs
├── shared/schema.ts        ← Drizzle tables + Zod (משותף) — 12 טבלאות
└── script/build.ts         ← esbuild bundler
```

---

## משתני סביבה (Railway)

| משתנה | תפקיד |
|---|---|
| `DATABASE_URL` | PostgreSQL (Railway מזריק אוטומטית) |
| `SESSION_SECRET` | חתימת cookies |
| `INITIAL_ADMIN_PASSWORD` | סיסמת admin ראשונית (דיפולט `TaxPro2026!`) |
| `LEAD_WEBHOOK_SECRET` | אימות webhook לידים (`LANDY_WEBHOOK_SECRET` עדיין נתמך כ-fallback) |
| `WHATSAPP_API_SECRET` | API key (CallMeBot עכשיו, היה Buzagloidan) |
| `WHATSAPP_RECIPIENT_PHONES` | טלפונים מקבלים (פסיקים) |
| Twilio creds | לבוט WhatsApp inbound (לוודא מה השמות) |
| 🆕 `SUPABASE_URL` | URL של פרויקט Supabase חדש (storage למסמכים) — **חסר** |
| 🆕 `SUPABASE_SERVICE_ROLE_KEY` | service_role key (לא anon) — **חסר** |

---

## הקשר עסקי
זו ה**מערכת הניהולית** של עדן.
- **לידים מגיעים מ:** קמפיין [Marketing/campaigns/eden-asulin.md](../../Projects/Marketing/campaigns/eden-asulin.md) → [דף נחיתה](../eden-asulin-cpa/PROJECT.md) → webhook → CRM
- **השאיפה:** [eden-asulin-cpa/מטרות.md](../eden-asulin-cpa/מטרות.md) — 250 לידים בשבוע, 4 קווי שירות

---

## הוראות עבודה (מ-CLAUDE.md)
- **שפת תקשורת:** עברית
- **קוד וקומיטים:** אנגלית
- **WhatsApp:** לא לשלוח הודעות בפיתוח אלא אם ביקשו מפורשות
- **לפני שינוי גדול** — להציע ולוודא לפני יישום
- **commits + push** אחרי כל שינוי משמעותי (Railway יעלה אוטומטית)

---

## הערות חשובות
1. **Session store:** `memorystore` (לא `connect-pg-simple`) — restart מחייב התחברות מחדש
2. **Seed לא מאפס סיסמאות** — משתמשים קיימים נשארים עם הסיסמה שלהם
3. **Webhook events** נשמרים גם אם האימות נכשל — לצורך דיבוג

---

## הערה — מיקום
התיקייה ב-Desktop, לא ב-Projects. **זה הפרויקט הכי גדול שלך** — שווה לשקול העברה ל-`C:\Users\Lenovo\Projects\refund-manager-crm\`.
