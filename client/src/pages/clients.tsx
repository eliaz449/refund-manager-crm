import { useState, useMemo, Fragment, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Plus, Search, Phone, Mail, MoreHorizontal, Eye, Trash2, Clock,
  Bell, BellOff, ChevronDown, ChevronUp, Calendar, Handshake, Loader2,
  ChevronLeft, ChevronRight, Check
} from "lucide-react";
import { formatDateTime, relativeTime } from "@/lib/date-utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/status-badge";
import { EditableCell } from "@/components/EditableCell";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Client, Reminder } from "@shared/schema";
import { format, isToday } from "date-fns";
import { he } from "date-fns/locale";

const sourceLabels: Record<string, string> = {
  referral: "הפניה",
  website: "אתר",
  social_media: "רשתות",
  direct: "ישיר",
  recommended: "מומלצים",
  other: "אחר",
};

const contactStatusLabels: Record<string, string> = {
  new: "חדש",
  no_answer_1: "אין מענה 1",
  no_answer_2: "אין מענה 2",
  no_answer_3: "אין מענה 3",
  no_answer_4: "אין מענה 4",
  no_answer_5: "אין מענה 5",
  no_answer_6: "אין מענה 6",
  talked: "ענה",
  sent_documents: "שלח מסמכים",
  in_process: "בטיפול",
  closed: "נסגר",
  not_relevant: "לא רלוונטי",
  not_interested: "לא מעוניין",
  wrong_info: "השאיר פרטים בטעות",
  waiting_for_docs: "מחכה לטפסים",
  missing_docs: "חסרים מסמכים",
  closed_won: "סגור בהצלחה",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(value);
}

function ActionStatusButton({
  client,
  onChangeStatus,
  onOpenReminder,
  onOpenNotRelevant,
}: {
  client: Client;
  onChangeStatus: (status: string) => void;
  onOpenReminder: () => void;
  onOpenNotRelevant: () => void;
}) {
  const status = client.contactStatus || "";
  const label = contactStatusLabels[status] || "פעולה";

  const colorClass = (() => {
    if (!status || status === "new") return "bg-blue-100 text-blue-800 hover:bg-blue-200";
    if (status.startsWith("no_answer")) return "bg-red-100 text-red-800 hover:bg-red-200";
    if (status === "talked") return "bg-amber-100 text-amber-800 hover:bg-amber-200";
    if (status === "waiting_for_docs") return "bg-purple-100 text-purple-800 hover:bg-purple-200";
    if (status === "missing_docs") return "bg-orange-100 text-orange-800 hover:bg-orange-200";
    if (status === "sent_documents") return "bg-emerald-100 text-emerald-800 hover:bg-emerald-200";
    if (status === "in_process") return "bg-cyan-100 text-cyan-800 hover:bg-cyan-200";
    if (status === "closed_won" || status === "closed") return "bg-green-100 text-green-800 hover:bg-green-200";
    if (["not_relevant", "not_interested", "wrong_info"].includes(status)) return "bg-gray-200 text-gray-700 hover:bg-gray-300";
    return "bg-muted hover:bg-muted/80";
  })();

  // Next no_answer level — cycles 1→6, stays at 6
  function nextNoAnswer() {
    const current = parseInt((status.match(/^no_answer_(\d)$/)?.[1]) || "0", 10);
    const next = Math.min(current + 1, 6) || 1;
    return `no_answer_${next}`;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 min-w-[90px] justify-between ${colorClass}`}
          data-testid={`action-status-${client.id}`}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="w-3 h-3 flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => onChangeStatus("talked")}>
          <span className="text-amber-700">●</span>&nbsp;ענה
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChangeStatus(nextNoAnswer())}>
          <span className="text-red-600">●</span>&nbsp;לא ענה
        </DropdownMenuItem>
        <div className="h-px bg-muted my-1" />
        <DropdownMenuItem onClick={() => onChangeStatus("waiting_for_docs")}>
          <span className="text-purple-700">🤖</span>&nbsp;מחכה לטפסים (בוט יטפל)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChangeStatus("missing_docs")}>
          <span className="text-orange-700">📄</span>&nbsp;חסרים מסמכים
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChangeStatus("in_process")}>
          <span className="text-cyan-700">⚙</span>&nbsp;בטיפול (עדן)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChangeStatus("closed_won")}>
          <span className="text-green-700">✓</span>&nbsp;סגור בהצלחה
        </DropdownMenuItem>
        <div className="h-px bg-muted my-1" />
        <DropdownMenuItem onClick={() => onChangeStatus("not_interested")}>
          <span className="text-gray-500">●</span>&nbsp;לא מעוניין
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChangeStatus("wrong_info")}>
          <span className="text-gray-500">●</span>&nbsp;השאיר פרטים בטעות
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenReminder}>
          <Bell className="w-3.5 h-3.5 ml-2 text-amber-600" />ליצור קשר בזמן אחר
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenNotRelevant}>
          <span className="text-gray-600 ml-2">✕</span>לא רלוונטי
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotRelevantReasonDialog({
  client,
  open,
  onClose,
  onConfirm,
}: {
  client: Client;
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState(client.notRelevantReason || "");
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>סימון "לא רלוונטי" — {client.fullName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Label>סיבה</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="למשל: אין הכנסות בשנים הרלוונטיות / כבר בטיפול אצל יועץ אחר / מספר לא תקין..."
            autoFocus
          />
          <div className="flex justify-start gap-2">
            <Button onClick={() => { onConfirm(reason.trim()); onClose(); }}>
              סמן כלא רלוונטי
            </Button>
            <Button variant="outline" onClick={onClose}>ביטול</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function contactStatusColor(status: string | null): string {
  if (!status) return "";
  if (status === "new") return "bg-blue-50 dark:bg-blue-950/20";
  if (status.startsWith("no_answer")) return "bg-red-50 dark:bg-red-950/20";
  if (["talked", "sent_documents", "in_process"].includes(status)) return "bg-amber-50 dark:bg-amber-950/20";
  if (status === "closed") return "bg-green-50 dark:bg-green-950/20";
  return "";
}

function PhoneLink({ phone }: { phone: string }) {
  return (
    <a
      href={`tel:${phone}`}
      onClick={(e) => e.stopPropagation()}
      className="flex items-center gap-1 text-primary font-medium hover:underline text-sm"
      dir="ltr"
      data-testid={`link-phone-${phone}`}
    >
      <Phone className="w-3 h-3 flex-shrink-0" />
      {phone}
    </a>
  );
}

interface LeadCriteria {
  jobChanged: boolean;
  hasChildren: boolean;
  employee: boolean;
  selfEmployed: boolean;
}

function parseCriteria(raw: string | null | undefined): LeadCriteria {
  try { return raw ? JSON.parse(raw) : {}; } catch { return {} as LeadCriteria; }
}

function CriteriaChecklist({ client }: { client: Client }) {
  const { toast } = useToast();
  const criteria = parseCriteria((client as any).leadCriteria);

  const items: { key: keyof LeadCriteria; label: string }[] = [
    { key: "jobChanged",  label: "החליף עבודה" },
    { key: "hasChildren", label: "נולדו ילדים" },
    { key: "employee",    label: "שכיר" },
    { key: "selfEmployed",label: "עצמאי" },
  ];

  const updateMutation = useMutation({
    mutationFn: (newCriteria: LeadCriteria) =>
      apiRequest("PATCH", `/api/clients/${client.id}`, { leadCriteria: JSON.stringify(newCriteria) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/clients"] }),
    onError: () => toast({ title: "שגיאה בשמירה", variant: "destructive" }),
  });

  function toggle(key: keyof LeadCriteria) {
    const updated = { ...criteria, [key]: !criteria[key] };
    updateMutation.mutate(updated);
  }

  return (
    <div className="flex flex-wrap gap-3 py-1">
      {items.map(({ key, label }) => (
        <label
          key={key}
          className="flex items-center gap-1.5 cursor-pointer select-none text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={!!criteria[key]}
            onCheckedChange={() => toggle(key)}
            data-testid={`checkbox-${key}-${client.id}`}
          />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

function AddReminderModal({
  client,
  open,
  onClose,
}: {
  client: Client;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [reminderAt, setReminderAt] = useState("");

  const createMutation = useMutation({
    mutationFn: () => {
      // <input type="datetime-local"> returns "2026-06-10T00:12" with no
      // timezone. Convert to UTC ISO so the server stores the actual moment
      // the user picked (in their local timezone).
      const localUtc = new Date(reminderAt).toISOString();
      return apiRequest("POST", `/api/clients/${client.id}/reminders`, { content, reminderAt: localUtc });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", client.id, "reminders"] });
      toast({ title: "תזכורת נוצרה" });
      setContent(""); setReminderAt("");
      onClose();
    },
    onError: () => toast({ title: "שגיאה", variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content || !reminderAt) return;
    createMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            תזכורת — {client.fullName}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>תוכן התזכורת</Label>
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="לדוגמה: להתקשר ולבדוק מצב טפסים..."
              rows={3}
              required
              data-testid="input-reminder-content"
            />
          </div>
          <div className="space-y-2">
            <Label>תאריך ושעה</Label>
            <Input
              type="datetime-local"
              value={reminderAt}
              onChange={e => setReminderAt(e.target.value)}
              required
              data-testid="input-reminder-datetime"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={createMutation.isPending} className="flex-1">
              {createMutation.isPending ? "שומר..." : "צור תזכורת"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface Partner { id: string; fullName: string; email: string }

function ShareWithPartnerDialog({
  client, open, onClose,
}: { client: Client; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [partnerId, setPartnerId] = useState("");
  const [notes, setNotes] = useState("");

  const { data: partners = [] } = useQuery<Partner[]>({
    queryKey: ["/api/partners"],
    enabled: open,
  });

  const shareMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/partner-leads/share", {
        partnerId,
        clientId: client.id,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner-leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partner-activities"] });
      toast({ title: "הלקוח הועבר לשותף" });
      setPartnerId(""); setNotes("");
      onClose();
    },
    onError: (err: Error) => toast({ title: "שגיאה", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Handshake className="w-4 h-4" />
            העבר לשותף — {client.fullName}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); if (partnerId) shareMutation.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>בחר שותף *</Label>
            <Select value={partnerId} onValueChange={setPartnerId}>
              <SelectTrigger data-testid="select-partner"><SelectValue placeholder={partners.length === 0 ? "אין שותפים זמינים" : "בחר שותף"} /></SelectTrigger>
              <SelectContent>
                {partners.map(p => <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>הערה לשותף (אופציונלי)</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="למשל: לקוח מתעניין בביטוח חיים, להתקשר השבוע"
              rows={3}
              data-testid="input-share-notes"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={!partnerId || shareMutation.isPending} className="flex-1" data-testid="button-confirm-share">
              {shareMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
              העבר
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReminderIndicator({ reminder }: { reminder: Reminder | undefined }) {
  if (!reminder) return null;
  const isPast = new Date(reminder.reminderAt) <= new Date();
  return (
    <div className={`flex items-center gap-1 text-xs ${isPast ? "text-red-600" : "text-amber-600"}`}>
      <Bell className="w-3 h-3" />
      <span className="whitespace-nowrap">
        {format(new Date(reminder.reminderAt), "dd/MM HH:mm", { locale: he })}
      </span>
    </div>
  );
}

// ── Year Note Cell ────────────────────────────────────────────────
function YearNoteCell({ clientId, year, notes }: { clientId: string; year: number; notes: Record<string, string> }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(notes[String(year)] ?? "");
  const [justSaved, setJustSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // sync when external data changes
  useMemo(() => { if (!editing) setLocal(notes[String(year)] ?? ""); }, [notes, year, editing]);

  const mutation = useMutation({
    mutationFn: async (value: string) => {
      const updated = { ...notes };
      if (value === "") delete updated[String(year)];
      else updated[String(year)] = value;
      await apiRequest("PATCH", `/api/clients/${clientId}`, { yearNotes: JSON.stringify(updated) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/clients"] });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1200);
    },
    onError: () => toast({ title: "שגיאה בשמירה", variant: "destructive" }),
  });

  function commit() {
    setEditing(false);
    const cleaned = local.trim();
    if (cleaned === (notes[String(year)] ?? "")) return;
    mutation.mutate(cleaned);
  }

  const displayValue = notes[String(year)] ?? "";
  const isBold = displayValue === "הוגש";

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={local}
          autoFocus
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === "Escape") { setLocal(notes[String(year)] ?? ""); setEditing(false); }
          }}
          className="bg-white border border-blue-300 px-1 py-0.5 text-xs w-full rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-right"
          style={{ minWidth: 72 }}
          dir="rtl"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`block w-full px-1 py-0.5 text-xs rounded hover:bg-muted/60 transition-colors min-h-[20px] text-right ${displayValue ? "" : "text-muted-foreground"} ${isBold ? "font-bold" : ""}`}
          style={{ minWidth: 72 }}
          dir="rtl"
        >
          {displayValue || "—"}
        </button>
      )}
      {mutation.isPending && <Loader2 className="w-3 h-3 animate-spin absolute -left-4 top-1/2 -translate-y-1/2 text-blue-600" />}
      {justSaved && !mutation.isPending && <Check className="w-3 h-3 absolute -left-4 top-1/2 -translate-y-1/2 text-green-600" />}
    </div>
  );
}

export default function Clients() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newClientSource, setNewClientSource] = useState("direct");
  const [reminderClient, setReminderClient] = useState<Client | null>(null);
  const [shareClient, setShareClient] = useState<Client | null>(null);
  const [notRelevantClient, setNotRelevantClient] = useState<Client | null>(null);
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set());
  const [yearOffset, setYearOffset] = useState(0); // 0 = current year as last column
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();
  // Tax years: up to last year (e.g., opened in 2026 → years 2020–2025)
  const visibleYears = Array.from({ length: 6 }, (_, i) => (currentYear - 1) - yearOffset - 5 + i);

  const { data: clients, isLoading } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: allReminders = [] } = useQuery<Reminder[]>({ queryKey: ["/api/reminders"], refetchInterval: 60000 });

  const remindersByClient = useMemo(() => {
    const map: Record<string, Reminder> = {};
    for (const r of allReminders) {
      if (!map[r.clientId] || new Date(r.reminderAt) < new Date(map[r.clientId].reminderAt)) {
        map[r.clientId] = r;
      }
    }
    return map;
  }, [allReminders]);

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      await apiRequest("POST", "/api/clients", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setDialogOpen(false);
      toast({ title: "הלקוח נוצר בהצלחה" });
    },
    onError: (err: Error) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "הלקוח נמחק" });
    },
  });

  // Generic contactStatus updater used by the action column dropdown
  const contactStatusMutation = useMutation({
    mutationFn: async ({ id, contactStatus, notRelevantReason }: { id: string; contactStatus: string; notRelevantReason?: string }) => {
      const payload: Record<string, any> = { contactStatus };
      if (notRelevantReason !== undefined) payload.notRelevantReason = notRelevantReason;
      await apiRequest("PATCH", `/api/clients/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
  });

  const filtered = useMemo(() => {
    // Hide clients that landed in "next year" (receipt date filled, or next_year status)
    // or in "not relevant" (3 contact statuses). Keeps the main list focused
    // on leads to actively work on.
    const HIDDEN_CONTACT_STATUSES = ["not_relevant", "not_interested", "wrong_info", "next_year"];
    return (clients || []).filter(c => {
      if (c.receiptDate) return false;
      if (c.contactStatus && HIDDEN_CONTACT_STATUSES.includes(c.contactStatus)) return false;
      const matchesSearch =
        c.fullName.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search);
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [clients, search, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aR = remindersByClient[a.id];
      const bR = remindersByClient[b.id];
      if (aR && !bR) return -1;
      if (!aR && bR) return 1;
      if (aR && bR) {
        return new Date(aR.reminderAt).getTime() - new Date(bR.reminderAt).getTime();
      }
      const aToday = isToday(new Date(a.createdAt ?? 0));
      const bToday = isToday(new Date(b.createdAt ?? 0));
      if (aToday && !bToday) return -1;
      if (!aToday && bToday) return 1;
      return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
    });
  }, [filtered, remindersByClient]);

  function toggleCriteria(id: string) {
    setExpandedCriteria(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    formData.forEach((val, key) => { if (val) data[key] = val.toString(); });
    createMutation.mutate(data);
  }

  const contactStatusBadge = (status: string | null) => {
    const label = contactStatusLabels[status || ""] || status;
    const colors: Record<string, string> = {
      new: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      talked: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      sent_documents: "bg-amber-100 text-amber-800",
      in_process: "bg-amber-100 text-amber-800",
      closed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      not_relevant: "bg-gray-100 text-gray-600",
    };
    const isNoAnswer = status?.startsWith("no_answer");
    const colorClass = isNoAnswer
      ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200"
      : (colors[status || ""] || "bg-gray-100 text-gray-600");
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${colorClass}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-auto h-full" dir="rtl">
      <PageHeader
        title="לקוחות"
        description={`${clients?.length || 0} לקוחות סה״כ`}
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-client" className="w-full sm:w-auto">
                <Plus className="w-4 h-4 ml-2" />הוסף לקוח
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle>לקוח חדש</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">שם מלא *</Label>
                  <Input id="fullName" name="fullName" required data-testid="input-client-name" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">טלפון</Label>
                    <Input id="phone" name="phone" data-testid="input-client-phone" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">אימייל</Label>
                    <Input id="email" name="email" type="email" data-testid="input-client-email" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientType">סוג לקוח</Label>
                    <Select name="clientType" defaultValue="private_individual">
                      <SelectTrigger data-testid="select-client-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private_individual">יחיד/שכיר</SelectItem>
                        <SelectItem value="self_employed">עצמאי</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source">מקור</Label>
                    <Select name="source" defaultValue="direct" value={newClientSource} onValueChange={setNewClientSource}>
                      <SelectTrigger data-testid="select-client-source"><SelectValue /></SelectTrigger>
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
                </div>
                {(newClientSource === "recommended" || newClientSource === "referral") && (
                  <div className="space-y-2">
                    <Label htmlFor="recommendedBy">שם הממליץ</Label>
                    <Input id="recommendedBy" name="recommendedBy" data-testid="input-client-recommended-by" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="notes">הערות</Label>
                  <Textarea id="notes" name="notes" rows={2} data-testid="input-client-notes" />
                </div>
                <div className="flex justify-start gap-2">
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-client">
                    {createMutation.isPending ? "יוצר..." : "צור לקוח"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש לקוחות..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
            data-testid="input-search-clients"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px]" data-testid="select-filter-status">
            <SelectValue placeholder="סינון לפי סטטוס" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            <SelectItem value="lead">ליד</SelectItem>
            <SelectItem value="active">פעיל</SelectItem>
            <SelectItem value="inactive">לא פעיל</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={search ? Search : Plus}
          title={search ? "לא נמצאו לקוחות תואמים" : "אין לקוחות עדיין"}
          description={search ? "נסה לשנות את מילות החיפוש" : "צור את הלקוח הראשון שלך כדי להתחיל"}
          action={!search ? (
            <Button onClick={() => setDialogOpen(true)} data-testid="button-empty-add-client">
              <Plus className="w-4 h-4 ml-2" />הוסף לקוח
            </Button>
          ) : undefined}
        />
      ) : (
        <>
          {/* ── Mobile cards ── */}
          <div className="md:hidden space-y-3">
            {sorted.map(client => {
              const rowColor = contactStatusColor(client.contactStatus);
              return (
                <Card
                  key={client.id}
                  className={`border ${rowColor}`}
                  data-testid={`card-client-${client.id}`}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm truncate" data-testid={`text-client-name-${client.id}`}>
                            {client.fullName}
                          </p>
                          {client.customStatus && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              {client.customStatus}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {client.taxId && <span className="text-xs text-muted-foreground font-mono" dir="ltr">{client.taxId}</span>}
                          {client.phone && <PhoneLink phone={client.phone} />}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" data-testid={`button-menu-client-${client.id}`}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLocation(`/clients/${client.id}`); }}>
                            <Eye className="w-4 h-4 ml-2" />כניסה לליד
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setShareClient(client); }}>
                            <Handshake className="w-4 h-4 ml-2" />העבר לשותף
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(client.id); }}
                          >
                            <Trash2 className="w-4 h-4 ml-2" />מחק
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {client.source && (
                      <div className="text-xs text-muted-foreground">
                        מקור: {sourceLabels[client.source] || client.source}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t text-xs">
                      {client.refundEstimateAmount && (
                        <div><span className="text-muted-foreground">צפי החזר:</span> {formatCurrency(parseFloat(client.refundEstimateAmount))}</div>
                      )}
                      {client.commissionAmount && (
                        <div><span className="text-muted-foreground">עמלה:</span> {formatCurrency(parseFloat(client.commissionAmount))}</div>
                      )}
                      {client.submissionDate && (
                        <div><span className="text-muted-foreground">הגשה:</span> {new Date(client.submissionDate).toLocaleDateString("he-IL")}</div>
                      )}
                      {client.receiptDate && (
                        <div className="text-green-700 font-medium"><span className="text-muted-foreground">תקבול:</span> {new Date(client.receiptDate).toLocaleDateString("he-IL")}</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* ── Desktop table ── */}
          <Card className="hidden md:block">
            <CardContent className="p-0 overflow-x-auto">
              {/* Year range navigation */}
              <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/30 justify-start" dir="rtl">
                <span className="text-xs text-muted-foreground">שנות מס:</span>
                <span className="text-xs font-medium">{visibleYears[0]}–{visibleYears[5]}</span>
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setYearOffset(y => y + 1)} title="שנים קודמות">
                  <ChevronRight className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setYearOffset(y => Math.max(0, y - 1))} title="שנים חדשות יותר" disabled={yearOffset === 0}>
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                {yearOffset > 0 && (
                  <Button size="sm" variant="ghost" className="h-5 text-xs px-1.5" onClick={() => setYearOffset(0)}>חזור להיום</Button>
                )}
              </div>
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right w-[110px] px-2">ת.ז.</TableHead>
                    <TableHead className="text-right w-[150px] px-2">שם</TableHead>
                    <TableHead className="text-right w-[120px] px-2">טלפון</TableHead>
                    <TableHead className="text-right w-[140px] px-2">סטטוס</TableHead>
                    <TableHead className="text-right w-[80px] px-2">מקור</TableHead>
                    <TableHead className="text-right w-[100px] px-2">צפי החזר</TableHead>
                    <TableHead className="text-right w-[100px] px-2">תאריך הגשה</TableHead>
                    <TableHead className="text-right w-[90px] px-2">עמלה</TableHead>
                    <TableHead className="text-right w-[100px] px-2">תאריך תקבול</TableHead>
                    <TableHead className="text-right w-[110px] px-2">פעולה</TableHead>
                    {visibleYears.map(y => (
                      <TableHead key={y} className="text-center w-[80px] px-1 text-xs font-semibold">{y}</TableHead>
                    ))}
                    <TableHead className="w-[70px] px-2"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map(client => {
                    const rowColor = contactStatusColor(client.contactStatus);
                    return (
                      <TableRow
                        key={client.id}
                        className={rowColor}
                        data-testid={`row-client-${client.id}`}
                      >
                        <TableCell className="px-2 align-middle">
                          <EditableCell
                            clientId={client.id}
                            field="taxId"
                            value={client.taxId}
                            type="text"
                            dir="ltr"
                            className="font-mono"
                            placeholder="ת.ז."
                          />
                        </TableCell>
                        <TableCell className="px-2 align-middle">
                          <EditableCell
                            clientId={client.id}
                            field="fullName"
                            value={client.fullName}
                            type="text"
                            placeholder="שם"
                          />
                        </TableCell>
                        <TableCell className="px-2 align-middle">
                          <EditableCell
                            clientId={client.id}
                            field="phone"
                            value={client.phone}
                            type="text"
                            dir="ltr"
                            placeholder="טלפון"
                          />
                        </TableCell>
                        <TableCell className="px-2 align-middle">
                          <EditableCell
                            clientId={client.id}
                            field="customStatus"
                            value={client.customStatus}
                            type="text"
                            placeholder="סטטוס"
                            bold={client.customStatus === "הוגש"}
                          />
                        </TableCell>
                        <TableCell className="px-2 align-middle">
                          <EditableCell
                            clientId={client.id}
                            field="source"
                            value={client.source}
                            type="select"
                            options={[
                              { value: "referral", label: "הפניה" },
                              { value: "website", label: "אתר" },
                              { value: "social_media", label: "סושיאל" },
                              { value: "direct", label: "ישיר" },
                              { value: "recommended", label: "מומלצים" },
                              { value: "other", label: "אחר" },
                            ]}
                          />
                          {(client.source === "recommended" || client.source === "referral") && (
                            <EditableCell
                              clientId={client.id}
                              field="recommendedBy"
                              value={client.recommendedBy}
                              type="text"
                              placeholder="שם הממליץ"
                              minWidth={90}
                            />
                          )}
                        </TableCell>
                        <TableCell className="px-2 align-middle">
                          <EditableCell
                            clientId={client.id}
                            field="refundEstimateAmount"
                            value={client.refundEstimateAmount}
                            type="number"
                            format={(v) => formatCurrency(parseFloat(v))}
                            placeholder="צפי החזר"
                          />
                        </TableCell>
                        <TableCell className="px-2 align-middle">
                          <EditableCell
                            clientId={client.id}
                            field="submissionDate"
                            value={client.submissionDate}
                            type="date"
                            format={(v) => new Date(v).toLocaleDateString("he-IL")}
                            placeholder="תאריך"
                          />
                        </TableCell>
                        <TableCell className="px-2 align-middle">
                          <EditableCell
                            clientId={client.id}
                            field="commissionAmount"
                            value={client.commissionAmount}
                            type="number"
                            format={(v) => formatCurrency(parseFloat(v))}
                            placeholder="עמלה"
                          />
                        </TableCell>
                        <TableCell className="px-2 align-middle">
                          <EditableCell
                            clientId={client.id}
                            field="receiptDate"
                            value={client.receiptDate}
                            type="date"
                            format={(v) => new Date(v).toLocaleDateString("he-IL")}
                            placeholder="תאריך"
                            className={client.receiptDate ? "text-green-700 font-medium" : ""}
                          />
                        </TableCell>
                        <TableCell className="px-2 align-middle" onClick={(e) => e.stopPropagation()}>
                          <ActionStatusButton
                            client={client}
                            onChangeStatus={(s) => contactStatusMutation.mutate({ id: client.id, contactStatus: s })}
                            onOpenReminder={() => setReminderClient(client)}
                            onOpenNotRelevant={() => setNotRelevantClient(client)}
                          />
                        </TableCell>
                        {(() => {
                          let parsedNotes: Record<string, string> = {};
                          try { parsedNotes = client.yearNotes ? JSON.parse(client.yearNotes) : {}; } catch {}
                          const clientYear = client.createdAt ? new Date(client.createdAt).getFullYear() : currentYear;
                          return visibleYears.map(y => (
                            <TableCell key={y} className="px-1 align-middle">
                              {y < clientYear ? (
                                <YearNoteCell clientId={client.id} year={y} notes={parsedNotes} />
                              ) : (
                                <span className="text-muted-foreground/30 text-xs block text-center">—</span>
                              )}
                            </TableCell>
                          ));
                        })()}
                        <TableCell className="px-2 align-middle" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-6 w-6" data-testid={`button-menu-client-${client.id}`}>
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem onClick={() => setLocation(`/clients/${client.id}`)}>
                                <Eye className="w-4 h-4 ml-2" />כניסה לליד
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setShareClient(client)}>
                                <Handshake className="w-4 h-4 ml-2" />העבר לשותף
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteMutation.mutate(client.id)}
                              >
                                <Trash2 className="w-4 h-4 ml-2" />מחק
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {notRelevantClient && (
        <NotRelevantReasonDialog
          client={notRelevantClient}
          open={!!notRelevantClient}
          onClose={() => setNotRelevantClient(null)}
          onConfirm={(reason) => {
            contactStatusMutation.mutate({
              id: notRelevantClient.id,
              contactStatus: "not_relevant",
              notRelevantReason: reason,
            });
          }}
        />
      )}

      {reminderClient && (
        <AddReminderModal
          client={reminderClient}
          open={!!reminderClient}
          onClose={() => setReminderClient(null)}
        />
      )}

      {shareClient && (
        <ShareWithPartnerDialog
          client={shareClient}
          open={!!shareClient}
          onClose={() => setShareClient(null)}
        />
      )}
    </div>
  );
}
