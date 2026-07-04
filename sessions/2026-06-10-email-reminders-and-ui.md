# Session 2026-06-10 — UI overhaul + email reminders + 2 critical bug fixes

**משך:** סשן ארוך (~כמה שעות)
**Commits (קוד עיקרי):** `5970698` → `385da12`

---

## מה בוצע

### 1. שדרוג רשימת הלקוחות
- **סדר עמודות חדש (לבקשת עדן):** ת.ז. → שם → טלפון → סטטוס → מקור → צפי החזר → תאריך הגשה → עמלה → תאריך תקבול → פעולה → ⋮
- **6 עמודות חדשות בסכמת `clients`:** customStatus (text חופשי), refundEstimateAmount, submissionDate, commissionAmount, receiptDate, pensionYearsChecked
- **הוסר מהתצוגה:** עמודת תזכורת, כפתור קריטריונים, badge של contactStatus
- בעריכת לקוח: 4 שדות חדשים (תאריך לידה, תאריך הנפקת ת.ז., מספר תעודה, סכום שהוצאנו) + Pension Checklist (6 שנים אחורה)
- 3 selectors הוסרו: "סטטוס תהליך", "שלב החזר מס", "סטטוס ליד" — מוחלפים ב-input אחד "סטטוס (טקסט חופשי)"

### 2. Inline Editing בכל תא
- רכיב חדש `EditableCell` (טקסט/מספר/תאריך/select) — קליק על תא → input → Enter/blur שומר → ✓ ירוק
- שורה לא ניתנת ללחיצה (אין navigation) — כניסה לליד רק דרך 3 הנקודות → "כניסה לליד"

### 3. עמוד "לידים לשנה הבאה"
- כל לקוח עם `receiptDate` עובר אוטומטית לעמוד הזה
- קיבוץ לפי שנת התקבול, 3 כרטיסי סיכום (סה"כ + החזרים + עמלות)
- 🐛 **באג שתוקן:** `EmptyState` ציפה ל-component reference, לא JSX element — גרם ל-React error #130. תוקן.

### 4. עמודת "פעולה" + Quick Actions
- כפתור צבעוני שמציג את ה-`contactStatus` הנוכחי. קליק → תפריט:
  - ענה (`talked`)
  - לא ענה (מתקדם `no_answer_1..6`)
  - לא מעוניין (`not_interested`) ✨ enum חדש
  - השאיר פרטים בטעות (`wrong_info`) ✨ enum חדש
  - ────
  - ליצור קשר בזמן אחר → פותח חלון תזכורת
  - לא רלוונטי → פותח חלון "סיבה" → שומר ב-`notRelevantReason`

### 5. עמוד "לידים לא רלוונטיים"
- כל לקוח עם `contactStatus ∈ (not_relevant, not_interested, wrong_info)` עובר אוטומטית
- קיבוץ + חיפוש + סיבה + כפתור החזרה לרשימה הראשית

### 6. סינון רשימת הלקוחות הראשית
- מוסתרים: לקוחות עם receiptDate (עברו לשנה הבאה) + 3 הסטטוסים של "לא רלוונטי"
- התוצאה: רק לידים פעילים שעדן צריכה לעבוד עליהם

### 7. ⭐ מערכת תזכורות במייל (חדש!)
- כל 60 שניות השרת בודק: יש תזכורת פנדינג שעוד לא נשלחה במייל?
- אם כן → שולח לעדן (`edenabergel94@gmail.com`) דרך Resend
- טמפלט יפה, navy gradient + 🔔 בכתום (לעומת הליד שזה ירוק)
- 2 כפתורי CTA: 📞 התקשר + 💬 WhatsApp + לינק לליד ב-CRM

---

## 🐛 באגים קריטיים שתוקנו במהלך הסשן

### באג #1: Timezone של תזכורות
**הסימפטום:** התזכורות נוצרות, אבל המייל לא מגיע גם כשהשעה כבר עברה.
**הסיבה:** `<input type="datetime-local">` מחזיר string ללא timezone (`"2026-06-10T00:12"`). זה נשמר ב-PG כאילו זה UTC. תזכורת ל-00:12 שעון ישראל נשמרה בפועל ל-00:12 UTC = 03:12 שעון ישראל. 3 שעות בעתיד.
**התיקון:** `new Date(reminderAt).toISOString()` — ה-Date constructor מפענח naive datetime-local כ-local time, ו-toISOString ממיר ל-UTC נכון.
**איפה:** `client/src/pages/clients.tsx:258`

### באג #2: `RESEND_API_KEY` לא ב-Railway
**הסימפטום:** `pendingCount: 0` תמיד, גם עם תזכורות פנדינג.
**הסיבה:** המפתח קיים ב-Netlify (לדף הנחיתה של עדן) — אבל לא ב-Railway (ל-CRM). 2 פלטפורמות, 2 רשימות env vars נפרדות.
**התיקון:** אליעז הוסיף `RESEND_API_KEY = re_b52HNBv5_3UNK9Z5PaQzfAPXWJ6n1p5Kk` ל-Railway Variables. אותו key כמו ב-Netlify, מה-Resend account.

### באג #3: Build נכשל ב-Railway על syntax error
**הסימפטום:** Railway "build" סטטוס נשאר ב-BUILDING למשך 8+ דקות.
**הסיבה:** commit `7c152cd` עם debug endpoints היה `await` בתוך פונקציה לא-async.
**התיקון:** שכתוב נקי של ה-endpoint (commit `fab8d2b`).

---

## הוכחת end-to-end עובד
4 מיילים נשלחו ונמסרו דרך Resend ב-22:10-22:14 UTC:
```
🔔 תזכורת — בדיקת מערכת        delivered ✅
🔔 תזכורת — אודי בניטה (00:12)  delivered ✅
🔔 תזכורת — אודי בניטה (00:23)  delivered ✅
🔔 תזכורת — אודי בניטה (00:47)  delivered ✅
```

---

## פתוח לסשן הבא 🔲

### חובה לעשות
1. **לאמת שעדן באמת קיבלה את ה-4 מיילים** — אם בספאם, לסמן "לא ספאם" לטובת העתיד
2. **בדיקה end-to-end לתיקון ה-timezone**:
   - ליצור תזכורת דרך ה-UI לזמן 2 דקות בעתיד (שעון ישראל)
   - לוודא שהמייל מגיע בזמן הנכון, לא 3 שעות מאוחר יותר
3. **לחזק את ה-debug endpoints** (כרגע פתוחים בלי auth!):
   - `GET /api/version` — בסדר, מידע לא רגיש
   - `GET /api/debug/email-reminder-status` — חושף תוכן תזכורות
   - `POST /api/debug/send-test-email` — כל אחד יכול לשלוח מייל
   - `POST /api/debug/send-reminder-now/:id` — כל אחד יכול לשלוח כל תזכורת
   - `POST /api/debug/run-email-scheduler` — כל אחד יכול להריץ את ה-scheduler
   - **הצעה:** להוסיף `requireAuth` או למחוק את 4 האחרונים
4. **לנקות 3 תזכורות הטסט** של אודי בניטה ("להתקשר מחר/שוב מחר/מחר שוב")

### מ-2026-06-03 (עדיין פתוח)
- חיבור Supabase Storage למסמכים — צריך פרויקט Supabase חדש + 2 env vars ב-Railway

---

## תובנות לעתיד
1. **דפלוי איטי = פוטנציאלית בעיית build**. אם Railway תקוע ב-BUILDING יותר מ-3-4 דקות, כנראה build נכשל. לבדוק ב-`View logs`.
2. **Cache הדפדפן עקשני ב-SPAs**. אחרי deploy, hard refresh (Ctrl+Shift+R) או חלון פרטי. ה-`maxAge: 1y, immutable` על ה-assets הוא אופטימיזציה, אבל יוצר את הצורך הזה.
3. **env vars הם per-service ב-Railway**. אם משהו עובד "במקום אחד" (Netlify), לא אומר שהוא קיים ב-CRM (Railway). 2 רשימות נפרדות.
4. **`<input type="datetime-local">` תמיד מחזיר naive string ללא timezone**. תמיד להמיר עם `new Date(...).toISOString()` לפני שליחה לשרת.
5. **Resend logs קל לבדוק מבחוץ** עם ה-API: `GET /api/emails?limit=10`. שימושי לדיבוג צד-שרת.
