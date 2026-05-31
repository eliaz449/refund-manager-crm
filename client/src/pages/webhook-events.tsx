import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { CheckCircle2, XCircle, AlertTriangle, Clock, RefreshCw, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { WebhookEvent } from "@shared/schema";

const statusConfig: Record<string, { label: string; color: string; icon: React.FC<any> }> = {
  received:          { label: "התקבל",        color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",    icon: Clock },
  auth_failed:       { label: "שגיאת אימות",   color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",      icon: XCircle },
  validation_failed: { label: "שגיאת ולידציה", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", icon: AlertTriangle },
  db_error:          { label: "שגיאת DB",      color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",      icon: XCircle },
  created:           { label: "ליד נוצר",      color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle2 },
  updated:           { label: "ליד עודכן",     color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",  icon: CheckCircle2 },
};

const authConfig: Record<string, { label: string; color: string }> = {
  ok:        { label: "עבר",       color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  failed:    { label: "נכשל",      color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  no_secret: { label: "חסר סוד",  color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" },
};

function StatusBadge({ status }: { status: string | null }) {
  const cfg = status ? statusConfig[status] : null;
  if (!cfg) return <span className="text-muted-foreground text-xs">—</span>;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function AuthBadge({ status }: { status: string | null }) {
  const cfg = status ? authConfig[status] : null;
  if (!cfg) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function ParsedPayload({ raw }: { raw: string | null }) {
  if (!raw) return <span className="text-muted-foreground text-xs">—</span>;
  try {
    const obj = JSON.parse(raw);
    return (
      <div className="text-xs space-y-0.5">
        {obj.full_name && <div><span className="text-muted-foreground">שם:</span> {obj.full_name}</div>}
        {obj.phone     && <div><span className="text-muted-foreground">טלפון:</span> {obj.phone}</div>}
        {obj.email     && <div><span className="text-muted-foreground">אימייל:</span> {obj.email}</div>}
      </div>
    );
  } catch {
    return <span className="text-xs text-muted-foreground">{raw.substring(0, 60)}</span>;
  }
}

export default function WebhookEventsPage() {
  const { data: events = [], isLoading, refetch, isFetching } = useQuery<WebhookEvent[]>({
    queryKey: ["/api/webhook-events"],
    refetchInterval: 30000,
  });

  const total      = events.length;
  const successful = events.filter(e => e.processingStatus === "created" || e.processingStatus === "updated").length;
  const authFailed = events.filter(e => e.processingStatus === "auth_failed").length;
  const otherFailed = events.filter(e => e.processingStatus === "db_error" || e.processingStatus === "validation_failed").length;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">לוג Webhooks — לידים</h1>
            <p className="text-sm text-muted-foreground mt-0.5">כל בקשת Webhook מדפי הנחיתה מתועדת כאן, כולל כשלים</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh-webhooks">
            <RefreshCw className={`w-4 h-4 ml-1 ${isFetching ? "animate-spin" : ""}`} />
            רענן
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="text-xs text-muted-foreground">סה״כ קיבל</div>
              <div className="text-2xl font-bold mt-1" data-testid="text-webhook-total">{total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="text-xs text-muted-foreground">הצליח</div>
              <div className="text-2xl font-bold text-green-600 mt-1" data-testid="text-webhook-success">{successful}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="text-xs text-muted-foreground">כשל אימות</div>
              <div className="text-2xl font-bold text-red-600 mt-1" data-testid="text-webhook-auth-fail">{authFailed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="text-xs text-muted-foreground">כשל אחר</div>
              <div className="text-2xl font-bold text-orange-500 mt-1" data-testid="text-webhook-other-fail">{otherFailed}</div>
            </CardContent>
          </Card>
        </div>

        {/* Auth mismatch warning */}
        {authFailed > 0 && (
          <Card className="border-red-300 bg-red-50 dark:bg-red-950/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-red-700 dark:text-red-400">יש {authFailed} בקשות שנכשלו באימות</div>
                  <div className="text-sm text-red-600 dark:text-red-500 mt-1">
                    הסוד שהדף שולח ב-<code>x-lead-signature</code> לא תואם את <code>LEAD_WEBHOOK_SECRET</code> שמוגדר ב-Railway.
                    <br />
                    <strong>פתרון:</strong> ודא ש-<code>CRM_WEBHOOK_SECRET</code> בדף הנחיתה זהה ל-<code>LEAD_WEBHOOK_SECRET</code> ב-Railway Variables.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Events table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">היסטוריית בקשות (200 אחרונות)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">טוען...</div>
            ) : events.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <div>אין בקשות עדיין</div>
                <div className="text-xs mt-1">כאשר דף נחיתה ישלח Webhook הוא יופיע כאן</div>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">תאריך ושעה</TableHead>
                        <TableHead className="text-right">פייסלוד מנורמל</TableHead>
                        <TableHead className="text-right">אימות</TableHead>
                        <TableHead className="text-right">סטטוס עיבוד</TableHead>
                        <TableHead className="text-right">שגיאה</TableHead>
                        <TableHead className="text-right">לקוח</TableHead>
                        <TableHead className="text-right">פרטים</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((event) => (
                        <Collapsible key={event.id} asChild>
                          <>
                            <TableRow data-testid={`row-webhook-${event.id}`}>
                              <TableCell className="text-xs whitespace-nowrap">
                                {event.receivedAt
                                  ? format(new Date(event.receivedAt), "dd/MM/yy HH:mm:ss", { locale: he })
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                <ParsedPayload raw={event.normalizedPayload} />
                              </TableCell>
                              <TableCell>
                                <AuthBadge status={event.authStatus} />
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={event.processingStatus} />
                              </TableCell>
                              <TableCell className="max-w-xs">
                                {event.errorMessage
                                  ? <span className="text-xs text-red-600 break-words">{event.errorMessage}</span>
                                  : <span className="text-muted-foreground text-xs">—</span>}
                              </TableCell>
                              <TableCell>
                                {event.createdClientId
                                  ? <Link href={`/clients/${event.createdClientId}`}>
                                      <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
                                        <ExternalLink className="w-3 h-3" />
                                        לקוח
                                      </Button>
                                    </Link>
                                  : <span className="text-muted-foreground text-xs">—</span>}
                              </TableCell>
                              <TableCell>
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 text-xs" data-testid={`button-expand-webhook-${event.id}`}>
                                    גוף גולמי
                                  </Button>
                                </CollapsibleTrigger>
                              </TableCell>
                            </TableRow>
                            <CollapsibleContent asChild>
                              <TableRow className="bg-muted/30">
                                <TableCell colSpan={7} className="py-2">
                                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-48 p-2 bg-muted rounded">
                                    {event.rawBody || "—"}
                                  </pre>
                                </TableCell>
                              </TableRow>
                            </CollapsibleContent>
                          </>
                        </Collapsible>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden divide-y">
                  {events.map((event) => (
                    <div key={event.id} className="p-4 space-y-2" data-testid={`card-webhook-${event.id}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {event.receivedAt ? format(new Date(event.receivedAt), "dd/MM/yy HH:mm:ss", { locale: he }) : "—"}
                        </span>
                        <StatusBadge status={event.processingStatus} />
                      </div>
                      <ParsedPayload raw={event.normalizedPayload} />
                      <div className="flex items-center gap-2 flex-wrap">
                        <AuthBadge status={event.authStatus} />
                        {event.createdClientId && (
                          <Link href={`/clients/${event.createdClientId}`}>
                            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
                              <ExternalLink className="w-3 h-3" />לקוח
                            </Button>
                          </Link>
                        )}
                      </div>
                      {event.errorMessage && (
                        <div className="text-xs text-red-600">{event.errorMessage}</div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Test curl command */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">פקודת curl לבדיקה ידנית</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap break-all">
{`curl -X POST https://refund-manager-crm-production.up.railway.app/api/webhooks/lead \\
  -H "Content-Type: application/json" \\
  -H "x-lead-signature: YOUR_SIGNATURE_HERE" \\
  -d '{"full_name":"ישראל ישראלי","phone":"0501234567","page_name":"בדיקה","source":"website"}'`}
            </pre>
            <p className="text-xs text-muted-foreground mt-2">
              <code>YOUR_SIGNATURE_HERE</code> הוא <code>HMAC-SHA256(LEAD_WEBHOOK_SECRET, body)</code> בפורמט hex.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
