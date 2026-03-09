import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, MoreHorizontal, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Case, Client, User } from "@shared/schema";

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

export default function Cases() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: allCases, isLoading } = useQuery<Case[]>({ queryKey: ["/api/cases"] });
  const { data: clients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: usersData } = useQuery<User[]>({ queryKey: ["/api/users"] });

  const clientMap = new Map(clients?.map(c => [c.id, c.fullName]) || []);
  const userMap = new Map(usersData?.map(u => [u.id, u.fullName]) || []);

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      await apiRequest("POST", "/api/cases", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setDialogOpen(false);
      toast({ title: "התיק נוצר בהצלחה" });
    },
    onError: (err: Error) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/cases/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "התיק נמחק" });
    },
  });

  const filtered = allCases?.filter(c => {
    const clientName = clientMap.get(c.clientId) || "";
    const matchesSearch = clientName.toLowerCase().includes(search.toLowerCase()) ||
      c.serviceType?.includes(search.toLowerCase()) ||
      c.notes?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Record<string, any> = {};
    formData.forEach((val, key) => {
      if (val) {
        if (key === "taxYear") data[key] = parseInt(val.toString());
        else data[key] = val.toString();
      }
    });
    createMutation.mutate(data);
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <PageHeader
        title="תיקים"
        description={`${allCases?.length || 0} תיקים סה״כ`}
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-case"><Plus className="w-4 h-4 ml-2" />תיק חדש</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>תיק חדש</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>לקוח *</Label>
                  <Select name="clientId" required>
                    <SelectTrigger data-testid="select-case-client"><SelectValue placeholder="בחר לקוח" /></SelectTrigger>
                    <SelectContent>
                      {clients?.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>שנת מס</Label>
                    <Input name="taxYear" type="number" placeholder="2024" data-testid="input-case-year" />
                  </div>
                  <div className="space-y-2">
                    <Label>סוג שירות</Label>
                    <Select name="serviceType" defaultValue="tax_refund">
                      <SelectTrigger data-testid="select-case-service"><SelectValue /></SelectTrigger>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>עדיפות</Label>
                    <Select name="priority" defaultValue="medium">
                      <SelectTrigger data-testid="select-case-priority"><SelectValue /></SelectTrigger>
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
                      <SelectTrigger data-testid="select-case-assigned"><SelectValue placeholder="בחר מטפל" /></SelectTrigger>
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
                  <Input name="refundEstimate" type="number" step="0.01" placeholder="0.00" data-testid="input-case-estimate" />
                </div>
                <div className="space-y-2">
                  <Label>הערות</Label>
                  <Textarea name="notes" rows={3} data-testid="input-case-notes" />
                </div>
                <div className="flex justify-start gap-2">
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-case">
                    {createMutation.isPending ? "יוצר..." : "צור תיק"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש תיקים..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
            data-testid="input-search-cases"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-case-status">
            <SelectValue placeholder="סינון לפי סטטוס" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            <SelectItem value="new">חדש</SelectItem>
            <SelectItem value="document_collection">איסוף מסמכים</SelectItem>
            <SelectItem value="in_progress">בטיפול</SelectItem>
            <SelectItem value="review">בבדיקה</SelectItem>
            <SelectItem value="submitted">הוגש</SelectItem>
            <SelectItem value="pending_tax_authority">ממתין לרשות המסים</SelectItem>
            <SelectItem value="completed">הושלם</SelectItem>
            <SelectItem value="cancelled">בוטל</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-12 w-full" />))}</CardContent></Card>
      ) : filtered.length === 0 ? (
        <EmptyState title={search ? "לא נמצאו תיקים תואמים" : "אין תיקים עדיין"} description="צור תיק חדש כדי להתחיל" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>לקוח</TableHead>
                  <TableHead>שירות</TableHead>
                  <TableHead className="hidden md:table-cell">שנה</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>עדיפות</TableHead>
                  <TableHead className="hidden lg:table-cell">מטפל</TableHead>
                  <TableHead className="hidden lg:table-cell">הערכת החזר</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.id} data-testid={`row-case-${c.id}`}>
                    <TableCell className="text-sm font-medium">{clientMap.get(c.clientId) || "לא ידוע"}</TableCell>
                    <TableCell className="text-sm">{serviceTypeLabels[c.serviceType || ""] || c.serviceType}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{c.taxYear || "-"}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell><StatusBadge status={c.priority} /></TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{userMap.get(c.assignedTo || "") || "-"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{c.refundEstimate ? formatCurrency(parseFloat(c.refundEstimate)) : "-"}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(c.id)}>
                            <Trash2 className="w-4 h-4 ml-2" />מחק
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
    </div>
  );
}
