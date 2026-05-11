# TODO List — Refund Manager CRM

עודכן: 2026-05-11

---

## 🔴 דחוף — חוסם

### 1. יצירת טוקן GitHub חדש

**סטטוס:** ממתין למשתמש

**הבעיה:**
הטוקן הישן ב-remote פג תוקף או בוטל.
`git push` חוזר עם: `Invalid username or token. Password authentication is not supported`.

**איך לפתור (טכני):**

1. **יצירת טוקן ב-GitHub:**
   - להיכנס ל: https://github.com/settings/tokens
   - ללחוץ: **Generate new token → Generate new token (classic)**
   - שם: `refund-manager-crm-local`
   - תוקף: **No expiration** (או 90 ימים אם רוצים מגבלה)
   - הרשאות לסמן: ✅ `repo` (full control of private repositories)
   - לחץ **Generate token** והעתק את הטוקן (יתחיל ב-`ghp_...`)

2. **עדכון ה-remote URL** (אריץ אני ברגע שתשלח את הטוקן):
   ```bash
   cd C:\Users\Lenovo\Desktop\refund-manager-crm
   git remote set-url origin https://eliaz449:<NEW_TOKEN>@github.com/eliaz449/refund-manager-crm.git
   ```

3. **שמירה ב-Windows Credential Manager** (אופציונלי, לעבודה חלקה):
   - לחפש בחיפוש Windows: **Credential Manager**
   - **Windows Credentials** → לחפש `git:https://github.com`
   - לערוך → להחליף ל-טוקן החדש

**תוצאה צפויה:** `git push` יעבוד בלי בקשת סיסמה.

---

### 2. דחיפת CLAUDE.md ל-GitHub

**סטטוס:** Commit `fa83547` קיים מקומית, לא נדחף

**מה צריך:**
- ברגע שיש טוקן חדש (משימה 1): פשוט `git push`.
- אחרי הדחיפה — Railway יקבל את ה-commit אבל לא יעשה redeploy (כי השתנה רק MD, לא קוד).

**אימות:**
```bash
cd C:\Users\Lenovo\Desktop\refund-manager-crm
git log origin/main..HEAD --oneline   # צריך להיות ריק אחרי push
```

---

## 🟡 בעדיפות בינונית — אינטגרציות

### 3. חיבור Landy webhook ל-Railway

**סטטוס:** הקוד מוכן ([routes.ts:324](server/routes.ts#L324)). חסר: הגדרת secret ב-Railway + Landy.

**איך זה עובד:**
Landy שולח `POST` ל-URL שתגדיר, עם payload של ליד חדש + header `x-landy-signature` שמחושב כ-`HMAC-SHA256(secret, rawBody)`. השרת מאמת, יוצר לקוח, ושולח WhatsApp.

**שלבים טכניים:**

1. **יצירת secret אקראי:**
   ```powershell
   # PowerShell
   [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
   ```
   או באתר: https://1password.com/password-generator/ (32 תווים, hex)

2. **הוספה ל-Railway:**
   - Railway → הפרויקט → **Variables** tab
   - Add Variable:
     - שם: `LANDY_WEBHOOK_SECRET`
     - ערך: ה-secret שיצרת
   - Railway יעשה redeploy אוטומטית (~1-2 דקות)

3. **הגדרה בצד Landy:**
   - בדף הנחיתה Landy → הגדרות Webhooks
   - **URL:** `https://refund-manager-crm-production.up.railway.app/api/webhooks/landy`
   - **Secret:** אותו ערך כמו `LANDY_WEBHOOK_SECRET`
   - **Method:** POST
   - **Content-Type:** application/json
   - לוודא שהשם של ה-header חתימה אצלם הוא `x-landy-signature`

4. **בדיקה:**
   - לשלוח ליד טסט מ-Landy
   - לבדוק ב: https://refund-manager-crm-production.up.railway.app/webhook-events
   - אמור להופיע event עם status `created`
   - לבדוק שהלקוח החדש מופיע ב-`/clients`

5. **דיבוג אם נכשל:**
   - Railway → Logs → לחפש `[Landy]`
   - אם `auth_failed` → secret לא תואם
   - אם `validation_failed` → מבנה ה-payload שונה ממה שהקוד מצפה (לעדכן ב-`normalizeLandyPayload` ב-routes.ts)

---

### 4. הגדרת WhatsApp Notifications

**סטטוס:** קוד מוכן ([whatsapp.ts](server/whatsapp.ts)) — חסרים env vars.

**איך זה עובד:**
שימוש ב-API חיצוני של buzagloidan. כל פעם שנוצר ליד חדש (ידני או מ-Landy webhook) או כשתזכורת מגיעה לזמן יעד, נשלחת הודעת WhatsApp לרשימת טלפונים.

**שלבים טכניים:**

1. **השגת API key מ-buzagloidan:**
   - להירשם ב: https://buzagloidan.com (אם עוד לא נרשמת)
   - דשבורד → API → יצירת API key
   - להעתיק

2. **הוספה ל-Railway Variables:**
   ```
   WHATSAPP_API_SECRET=<API_KEY>
   WHATSAPP_RECIPIENT_PHONES=972501234567,972541234568
   ```
   הערות:
   - מספרים בפורמט **972** (בלי 0 בהתחלה, בלי +, בלי רווחים)
   - מופרדים בפסיק, ללא רווחים
   - מינימום מספר אחד, אפשר עד כמה שרוצים

3. **בדיקה ידנית:**
   - להיכנס ל-CRM (מחובר)
   - לפתוח DevTools → Console → להריץ:
     ```js
     fetch("/api/test-whatsapp", {
       method: "POST",
       headers: {"Content-Type": "application/json"},
       credentials: "include",
       body: JSON.stringify({ message: "טסט מהמערכת" })
     }).then(r => r.json()).then(console.log)
     ```
   - או דרך כפתור ב-Settings (אם קיים)
   - לוודא שמתקבלת הודעה ב-WhatsApp

4. **בדיקה אמיתית:**
   - ליצור ליד חדש דרך `/clients` (status=lead)
   - לוודא שמתקבלת הודעה תוך כמה שניות

5. **תזכורות:**
   - הסקדיולר רץ אוטומטית כל 60 שניות ([index.ts:119](server/index.ts#L119))
   - ליצור reminder עם `reminderAt` לפני זמן הנוכחי → אמור להישלח תוך דקה

---

### 5. ייבוא נתונים מ-Replit

**סטטוס:** המשתמש בחר להוסיף ידנית (כמות קטנה)

**אם בכל זאת רוצים לייבא — תהליך טכני:**

1. **גישה ל-Replit DB:**
   - להיכנס ל-Replit → הפרויקט המקורי
   - לשונית **Shell**
   - הרצה:
     ```bash
     pg_dump $DATABASE_URL \
       --data-only \
       --inserts \
       --table=clients \
       --table=cases \
       --table=tasks \
       --table=payments \
       --table=transactions \
       --table=communication_logs \
       --table=client_notes \
       --table=reminders \
       > export.sql
     ```
   - להוריד את `export.sql` (כפתור הורדה ב-Files)

2. **ניקוי נתוני דמו ב-Railway DB** (לפני הייבוא):
   ```bash
   psql "postgresql://postgres:fzJmujFMZwrmWMjMVaWQtrCEaaEgMTWd@trolley.proxy.rlwy.net:50633/railway" -c "
     TRUNCATE clients, cases, tasks, payments, transactions, communication_logs, client_notes, reminders RESTART IDENTITY CASCADE;
   "
   ```

3. **ייבוא:**
   ```bash
   psql "postgresql://postgres:fzJmujFMZwrmWMjMVaWQtrCEaaEgMTWd@trolley.proxy.rlwy.net:50633/railway" -f export.sql
   ```

4. **אימות:**
   ```bash
   psql "<URL>" -c "SELECT COUNT(*) FROM clients;"
   ```

**סיכון:** ייתכן ש-IDs מתנגשים, או שיש foreign keys שמצביעים ל-users שלא קיימים. אם נכשל → לטפל לפי שגיאה.

---

## 🟢 בעדיפות נמוכה — שיפורים

### 6. Domain מותאם אישית

**סטטוס:** טרם הוגדר. כרגע: `refund-manager-crm-production.up.railway.app`

**שלבים טכניים:**

1. **רכישת דומיין:**
   - Namecheap / GoDaddy / Cloudflare Registrar
   - מומלץ: שם קצר וברור (`crm.eliazasulin.co.il` אם יש לך דומיין ראשי, או דומיין חדש)
   - מחיר: ~$10/שנה ל-.com, ~$30/שנה ל-.co.il

2. **הגדרה ב-Railway:**
   - Railway → הפרויקט → **Settings** → **Networking** → **Custom Domain**
   - להוסיף את הדומיין שרכשת
   - Railway ייתן לך CNAME יעד (משהו כמו `xxxx.up.railway.app`)

3. **הגדרת DNS אצל הרשם:**
   - Subdomain (`crm.example.com`):
     - Type: `CNAME`, Name: `crm`, Value: `xxxx.up.railway.app`, TTL: 300
   - דומיין שורש (`example.com`):
     - Type: `A` או `ALIAS` — תלוי במה ה-registrar תומך
     - Railway מספק הוראות בדף ה-Custom Domain

4. **המתנה ל-DNS** (5 דקות עד 24 שעות, בד"כ ~10 דק')

5. **HTTPS:** Railway מנפיק תעודת Let's Encrypt אוטומטית

6. **עדכון Landy webhook:** אחרי שהדומיין עובד — להחליף את ה-URL ב-Landy

---

### 7. בדיקת תפקוד שינוי סיסמה

**סטטוס:** הקוד קיים ([auth.ts:144](server/auth.ts#L144))

**מה לבדוק:**

1. להתחבר כעדן (`edenabergel94@gmail.com`)
   - סיסמה ראשונית: `Admin2026` (אם נוצרה אחרי תיקון הסיסמה האחרון)
   - אם לא עובד — להריץ סקריפט איפוס לעדן בלבד

2. ב-CRM → **Settings** → **שינוי סיסמה**
   - להזין סיסמה נוכחית + סיסמה חדשה פעמיים
   - לוודא הודעת הצלחה

3. להתנתק ולהתחבר שוב עם הסיסמה החדשה

**אם לא עובד:** לבדוק:
- האם ה-endpoint `POST /api/auth/change-password` מחזיר 200?
- האם בסשן מחובר משתמש (`req.isAuthenticated()`)?
- האם `currentPassword` נכון?

---

### 8. ניקוי נתוני דמו מ-DB

**סטטוס:** ה-seed יצר 5 לקוחות מומצאים (Yael Shapira, Avi Goldstein וכו')

**למתי:** לפני שעדן מקבלת גישה — שלא תראה לקוחות לא אמיתיים.

**טכני:**

```bash
psql "postgresql://postgres:fzJmujFMZwrmWMjMVaWQtrCEaaEgMTWd@trolley.proxy.rlwy.net:50633/railway"
```

ואז SQL:
```sql
-- מחיקת נתוני דמו (משאיר את users)
DELETE FROM transactions;
DELETE FROM payments;
DELETE FROM tasks;
DELETE FROM cases;
DELETE FROM communication_logs;
DELETE FROM client_notes;
DELETE FROM reminders;
DELETE FROM clients;
```

**הערה:** ה-seed לא ייצור אותם מחדש בהפעלה הבאה כי הוא בודק `count(clients) > 0` — אבל מכיוון שעכשיו `count = 0`, **הוא כן יחזור וייצור** אותם!

**פתרון:** לערוך את [seed.ts:42](server/seed.ts#L42) — להפוך את כל בלוק הדמו לתנאי שמסתמך על env var:
```typescript
if (process.env.SEED_DEMO_DATA !== "true") return;
```
ולא להגדיר את המשתנה ב-Railway.

---

### 9. הסרת קבצי דיבוג

**הקבצים:** `check-login.mjs`, `check-session.mjs` בשורש הפרויקט

**הבעיה:** מכילים DB credentials hardcoded (חשיפה ב-git אם בטעות יידחפו)

**שתי אופציות:**

**א. מחיקה:**
```bash
cd C:\Users\Lenovo\Desktop\refund-manager-crm
rm check-login.mjs check-session.mjs
```

**ב. שמירה + הוספה ל-.gitignore:**
```bash
echo "check-*.mjs" >> .gitignore
git rm --cached check-login.mjs check-session.mjs 2>/dev/null
```

**המלצה:** מחיקה. אם נצטרך שוב, אכתוב מחדש (וגם, ניתן להשתמש ב-env vars במקום hardcoded).

---

## 🔵 פרויקטים עתידיים

### 10. CRM נוסף לעסק האישי של אליעז

**רעיון:** Fork של הפרויקט לעסק החדש שלך, מותאם.

**שלבים טכניים:**

1. **Fork ריפו ב-GitHub:**
   - להיכנס ל: https://github.com/eliaz449/refund-manager-crm
   - Fork → או ליצור ריפו חדש ו-`git remote add` + `push`

2. **Clone למחשב:**
   ```bash
   git clone https://github.com/eliaz449/<new-repo-name>.git C:\Users\Lenovo\Desktop\<new-project-name>
   cd <new-project-name>
   npm install
   ```

3. **Railway חדש:**
   - Railway → New Project → Deploy from GitHub repo → לבחור הריפו החדש
   - להוסיף PostgreSQL service (Add → Database → PostgreSQL)
   - Variables: לאותם ערכים כמו הפרויקט הזה (חוץ מ-DATABASE_URL שיתווסף אוטומטית)

4. **התאמות:**
   - שם המערכת ([App.tsx:65](client/src/App.tsx#L65)) — "מערכת ניהול מס והנהלת חשבונות" → לשם של העסק
   - לוגו ([client/public/](client/public/) או [components/app-sidebar.tsx](client/src/components/app-sidebar.tsx))
   - אם סוג העסק שונה — להתאים enums ב-[schema.ts](shared/schema.ts) (clientType, serviceType וכו')
   - צבעים: [tailwind.config.ts](tailwind.config.ts) + [client/src/index.css](client/src/index.css)

5. **DB push:**
   ```bash
   npm run db:push
   ```

6. **משתמש admin ראשון:**
   - להגדיר `INITIAL_ADMIN_PASSWORD` ב-Railway
   - לערוך [seed.ts:39](server/seed.ts#L39) — להחליף את ה-email והשם

**זמן משוער:** 2-4 שעות עבודה לעסק דומה.

---

### 11. אינטגרציית Google Ads + בוט טלגרם

**מקור:** מזכר בזיכרון Claude (`project_google_ads.md`)

**רעיון כללי:** בוט טלגרם שמקבל פקודות → מפעיל/מכבה קמפיינים ב-Google Ads, שולף סטטיסטיקות.

**מה צריך לחקור:**
- Google Ads API: יצירת developer token, OAuth flow, scopes
- בוט טלגרם: יצירת bot ב-@BotFather, polling vs webhook
- אכסון: Railway או VPS

**זה פרויקט נפרד** — לא חלק מה-CRM הזה. כשתרצה לעבוד עליו, נפתח פרויקט חדש.

---

## ✅ הושלם בשיחה זו

| משימה | פירוט |
|---|---|
| ✅ תיקון לוגין | session store הוחלף מ-`connect-pg-simple` ל-`memorystore` |
| ✅ יצירת טבלת session | נוצרה ידנית ב-Railway DB (כשעדיין השתמשנו ב-connect-pg-simple) |
| ✅ תיקון seed | לא מאפס סיסמאות קיימות יותר |
| ✅ איפוס סיסמה | `eliazasulin@gmail.com` עם סיסמה `Admin2026` |
| ✅ העברת תיקייה | מ-`Projects/` ל-`Desktop/` |
| ✅ עדכון CLAUDE.md | תיעוד מקיף של כל הפרויקט (commit `fa83547`) |
| ✅ זיכרון חדש | "עדכון CLAUDE.md אחרי שינויים גדולים" — שמור |
