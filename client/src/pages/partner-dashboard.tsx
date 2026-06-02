import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, LogOut, Plus, Phone, Mail, Clock, User as UserIcon,
  Search, Inbox, Activity, CheckCircle2, Lightbulb, Send, UserPlus, MessageCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DocumentsSection } from "@/components/DocumentsSection";

type Status = "new" | "contacted" | "interested" | "not_interested" | "in_progress" | "closed_won" | "closed_lost";

const STATUS_LABELS: Record<Status, string> = {
  new: "חדש",
  contacted: "יצרתי קשר",
  interested: "מתעניין",
  not_interested: "לא רלוונטי",
  in_progress: "בטיפול",
  closed_won: "נסגר ✓",
  closed_lost: "לא נסגר",
};

const STATUS_COLORS: Record<Status, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-yellow-100 text-yellow-800",
  interested: "bg-purple-100 text-purple-800",
  not_interested: "bg-gray-100 text-gray-700",
  in_progress: "bg-orange-100 text-orange-800",
  closed_won: "bg-green-100 text-green-800",
  closed_lost: "bg-red-100 text-red-800",
};

type Filter = "all" | "new" | "in_progress" | "closed";

interface PartnerLead {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  status: Status;
  notes?: string;
  source: "owner_shared" | "partner_added";
  createdAt: string;
  updatedAt: string;
}

interface Activity {
  id: string;
  actorName: string;
  actorRole: string;
  action: string;
  details?: string;
  createdAt: string;
}

export default function PartnerDashboard() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const { data: leads = [], isLoading } = useQuery<PartnerLead[]>({
    queryKey: ["/api/partner/leads"],
  });

  const updateLead = useMutation({
    mutationFn: async ({ id, update }: { id: string; update: Partial<PartnerLead> }) => {
      const res = await apiRequest("PATCH", `/api/partner/leads/${id}`, update);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner/leads"] });
      if (selectedLeadId) queryClient.invalidateQueries({ queryKey: [`/api/partner/leads/${selectedLeadId}/activities`] });
      toast({ description: "עודכן" });
    },
  });

  const addLead = useMutation({
    mutationFn: async (lead: { fullName: string; phone?: string; email?: string; notes?: string }) => {
      const res = await apiRequest("POST", "/api/partner/leads", lead);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner/leads"] });
      setAddOpen(false);
      toast({ description: "ליד נוסף" });
    },
  });

  const stats = useMemo(() => {
    const newCount = leads.filter(l => l.status === "new").length;
    const inProgress = leads.filter(l => ["contacted", "interested", "in_progress"].includes(l.status)).length;
    const closedWon = leads.filter(l => l.status === "closed_won").length;
    const stale = leads.filter(l => {
      if (l.status !== "new") return false;
      const ageMs = Date.now() - new Date(l.createdAt).getTime();
      return ageMs > 24 * 60 * 60 * 1000;
    }).length;
    return { total: leads.length, new: newCount, inProgress, closedWon, stale };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    let list = leads;
    if (filter === "new") list = list.filter(l => l.status === "new");
    else if (filter === "in_progress") list = list.filter(l => ["contacted", "interested", "in_progress"].includes(l.status));
    else if (filter === "closed") list = list.filter(l => ["closed_won", "closed_lost", "not_interested"].includes(l.status));

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(l =>
        l.fullName.toLowerCase().includes(q) ||
        (l.phone ?? "").toLowerCase().includes(q) ||
        (l.email ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [leads, filter, search]);

  const selectedLead = leads.find(l => l.id === selectedLeadId);
  const firstName = user?.fullName?.split(" ")[0] ?? "";

  return (
    <div className="min-h-screen bg-muted/30" dir="rtl">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">דשבורד שותפים</h1>
            <p className="text-xs text-muted-foreground">{user?.fullName}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => logout.mutate()}>
            <LogOut className="w-4 h-4 ml-2" />
            התנתק
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Welcome banner */}
        <div className="bg-gradient-to-l from-primary/10 to-transparent border-r-4 border-primary rounded-lg p-4">
          <h2 className="font-semibold">שלום{firstName ? ` ${firstName}` : ""} 👋</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {stats.stale > 0
              ? `יש ${stats.stale} לידים שלא טופלו מעל 24 שעות — כדאי ליצור קשר היום`
              : stats.new > 0
              ? `יש ${stats.new} לידים חדשים שמחכים לטיפול`
              : "אין מה לטפל כרגע — עבודה טובה!"}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={<Inbox className="w-4 h-4" />} label="סה״כ לידים" value={stats.total} color="text-foreground" />
          <StatCard icon={<UserPlus className="w-4 h-4" />} label="חדשים" value={stats.new} color="text-blue-600" />
          <StatCard icon={<Activity className="w-4 h-4" />} label="בטיפול" value={stats.inProgress} color="text-orange-600" />
          <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="נסגרו" value={stats.closedWon} color="text-green-600" />
        </div>

        {/* Filter + Search + Add */}
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="flex-1">
            <TabsList className="w-full md:w-auto">
              <TabsTrigger value="all">הכל ({stats.total})</TabsTrigger>
              <TabsTrigger value="new">חדשים ({stats.new})</TabsTrigger>
              <TabsTrigger value="in_progress">בטיפול ({stats.inProgress})</TabsTrigger>
              <TabsTrigger value="closed">סגורים</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="חפש לפי שם, טלפון או אימייל..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pr-8"
                data-testid="input-search"
              />
            </div>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-lead">
                  <Plus className="w-4 h-4 ml-2" />
                  הוסף ליד
                </Button>
              </DialogTrigger>
              <AddLeadDialog onAdd={(data) => addLead.mutate(data)} isPending={addLead.isPending} />
            </Dialog>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : leads.length === 0 ? (
          <HowItWorksCard onAddClick={() => setAddOpen(true)} />
        ) : filteredLeads.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-muted-foreground">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>אין תוצאות שתואמות את הסינון</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filteredLeads.map(lead => (
              <Card key={lead.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedLeadId(lead.id)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-semibold">{lead.fullName}</h3>
                        <Badge variant="outline" className={STATUS_COLORS[lead.status]}>
                          {STATUS_LABELS[lead.status]}
                        </Badge>
                        {lead.source === "partner_added" && (
                          <Badge variant="outline" className="text-xs">נוסף על ידך</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        {lead.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>}
                        {lead.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>}
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(lead.createdAt).toLocaleDateString("he-IL")}</span>
                      </div>
                      {lead.notes && (
                        <p className="text-sm mt-2 text-muted-foreground line-clamp-2">{lead.notes}</p>
                      )}
                    </div>
                    {lead.phone && (
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button asChild size="icon" variant="outline" className="h-8 w-8" title="התקשר">
                          <a href={`tel:${lead.phone}`}><Phone className="w-3.5 h-3.5" /></a>
                        </Button>
                        <Button asChild size="icon" variant="outline" className="h-8 w-8" title="WhatsApp">
                          <a href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {selectedLead && (
        <LeadDetailDialog
          lead={selectedLead}
          open={!!selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
          onUpdate={(update) => updateLead.mutate({ id: selectedLead.id, update })}
          isPending={updateLead.isPending}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          {icon}
          <span>{label}</span>
        </div>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function HowItWorksCard({ onAddClick }: { onAddClick: () => void }) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-8 text-center max-w-lg mx-auto">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
          <Lightbulb className="w-7 h-7 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-1">ברוך הבא לדשבורד שלך</h3>
        <p className="text-sm text-muted-foreground mb-6">איך זה עובד:</p>

        <div className="space-y-3 text-right mb-6">
          <Step num={1} title="קבלת לידים" desc="לידים שיועברו אליך יופיעו כאן אוטומטית" />
          <Step num={2} title="ניהול קשר" desc="לחץ על ליד כדי לעדכן סטטוס ולהוסיף הערות — כל פעולה נשמרת" />
          <Step num={3} title="הוסף לידים משלך" desc="לחץ על 'הוסף ליד' כדי לרשום לקוחות שאתה הבאת" />
        </div>

        <Button onClick={onAddClick}>
          <Plus className="w-4 h-4 ml-2" />
          הוסף ליד ראשון
        </Button>
      </CardContent>
    </Card>
  );
}

function Step({ num, title, desc }: { num: number; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center">
        {num}
      </div>
      <div className="flex-1">
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}

function AddLeadDialog({ onAdd, isPending }: { onAdd: (data: any) => void; isPending: boolean }) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    onAdd({ fullName: fullName.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined, notes: notes.trim() || undefined });
    setFullName(""); setPhone(""); setEmail(""); setNotes("");
  };

  return (
    <DialogContent dir="rtl">
      <DialogHeader>
        <DialogTitle>הוספת ליד חדש</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label>שם מלא *</Label>
          <Input value={fullName} onChange={e => setFullName(e.target.value)} required data-testid="input-fullname" />
        </div>
        <div className="space-y-1.5">
          <Label>טלפון</Label>
          <Input value={phone} onChange={e => setPhone(e.target.value)} dir="ltr" data-testid="input-phone" />
        </div>
        <div className="space-y-1.5">
          <Label>אימייל</Label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} dir="ltr" data-testid="input-email" />
        </div>
        <div className="space-y-1.5">
          <Label>הערות</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} data-testid="input-notes" />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={isPending || !fullName.trim()}>
            {isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
            הוסף
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function LeadDetailDialog({
  lead, open, onClose, onUpdate, isPending,
}: {
  lead: PartnerLead;
  open: boolean;
  onClose: () => void;
  onUpdate: (update: Partial<PartnerLead>) => void;
  isPending: boolean;
}) {
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [status, setStatus] = useState<Status>(lead.status);

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: [`/api/partner/leads/${lead.id}/activities`],
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead.fullName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {lead.phone && (
              <Button asChild size="sm" variant="outline">
                <a href={`tel:${lead.phone}`}><Phone className="w-3.5 h-3.5 ml-1.5" />התקשר</a>
              </Button>
            )}
            {lead.phone && (
              <Button asChild size="sm" variant="outline">
                <a href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-3.5 h-3.5 ml-1.5" />WhatsApp
                </a>
              </Button>
            )}
            {lead.email && (
              <Button asChild size="sm" variant="outline">
                <a href={`mailto:${lead.email}`}><Mail className="w-3.5 h-3.5 ml-1.5" />אימייל</a>
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {lead.phone && <div><span className="text-muted-foreground">טלפון:</span> <span dir="ltr">{lead.phone}</span></div>}
            {lead.email && <div><span className="text-muted-foreground">אימייל:</span> <span dir="ltr">{lead.email}</span></div>}
          </div>

          <div className="space-y-1.5">
            <Label>סטטוס</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABELS) as Status[]).map(s => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>הערות</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} />
          </div>

          {lead.clientId && (
            <DocumentsSection
              clientId={lead.clientId}
              readOnly
              listEndpoint={`/api/partner/leads/${lead.id}/documents`}
              downloadEndpointPrefix="/api/partner/documents"
            />
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>סגור</Button>
            <Button
              onClick={() => {
                const update: any = {};
                if (status !== lead.status) update.status = status;
                if (notes !== (lead.notes ?? "")) update.notes = notes;
                if (Object.keys(update).length > 0) onUpdate(update);
                else onClose();
              }}
              disabled={isPending}
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
              שמור
            </Button>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold text-sm mb-2">היסטוריית פעולות</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activities.length === 0 ? (
                <p className="text-xs text-muted-foreground">אין פעולות עדיין</p>
              ) : activities.map(a => (
                <div key={a.id} className="text-xs border-r-2 border-primary/30 pr-2 py-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{a.actorName} <span className="text-muted-foreground">({a.actorRole === "owner" ? "בעלים" : "שותף"})</span></span>
                    <span className="text-muted-foreground">{new Date(a.createdAt).toLocaleString("he-IL")}</span>
                  </div>
                  {a.details && <p className="text-muted-foreground mt-0.5">{a.details}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
