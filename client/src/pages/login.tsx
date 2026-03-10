import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Eye, EyeOff, Loader2, ArrowRight, CheckCircle } from "lucide-react";

type View = "login" | "forgot" | "enterToken" | "reset" | "success";

export default function LoginPage() {
  const { login } = useAuth();
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ email: email.trim(), password });
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await apiRequest("POST", "/api/auth/forgot-password", { email: email.trim() });
      const data = await res.json();
      setMessage(data.message);
      setView("enterToken");
    } catch (err: any) {
      setError("שגיאה ביצירת קוד איפוס");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
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
    setResetLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/reset-password", {
        token: resetToken,
        newPassword,
      });
      const data = await res.json();
      setMessage(data.message);
      setView("success");
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("400")) {
        setError("קוד איפוס לא תקין או שפג תוקפו");
      } else {
        setError("שגיאה באיפוס סיסמה");
      }
    } finally {
      setResetLoading(false);
    }
  };

  const backToLogin = () => {
    setView("login");
    setMessage("");
    setError("");
    setResetToken("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex items-center justify-center w-14 h-14 rounded-xl bg-primary">
            <Building2 className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold" data-testid="text-login-title">TaxPro CRM</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">מערכת ניהול מס והנהלת חשבונות</p>
          </div>
        </CardHeader>
        <CardContent>
          {view === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">אימייל</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  dir="ltr"
                  className="text-left"
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">סיסמה</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="הזן סיסמה"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    dir="ltr"
                    className="text-left pl-10"
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {login.isError && (
                <div className="text-sm text-destructive text-center" data-testid="text-login-error">
                  {(login.error as Error)?.message?.includes("401")
                    ? "אימייל או סיסמה שגויים"
                    : "שגיאה בהתחברות, נסה שוב"}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={login.isPending}
                data-testid="button-login"
              >
                {login.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin ml-2" />
                    מתחבר...
                  </>
                ) : (
                  "התחבר"
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setView("forgot"); setError(""); setMessage(""); }}
                  className="text-sm text-primary hover:underline"
                  data-testid="link-forgot-password"
                >
                  שכחתי סיסמה
                </button>
              </div>
            </form>
          )}

          {view === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                הזן את כתובת האימייל שלך לאיפוס סיסמה
              </p>
              <div className="space-y-2">
                <Label htmlFor="forgot-email">אימייל</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  dir="ltr"
                  className="text-left"
                  data-testid="input-forgot-email"
                />
              </div>

              {error && <div className="text-sm text-destructive text-center" data-testid="text-forgot-error">{error}</div>}
              {message && <div className="text-sm text-green-600 text-center" data-testid="text-forgot-message">{message}</div>}

              <Button type="submit" className="w-full" disabled={forgotLoading} data-testid="button-send-reset">
                {forgotLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin ml-2" />
                    שולח...
                  </>
                ) : (
                  "שלח קוד איפוס"
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={backToLogin}
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  data-testid="link-back-to-login"
                >
                  <ArrowRight className="w-3 h-3" />
                  חזרה להתחברות
                </button>
              </div>
            </form>
          )}

          {view === "enterToken" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                {message || "פנה למנהל המערכת לקבלת קוד איפוס"}
              </p>
              <div className="space-y-2">
                <Label htmlFor="token-input">קוד איפוס</Label>
                <Input
                  id="token-input"
                  type="text"
                  placeholder="הדבק את קוד האיפוס כאן"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  dir="ltr"
                  className="text-left font-mono text-xs"
                  data-testid="input-reset-token"
                />
              </div>

              {error && <div className="text-sm text-destructive text-center" data-testid="text-token-error">{error}</div>}

              <Button
                className="w-full"
                disabled={!resetToken.trim()}
                onClick={async () => {
                  setError("");
                  try {
                    const res = await fetch(`/api/auth/validate-reset-token/${resetToken.trim()}`);
                    const data = await res.json();
                    if (data.valid) {
                      setView("reset");
                      setMessage("");
                    } else {
                      setError(data.message || "קוד איפוס לא תקין או שפג תוקפו");
                    }
                  } catch {
                    setError("שגיאה באימות הקוד");
                  }
                }}
                data-testid="button-validate-token"
              >
                המשך
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={backToLogin}
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  data-testid="link-back-to-login-from-token"
                >
                  <ArrowRight className="w-3 h-3" />
                  חזרה להתחברות
                </button>
              </div>
            </div>
          )}

          {view === "reset" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                הזן סיסמה חדשה לחשבון שלך
              </p>

              <div className="space-y-2">
                <Label htmlFor="new-password">סיסמה חדשה</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="לפחות 6 תווים"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  dir="ltr"
                  className="text-left"
                  data-testid="input-new-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">אימות סיסמה</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="הזן שוב את הסיסמה"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  dir="ltr"
                  className="text-left"
                  data-testid="input-confirm-password"
                />
              </div>

              {error && <div className="text-sm text-destructive text-center" data-testid="text-reset-error">{error}</div>}

              <Button type="submit" className="w-full" disabled={resetLoading} data-testid="button-reset-password">
                {resetLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin ml-2" />
                    מאפס...
                  </>
                ) : (
                  "אפס סיסמה"
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={backToLogin}
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  data-testid="link-back-to-login-from-reset"
                >
                  <ArrowRight className="w-3 h-3" />
                  חזרה להתחברות
                </button>
              </div>
            </form>
          )}

          {view === "success" && (
            <div className="space-y-4 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
              <p className="text-sm font-medium" data-testid="text-reset-success">הסיסמה אופסה בהצלחה!</p>
              <p className="text-sm text-muted-foreground">ניתן להתחבר עם הסיסמה החדשה</p>
              <Button onClick={backToLogin} className="w-full" data-testid="button-back-to-login">
                חזרה להתחברות
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
