# Refund Manager CRM

CRM לרואה חשבון/יועץ מס של אליעז אסולין. ניהול לקוחות, תיקי החזרי מס, הנהלת חשבונות, משימות, תשלומים, וקבלת לידים אוטומטית מדפי נחיתה.

- **בעלים:** אליעז אסולין (eliaz449 ב-GitHub)
- **Production:** https://refund-manager-crm-production.up.railway.app
- **Repo:** https://github.com/eliaz449/refund-manager-crm
- **שפת ממשק:** עברית (RTL)

---

## Tech Stack

### Frontend (`client/`)
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS + shadcn/ui (Radix-based components)
- wouter (routing)
- TanStack Query (server state)
- React Hook Form + Zod (forms + validation)

### Backend (`server/`)
- Express 5 + TypeScript (tsx)
- Passport.js (Local Strategy) + bcryptjs (auth)
- express-session + memorystore (sessions in memory)
- Drizzle ORM (DB layer)
- pg (PostgreSQL driver)

### Database
- PostgreSQL 16 (Railway managed)
- Drizzle Kit (`npm run db:push` למיגרציות)

### Deployment
- Railway (auto-deploy מ-`main` branch ב-GitHub)
- esbuild bundles to `dist/index.cjs`

---

## מבנה תיקיות

```
refund-manager-crm/
├── client/                      ← React frontend
│   └── src/
│       ├── App.tsx              ← רוטר ראשי + auth gate
│       ├── pages/               ← דפי האפליקציה
│       ├── components/
│       │   ├── ui/              ← רכיבי shadcn/ui
│       │   ├── app-sidebar.tsx  ← תפריט צד
│       │   └── ...
│       ├── hooks/               ← use-auth, use-reminder-notifications, וכו'
│       └── lib/                 ← queryClient, utilities
├── server/
│   ├── index.ts                 ← entry point + WhatsApp scheduler
│   ├── auth.ts                  ← Passport + session + endpoints
│   ├── routes.ts                ← כל ה-API (~50 routes)
│   ├── storage.ts               ← Drizzle queries (data layer)
│   ├── seed.ts                  ← יצירת admin ראשוני + נתוני דמו
│   ├── whatsapp.ts              ← אינטגרציית WhatsApp
│   ├── db.ts                    ← חיבור PostgreSQL
│   ├── static.ts                ← static serving (production)
│   └── vite.ts                  ← Vite middleware (dev)
├── shared/
│   └── schema.ts                ← Drizzle tables + Zod schemas (משותף client+server)
├── script/
│   └── build.ts                 ← esbuild bundler
└── drizzle.config.ts
```

---

## דפי אפליקציה

| Path | קובץ | תיאור |
|---|---|---|
| `/` | `pages/dashboard.tsx` | סטטיסטיקות, משימות פעילות, תזכורות |
| `/clients` | `pages/clients.tsx` | רשימת לקוחות + פילטרים |
| `/clients/:id` | `pages/client-detail.tsx` | פרטי לקוח + תיקים/משימות/תשלומים/הערות |
| `/transactions` | `pages/transactions.tsx` | הכנסות והוצאות |
| `/settings` | `pages/settings.tsx` | הגדרות + שינוי סיסמה |
| `/webhook-events` | `pages/webhook-events.tsx` | audit log של webhooks |
| `/login` | `pages/login.tsx` | התחברות |

> `cases`, `tasks`, `payments` כדפים נפרדים — **מוסרים**. הכל מאוחד בתוך `client-detail`.

---

## מודל נתונים (`shared/schema.ts`)

| טבלה | תפקיד |
|---|---|
| `users` | משתמשי המערכת (admin / user / accountant) |
| `clients` | לקוחות — מצב חיים: lead → active → inactive |
| `cases` | תיקים (תיק החזר מס, הנהלת חשבונות, דוח שנתי, VAT וכו') |
| `tasks` | משימות עם due date, קטגוריה וחזרתיות |
| `payments` | תשלומים שהתקבלו |
| `transactions` | הכנסות/הוצאות (חשבונאי) |
| `communication_logs` | תיעוד שיחות/אימיילים/WhatsApp |
| `client_notes` | הערות חופשיות על לקוח |
| `reminders` | תזכורות לטיפול — שולחות WhatsApp אוטומטית |
| `password_reset_tokens` | טוקנים לאיפוס סיסמה |
| `webhook_events` | audit log של webhook שמגיע מ-Landy |

**Enums מרכזיים:** `clientStatus`, `clientProcessStatus`, `leadStatus`, `caseStatus`, `taskStatus`, `priority`, `paymentMethod`, `serviceType` ועוד (כולם ב-`schema.ts`).

---

## API Endpoints (`server/routes.ts`)

כל ה-endpoints מתחת ל-`/api/*` ודורשים `requireAuth` חוץ מ-`/api/auth/*` ו-`/api/webhooks/landy`.

### Auth (`server/auth.ts`)
- `POST /api/auth/login` — email + password
- `POST /api/auth/logout`
- `GET  /api/auth/me`
- `POST /api/auth/change-password`
- `POST /api/auth/forgot-password` — יוצר טוקן (לא שולח מייל, רק לוג ב-dev)
- `POST /api/auth/reset-password` — צריך טוקן

### Resources (CRUD)
- `/api/clients` — + `:id/contact-attempt`, `:id/reminders`
- `/api/cases` — + `/clients/:clientId/cases`
- `/api/tasks` — + `/clients/:clientId/tasks`
- `/api/payments` — + `/clients/:clientId/payments`
- `/api/transactions` — + `/clients/:clientId/transactions`
- `/api/communications` — + `/clients/:clientId/communications`
- `/api/clients/:clientId/notes` — הערות לקוח
- `/api/reminders` — + `/active`, `/clients/:id/reminders`

### Special
- `POST /api/webhooks/landy` — webhook מדף נחיתה (HMAC-SHA256 auth, ללא session)
- `GET  /api/webhook-events` — audit log
- `POST /api/test-whatsapp` — בדיקת WhatsApp
- `GET  /api/dashboard/stats`
- `GET  /api/users`
- `GET  /api/health`

---

## אינטגרציות

### 1. Landy Webhook
- **Endpoint:** `POST /api/webhooks/landy`
- **Auth:** HMAC-SHA256 על raw body, header `x-landy-signature`
- **תהליך:** רשם audit → אימות → נירמול payload → יצירת/עדכון לקוח → שליחת WhatsApp
- **Env:** `LANDY_WEBHOOK_SECRET`

### 2. WhatsApp (buzagloidan API)
- **API:** `POST https://api.buzagloidan.com/api/v1/<SECRET>`
- **שני שימושים:**
  1. התראה על ליד חדש (מ-routes או מ-webhook)
  2. תזכורות שמועברות ע"י scheduler ב-`index.ts:119` (כל 60s)
- **Dedup:** in-memory map עם TTL 5 דקות (מונע כפילויות בין יצירה ידנית ל-webhook)
- **Env:** `WHATSAPP_API_SECRET`, `WHATSAPP_RECIPIENT_PHONES` (פסיקים), `WHATSAPP_RECIPIENT_PHONE` (fallback)

---

## משתני סביבה

| משתנה | חובה? | תפקיד |
|---|---|---|
| `DATABASE_URL` | ✅ | חיבור PostgreSQL |
| `SESSION_SECRET` | ✅ | חתימת cookies |
| `PORT` | אופציונלי | ברירת מחדל 5000, ב-Railway 3000 |
| `NODE_ENV` | אופציונלי | `development` / `production` |
| `INITIAL_ADMIN_PASSWORD` | אופציונלי | סיסמת admin ראשונית. דיפולט: `TaxPro2026!` |
| `LANDY_WEBHOOK_SECRET` | אם משתמשים ב-Landy | אימות webhook |
| `WHATSAPP_API_SECRET` | אם משתמשים ב-WA | מפתח API |
| `WHATSAPP_RECIPIENT_PHONES` | אם משתמשים ב-WA | טלפונים מקבלים (`972XXX,972YYY`) |

קובץ `.env` בשורש לפיתוח מקומי — **לא** נכנס ל-git (יש ב-`.gitignore`).

---

## הרצה מקומית

```bash
npm install
npm run db:push      # מיגרציה — יוצר טבלאות לפי schema.ts
npm run dev          # http://localhost:3000
```

ה-seed רץ אוטומטית בהתחלה — יוצר את `eliazasulin@gmail.com` ו-`edenabergel94@gmail.com` כ-admins (אם לא קיימים).

### פקודות נוספות
```bash
npm run build        # bundle לפרודקשן (dist/index.cjs)
npm run start        # מריץ את ה-bundle
npm run check        # בדיקת TypeScript
```

---

## Deployment ל-Railway

- כל push ל-`main` → Railway redeploys אוטומטית
- Railway מחקה את ה-PostgreSQL service ומזריק `DATABASE_URL` אוטומטית
- שאר משתני הסביבה ידנית ב-Variables tab של Railway
- חיבור חיצוני ל-DB (לדיבוג): `trolley.proxy.rlwy.net:50633`

---

## משתמשי admin

| Email | תפקיד |
|---|---|
| `eliazasulin@gmail.com` | admin (אליעז) |
| `edenabergel94@gmail.com` | admin (עדן) |

הסיסמה הראשונית נקבעת ע"י `INITIAL_ADMIN_PASSWORD` או דיפולט `TaxPro2026!`. ה-seed **לא** מאפס סיסמאות למשתמשים קיימים — שינוי סיסמה דרך ה-UI נשמר.

---

## הוראות עבודה ל-Claude

- **שפת תקשורת:** עברית
- **שפת קוד וקומיטים:** אנגלית
- **לפני שינוי גדול** — להציע ולוודא עם המשתמש לפני יישום
- **commits + push** — לדחוף ל-GitHub אחרי כל שינוי משמעותי (Railway יעלה אוטומטית)
- **ערוך קיים, לא תיצור חדש** — אלא אם נדרש
- **שמירה על schema** — שינוי ב-`shared/schema.ts` דורש `npm run db:push` נגד ה-DB הרלוונטי
- **בדיקה ב-DB ישירות:** סקריפטים `check-login.mjs`, `check-session.mjs` בשורש לדיבוג מהיר
- **WhatsApp:** לא לשלוח הודעות במהלך פיתוח אלא אם המשתמש ביקש מפורשות

---

## דברים חשובים לזכור

1. **Session store:** עברנו מ-`connect-pg-simple` ל-`memorystore`. הסיבה: הראשון לא יצר את טבלת ה-session אוטומטית ב-Railway → הלוגין נכשל למרות סיסמה נכונה. הסשנים בזיכרון → restart מחייב התחברות מחדש.
2. **Seed לא מאפס סיסמאות:** משתמשים קיימים נשארים עם הסיסמה שלהם. רק יצירה ראשונית משתמשת ב-`INITIAL_ADMIN_PASSWORD`.
3. **Cookies בפרודקשן:** `secure: true` + `trust proxy: 1` — דורש HTTPS (Railway מספק).
4. **WhatsApp scheduler** רץ כל 60 שניות גם אם אין WA mute — בודק DB ולא שולח אם אין pending.
5. **Webhook events** נשמרים ב-DB גם אם האימות נכשל — לצורך דיבוג.
