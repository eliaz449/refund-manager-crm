import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, User, Lock, MessageCircle, Send } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function Settings() {
  const { user, changePassword } = useAuth();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [waTesting, setWaTesting] = useState(false);
  const [waResult, setWaResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestWhatsApp = async () => {
    setWaTesting(true);
    setWaResult(null);
    try {
      const res = await apiRequest("POST", "/api/test-whatsapp", {});
      const data = await res.json();
      if (data.success) {
        const count = data.recipients ?? 1;
        setWaResult({ success: true, message: `ההודעה נשלחה בהצלחה ל-${data.sent} מתוך ${count} מקבלים!` });
      } else {
        setWaResult({ success: false, message: data.error ?? "שגיאה לא ידועה" });
      }
    } catch (err: any) {
      setWaResult({ success: false, message: err.message ?? "שגיאת רשת" });
    } finally {
      setWaTesting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("הסיסמאות לא תואמות");
      return;
    }
    if (newPassword.length < 6) {
      setError("הסיסמה חייבת להיות לפחות 6 תווים");
      return;
    }

    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          toast({ title: "הסיסמה שונתה בהצלחה" });
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        },
        onError: (err: Error) => {
          const msg = err.message || "";
          if (msg.includes("401")) {
            setError("הסיסמה הנוכחית שגויה");
          } else {
            setError("שגיאה בשינוי סיסמה");
          }
        },
      }
    );
  };

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-settings-title">הגדרות חשבון</h1>
        <p className="text-sm text-muted-foreground mt-1">ניהול פרטי החשבון והסיסמה</p>
      </div>

      <div className="grid gap-6 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5" />
              פרטי חשבון
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>שם מלא</Label>
              <Input value={user?.fullName || ""} disabled data-testid="text-settings-name" />
            </div>
            <div className="space-y-2">
              <Label>אימייל</Label>
              <Input value={user?.email || ""} disabled dir="ltr" className="text-left" data-testid="text-settings-email" />
            </div>
            <div className="space-y-2">
              <Label>תפקיד</Label>
              <Input
                value={user?.role === "admin" ? "מנהל" : user?.role === "accountant" ? "רואה חשבון" : "משתמש"}
                disabled
                data-testid="text-settings-role"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="w-5 h-5" />
              שינוי סיסמה
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current">סיסמה נוכחית</Label>
                <Input
                  id="current"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  dir="ltr"
                  className="text-left"
                  data-testid="input-current-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new">סיסמה חדשה</Label>
                <Input
                  id="new"
                  type="password"
                  placeholder="לפחות 6 תווים"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  dir="ltr"
                  className="text-left"
                  data-testid="input-settings-new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">אימות סיסמה חדשה</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="הזן שוב את הסיסמה"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  dir="ltr"
                  className="text-left"
                  data-testid="input-settings-confirm-password"
                />
              </div>

              {error && <div className="text-sm text-destructive" data-testid="text-password-error">{error}</div>}

              {changePassword.isSuccess && (
                <div className="text-sm text-green-600 flex items-center gap-1" data-testid="text-password-success">
                  <CheckCircle className="w-4 h-4" />
                  הסיסמה שונתה בהצלחה
                </div>
              )}

              <Button type="submit" disabled={changePassword.isPending} data-testid="button-change-password">
                {changePassword.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin ml-2" />
                    משנה...
                  </>
                ) : (
                  "שנה סיסמה"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-600" />
              התראות WhatsApp
            </CardTitle>
            <CardDescription>
              שליחת הודעות WhatsApp אוטומטיות על לידים חדשים ותזכורות
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>🔑 <strong>WHATSAPP_API_SECRET</strong> — מפתח ה-API (מוגדר ב-Secrets)</p>
              <p>📱 <strong>WHATSAPP_RECIPIENT_PHONES</strong> — מספרי הטלפון המקבלים, מופרדים בפסיק</p>
              <p className="text-xs">לדוגמה: <span dir="ltr" className="font-mono bg-muted px-1 rounded">972501234567,972509876543</span></p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="flex items-center gap-2 w-fit border-green-300 text-green-700 hover:bg-green-50"
                onClick={handleTestWhatsApp}
                disabled={waTesting}
                data-testid="button-test-whatsapp"
              >
                {waTesting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {waTesting ? "שולח..." : "שלח הודעת בדיקה"}
              </Button>
              {waResult && (
                <div
                  className={`text-sm flex items-center gap-1.5 ${waResult.success ? "text-green-600" : "text-destructive"}`}
                  data-testid="text-whatsapp-result"
                >
                  {waResult.success ? <CheckCircle className="w-4 h-4" /> : null}
                  {waResult.message}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
