import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileText, Upload, Download, Trash2, FileImage, FileType } from "lucide-react";
import type { Document } from "@shared/schema";

const documentCategoryLabels: Record<string, string> = {
  id_card: "תעודת זהות",
  form_1301: "טופס 1301",
  form_135: "טופס 135",
  tax_authority_letter: "מכתב מרשות המסים",
  bank_statement: "דוח בנק",
  salary_slip: "תלוש משכורת",
  tax_certificate: "אישור ניכוי מס",
  other: "אחר",
};

function getFileIcon(mimeType?: string | null) {
  if (!mimeType) return <FileText className="w-4 h-4" />;
  if (mimeType.startsWith("image/")) return <FileImage className="w-4 h-4 text-blue-600" />;
  if (mimeType === "application/pdf") return <FileType className="w-4 h-4 text-red-600" />;
  return <FileText className="w-4 h-4" />;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  clientId: string;
  readOnly?: boolean;
  // If readOnly (partner view), download URL is /api/partner/documents/:id/download
  // Otherwise (admin), it's /api/documents/:id/download
  downloadEndpointPrefix?: string; // default: /api/documents
  listEndpoint?: string;            // default: /api/clients/:id/documents
}

export function DocumentsSection({
  clientId,
  readOnly = false,
  downloadEndpointPrefix = "/api/documents",
  listEndpoint,
}: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<string>("other");

  const listUrl = listEndpoint ?? `/api/clients/${clientId}/documents`;
  const { data: docs, isLoading } = useQuery<Document[]>({ queryKey: [listUrl] });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", category);
      const res = await fetch(`/api/clients/${clientId}/documents`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      toast({ title: "הקובץ הועלה בהצלחה" });
      qc.invalidateQueries({ queryKey: [listUrl] });
    } catch (err: any) {
      toast({ title: "שגיאה בהעלאה", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const downloadMutation = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`${downloadEndpointPrefix}/${docId}/download`, { credentials: "include" });
      if (!res.ok) throw new Error("שגיאה ביצירת קישור");
      return (await res.json()) as { url: string; fileName: string };
    },
    onSuccess: ({ url }) => {
      window.open(url, "_blank");
    },
    onError: (err: any) => toast({ title: "שגיאה", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/documents/${docId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("שגיאה במחיקה");
    },
    onSuccess: () => {
      toast({ title: "המסמך נמחק" });
      qc.invalidateQueries({ queryKey: [listUrl] });
    },
    onError: (err: any) => toast({ title: "שגיאה", description: err.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4" />מסמכים ({docs?.length || 0})
        </h3>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-8 w-[150px]" data-testid="select-document-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(documentCategoryLabels).map(([k, l]) => (
                  <SelectItem key={k} value={k}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={handleFileChange}
              accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.doc,.docx,.xls,.xlsx"
              data-testid="input-document-file"
            />
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              data-testid="button-upload-document"
            >
              <Upload className="w-4 h-4 ml-1" />
              {uploading ? "מעלה..." : "העלה"}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">טוען...</div>
        ) : docs && docs.length > 0 ? (
          <ul className="divide-y">
            {docs.map(d => (
              <li key={d.id} className="flex items-center gap-3 p-3" data-testid={`row-document-${d.id}`}>
                <div className="flex-shrink-0">{getFileIcon(d.mimeType)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{d.fileName}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                    <span>{documentCategoryLabels[d.category ?? "other"]}</span>
                    <span>•</span>
                    <span>{formatBytes(d.sizeBytes)}</span>
                    {d.uploadedByName && (<><span>•</span><span>{d.uploadedByName}</span></>)}
                    {d.createdAt && (<><span>•</span><span>{new Date(d.createdAt).toLocaleDateString("he-IL")}</span></>)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => downloadMutation.mutate(d.id)}
                    disabled={downloadMutation.isPending}
                    data-testid={`button-download-${d.id}`}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  {!readOnly && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`למחוק את "${d.fileName}"?`)) deleteMutation.mutate(d.id);
                      }}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${d.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {readOnly ? "אין מסמכים ללקוח זה" : "אין מסמכים — לחץ \"העלה\" להוספת מסמך ראשון"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
