import { useState, useRef } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckCircle2, Upload, FileText, AlertCircle, Loader2, Pen, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────
interface RequiredDoc {
  key: string;
  label: string;
  required: boolean;
}

interface FirmDetails {
  name: string;
  companyId: string | null;
  officeAddress: string | null;
  cpaLicense: string | null;
  phone: string | null;
  email: string | null;
}

interface PortalData {
  sessionId: string;
  clientName: string;
  clientType: "private_individual" | "self_employed";
  commissionType: "percentage" | "fixed";
  commissionValue: string | null;
  requiredDocs: RequiredDoc[];
  status: string;
  contractSignedAt: string | null;
  signerName: string | null;
  uploadedKeys: string[];
  firmDetails?: FirmDetails;
}

interface UploadedDoc {
  id: string;
  docKey: string;
  docLabel: string | null;
  fileName: string;
  uploadedAt: string | null;
}

// ─── Contract text ───────────────────────────────────────────────
function ContractText({ clientName, commissionType, commissionValue, firm }: {
  clientName: string;
  commissionType: "percentage" | "fixed";
  commissionValue: string | null;
  firm?: FirmDetails;
}) {
  const feeText = commissionType === "percentage"
    ? `${commissionValue ?? "X"}% מסכום החזר המס שיתקבל בפועל`
    : `${Number(commissionValue ?? 0).toLocaleString("he-IL")} ₪`;

  const firmName = firm?.name ?? "עדן אסולין, רו\"ח";

  return (
    <div className="text-sm leading-relaxed space-y-4 text-gray-700">
      <div className="text-center font-bold text-base text-gray-900 border-b pb-3">
        הסכם שירות — החזר מס הכנסה
      </div>

      <p>
        <strong>בין:</strong> {firmName}
        {firm?.companyId && <span> | ח.פ. {firm.companyId}</span>}
        {firm?.officeAddress && <span> | {firm.officeAddress}</span>}
        {firm?.cpaLicense && <span> | רישיון רו&quot;ח מס&apos; {firm.cpaLicense}</span>}
        {" "}(&ldquo;נותן השירות&rdquo;)<br />
        <strong>לבין:</strong> {clientName} (&ldquo;הלקוח&rdquo;)
      </p>

      <section>
        <p className="font-semibold text-gray-900 mb-1">א. מהות השירות</p>
        <p>
          נותן השירות ייצג את הלקוח מול רשות המסים לצורך בדיקה והגשת בקשה להחזר
          מס הכנסה עבור שנות המס הרלוונטיות, עד 6 שנות מס אחורה.
        </p>
      </section>

      <section>
        <p className="font-semibold text-gray-900 mb-1">ב. ייפוי כוח</p>
        <p>
          הלקוח מייפה בזאת את כוחה של עדן אסולין, רו&quot;ח, לפעול בשמו מול רשות
          המסים לצורך השגת החזר המס, לרבות הגשת טפסים, קבלת מידע ומסמכים
          מרשות המסים בעניינו.
        </p>
      </section>

      <section>
        <p className="font-semibold text-gray-900 mb-1">ג. אחריות הלקוח</p>
        <p>
          הלקוח מצהיר ומאשר כי כל המידע, הנתונים והמסמכים שמסר הינם נכונים,
          מלאים ומדויקים. ידוע לו כי השירות מתבסס אך ורק על הנתונים שמסר, ובמקרה
          של אי-דיוק, שגיאה, השמטה או הסתרת מידע — כל אחריות משפטית, כספית ואחרת
          תחול על הלקוח בלבד ובמלואה. עדן אסולין, רו&quot;ח, לא תישא בכל חבות,
          ישירה או עקיפה, לנזקים שייגרמו עקב נתונים שגויים שנמסרו.
        </p>
      </section>

      <section>
        <p className="font-semibold text-gray-900 mb-1">ד. תקופת הטיפול</p>
        <p>הטיפול יכסה עד 6 שנות מס אחורה בהתאם לתקנות רשות המסים.</p>
      </section>

      <section>
        <p className="font-semibold text-gray-900 mb-1">ה. שכר טרחה ותשלום</p>
        <p className="font-medium">שכר הטרחה המוסכם: {feeText}.</p>

        <p className="mt-2">
          <strong>מועד התשלום:</strong> הלקוח מתחייב להעביר את שכר הטרחה תוך{" "}
          <strong>3 ימי עסקים</strong> ממועד קבלת ההחזר לחשבון הבנק שלו, ולהודיע
          לעדן אסולין, רו&quot;ח, על קבלתו תוך 24 שעות מהקבלה.
        </p>

        <p className="mt-2">
          <strong>הרשאת חיוב:</strong> בחתימתו על הסכם זה, הלקוח מעניק הרשאה
          מפורשת ובלתי חוזרת לחייב את אמצעי התשלום שלו בסכום שכר הטרחה המוסכם,
          אם לא יועבר התשלום עד <strong>7 ימים</strong> ממועד קבלת ההחזר. חיוב זה
          ייעשה ללא צורך בהודעה נוספת, מאחר שהסכם זה מהווה הסכמה מוקדמת ומלאה
          לביצועו.
        </p>

        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-xs">
          <p className="font-bold mb-1">⚠️ תנאי איחור — חובה לקרוא</p>
          <p>
            איחור בתשלום מעל 7 ימים יגרור באופן <strong>אוטומטי</strong> את כל
            אלה:
          </p>
          <ul className="list-disc list-inside mt-1 space-y-0.5">
            <li>חיוב אוטומטי של אמצעי התשלום הרשום בסכום המלא</li>
            <li>
              ריבית פיגורים לפי חוק פסיקת ריבית והצמדה, תשכ&quot;א–1961
            </li>
            <li>דמי טיפול בגביה בסכום של 350 ₪</li>
            <li>
              הלקוח יישא בכל הוצאות גביית החוב, לרבות שכ&quot;ט עו&quot;ד,
              ככל שיידרשו
            </li>
          </ul>
        </div>

        <p className="mt-2 text-xs text-gray-500">
          הלקוח מצהיר כי קרא, הבין ומסכים לכלל תנאי סעיף זה, וכי הסכמתו
          לחיוב ניתנת מרצונו החופשי ובמודע.
        </p>
      </section>
    </div>
  );
}

// ─── Upload section for a single doc ─────────────────────────────
function DocUploadRow({
  doc,
  uploaded,
  token,
  onUploaded,
  disabled,
}: {
  doc: RequiredDoc;
  uploaded: boolean;
  token: string;
  onUploaded: (docKey: string, fileName: string) => void;
  disabled: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("docKey", doc.key);
      fd.append("docLabel", doc.label);

      const res = await fetch(`/api/portal/${token}/upload`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "שגיאה" }));
        throw new Error(err.message);
      }
      onUploaded(doc.key, file.name);
      toast({ title: "הועלה בהצלחה", description: file.name });
    } catch (err: any) {
      toast({ title: "שגיאה בהעלאה", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div
      className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors ${
        uploaded
          ? "bg-green-50 border-green-200"
          : disabled
          ? "bg-gray-50 border-gray-200 opacity-60"
          : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {uploaded ? (
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
        ) : (
          <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{doc.label}</p>
          {!doc.required && (
            <p className="text-xs text-gray-400">אופציונלי</p>
          )}
        </div>
      </div>

      {uploaded ? (
        <span className="text-xs text-green-700 font-medium flex-shrink-0">הועלה ✓</span>
      ) : (
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={handleFile}
            disabled={disabled || uploading}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || uploading}
            onClick={() => fileRef.current?.click()}
            className="flex-shrink-0 text-xs"
          >
            {uploading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Upload className="w-3 h-3 ml-1" />
            )}
            {uploading ? "מעלה..." : "העלאה"}
          </Button>
        </>
      )}
    </div>
  );
}

// ─── Main portal page ─────────────────────────────────────────────
export default function Portal() {
  const [, params] = useRoute("/portal/:token");
  const token = params?.token ?? "";
  const { toast } = useToast();

  const [signerName, setSignerName] = useState("");
  const [signing, setSigning] = useState(false);
  const [uploadedKeys, setUploadedKeys] = useState<Set<string>>(new Set());
  const [localSigned, setLocalSigned] = useState(false);

  const { data: portal, isLoading, error, refetch } = useQuery<PortalData>({
    queryKey: ["portal", token],
    queryFn: async () => {
      const res = await fetch(`/api/portal/${token}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "שגיאה" }));
        throw new Error(err.message);
      }
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  // Merge server uploadedKeys with local optimistic state
  const allUploadedKeys = new Set([
    ...(portal?.uploadedKeys ?? []),
    ...uploadedKeys,
  ]);
  const signed = localSigned || !!portal?.contractSignedAt;
  const requiredDocs = portal?.requiredDocs ?? [];

  const handleSign = async () => {
    if (!signerName.trim() || signerName.trim().length < 2) {
      toast({ title: "יש להזין שם מלא", variant: "destructive" });
      return;
    }
    setSigning(true);
    try {
      const res = await fetch(`/api/portal/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signerName: signerName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "שגיאה" }));
        throw new Error(err.message);
      }
      setLocalSigned(true);
      toast({ title: "החוזה נחתם בהצלחה", description: "כעת תוכל להעלות מסמכים" });
    } catch (err: any) {
      toast({ title: "שגיאה בחתימה", description: err.message, variant: "destructive" });
    } finally {
      setSigning(false);
    }
  };

  const requiredCount = requiredDocs.filter(d => d.required).length;
  const uploadedRequiredCount = requiredDocs.filter(d => d.required && allUploadedKeys.has(d.key)).length;
  const allRequiredDone = requiredCount > 0 && uploadedRequiredCount >= requiredCount;
  const allDone = signed && allRequiredDone;

  // ── Loading ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div dir="rtl" className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────
  if (error || !portal) {
    return (
      <div dir="rtl" className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-sm w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-800 mb-2">הקישור אינו תקין</h2>
          <p className="text-gray-500 text-sm">
            {(error as Error)?.message || "אנא פנה למשרד עדן אסולין לקבלת קישור חדש."}
          </p>
        </div>
      </div>
    );
  }

  // ── All done ──────────────────────────────────────────────────
  if (allDone) {
    return (
      <div dir="rtl" className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-sm w-full text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">הכל הושלם!</h2>
          <p className="text-gray-600 text-sm mb-4">
            {portal.clientName}, החוזה נחתם והמסמכים הועלו בהצלחה.
          </p>
          <p className="text-gray-500 text-xs">
            עדן אסולין, רו&quot;ח, תיצור איתך קשר בהמשך.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            עא
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">עדן אסולין, רו&quot;ח</p>
            <p className="text-xs text-gray-500">פורטל לקוחות — שירות החזר מס</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* Welcome */}
        <div className="bg-blue-600 text-white rounded-2xl p-5">
          <p className="text-lg font-bold mb-1">שלום, {portal.clientName}</p>
          <p className="text-blue-100 text-sm">
            כדי שנוכל להתחיל בטיפול בהחזר המס שלך, יש להשלים שני שלבים:
            חתימה על הסכם השירות והעלאת המסמכים הנדרשים.
          </p>
        </div>

        {/* Progress bar */}
        <div className="bg-white rounded-xl border p-4">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>התקדמות</span>
            <span>
              {signed ? "חוזה ✓" : "חוזה ⏳"} &nbsp;|&nbsp;
              {uploadedRequiredCount}/{requiredCount} מסמכים
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{
                width: `${Math.round(
                  ((signed ? 1 : 0) + uploadedRequiredCount / Math.max(requiredCount, 1)) / 2 * 100
                )}%`,
              }}
            />
          </div>
        </div>

        {/* ── Section 1: Contract ── */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
            {signed ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <Pen className="w-5 h-5 text-blue-600" />
            )}
            <h2 className="font-bold text-gray-800">שלב 1 — חתימה על הסכם שירות</h2>
          </div>

          {signed ? (
            <div className="p-4 flex items-center gap-2 text-green-700 bg-green-50">
              <CheckCircle2 className="w-5 h-5" />
              <div>
                <p className="text-sm font-medium">ההסכם נחתם על ידי: {portal.signerName || signerName}</p>
                <p className="text-xs text-green-600">תאריך: {portal.contractSignedAt
                  ? new Date(portal.contractSignedAt).toLocaleDateString("he-IL")
                  : new Date().toLocaleDateString("he-IL")}</p>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Scrollable contract */}
              <div className="max-h-72 overflow-y-auto border rounded-lg p-4 bg-gray-50 text-xs">
                <ContractText
                  clientName={portal.clientName}
                  commissionType={portal.commissionType}
                  commissionValue={portal.commissionValue}
                  firm={portal.firmDetails}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  חתימה — הקלד/י את שמך המלא לאישור ההסכם
                </label>
                <Input
                  placeholder="שם מלא"
                  value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  className="text-base"
                  dir="rtl"
                />
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleSign}
                  disabled={signing || !signerName.trim()}
                >
                  {signing ? (
                    <Loader2 className="w-4 h-4 animate-spin ml-2" />
                  ) : (
                    <Pen className="w-4 h-4 ml-2" />
                  )}
                  {signing ? "חותם..." : "חתום על ההסכם"}
                </Button>
                <p className="text-xs text-gray-400 text-center">
                  בלחיצה על &quot;חתום&quot; אתה מאשר שקראת והסכמת לתנאי ההסכם
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Section 2: Documents ── */}
        <div className={`bg-white rounded-xl border overflow-hidden ${!signed ? "opacity-60" : ""}`}>
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
            {allRequiredDone ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : !signed ? (
              <Lock className="w-5 h-5 text-gray-400" />
            ) : (
              <Upload className="w-5 h-5 text-blue-600" />
            )}
            <h2 className="font-bold text-gray-800">שלב 2 — העלאת מסמכים</h2>
            {!signed && (
              <span className="text-xs text-gray-400 mr-auto">יינעל עד לחתימה</span>
            )}
          </div>

          {!signed && (
            <div className="p-4 text-center text-gray-400 text-sm py-8">
              <Lock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>יש לחתום על ההסכם תחילה</p>
            </div>
          )}

          {signed && (
            <div className="p-4 space-y-2">
              {requiredDocs.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">אין מסמכים נדרשים</p>
              )}
              {requiredDocs.map(doc => (
                <DocUploadRow
                  key={doc.key}
                  doc={doc}
                  uploaded={allUploadedKeys.has(doc.key)}
                  token={token}
                  disabled={false}
                  onUploaded={(key) => setUploadedKeys(prev => new Set([...prev, key]))}
                />
              ))}
              {requiredDocs.filter(d => d.required).length > 0 && (
                <p className="text-xs text-gray-400 pt-1">
                  * מסמכים ללא סימון &quot;אופציונלי&quot; הם חובה
                </p>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 pb-4">
          שאלות? צרו קשר עם משרד עדן אסולין, רו&quot;ח
        </p>
      </div>
    </div>
  );
}
