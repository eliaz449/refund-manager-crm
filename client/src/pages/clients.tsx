import { useState, useMemo, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Plus, Search, Phone, Mail, MoreHorizontal, Eye, Trash2, Clock,
  Bell, BellOff, ChevronDown, ChevronUp, Calendar, Handshake, Loader2
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
  talked: "דיברנו",
  sent_documents: "שלח מסמכים",
  in_process: "בתהליך",
  closed: "נסגר",
  not_relevant: "לא רלוונטי",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(value);
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
    mutationFn: () =>
      apiRequest("POST", `/api/clients/${client.id}/reminders`, { content, reminderAt }),
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

export default function Clients() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newClientSource, setNewClientSource] = useState("direct");
  const [reminderClient, setReminderClient] = useState<Client | null>(null);
  const [shareClient, setShareClient] = useState<Client | null>(null);
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set());
  const [, setLocation] = useLocation();
  const { toast } = useToast();

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

  const filtered = useMemo(() => {
    return (clients || []).filter(c => {
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
                  className={`cursor-pointer border ${rowColor}`}
                  onClick={() => setLocation(`/clients/${client.id}`)}
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
                            <Eye className="w-4 h-4 ml-2" />צפה
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
                    <TableHead className="w-[70px] px-2"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map(client => {
                    const rowColor = contactStatusColor(client.contactStatus);
                    return (
                      <TableRow
                        key={client.id}
                        className={`cursor-pointer ${rowColor}`}
                        onClick={() => setLocation(`/clients/${client.id}`)}
                        data-testid={`row-client-${client.id}`}
                      >
                        <TableCell className="px-2 font-mono text-xs" dir="ltr">
                          {client.taxId || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="px-2">
                          <p className="font-medium text-sm truncate" data-testid={`text-client-name-${client.id}`}>
                            {client.fullName}
                          </p>
                        </TableCell>
                        <TableCell className="px-2">
                          {client.phone
                            ? <PhoneLink phone={client.phone} />
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="px-2">
                          {client.customStatus
                            ? <span className="truncate block max-w-[140px]" title={client.customStatus}>{client.customStatus}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="px-2 text-muted-foreground">
                          {sourceLabels[client.source || ""] || client.source || "—"}
                        </TableCell>
                        <TableCell className="px-2 whitespace-nowrap">
                          {client.refundEstimateAmount
                            ? formatCurrency(parseFloat(client.refundEstimateAmount))
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="px-2 whitespace-nowrap">
                          {client.submissionDate
                            ? new Date(client.submissionDate).toLocaleDateString("he-IL")
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="px-2 whitespace-nowrap">
                          {client.commissionAmount
                            ? formatCurrency(parseFloat(client.commissionAmount))
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="px-2 whitespace-nowrap">
                          {client.receiptDate
                            ? <span className="text-green-700 font-medium">{new Date(client.receiptDate).toLocaleDateString("he-IL")}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="px-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-0.5">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => setShareClient(client)}
                              title="העבר לשותף"
                              data-testid={`button-share-partner-${client.id}`}
                            >
                              <Handshake className="w-3 h-3" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-6 w-6" data-testid={`button-menu-client-${client.id}`}>
                                  <MoreHorizontal className="w-3.5 h-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem onClick={() => setLocation(`/clients/${client.id}`)}>
                                  <Eye className="w-4 h-4 ml-2" />צפה
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
                          </div>
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
