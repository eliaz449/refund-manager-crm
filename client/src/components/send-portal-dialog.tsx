import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Copy, Send, Plus, X, CheckCircle2, ExternalLink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Client } from "@shared/schema";

// ─── Default doc templates ────────────────────────────────────────
const DOCS_PRIVATE: DocItem[] = [
  { key: "form_106",       label: "טופס 106 (מכל מעסיק)",             required: true },
  { key: "id_front",       label: "צילום קדימה של תעודת זהות",         required: true },
  { key: "id_annex",       label: "ספח תעודת זהות",                   required: true },
  { key: "license_front",  label: "צילום קדימה של רישיון נהיגה",       required: true },
  { key: "form_867",       label: "טופס 867 (ריבית / דיבידנד)",        required: false },
  { key: "form_161",       label: "טופס 161 (פיצויי פרישה)",           required: false },
  { key: "form_3456",      label: "טופס 3456א (תרומות)",              required: false },
];

const DOCS_SELF_EMPLOYED: DocItem[] = [
  { key: "id_front",       label: "צילום קדימה של תעודת זהות",         required: true },
  { key: "id_annex",       label: "ספח תעודת זהות",                   required: true },
  { key: "license_front",  label: "צילום קדימה של רישיון נהיגה",       required: true },
  { key: "bank_statements", label: "דפי בנק 3 חודשים אחרונים",         required: true },
  { key: "bookkeeping",    label: "ספרי חשבונות / הנהלת חשבונות",     required: true },
];

interface DocItem {
  key: string;
  label: string;
  required: boolean;
}

interface PortalSession {
  id: string;
  token: string;
  commissionType: string;
  commissionValue: string | null;
  status: string;
  contractSignedAt: string | null;
  createdAt: string;
}

interface Props {
  client: Client;
  open: boolean;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  sent:         { label: "נשלח",               color: "bg-blue-100 text-blue-800" },
  docs_partial: { label: "מסמכים חלקיים",       color: "bg-yellow-100 text-yellow-800" },
  docs_complete:{ label: "מסמכים הועלו",        color: "bg-indigo-100 text-indigo-800" },
  signed:       { label: "חוזה נחתם",           color: "bg-purple-100 text-purple-800" },
  complete:     { label: "הושלם",               color: "bg-green-100 text-green-800" },
};

export function SendPortalDialog({ client, open, onClose }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const defaultDocs = client.clientType === "self_employed"
    ? DOCS_SELF_EMPLOYED
    : DOCS_PRIVATE;

  const [commissionType, setCommissionType] = useState<"percentage" | "fixed">("percentage");
  const [commissionValue, setCommissionValue] = useState("");
  const [docs, setDocs] = useState<DocItem[]>(defaultDocs);
  const [customDocLabel, setCustomDocLabel] = useState("");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  // Fetch existing session
  const { data: existingSession } = useQuery<PortalSession | null>({
    queryKey: ["portal-session", client.id],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${client.id}/portal-session`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: open,
    staleTime: 0,
  });

  // Reset form when dialog opens for a client
  useEffect(() => {
    if (open) {
      setDocs(client.clientType === "self_employed" ? DOCS_SELF_EMPLOYED : DOCS_PRIVATE);
      setGeneratedUrl(null);
      if (existingSession) {
        setCommissionType((existingSession.commissionType as any) || "percentage");
        setCommissionValue(existingSession.commissionValue ?? "");
      } else {
        setCommissionType("percentage");
        setCommissionValue("");
      }
    }
  }, [open, client.id, client.clientType]);

  // Update when existing session loads
  useEffect(() => {
    if (existingSession && !generatedUrl) {
      setCommissionType((existingSession.commissionType as any) || "percentage");
      setCommissionValue(existingSession.commissionValue ?? "");
    }
  }, [existingSession]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/clients/${client.id}/portal-session`, {
        commissionType,
        commissionValue: commissionValue ? Number(commissionValue) : null,
        requiredDocs: docs,
      });
      return res.json();
    },
    onSuccess: (session: PortalSession) => {
      qc.invalidateQueries({ queryKey: ["portal-session", client.id] });
      qc.invalidateQueries({ queryKey: ["portal-sessions"] });
      const url = `${window.location.origin}/portal/${session.token}`;
      setGeneratedUrl(url);
    },
    onError: (err: any) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  const toggleDoc = (key: string) => {
    setDocs(prev => prev.map(d => d.key === key ? { ...d, required: !d.required } : d));
  };

  const removeDoc = (key: string) => {
    setDocs(prev => prev.filter(d => d.key !== key));
  };

  const addCustomDoc = () => {
    const label = customDocLabel.trim();
    if (!label) return;
    const key = `custom_${Date.now()}`;
    setDocs(prev => [...prev, { key, label, required: true }]);
    setCustomDocLabel("");
  };

  const copyUrl = () => {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl).then(() => {
      toast({ title: "הקישור הועתק ללוח" });
    });
  };

  const statusInfo = existingSession ? STATUS_LABELS[existingSession.status] : null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600" />
            שליחת פורטל מסמכים — {client.fullName}
          </DialogTitle>
        </DialogHeader>

        {/* Existing session status */}
        {existingSession && !generatedUrl && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-blue-800">פורטל קיים</span>
              {statusInfo && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              )}
            </div>
            {existingSession.contractSignedAt && (
              <p className="text-xs text-blue-600">
                חוזה נחתם: {new Date(existingSession.contractSignedAt).toLocaleDateString("he-IL")}
              </p>
            )}
            <p className="text-xs text-blue-500 mt-1">
              יצירת קישור חדש תאפס את הפורטל הקיים.
            </p>
          </div>
        )}

        {/* Generated URL */}
        {generatedUrl ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p className="font-bold text-green-800 mb-1">הפורטל נוצר!</p>
              <p className="text-xs text-green-600 mb-3">שתף את הקישור הבא עם {client.fullName}</p>
              <div className="bg-white border rounded-lg p-2 text-xs text-gray-700 break-all font-mono mb-3">
                {generatedUrl}
              </div>
              <div className="flex gap-2 justify-center">
                <Button size="sm" onClick={copyUrl} className="gap-1">
                  <Copy className="w-3 h-3" /> העתק קישור
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={generatedUrl} target="_blank" rel="noopener noreferrer" className="gap-1 flex items-center">
                    <ExternalLink className="w-3 h-3" /> תצוגה מקדימה
                  </a>
                </Button>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={onClose}>סגור</Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Commission */}
            <div className="space-y-3">
              <Label className="font-semibold">שכר טרחה</Label>
              <RadioGroup
                value={commissionType}
                onValueChange={v => setCommissionType(v as any)}
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="percentage" id="pct" />
                  <Label htmlFor="pct">אחוז מהחזר</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="fixed" id="fixed" />
                  <Label htmlFor="fixed">סכום קבוע (₪)</Label>
                </div>
              </RadioGroup>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  placeholder={commissionType === "percentage" ? "לדוגמה: 15" : "לדוגמה: 500"}
                  value={commissionValue}
                  onChange={e => setCommissionValue(e.target.value)}
                  className="max-w-[140px]"
                />
                <span className="text-gray-500 text-sm">
                  {commissionType === "percentage" ? "%" : "₪"}
                </span>
              </div>
            </div>

            {/* Documents checklist */}
            <div className="space-y-2">
              <Label className="font-semibold">מסמכים נדרשים</Label>
              <p className="text-xs text-gray-400 mb-2">
                מסומן = חובה. בטל סימון = אופציונלי. × = הסר לגמרי.
              </p>
              <div className="space-y-1.5">
                {docs.map(doc => (
                  <div key={doc.key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={doc.required}
                      onCheckedChange={() => toggleDoc(doc.key)}
                      id={`doc-${doc.key}`}
                    />
                    <label htmlFor={`doc-${doc.key}`} className="flex-1 cursor-pointer">
                      {doc.label}
                    </label>
                    <button
                      onClick={() => removeDoc(doc.key)}
                      className="text-gray-300 hover:text-red-500 transition-colors p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add custom doc */}
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="מסמך נוסף..."
                  value={customDocLabel}
                  onChange={e => setCustomDocLabel(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addCustomDoc()}
                  className="text-sm"
                />
                <Button size="sm" variant="outline" onClick={addCustomDoc} disabled={!customDocLabel.trim()}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "יוצר קישור..." : "צור קישור לפורטל"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
