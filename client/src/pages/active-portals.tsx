import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Send, CheckCircle2, Clock, FileText, Copy, ExternalLink, ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface EnrichedPortalSession {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  token: string;
  commissionType: string;
  commissionValue: string | null;
  requiredDocs: string | null;
  status: string;
  contractSignedAt: string | null;
  signerName: string | null;
  expiresAt: string | null;
  createdAt: string;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; cls: string }> = {
  sent:          { label: "ממתין לפעולה",          variant: "secondary", cls: "bg-blue-100 text-blue-800 border-blue-200" },
  docs_partial:  { label: "מסמכים חלקיים",         variant: "secondary", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  docs_complete: { label: "מסמכים הועלו",          variant: "secondary", cls: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  signed:        { label: "חוזה נחתם",             variant: "secondary", cls: "bg-purple-100 text-purple-800 border-purple-200" },
  complete:      { label: "הושלם ✓",              variant: "secondary", cls: "bg-green-100 text-green-800 border-green-200" },
};

const STATUS_ORDER = ["sent", "signed", "docs_partial", "docs_complete", "complete"];

function portalUrl(token: string) {
  return `${window.location.origin}/portal/${token}`;
}

function commissionDisplay(type: string, value: string | null): string {
  if (!value) return "";
  return type === "percentage"
    ? `${value}%`
    : `${Number(value).toLocaleString("he-IL")} ₪`;
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function ActivePortals() {
  const { toast } = useToast();

  const { data: sessions = [], isLoading } = useQuery<EnrichedPortalSession[]>({
    queryKey: ["/api/portal-sessions/full"],
  });

  const copyLink = (token: string, clientName: string) => {
    navigator.clipboard.writeText(portalUrl(token)).then(() => {
      toast({ title: "קישור הועתק", description: `פורטל של ${clientName}` });
    });
  };

  // Group by status for a quick count summary
  const counts = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

  const activeSessions = sessions.filter(s => s.status !== "complete");
  const completedSessions = sessions.filter(s => s.status === "complete");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground text-sm">טוען פורטלים...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <Send className="w-5 h-5 text-blue-600" />
        <h1 className="text-xl font-bold">פורטלים פעילים</h1>
        <span className="text-sm text-muted-foreground mr-1">
          {activeSessions.length} פעיל / {sessions.length} סה"כ
        </span>
      </div>

      {/* Summary chips */}
      {sessions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {STATUS_ORDER.filter(s => counts[s]).map(status => {
            const info = STATUS_MAP[status] ?? { label: status, cls: "bg-gray-100 text-gray-700" };
            return (
              <span
                key={status}
                className={`text-xs font-semibold px-3 py-1 rounded-full border ${info.cls}`}
              >
                {info.label}: {counts[status]}
              </span>
            );
          })}
        </div>
      )}

      {sessions.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Send className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">אין פורטלים שנשלחו עדיין</p>
            <p className="text-xs mt-1">שלח פורטל מסמכים ללקוח דרך דף הלקוחות</p>
          </CardContent>
        </Card>
      )}

      {/* Active sessions */}
      {activeSessions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">ממתינים לפעולה</h2>
          {activeSessions.map(session => <PortalRow key={session.id} session={session} onCopy={copyLink} />)}
        </div>
      )}

      {/* Completed sessions */}
      {completedSessions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">הושלמו</h2>
          {completedSessions.map(session => <PortalRow key={session.id} session={session} onCopy={copyLink} />)}
        </div>
      )}
    </div>
  );
}

function PortalRow({
  session,
  onCopy,
}: {
  session: EnrichedPortalSession;
  onCopy: (token: string, name: string) => void;
}) {
  const statusInfo = STATUS_MAP[session.status] ?? { label: session.status, cls: "bg-gray-100 text-gray-700" };
  const commission = commissionDisplay(session.commissionType, session.commissionValue);
  const age = daysSince(session.createdAt);
  const expires = session.expiresAt ? daysUntil(session.expiresAt) : null;
  const isExpired = expires !== null && expires < 0;

  const requiredDocs: { key: string; label: string; required: boolean }[] = (() => {
    try { return JSON.parse(session.requiredDocs || "[]"); } catch { return []; }
  })();
  const requiredCount = requiredDocs.filter(d => d.required).length;

  return (
    <Card className={session.status === "complete" ? "opacity-70" : ""}>
      <CardContent className="py-3 px-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          {/* Left: client info */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/clients/${session.clientId}`}>
                <span className="font-semibold text-sm hover:underline cursor-pointer text-foreground flex items-center gap-1">
                  {session.clientName}
                  <ChevronLeft className="w-3 h-3" />
                </span>
              </Link>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusInfo.cls}`}>
                {statusInfo.label}
              </span>
              {isExpired && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-red-100 text-red-700 border-red-200">
                  פג תוקף
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              {commission && <span>שכ"ט: {commission}</span>}
              {requiredCount > 0 && <span>{requiredCount} מסמכים נדרשים</span>}
              <span>נשלח לפני {age} ימים</span>
              {expires !== null && !isExpired && expires <= 7 && (
                <span className="text-amber-600 font-medium">פג תוקף בעוד {expires} ימים</span>
              )}
            </div>

            {/* Contract signed */}
            {session.contractSignedAt && (
              <div className="flex items-center gap-1.5 text-xs text-green-700 mt-1">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>נחתם על ידי {session.signerName} ב-{new Date(session.contractSignedAt).toLocaleDateString("he-IL")}</span>
              </div>
            )}
            {!session.contractSignedAt && session.status !== "sent" && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                <span>טרם חתם על החוזה</span>
              </div>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              title="העתק קישור"
              onClick={() => onCopy(session.token, session.clientName)}
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <a
              href={portalUrl(session.token)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="פתח פורטל">
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
