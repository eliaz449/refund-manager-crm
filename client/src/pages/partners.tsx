import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, UserPlus, Send, Clock, Activity as ActivityIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABELS: Record<string, string> = {
  new: "חדש",
  contacted: "יצרתי קשר",
  interested: "מתעניין",
  not_interested: "לא רלוונטי",
  in_progress: "בטיפול",
  closed_won: "נסגר ✓",
  closed_lost: "לא נסגר",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-yellow-100 text-yellow-800",
  interested: "bg-purple-100 text-purple-800",
  not_interested: "bg-gray-100 text-gray-700",
  in_progress: "bg-orange-100 text-orange-800",
  closed_won: "bg-green-100 text-green-800",
  closed_lost: "bg-red-100 text-red-800",
};

interface Partner { id: string; fullName: string; email: string; createdAt: string }
interface PartnerLead {
  id: string; partnerId: string; clientId?: string;
  fullName: string; phone?: string; email?: string;
  status: string; notes?: string; source: string;
  createdAt: string; updatedAt: string;
}
interface Activity {
  id: string; partnerLeadId: string;
  actorName: string; actorRole: string;
  action: string; details?: string;
  createdAt: string;
}
interface Client { id: string; fullName: string; phone?: string; email?: string; status: string }

export default function PartnersPage() {
  const { toast } = useToast();
  const [shareOpen, setShareOpen] = useState(false);

  const { data: partners = [] } = useQuery<Partner[]>({ queryKey: ["/api/partners"] });
  const { data: leads = [] } = useQuery<PartnerLead[]>({ queryKey: ["/api/partner-leads"] });
  const { data: activities = [] } = useQuery<Activity[]>({ queryKey: ["/api/partner-activities"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const share = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("POST", "/api/partner-leads/share", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner-leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partner-activities"] });
      setShareOpen(false);
      toast({ description: "הליד הועבר לשותף" });
    },
  });

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">שותפים</h1>
          <p className="text-sm text-muted-foreground">ניהול לידים משותפים ופעילות השותפים</p>
        </div>
        <Dialog open={shareOpen} onOpenChange={setShareOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-share-lead">
              <Send className="w-4 h-4 ml-2" />
              שתף ליד עם שותף
            </Button>
          </DialogTrigger>
          <ShareLeadDialog
            partners={partners}
            clients={clients}
            onShare={(body) => share.mutate(body)}
            isPending={share.isPending}
          />
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">שותפים פעילים</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{partners.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">לידים משותפים</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{leads.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">נסגרו בהצלחה</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{leads.filter(l => l.status === "closed_won").length}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="leads">
        <TabsList>
          <TabsTrigger value="leads">כל הלידים</TabsTrigger>
          <TabsTrigger value="activity">פעילות אחרונה</TabsTrigger>
          <TabsTrigger value="partners">שותפים</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-2">
          {leads.length === 0 ? (
            <Card><CardContent className="text-center py-12 text-muted-foreground">אין לידים משותפים</CardContent></Card>
          ) : leads.map(lead => {
            const partner = partners.find(p => p.id === lead.partnerId);
            return (
              <Card key={lead.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold">{lead.fullName}</h3>
                        <Badge variant="outline" className={STATUS_COLORS[lead.status]}>{STATUS_LABELS[lead.status]}</Badge>
                        <Badge variant="outline" className="text-xs">
                          {lead.source === "owner_shared" ? "שותפת" : "השותף הוסיף"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-0.5">
                        {partner && <div>👤 {partner.fullName}</div>}
                        {lead.phone && <div dir="ltr" className="text-right">📞 {lead.phone}</div>}
                        {lead.email && <div dir="ltr" className="text-right">✉ {lead.email}</div>}
                        {lead.notes && <div className="text-xs mt-1">{lead.notes}</div>}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(lead.updatedAt).toLocaleString("he-IL")}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="activity" className="space-y-2">
          {activities.length === 0 ? (
            <Card><CardContent className="text-center py-12 text-muted-foreground">אין פעילות</CardContent></Card>
          ) : activities.map(a => {
            const lead = leads.find(l => l.id === a.partnerLeadId);
            return (
              <Card key={a.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 text-sm">
                      <div className="font-medium">
                        {a.actorName}
                        <span className="text-xs text-muted-foreground mr-1">({a.actorRole === "owner" ? "בעלים" : "שותף"})</span>
                      </div>
                      {a.details && <div className="text-muted-foreground text-xs mt-0.5">{a.details}</div>}
                      {lead && <div className="text-xs text-primary mt-0.5">→ {lead.fullName}</div>}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      <Clock className="w-3 h-3 inline ml-1" />
                      {new Date(a.createdAt).toLocaleString("he-IL")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="partners" className="space-y-2">
          {partners.length === 0 ? (
            <Card><CardContent className="text-center py-12 text-muted-foreground">אין שותפים. כדי ליצור שותף — פנה למפתח.</CardContent></Card>
          ) : partners.map(p => {
            const partnerLeads = leads.filter(l => l.partnerId === p.id);
            return (
              <Card key={p.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{p.fullName}</h3>
                      <p className="text-sm text-muted-foreground" dir="ltr">{p.email}</p>
                    </div>
                    <div className="text-left">
                      <div className="text-2xl font-bold">{partnerLeads.length}</div>
                      <div className="text-xs text-muted-foreground">לידים</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ShareLeadDialog({
  partners, clients, onShare, isPending,
}: { partners: Partner[]; clients: Client[]; onShare: (body: any) => void; isPending: boolean }) {
  const [partnerId, setPartnerId] = useState("");
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [clientId, setClientId] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerId) return;
    const body: any = { partnerId, notes: notes.trim() || undefined };
    if (mode === "existing") {
      if (!clientId) return;
      body.clientId = clientId;
    } else {
      if (!fullName.trim()) return;
      body.fullName = fullName.trim();
      body.phone = phone.trim() || undefined;
      body.email = email.trim() || undefined;
    }
    onShare(body);
  };

  return (
    <DialogContent dir="rtl" className="max-w-md">
      <DialogHeader><DialogTitle>שתף ליד עם שותף</DialogTitle></DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label>שותף *</Label>
          <Select value={partnerId} onValueChange={setPartnerId}>
            <SelectTrigger><SelectValue placeholder="בחר שותף" /></SelectTrigger>
            <SelectContent>
              {partners.map(p => <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="existing" className="flex-1">לקוח קיים</TabsTrigger>
            <TabsTrigger value="new" className="flex-1">ליד חדש</TabsTrigger>
          </TabsList>
          <TabsContent value="existing" className="space-y-1.5 mt-2">
            <Label>בחר לקוח *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="חפש לקוח" /></SelectTrigger>
              <SelectContent>
                {clients.slice(0, 50).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.fullName}{c.phone ? ` — ${c.phone}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TabsContent>
          <TabsContent value="new" className="space-y-2 mt-2">
            <div className="space-y-1.5"><Label>שם מלא *</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>טלפון</Label><Input value={phone} onChange={e => setPhone(e.target.value)} dir="ltr" /></div>
            <div className="space-y-1.5"><Label>אימייל</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} dir="ltr" /></div>
          </TabsContent>
        </Tabs>

        <div className="space-y-1.5"><Label>הערות לשותף</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} /></div>

        <DialogFooter>
          <Button type="submit" disabled={isPending || !partnerId || (mode === "existing" ? !clientId : !fullName.trim())}>
            {isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
            שתף
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
