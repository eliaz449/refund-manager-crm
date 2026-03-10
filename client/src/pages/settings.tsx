import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, User, Lock } from "lucide-react";

export default function Settings() {
  const { user, changePassword } = useAuth();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

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
      </div>
    </div>
  );
}
