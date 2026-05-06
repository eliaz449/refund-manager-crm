# Refund Manager CRM — אליעז אסולין

## על הפרויקט
CRM לניהול תיקי החזרי מס. נבנה ב-Replit ומועבר לעבוד באופן עצמאי.
בעל העסק: אליעז אסולין (eliaz449 ב-GitHub)

## טכנולוגיה
- **Frontend:** React + TypeScript + Vite + Tailwind + shadcn/ui
- **Backend:** Express + Node.js (TypeScript)
- **Database:** PostgreSQL + Drizzle ORM
- **Auth:** Passport.js (local strategy)

## הרצה מקומית
```bash
npm install
npm run dev
```

## מבנה תיקיות
```
client/          ← React frontend
  src/
    components/  ← רכיבי UI
    pages/       ← דפי האפליקציה
server/          ← Express backend
  routes/        ← API routes
  db/            ← מסד נתונים
shared/          ← טיפוסים משותפים
```

## מצב הפרויקט
- הועבר מ-Replit לגיטהאב ולמחשב מקומי
- צריך להגדיר משתני סביבה (DATABASE_URL וכו')
- מטרה: לעבוד ללא תלות ב-Replit

## משתני סביבה נדרשים
```
DATABASE_URL=
SESSION_SECRET=
```

## הוראות עבודה
- לפני כל שינוי — לשאול על המטרה
- לאחר כל שינוי — לדחוף ל-GitHub
- לשמור על תאימות עם הנתונים הקיימים
