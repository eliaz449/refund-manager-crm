import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Plus, Search, Eye, MoreHorizontal, CheckCircle2, Circle,
  ChevronDown, CalendarDays, Briefcase, UserRound
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { EditableCell } from "@/components/EditableCell";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Client } from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────
interface SelfEmployedYear {
  year: number;
  status: "open" | "in_progress" | "submitted" | "paid";
  amount: string;
  notes: string;
}

function parseYears(raw: string | null | undefined): SelfEmployedYear[] {
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}

const YEAR_STATUS_LABELS: Record<string, string> = {
  open: "טרם הוגש",
  in_progress: "בטיפול",
  submitted: "הוגש",
  paid: "שולם",
};

const YEAR_STATUS_COLORS: Record<string, string> = {
  open: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  submitted: "bg-purple-100 text-purple-700",
  paid: "bg-green-100 text-green-700",
};

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  exempt: "עוסק פטור",
  authorized: "עוסק מורשה",
  company: "חברה בע\"מ",
};

const VAT_FREQ_LABELS: Record<string, string> = {
  monthly: "חודשי",
  bimonthly: "דו-חודשי",
};

function formatCurrency(v: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(v);
}

// ─── Years Manager Dialog ─────────────────────────────────────────
function YearsManagerDialog({
  client,
  open,
  onClose,
}: { client: Client; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [years, setYears] = useState<SelfEmployedYear[]>(() => parseYears((client as any).selfEmployedYears));

  const saveMutation = useMutation({
    mutationFn: async (updated: SelfEmployedYear[]) => {
      await apiRequest("PATCH", `/api/clients/${client.id}`, {
        selfEmployedYears: JSON.stringify(updated),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "שנות המס נשמרו" });
      onClose();
    },
    onError: () => toast({ title: "שגיאה בשמירה", variant: "destructive" }),
  });

  function addYear() {
    const existingYears = years.map(y => y.year);
    const currentYear = new Date().getFullYear();
    let next = currentYear - 1;
    while (existingYears.includes(next) && next > currentYear - 10) next--;
    setYears(prev => [...prev, { year: next, status: "open", amount: "", notes: "" }].sort((a, b) => b.year - a.year));
  }

  function removeYear(idx: number) {
    setYears(prev => prev.filter((_, i) => i !== idx));
  }

  function updateYear(idx: number, field: keyof SelfEmployedYear, value: string | number) {
    setYears(prev => prev.map((y, i) => i === idx ? { ...y, [field]: value } : y));
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4" />
            דוחות שנתיים — {client.fullName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {years.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">אין שנות מס. לחץ "הוסף שנה" כדי להתחיל.</p>
          )}

          {years.map((y, idx) => (
            <div key={idx} className="border rounded-lg p-3 space-y-2 bg-muted/20">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Year */}
                <div className="space-y-1 w-20">
                  <Label className="text-xs">שנת מס</Label>
                  <Input
                    type="number"
                    value={y.year}
                    onChange={e => updateYear(idx, "year", parseInt(e.target.value) || y.year)}
                    className="h-7 text-xs px-2"
                    dir="ltr"
                  />
                </div>

                {/* Status */}
                <div className="space-y-1 flex-1 min-w-[130px]">
                  <Label className="text-xs">סטטוס</Label>
                  <Select value={y.status} onValueChange={v => updateYear(idx, "status", v)}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">טרם הוגש</SelectItem>
                      <SelectItem value="in_progress">בטיפול</SelectItem>
                      <SelectItem value="submitted">הוגש</SelectItem>
                      <SelectItem value="paid">שולם</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount */}
                <div className="space-y-1 w-28">
                  <Label className="text-xs">סכום החזר / חוב</Label>
                  <Input
                    type="number"
                    value={y.amount}
                    onChange={e => updateYear(idx, "amount", e.target.value)}
                    placeholder="0"
                    className="h-7 text-xs px-2"
                    dir="ltr"
                  />
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive h-7 px-2 mt-4 flex-shrink-0"
                  onClick={() => removeYear(idx)}
                >
                  הסר
                </Button>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <Label className="text-xs">הערות</Label>
                <Input
                  value={y.notes}
                  onChange={e => updateYear(idx, "notes", e.target.value)}
                  placeholder="הערה חופשית..."
                  className="h-7 text-xs"
                />
              </div>
            </div>
          ))}

          <Button size="sm" variant="outline" onClick={addYear} className="w-full">
            + הוסף שנת מס
          </Button>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => saveMutation.mutate(years)}
              disabled={saveMutation.isPending}
              className="flex-1"
            >
              {saveMutation.isPending ? "שומר..." : "שמור"}
            </Button>
            <Button variant="outline" onClick={onClose}>ביטול</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Years Summary (inline in table row) ─────────────────────────
function YearsSummary({ client, onOpen }: { client: Client; onOpen: () => void }) {
  const years = parseYears((client as any).selfEmployedYears);

  if (years.length === 0) {
    return (
      <button
        onClick={onOpen}
        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
      >
        + הוסף שנות מס
      </button>
    );
  }

  return (
    <button onClick={onOpen} className="text-right hover:opacity-80 transition-opacity">
      <div className="flex flex-wrap gap-1">
        {years.map(y => (
          <span
            key={y.year}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${YEAR_STATUS_COLORS[y.status]}`}
            title={`${y.year}: ${YEAR_STATUS_LABELS[y.status]}${y.amount ? ` — ${formatCurrency(parseFloat(y.amount))}` : ""}${y.notes ? ` (${y.notes})` : ""}`}
          >
            {y.year}
            {y.status === "paid" && " ✓"}
            {y.status === "submitted" && " ⏳"}
            {y.status === "in_progress" && " 🔄"}
          </span>
        ))}
      </div>
    </button>
  );
}

// ─── NI Toggle ───────────────────────────────────────────────────
function NationalInsuranceToggle({ client }: { client: Client }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const ok = !!(client as any).nationalInsuranceOk;

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/clients/${client.id}`, { nationalInsuranceOk: !ok });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/clients"] }),
    onError: () => toast({ title: "שגיאה", variant: "destructive" }),
  });

  return (
    <button
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className={`flex items-center gap-1 text-xs font-medium transition-colors ${ok ? "text-green-700" : "text-gray-400 hover:text-gray-600"}`}
      title={ok ? "עדכני — לחץ לשינוי" : "לא עדכני — לחץ לסימון"}
    >
      {ok
        ? <CheckCircle2 className="w-4 h-4 text-green-600" />
        : <Circle className="w-4 h-4" />}
      {ok ? "עדכני" : "לא עדכני"}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function SelfEmployed() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [yearsClient, setYearsClient] = useState<Client | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: allClients, isLoading } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const moveToRegularMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/clients/${id}`, { clientType: "private_individual" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "הלקוח הועבר חזרה ללקוחות רגילים" });
    },
  });

  const clients = useMemo(() => {
    return (allClients || []).filter(c => {
      if (c.clientType !== "self_employed") return false;
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        c.fullName.toLowerCase().includes(s) ||
        (c.taxId || "").includes(s) ||
        (c.phone || "").includes(s) ||
        ((c as any).vatNumber || "").includes(s)
      );
    });
  }, [allClients, search]);

  // Stats
  const totalYears = useMemo(() => clients.reduce((sum, c) => sum + parseYears((c as any).selfEmployedYears).length, 0), [clients]);
  const openYears = useMemo(() => clients.reduce((sum, c) => sum + parseYears((c as any).selfEmployedYears).filter(y => y.status === "open" || y.status === "in_progress").length, 0), [clients]);

  return (
    <div className="p-4 sm:p-6 space-y-4 overflow-auto h-full" dir="rtl">
      <PageHeader
        title="עצמאים"
        description={`${clients.length} לקוחות עצמאיים`}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">סה״כ עצמאיים</div>
          <div className="text-2xl font-bold mt-1">{clients.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">שנות מס פתוחות</div>
          <div className="text-2xl font-bold mt-1 text-amber-600">{openYears}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">סה״כ שנות מס</div>
          <div className="text-2xl font-bold mt-1">{totalYears}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">ביטוח לאומי עדכני</div>
          <div className="text-2xl font-bold mt-1 text-green-600">
            {clients.filter(c => (c as any).nationalInsuranceOk).length}
          </div>
        </CardContent></Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="חיפוש לפי שם / ת.ז. / טלפון / ח.פ..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pr-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={search ? "לא נמצאו לקוחות עצמאיים" : "אין לקוחות עצמאיים עדיין"}
          description={search ? "נסה שינוי בחיפוש" : "לקוחות יופיעו כאן כשתסמן אותם כ\"עצמאי\" בפרטי הלקוח"}
        />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right w-[110px] px-2">ת.ז.</TableHead>
                  <TableHead className="text-right w-[150px] px-2">שם</TableHead>
                  <TableHead className="text-right w-[115px] px-2">טלפון</TableHead>
                  <TableHead className="text-right w-[100px] px-2">ח.פ. / ע.מ.</TableHead>
                  <TableHead className="text-right w-[110px] px-2">סוג עוסק</TableHead>
                  <TableHead className="text-right w-[90px] px-2">מע״מ תדירות</TableHead>
                  <TableHead className="text-right w-[100px] px-2">מע״מ — תאריך הבא</TableHead>
                  <TableHead className="text-right w-[100px] px-2">מקדמות חודשי</TableHead>
                  <TableHead className="text-right w-[100px] px-2">ביטוח לאומי</TableHead>
                  <TableHead className="text-right w-[220px] px-2">דוחות שנתיים</TableHead>
                  <TableHead className="text-right w-[140px] px-2">הערות</TableHead>
                  <TableHead className="w-[50px] px-2"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map(client => (
                  <TableRow key={client.id} className="align-top">
                    {/* ת.ז. */}
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

                    {/* שם */}
                    <TableCell className="px-2 align-middle">
                      <EditableCell
                        clientId={client.id}
                        field="fullName"
                        value={client.fullName}
                        type="text"
                        placeholder="שם"
                      />
                    </TableCell>

                    {/* טלפון */}
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

                    {/* ח.פ. / ע.מ. */}
                    <TableCell className="px-2 align-middle">
                      <EditableCell
                        clientId={(client as any).id}
                        field={"vatNumber" as any}
                        value={(client as any).vatNumber}
                        type="text"
                        dir="ltr"
                        placeholder="ח.פ."
                      />
                    </TableCell>

                    {/* סוג עוסק */}
                    <TableCell className="px-2 align-middle">
                      <EditableCell
                        clientId={client.id}
                        field={"selfEmployedBusinessType" as any}
                        value={(client as any).selfEmployedBusinessType}
                        type="select"
                        options={[
                          { value: "exempt", label: "עוסק פטור" },
                          { value: "authorized", label: "עוסק מורשה" },
                          { value: "company", label: 'חברה בע"מ' },
                        ]}
                      />
                    </TableCell>

                    {/* מע"מ תדירות */}
                    <TableCell className="px-2 align-middle">
                      <EditableCell
                        clientId={client.id}
                        field={"vatFrequency" as any}
                        value={(client as any).vatFrequency}
                        type="select"
                        options={[
                          { value: "monthly", label: "חודשי" },
                          { value: "bimonthly", label: "דו-חודשי" },
                        ]}
                      />
                    </TableCell>

                    {/* מע"מ — תאריך הבא */}
                    <TableCell className="px-2 align-middle">
                      <EditableCell
                        clientId={client.id}
                        field={"vatNextDate" as any}
                        value={(client as any).vatNextDate}
                        type="date"
                        format={v => new Date(v).toLocaleDateString("he-IL")}
                        placeholder="תאריך"
                      />
                    </TableCell>

                    {/* מקדמות חודשי */}
                    <TableCell className="px-2 align-middle">
                      <EditableCell
                        clientId={client.id}
                        field={"advancePaymentMonthly" as any}
                        value={(client as any).advancePaymentMonthly}
                        type="number"
                        format={v => formatCurrency(parseFloat(v))}
                        placeholder="סכום"
                        dir="ltr"
                      />
                    </TableCell>

                    {/* ביטוח לאומי */}
                    <TableCell className="px-2 align-middle">
                      <NationalInsuranceToggle client={client} />
                    </TableCell>

                    {/* דוחות שנתיים */}
                    <TableCell className="px-2 align-middle">
                      <YearsSummary client={client} onOpen={() => setYearsClient(client)} />
                    </TableCell>

                    {/* הערות */}
                    <TableCell className="px-2 align-middle">
                      <EditableCell
                        clientId={client.id}
                        field="notes"
                        value={client.notes}
                        type="text"
                        placeholder="הערות"
                        minWidth={120}
                      />
                    </TableCell>

                    {/* Menu */}
                    <TableCell className="px-2 align-middle" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-6 w-6">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={() => setLocation(`/clients/${client.id}`)}>
                            <Eye className="w-4 h-4 ml-2" />כניסה לתיק
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setYearsClient(client)}>
                            <CalendarDays className="w-4 h-4 ml-2" />נהל שנות מס
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            if (confirm(`להחזיר את ${client.fullName} ללקוחות רגילים?`)) {
                              moveToRegularMutation.mutate(client.id);
                            }
                          }}>
                            <UserRound className="w-4 h-4 ml-2" />החזר ללקוחות רגילים
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {yearsClient && (
        <YearsManagerDialog
          client={yearsClient}
          open={!!yearsClient}
          onClose={() => setYearsClient(null)}
        />
      )}
    </div>
  );
}
