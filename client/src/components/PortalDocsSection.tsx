import { useQuery } from "@tanstack/react-query";
import { Download, FileText, CheckCircle2, Clock, Send } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface PortalDoc {
  id: string;
  docKey: string;
  docLabel: string | null;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedAt: string | null;
}

interface PortalSession {
  id: string;
  token: string;
  commissionType: string;
  commissionValue: string | null;
  status: string;
  contractSignedAt: string | null;
  signerName: string | null;
  createdAt: string;
}

const STATUS_INFO: Record<string, { label: string; cls: string }> = {
  sent:          { label: "ממתין לפעולת לקוח",   cls: "bg-blue-100 text-blue-700" },
  docs_partial:  { label: "מסמכים חלקיים",       cls: "bg-amber-100 text-amber-700" },
  docs_complete: { label: "מסמכים הועלו — ממתין לחתימה", cls: "bg-indigo-100 text-indigo-700" },
  signed:        { label: "חוזה נחתם — ממתין למסמכים",   cls: "bg-purple-100 text-purple-700" },
  complete:      { label: "הושלם",               cls: "bg-green-100 text-green-700" },
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function PortalDocsSection({ clientId }: { clientId: string }) {
  const { toast } = useToast();

  const { data: session } = useQuery<PortalSession | null>({
    queryKey: [`/api/clients/${clientId}/portal-session`],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/portal-session`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: docs = [] } = useQuery<PortalDoc[]>({
    queryKey: [`/api/clients/${clientId}/portal-documents`],
    enabled: !!session,
  });

  const handleDownload = async (docId: string, fileName: string) => {
    try {
      const res = await fetch(`/api/portal-documents/${docId}/download`, { credentials: "include" });
      if (!res.ok) throw new Error("שגיאה בהורדה");
      const { url } = await res.json();
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      toast({ title: "שגיאה בהורדה", description: err.message, variant: "destructive" });
    }
  };

  if (!session) return null;

  const statusInfo = STATUS_INFO[session.status] ?? { label: session.status, cls: "bg-gray-100 text-gray-700" };
  const commissionDisplay = session.commissionValue
    ? session.commissionType === "percentage"
      ? `${session.commissionValue}%`
      : `${Number(session.commissionValue).toLocaleString("he-IL")} ₪`
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-base">פורטל מסמכים וחוזה</h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {commissionDisplay && (
              <span className="text-xs text-muted-foreground border rounded px-2 py-0.5">
                שכ"ט: {commissionDisplay}
              </span>
            )}
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${statusInfo.cls}`}>
              {statusInfo.label}
            </span>
          </div>
        </div>

        {/* Contract signed info */}
        {session.contractSignedAt && (
          <div className="mt-2 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>
              החוזה נחתם על ידי <strong>{session.signerName}</strong>{" "}
              ב-{new Date(session.contractSignedAt).toLocaleDateString("he-IL", {
                year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
              })}
            </span>
          </div>
        )}

        {!session.contractSignedAt && (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span>הלקוח טרם חתם על החוזה</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            הלקוח טרם העלה מסמכים דרך הפורטל
          </p>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground mb-2 font-medium">
              {docs.length} מסמכים הועלו על ידי הלקוח
            </p>
            {docs.map(doc => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {doc.docLabel || doc.docKey}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {doc.fileName}
                      {doc.sizeBytes ? ` • ${formatBytes(doc.sizeBytes)}` : ""}
                      {doc.uploadedAt
                        ? ` • ${new Date(doc.uploadedAt).toLocaleDateString("he-IL")}`
                        : ""}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-shrink-0 h-7 text-xs gap-1"
                  onClick={() => handleDownload(doc.id, doc.fileName)}
                >
                  <Download className="w-3 h-3" />
                  הורד
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
