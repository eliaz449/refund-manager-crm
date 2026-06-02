import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowRight, Phone, Mail, FileText, Briefcase, CheckSquare, CreditCard, Save, Clock, Plus, Pencil, Trash2, StickyNote, Users, PhoneCall, PhoneOff, AlertCircle } from "lucide-react";
import { formatDateTime, relativeTime } from "@/lib/date-utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { DocumentsSection } from "@/components/DocumentsSection";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Client, Case, Task, Payment, ClientNote, User } from "@shared/schema";
import { useState, useEffect } from "react";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(value);
}

const serviceTypeLabels: Record<string, string> = {
  tax_refund: "החזר מס",
  bookkeeping: "הנהלת חשבונות",
  annual_report: "דוח שנתי",
  quarterly_report: "דוח רבעוני",
  vat_report: 'דוח מע"מ',
  business_registration: "רישום עסק",
  consultation: "ייעוץ",
  other: "אחר",
};

const paymentMethodLabels: Record<string, string> = {
  credit_card: "כרטיס אשראי",
  bank_transfer: "העברה בנקאית",
  check: "צ׳ק",
  cash: "מזומן",
  other: "אחר",
};

const sourceLabels: Record<string, string> = {
  referral: "הפניה",
  website: "אתר אינטרנט",
  social_media: "רשתות חברתיות",
  direct: "ישיר",
  other: "אחר",
  recommended: "מומלצים",
};

const pricingTypeLabels: Record<string, string> = {
  percentage: "אחוז מההחזר",
  fixed: "סכום קבוע",
  hourly: "שעתי",
};

const contactStatusLabels: Record<string, string> = {
  new: "חדש",
  no_answer_1: "אין מענה 1",
  no_answer_2: "אין מענה 2",
  no_answer_3: "אין מענה 3",
  no_answer_4: "אין מענה 4",
  no_answer_5: "אין מענה 5",
  no_answer_6: "אין מענה 6",
  talked: "דיברנו",
  sent_documents: "שלח מסמכים",
  in_process: "בתהליך",
  closed: "נסגר",
  not_relevant: "לא רלוונטי",
};

const refundStageLabels: Record<string, string> = {
  details_received: "פרטים התקבלו",
  waiting_documents: "מחכים למסמכים",
  document_review: "בדיקת מסמכים",
  submitted_to_tax: "הוגש למס הכנסה",
  in_treatment: "בטיפול",
  approved: "אושר",
  paid: "שולם",
};

export default function ClientDetail() {
  const [, params] = useRoute("/clients/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const clientId = params?.id;

  const { data: client, isLoading } = useQuery<Client>({
    queryKey: ["/api/clients", clientId],
    enabled: !!clientId,
  });

  const { data: clientCases } = useQuery<Case[]>({
    queryKey: ["/api/clients", clientId, "cases"],
    enabled: !!clientId,
  });

  const { data: clientTasks } = useQuery<Task[]>({
    queryKey: ["/api/clients", clientId, "tasks"],
    enabled: !!clientId,
  });

  const { data: clientPayments } = useQuery<Payment[]>({
    queryKey: ["/api/clients", clientId, "payments"],
    enabled: !!clientId,
  });

  const { data: clientNotes } = useQuery<ClientNote[]>({
    queryKey: ["/api/clients", clientId, "notes"],
    enabled: !!clientId,
  });

  const { data: usersData } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: allClients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const [editData, setEditData] = useState<Partial<Client>>({});
  const [caseDialogOpen, setCaseDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const [notRelevantReason, setNotRelevantReason] = useState("");
  const [showNotRelevantDialog, setShowNotRelevantDialog] = useState(false);
  const [notRelevantSource, setNotRelevantSource] = useState<"contactStatus" | "processStatus">("contactStatus");

  useEffect(() => {
    if (client) setEditData(client);
  }, [client]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Client>) => {
      await apiRequest("PATCH", `/api/clients/${clientId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      toast({ title: "הלקוח עודכן בהצלחה" });
    },
    onError: (err: Error) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  const createCaseMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      await apiRequest("POST", "/api/cases", { ...data, clientId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setCaseDialogOpen(false);
      toast({ title: "התיק נוצר בהצלחה" });
    },
    onError: (err: Error) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      await apiRequest("POST", "/api/tasks", { ...data, clientId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setTaskDialogOpen(false);
      toast({ title: "המשימה נוצרה בהצלחה" });
    },
    onError: (err: Error) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      await apiRequest("POST", "/api/payments", { ...data, clientId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setPaymentDialogOpen(false);
      toast({ title: "התשלום נוסף בהצלחה" });
    },
    onError: (err: Error) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      await apiRequest("POST", `/api/clients/${clientId}/notes`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "notes"] });
      setNoteText("");
      toast({ title: "ההערה נוספה" });
    },
    onError: (err: Error) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      await apiRequest("PATCH", `/api/notes/${id}`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "notes"] });
      setEditingNoteId(null);
      toast({ title: "ההערה עודכנה" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "notes"] });
      toast({ title: "ההערה נמחקה" });
    },
  });

  const contactAttemptMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/clients/${clientId}/contact-attempt`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "ניסיון התקשרות נרשם" });
    },
    onError: (err: Error) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  function handleContactStatusChange(newStatus: string) {
    if (newStatus === "not_relevant") {
      setNotRelevantSource("contactStatus");
      setNotRelevantReason("");
      setShowNotRelevantDialog(true);
      return;
    }
    const updatePayload: Record<string, any> = { contactStatus: newStatus };
    if (newStatus === "talked" && !client?.firstContactAt) {
      updatePayload.firstContactAt = new Date().toISOString();
    }
    if (newStatus === "closed") {
      updatePayload.closedDate = new Date().toISOString().split("T")[0];
    }
    updateMutation.mutate(updatePayload);
  }

  function handleProcessStatusChange(newStatus: string) {
    if (newStatus === "not_relevant") {
      setNotRelevantSource("processStatus");
      setNotRelevantReason("");
      setShowNotRelevantDialog(true);
      return;
    }
    setEditData({ ...editData, clientProcessStatus: newStatus as any });
  }

  function handleNotRelevantConfirm() {
    const updatePayload: Record<string, any> = {};
    if (notRelevantSource === "contactStatus") {
      updatePayload.contactStatus = "not_relevant";
    } else {
      updatePayload.clientProcessStatus = "not_relevant";
      setEditData({ ...editData, clientProcessStatus: "not_relevant" as any });
    }
    updateMutation.mutate(updatePayload);
    if (notRelevantReason.trim()) {
      createNoteMutation.mutate(`לא רלוונטי - ${notRelevantReason.trim()}`);
    }
    setShowNotRelevantDialog(false);
    setNotRelevantReason("");
  }

  function handleCaseSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Record<string, any> = {};
    formData.forEach((val, key) => {
      if (val) {
        if (key === "taxYear") data[key] = parseInt(val.toString());
        else data[key] = val.toString();
      }
    });
    createCaseMutation.mutate(data);
  }

  function handleTaskSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Record<string, any> = {};
    formData.forEach((val, key) => {
      if (val) data[key] = val.toString();
    });
    createTaskMutation.mutate(data);
  }

  function handlePaymentSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Record<string, any> = {};
    formData.forEach((val, key) => {
      if (val) data[key] = val.toString();
    });
    createPaymentMutation.mutate(data);
  }

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-4 sm:p-6">
        <p className="text-muted-foreground">הלקוח לא נמצא</p>
        <Button variant="outline" onClick={() => setLocation("/clients")} className="mt-4">
          <ArrowRight className="w-4 h-4 ml-2" />חזרה ללקוחות
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={() => setLocation("/clients")} data-testid="button-back">
          <ArrowRight className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-client-name">{client.fullName}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <StatusBadge status={client.status} />
            <StatusBadge status={client.clientProcessStatus} />
            {client.contactStatus && <StatusBadge status={client.contactStatus} />}
            {client.refundStage && <StatusBadge status={client.refundStage} />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-detail-created-at">
          <Clock className="w-4 h-4" />
          <span>{formatDateTime(client.createdAt)}</span>
          {relativeTime(client.createdAt) && (
            <span className="text-xs">({relativeTime(client.createdAt)})</span>
          )}
        </div>
        {client.phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="w-4 h-4" />{client.phone}
          </div>
        )}
        {client.email && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="w-4 h-4" />{client.email}
          </div>
        )}
      </div>

      {/* Contact Tracking Section */}
      <Card>
        <CardHeader className="pb-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <PhoneCall className="w-4 h-4" />סטטוס קשר
          </h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">סטטוס קשר</p>
              <Select
                value={client.contactStatus || "new"}
                onValueChange={handleContactStatusChange}
              >
                <SelectTrigger className="h-8 text-sm" data-testid="select-contact-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(contactStatusLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">ניסיונות התקשרות</p>
              <p className="text-lg font-semibold" data-testid="text-contact-attempts">{client.contactAttempts || 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">קשר ראשון</p>
              <p className="text-sm" data-testid="text-first-contact">
                {client.firstContactAt ? formatDateTime(client.firstContactAt) : "טרם התקיים"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">קשר אחרון</p>
              <p className="text-sm" data-testid="text-last-contact">
                {client.lastContactAt ? formatDateTime(client.lastContactAt) : "טרם התקיים"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details Section */}
      <Card>
        <CardHeader className="pb-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4" />פרטי לקוח
          </h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>שם מלא</Label>
              <Input
                value={editData.fullName || ""}
                onChange={(e) => setEditData({ ...editData, fullName: e.target.value })}
                data-testid="input-edit-name"
              />
            </div>
            <div className="space-y-2">
              <Label>אימייל</Label>
              <Input
                value={editData.email || ""}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                data-testid="input-edit-email"
              />
            </div>
            <div className="space-y-2">
              <Label>טלפון</Label>
              <Input
                value={editData.phone || ""}
                onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                data-testid="input-edit-phone"
              />
            </div>
            <div className="space-y-2">
              <Label>תעודת זהות / ח.פ.</Label>
              <Input
                value={editData.taxId || ""}
                onChange={(e) => setEditData({ ...editData, taxId: e.target.value })}
                data-testid="input-edit-taxid"
              />
            </div>
            <div className="space-y-2">
              <Label>תאריך לידה</Label>
              <Input
                type="date"
                value={editData.dateOfBirth || ""}
                onChange={(e) => setEditData({ ...editData, dateOfBirth: e.target.value })}
                data-testid="input-edit-date-of-birth"
              />
            </div>
            <div className="space-y-2">
              <Label>תאריך הנפקת ת.ז.</Label>
              <Input
                type="date"
                value={editData.idIssueDate || ""}
                onChange={(e) => setEditData({ ...editData, idIssueDate: e.target.value })}
                data-testid="input-edit-id-issue-date"
              />
            </div>
            <div className="space-y-2">
              <Label>מספר תעודה (מאחור)</Label>
              <Input
                value={editData.idDocumentNumber || ""}
                onChange={(e) => setEditData({ ...editData, idDocumentNumber: e.target.value })}
                placeholder="9 ספרות מאחורי הת.ז."
                data-testid="input-edit-id-document-number"
              />
            </div>
            <div className="space-y-2">
              <Label>סכום שהוצאנו ללקוח/ה (₪)</Label>
              <Input
                type="number"
                step="0.01"
                value={editData.refundPaidToClient || ""}
                onChange={(e) => setEditData({ ...editData, refundPaidToClient: e.target.value })}
                placeholder="סכום ההחזר שהועבר ללקוח/ה"
                data-testid="input-edit-refund-paid"
              />
            </div>
            <div className="space-y-2">
              <Label>סטטוס</Label>
              <Select value={editData.status || ""} onValueChange={(v) => setEditData({ ...editData, status: v as any })}>
                <SelectTrigger data-testid="select-edit-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">ליד</SelectItem>
                  <SelectItem value="active">פעיל</SelectItem>
                  <SelectItem value="inactive">לא פעיל</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>סטטוס תהליך</Label>
              <Select value={editData.clientProcessStatus || ""} onValueChange={handleProcessStatusChange}>
                <SelectTrigger data-testid="select-edit-process"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">ליד</SelectItem>
                  <SelectItem value="initial_process">תהליך ראשוני</SelectItem>
                  <SelectItem value="waiting_for_documents">ממתין למסמכים</SelectItem>
                  <SelectItem value="ready_for_case_opening">מוכן לפתיחת תיק</SelectItem>
                  <SelectItem value="in_treatment">בטיפול</SelectItem>
                  <SelectItem value="transferred_to_accountant">הועבר לרואה חשבון</SelectItem>
                  <SelectItem value="ready_for_submission">מוכן להגשה</SelectItem>
                  <SelectItem value="submitted_to_tax_authority">הוגש לרשות המסים</SelectItem>
                  <SelectItem value="paid_and_closed">שולם ונסגר</SelectItem>
                  <SelectItem value="not_relevant">לא רלוונטי</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>שלב החזר מס</Label>
              <Select value={editData.refundStage || ""} onValueChange={(v) => setEditData({ ...editData, refundStage: v as any })}>
                <SelectTrigger data-testid="select-edit-refund-stage"><SelectValue placeholder="בחר שלב" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(refundStageLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>מקור</Label>
              <Select value={editData.source || ""} onValueChange={(v) => setEditData({ ...editData, source: v as any })}>
                <SelectTrigger data-testid="select-edit-source"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="referral">הפניה</SelectItem>
                  <SelectItem value="website">אתר אינטרנט</SelectItem>
                  <SelectItem value="social_media">רשתות חברתיות</SelectItem>
                  <SelectItem value="direct">ישיר</SelectItem>
                  <SelectItem value="recommended">מומלצים</SelectItem>
                  <SelectItem value="other">אחר</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(editData.source === "recommended" || editData.source === "referral") && (
              <div className="space-y-2">
                <Label>שם הממליץ</Label>
                <Input
                  value={editData.recommendedBy || ""}
                  onChange={(e) => setEditData({ ...editData, recommendedBy: e.target.value })}
                  data-testid="input-edit-recommended-by"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>כתובת</Label>
              <Input
                value={editData.address || ""}
                onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                data-testid="input-edit-address"
              />
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-semibold mb-3">תמחור</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>סוג תמחור</Label>
                <Select value={editData.pricingType || ""} onValueChange={(v) => setEditData({ ...editData, pricingType: v as any })}>
                  <SelectTrigger data-testid="select-edit-pricing-type"><SelectValue placeholder="בחר סוג" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">אחוז מההחזר</SelectItem>
                    <SelectItem value="fixed">סכום קבוע</SelectItem>
                    <SelectItem value="hourly">שעתי</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editData.pricingType === "percentage" && (
                <div className="space-y-2">
                  <Label>אחוז מוסכם (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={editData.agreedPercentage || ""}
                    onChange={(e) => setEditData({ ...editData, agreedPercentage: e.target.value })}
                    data-testid="input-edit-agreed-percentage"
                  />
                </div>
              )}
              {(editData.pricingType === "fixed" || editData.pricingType === "hourly") && (
                <div className="space-y-2">
                  <Label>{editData.pricingType === "fixed" ? "סכום קבוע (₪)" : "תעריף שעתי (₪)"}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editData.agreedFixedAmount || ""}
                    onChange={(e) => setEditData({ ...editData, agreedFixedAmount: e.target.value })}
                    data-testid="input-edit-agreed-amount"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>הערות כלליות</Label>
            <Textarea
              value={editData.notes || ""}
              onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
              rows={3}
              data-testid="input-edit-notes"
            />
          </div>
          <div className="flex justify-start">
            <Button onClick={() => updateMutation.mutate(editData)} disabled={updateMutation.isPending} data-testid="button-save-client">
              <Save className="w-4 h-4 ml-2" />{updateMutation.isPending ? "שומר..." : "שמור שינויים"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notes History Section */}
      <Card>
        <CardHeader className="pb-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <StickyNote className="w-4 h-4" />היסטוריית הערות ({clientNotes?.length || 0})
          </h3>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Textarea
              placeholder="הוסף הערה חדשה..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={2}
              className="flex-1"
              data-testid="input-new-note"
            />
            <Button
              onClick={() => { if (noteText.trim()) createNoteMutation.mutate(noteText.trim()); }}
              disabled={!noteText.trim() || createNoteMutation.isPending}
              size="sm"
              className="self-end"
              data-testid="button-add-note"
            >
              <Plus className="w-4 h-4 ml-1" />הוסף
            </Button>
          </div>
          {clientNotes && clientNotes.length > 0 ? (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {clientNotes.map(note => (
                <div key={note.id} className="border rounded-md p-3 space-y-1" data-testid={`note-${note.id}`}>
                  {editingNoteId === note.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editingNoteText}
                        onChange={(e) => setEditingNoteText(e.target.value)}
                        rows={2}
                        data-testid="input-edit-note"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => updateNoteMutation.mutate({ id: note.id, content: editingNoteText })} data-testid="button-save-note">שמור</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingNoteId(null)} data-testid="button-cancel-note">ביטול</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(note.createdAt)}
                          {relativeTime(note.createdAt) && ` (${relativeTime(note.createdAt)})`}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => { setEditingNoteId(note.id); setEditingNoteText(note.content); }}
                            data-testid={`button-edit-note-${note.id}`}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => deleteNoteMutation.mutate(note.id)}
                            data-testid={`button-delete-note-${note.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">אין הערות עדיין</p>
          )}
        </CardContent>
      </Card>

      {/* Cases Section */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Briefcase className="w-4 h-4" />תיקים ({clientCases?.length || 0})
          </h3>
          <Button size="sm" onClick={() => setCaseDialogOpen(true)} data-testid="button-add-case-inline">
            <Plus className="w-4 h-4 ml-1" />פתח תיק
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {clientCases && clientCases.length > 0 ? (
            <>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>סוג שירות</TableHead>
                      <TableHead>שנת מס</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead>עדיפות</TableHead>
                      <TableHead>הערכת החזר</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientCases.map(c => (
                      <TableRow key={c.id} data-testid={`row-case-${c.id}`}>
                        <TableCell className="text-sm">{serviceTypeLabels[c.serviceType || ""] || c.serviceType}</TableCell>
                        <TableCell className="text-sm">{c.taxYear || "-"}</TableCell>
                        <TableCell><StatusBadge status={c.status} /></TableCell>
                        <TableCell><StatusBadge status={c.priority} /></TableCell>
                        <TableCell className="text-sm">{c.refundEstimate ? formatCurrency(parseFloat(c.refundEstimate)) : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="sm:hidden space-y-2 p-4">
                {clientCases.map(c => (
                  <div key={c.id} className="border rounded-md p-3 space-y-2" data-testid={`card-case-${c.id}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm font-medium">{serviceTypeLabels[c.serviceType || ""] || c.serviceType}</span>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="flex items-center justify-between gap-2 flex-wrap text-sm text-muted-foreground">
                      <span>שנת מס: {c.taxYear || "-"}</span>
                      <StatusBadge status={c.priority} />
                    </div>
                    {c.refundEstimate && (
                      <p className="text-sm">הערכת החזר: {formatCurrency(parseFloat(c.refundEstimate))}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">אין תיקים ללקוח זה</div>
          )}
        </CardContent>
      </Card>

      {/* Tasks Section */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <CheckSquare className="w-4 h-4" />משימות ({clientTasks?.length || 0})
          </h3>
          <Button size="sm" onClick={() => setTaskDialogOpen(true)} data-testid="button-add-task-inline">
            <Plus className="w-4 h-4 ml-1" />הוסף משימה
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {clientTasks && clientTasks.length > 0 ? (
            <>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>משימה</TableHead>
                      <TableHead>תאריך יעד</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead>עדיפות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientTasks.map(t => (
                      <TableRow key={t.id} data-testid={`row-task-${t.id}`}>
                        <TableCell className="text-sm font-medium">{t.taskName}</TableCell>
                        <TableCell className="text-sm">{t.dueDate || "-"}</TableCell>
                        <TableCell><StatusBadge status={t.status} /></TableCell>
                        <TableCell><StatusBadge status={t.priority} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="sm:hidden space-y-2 p-4">
                {clientTasks.map(t => (
                  <div key={t.id} className="border rounded-md p-3 space-y-2" data-testid={`card-task-${t.id}`}>
                    <p className="text-sm font-medium">{t.taskName}</p>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm text-muted-foreground">יעד: {t.dueDate || "-"}</span>
                      <div className="flex items-center gap-1 flex-wrap">
                        <StatusBadge status={t.status} />
                        <StatusBadge status={t.priority} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">אין משימות ללקוח זה</div>
          )}
        </CardContent>
      </Card>

      {/* Payments Section */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <CreditCard className="w-4 h-4" />תשלומים ({clientPayments?.length || 0})
          </h3>
          <Button size="sm" onClick={() => setPaymentDialogOpen(true)} data-testid="button-add-payment-inline">
            <Plus className="w-4 h-4 ml-1" />הוסף תשלום
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {clientPayments && clientPayments.length > 0 ? (
            <>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>סכום</TableHead>
                      <TableHead>תאריך</TableHead>
                      <TableHead>אמצעי תשלום</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead>מס׳ אסמכתא</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientPayments.map(p => (
                      <TableRow key={p.id} data-testid={`row-payment-${p.id}`}>
                        <TableCell className="text-sm font-medium">{formatCurrency(parseFloat(p.amount))}</TableCell>
                        <TableCell className="text-sm">{p.paymentDate || "-"}</TableCell>
                        <TableCell className="text-sm">{paymentMethodLabels[p.paymentMethod || ""] || p.paymentMethod}</TableCell>
                        <TableCell><StatusBadge status={p.status} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.referenceNumber || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="sm:hidden space-y-2 p-4">
                {clientPayments.map(p => (
                  <div key={p.id} className="border rounded-md p-3 space-y-2" data-testid={`card-payment-${p.id}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm font-medium">{formatCurrency(parseFloat(p.amount))}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="flex items-center justify-between gap-2 flex-wrap text-sm text-muted-foreground">
                      <span>{p.paymentDate || "-"}</span>
                      <span>{paymentMethodLabels[p.paymentMethod || ""] || p.paymentMethod}</span>
                    </div>
                    {p.referenceNumber && (
                      <p className="text-xs text-muted-foreground">אסמכתא: {p.referenceNumber}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">אין תשלומים ללקוח זה</div>
          )}
        </CardContent>
      </Card>

      <DocumentsSection clientId={client.id} />

      {/* Create Case Dialog */}
      <Dialog open={caseDialogOpen} onOpenChange={setCaseDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>תיק חדש - {client.fullName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCaseSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>שנת מס</Label>
                <Input name="taxYear" type="number" placeholder="2024" data-testid="input-inline-case-year" />
              </div>
              <div className="space-y-2">
                <Label>סוג שירות</Label>
                <Select name="serviceType" defaultValue="tax_refund">
                  <SelectTrigger data-testid="select-inline-case-service"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tax_refund">החזר מס</SelectItem>
                    <SelectItem value="bookkeeping">הנהלת חשבונות</SelectItem>
                    <SelectItem value="annual_report">דוח שנתי</SelectItem>
                    <SelectItem value="quarterly_report">דוח רבעוני</SelectItem>
                    <SelectItem value="vat_report">דוח מע״מ</SelectItem>
                    <SelectItem value="business_registration">רישום עסק</SelectItem>
                    <SelectItem value="consultation">ייעוץ</SelectItem>
                    <SelectItem value="other">אחר</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>עדיפות</Label>
                <Select name="priority" defaultValue="medium">
                  <SelectTrigger data-testid="select-inline-case-priority"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">נמוכה</SelectItem>
                    <SelectItem value="medium">בינונית</SelectItem>
                    <SelectItem value="high">גבוהה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>מטפל אחראי</Label>
                <Select name="assignedTo">
                  <SelectTrigger data-testid="select-inline-case-assigned"><SelectValue placeholder="בחר מטפל" /></SelectTrigger>
                  <SelectContent>
                    {usersData?.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>הערכת החזר</Label>
              <Input name="refundEstimate" type="number" step="0.01" placeholder="0.00" data-testid="input-inline-case-estimate" />
            </div>
            <div className="space-y-2">
              <Label>הערות</Label>
              <Textarea name="notes" rows={2} data-testid="input-inline-case-notes" />
            </div>
            <div className="flex justify-start gap-2">
              <Button type="submit" disabled={createCaseMutation.isPending} data-testid="button-submit-inline-case">
                {createCaseMutation.isPending ? "יוצר..." : "צור תיק"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setCaseDialogOpen(false)}>ביטול</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>משימה חדשה - {client.fullName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTaskSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>שם משימה *</Label>
              <Input name="taskName" required data-testid="input-inline-task-name" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>תאריך יעד</Label>
                <Input name="dueDate" type="date" data-testid="input-inline-task-due" />
              </div>
              <div className="space-y-2">
                <Label>עדיפות</Label>
                <Select name="priority" defaultValue="medium">
                  <SelectTrigger data-testid="select-inline-task-priority"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">נמוכה</SelectItem>
                    <SelectItem value="medium">בינונית</SelectItem>
                    <SelectItem value="high">גבוהה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {clientCases && clientCases.length > 0 && (
              <div className="space-y-2">
                <Label>תיק משויך</Label>
                <Select name="caseId">
                  <SelectTrigger data-testid="select-inline-task-case"><SelectValue placeholder="בחר תיק (אופציונלי)" /></SelectTrigger>
                  <SelectContent>
                    {clientCases.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {serviceTypeLabels[c.serviceType || ""] || c.serviceType} {c.taxYear ? `(${c.taxYear})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>הערות</Label>
              <Textarea name="notes" rows={2} data-testid="input-inline-task-notes" />
            </div>
            <div className="flex justify-start gap-2">
              <Button type="submit" disabled={createTaskMutation.isPending} data-testid="button-submit-inline-task">
                {createTaskMutation.isPending ? "יוצר..." : "צור משימה"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setTaskDialogOpen(false)}>ביטול</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>תשלום חדש - {client.fullName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>סכום *</Label>
                <Input name="amount" type="number" step="0.01" required data-testid="input-inline-payment-amount" />
              </div>
              <div className="space-y-2">
                <Label>תאריך תשלום</Label>
                <Input name="paymentDate" type="date" data-testid="input-inline-payment-date" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>אמצעי תשלום</Label>
                <Select name="paymentMethod" defaultValue="bank_transfer">
                  <SelectTrigger data-testid="select-inline-payment-method"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit_card">כרטיס אשראי</SelectItem>
                    <SelectItem value="bank_transfer">העברה בנקאית</SelectItem>
                    <SelectItem value="check">צ׳ק</SelectItem>
                    <SelectItem value="cash">מזומן</SelectItem>
                    <SelectItem value="other">אחר</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>סטטוס</Label>
                <Select name="status" defaultValue="paid">
                  <SelectTrigger data-testid="select-inline-payment-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">שולם</SelectItem>
                    <SelectItem value="pending">ממתין</SelectItem>
                    <SelectItem value="cancelled">בוטל</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {clientCases && clientCases.length > 0 && (
              <div className="space-y-2">
                <Label>תיק משויך</Label>
                <Select name="caseId">
                  <SelectTrigger data-testid="select-inline-payment-case"><SelectValue placeholder="בחר תיק (אופציונלי)" /></SelectTrigger>
                  <SelectContent>
                    {clientCases.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {serviceTypeLabels[c.serviceType || ""] || c.serviceType} {c.taxYear ? `(${c.taxYear})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>מס׳ אסמכתא</Label>
              <Input name="referenceNumber" data-testid="input-inline-payment-ref" />
            </div>
            <div className="space-y-2">
              <Label>הערות</Label>
              <Textarea name="notes" rows={2} data-testid="input-inline-payment-notes" />
            </div>
            <div className="flex justify-start gap-2">
              <Button type="submit" disabled={createPaymentMutation.isPending} data-testid="button-submit-inline-payment">
                {createPaymentMutation.isPending ? "שומר..." : "הוסף תשלום"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)}>ביטול</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Not Relevant Reason Dialog */}
      <Dialog open={showNotRelevantDialog} onOpenChange={setShowNotRelevantDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              סימון כלא רלוונטי
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">ניתן לכתוב סיבה קצרה. הסיבה תישמר כהערה בכרטיס הלקוח.</p>
            <Textarea
              placeholder="מה הסיבה שזה לא רלוונטי?"
              value={notRelevantReason}
              onChange={(e) => setNotRelevantReason(e.target.value)}
              rows={3}
              data-testid="input-not-relevant-reason"
            />
            <div className="flex justify-start gap-2">
              <Button onClick={handleNotRelevantConfirm} data-testid="button-confirm-not-relevant">
                אישור
              </Button>
              <Button variant="outline" onClick={() => { setShowNotRelevantDialog(false); setNotRelevantReason(""); }} data-testid="button-cancel-not-relevant">
                ביטול
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
