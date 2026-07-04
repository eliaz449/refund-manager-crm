# Session 2026-06-03 — מסמכים + פרטי ת.ז. + Refund tracking

**משך:** ~שעה
**Commit:** `279aead`

---

## הבקשה
המשתמש ביקש 4 פיצ'רים על ה-CRM:
1. **העלאת מסמכים** ללקוחות
2. **שותף יוכל לראות** את המסמכים על הלקוחות שמשותפים איתו
3. **שדות נוספים בפרטי לקוח** — תאריך לידה, ת.ז., תאריך הנפקה, מספר תעודה (מאחור)
4. **מעקב כסף שהוצאנו ללקוחה** ממס הכנסה + שלב בתהליך החזר

---

## גילויים מקדימים
חצי מהדברים **כבר קיימים** בסכמה ולא היו חשופים:
- `refundStage` enum עם 7 שלבים — כבר קיים ב-clients
- `clientProcessStatus` enum רחב יותר (10 שלבים)
- `taxId` כבר קיים
- `cases.refundEstimate` + `cases.totalPaid` — סכומים

מה שהיה חסר ובוצע:
- תשתית קבצים (אין)
- שדות ת.ז. נוספים (תאריך לידה, תאריך הנפקה, מספר תעודה)
- שדה ייעודי "סכום שהוצאנו ללקוחה ממס הכנסה"

---

## בחירות שהמשתמש קבע
- **Storage:** Supabase Storage **בפרויקט חדש** (לא בפרויקט Paglo הקיים) — לבידוד מלא של נתונים רגישים
- **משמעות "כסף שקיבלה מאיתנו":** הכסף שהוצאנו ללקוחה ממס הכנסה (refund paid to client)
- **שדות ת.ז.:** תאריך לידה + תאריך הנפקה + מספר לווה (תעודה מאחור) + סריקה כקובץ

---

## מה בוצע

### Schema (`shared/schema.ts`)
- **`documentCategoryEnum`** חדש — 8 ערכים: `id_card`, `form_1301`, `form_135`, `tax_authority_letter`, `bank_statement`, `salary_slip`, `tax_certificate`, `other`
- **טבלה חדשה `documents`** — `id`, `clientId`, `fileName`, `storagePath`, `mimeType`, `sizeBytes`, `category`, `uploadedBy`, `uploadedByName`, `createdAt` + index על `clientId`
- **4 עמודות חדשות ב-`clients`** (כולן nullable):
  - `dateOfBirth` (date)
  - `idIssueDate` (date)
  - `idDocumentNumber` (text)
  - `refundPaidToClient` (numeric)

### Storage layer (`server/supabaseStorage.ts`) — חדש
- `uploadDocument()` — מעלה ל-bucket `crm-documents`, path `{clientId}/{timestamp}-{filename}`
- `createSignedUrl()` — signed URL לתוקף של 60 שניות
- `deleteDocument()` — מחיקה מ-storage
- `isStorageConfigured()` — בודק שיש env vars

### API endpoints (`server/routes.ts`)
**Admin (requireAuth):**
- `GET    /api/clients/:id/documents` — רשימה
- `POST   /api/clients/:id/documents` — העלאה (multipart, multer, 20MB limit)
- `GET    /api/documents/:id/download` — signed URL
- `DELETE /api/documents/:id` — מחיקה (storage + DB)

**Partner (requirePartner):**
- `GET /api/partner/leads/:id/documents` — רשימה (רק על clients משותפים)
- `GET /api/partner/documents/:id/download` — signed URL (אימות ACL דרך `partner_leads`)

### Storage methods (`server/storage.ts`)
- `getDocumentsByClient`, `getDocument`, `createDocument`, `deleteDocument`

### Auto-migration runner (`server/migrations.ts`) — חדש
- רץ ב-`server/index.ts` לפני seed, בכל boot
- מפעיל את כל `migrations/*.sql` בסדר אלפביתי
- כל הקבצים idempotent (`IF NOT EXISTS`, `DO $$ ... EXCEPTION duplicate_object`)
- כישלון בקובץ אחד לא חוסם את ה-app

### Migration SQL (`migrations/documents-and-id-fields.sql`) — חדש
```sql
DO $$ BEGIN CREATE TYPE document_category AS ENUM (...); EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE TABLE IF NOT EXISTS documents (...);
CREATE INDEX IF NOT EXISTS idx_documents_client_id ON documents(client_id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS id_issue_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS id_document_number TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS refund_paid_to_client NUMERIC;
```

### UI changes
**`client/src/components/DocumentsSection.tsx`** — רכיב חדש משותף:
- Upload (drag&drop לא, אבל יש input file) + category select
- רשימה עם file icon, שם, קטגוריה, גודל, מעלה, תאריך
- Download (פותח signed URL ב-tab חדש)
- Delete (admin only — `readOnly` prop מסתיר)
- Props: `clientId`, `readOnly`, `listEndpoint`, `downloadEndpointPrefix` — לשימוש בשני מצבים

**`client/src/pages/client-detail.tsx`:**
- 4 שדות חדשים ב-edit form (תאריך לידה, תאריך הנפקת ת.ז., מספר תעודה, סכום שהוצאנו)
- `<DocumentsSection clientId={client.id} />` אחרי סקציית תשלומים

**`client/src/pages/partner-dashboard.tsx`:**
- `<DocumentsSection clientId={lead.clientId} readOnly listEndpoint=... downloadEndpointPrefix=... />` בדיאלוג של ליד משותף

### Deploy
1. `npm install @supabase/supabase-js multer @types/multer`
2. `npm run build` — עבר (1.4mb dist/index.cjs)
3. `git commit` + `git push origin main` → Railway auto-deploy
4. Railway עלה, migration רץ אוטומטית, `/api/health` → 200

---

## אימות
- ✅ `/api/health` → 200
- ✅ `/api/webhooks/lead` עדיין עובד (HMAC mismatch על test signature — צפוי)
- ✅ Build עבר (1.4mb)
- ✅ ה-migration ירוץ אוטומטית בעלייה ראשונה

---

## פתוח להמשך (לא הסתיים)
- [ ] **המשתמש**: ליצור פרויקט Supabase חדש (`refund-manager-crm`) + bucket `crm-documents` (private)
- [ ] **המשתמש**: לשלוח URL + service_role key
- [ ] להוסיף ב-Railway: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- [ ] בדיקה end-to-end: העלאת מסמך → הורדה (admin + partner)

---

## תובנות
1. **רבים מהפיצ'רים שביקש כבר היו בסכמה** — חשוב לבדוק לפני שמוסיפים enum/שדות חדשים
2. **Auto-migration runner חוסך הרבה כאב ראש** — במקום לבקש מהמשתמש לרוץ SQL ידנית ב-Railway DB console. כל קובץ `migrations/*.sql` idempotent → בטוח לרוץ פעמים רבות
3. **Component reusable עם props** — `DocumentsSection` משמש גם ב-admin (read/write) וגם ב-partner (read-only) דרך 3 props
4. **Supabase Storage ACL מתבסס על service_role + signed URLs** — bucket private, אף אחד לא רואה ישירות. אנחנו ה-gate.
