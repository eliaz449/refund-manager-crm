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
import type { Payment, Client, Case } from "@shared/schema";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(value);
}

const paymentMethodLabels: Record<string, string> = {
  credit_card: "כרטיס אשראי",
  bank_transfer: "העברה בנקאית",
  check: "צ׳ק",
  cash: "מזומן",
  other: "אחר",
};

export default function Payments() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: allPayments, isLoading } = useQuery<Payment[]>({ queryKey: ["/api/payments"] });
  const { data: clients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: cases } = useQuery<Case[]>({ queryKey: ["/api/cases"] });

  const clientMap = new Map(clients?.map(c => [c.id, c.fullName]) || []);

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      await apiRequest("POST", "/api/payments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setDialogOpen(false);
      toast({ title: "התשלום נרשם בהצלחה" });
    },
    onError: (err: Error) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/payments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "התשלום נמחק" });
    },
  });

  const filtered = allPayments?.filter(p => {
    const clientName = clientMap.get(p.clientId) || "";
    const matchesSearch = clientName.toLowerCase().includes(search.toLowerCase()) ||
      p.referenceNumber?.toLowerCase().includes(search.toLowerCase()) ||
      p.amount.includes(search);
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const totalPaid = allPayments?.filter(p => p.status === "paid").reduce((sum, p) => sum + parseFloat(p.amount), 0) || 0;
  const totalPending = allPayments?.filter(p => p.status === "pending").reduce((sum, p) => sum + parseFloat(p.amount), 0) || 0;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Record<string, any> = {};
    formData.forEach((val, key) => {
      if (val) data[key] = val.toString();
    });
    createMutation.mutate(data);
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <PageHeader
        title="תשלומים"
        description={`${formatCurrency(totalPaid)} נגבה | ${formatCurrency(totalPending)} ממתין`}
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-payment"><Plus className="w-4 h-4 ml-2" />רשום תשלום</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>רישום תשלום</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>לקוח *</Label>
                  <Select name="clientId" required>
                    <SelectTrigger data-testid="select-payment-client"><SelectValue placeholder="בחר לקוח" /></SelectTrigger>
                    <SelectContent>
                      {clients?.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>סכום *</Label>
                    <Input name="amount" type="number" step="0.01" required data-testid="input-payment-amount" />
                  </div>
                  <div className="space-y-2">
                    <Label>תאריך תשלום</Label>
                    <Input name="paymentDate" type="date" data-testid="input-payment-date" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>אמצעי תשלום</Label>
                    <Select name="paymentMethod" defaultValue="bank_transfer">
                      <SelectTrigger data-testid="select-payment-method"><SelectValue /></SelectTrigger>
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
                      <SelectTrigger data-testid="select-payment-status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">שולם</SelectItem>
                        <SelectItem value="pending">ממתין</SelectItem>
                        <SelectItem value="cancelled">בוטל</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>מספר אסמכתא</Label>
                  <Input name="referenceNumber" data-testid="input-payment-reference" />
                </div>
                <div className="space-y-2">
                  <Label>הערות</Label>
                  <Textarea name="notes" rows={2} data-testid="input-payment-notes" />
                </div>
                <div className="flex justify-start gap-2">
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-payment">
                    {createMutation.isPending ? "רושם..." : "רשום תשלום"}
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
            placeholder="חיפוש תשלומים..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
            data-testid="input-search-payments"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-filter-payment-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            <SelectItem value="paid">שולם</SelectItem>
            <SelectItem value="pending">ממתין</SelectItem>
            <SelectItem value="cancelled">בוטל</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-12 w-full" />))}</CardContent></Card>
      ) : filtered.length === 0 ? (
        <EmptyState title={search ? "לא נמצאו תשלומים תואמים" : "אין תשלומים עדיין"} description="רשום את התשלום הראשון" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>לקוח</TableHead>
                  <TableHead>סכום</TableHead>
                  <TableHead className="hidden md:table-cell">תאריך</TableHead>
                  <TableHead className="hidden md:table-cell">אמצעי תשלום</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead className="hidden lg:table-cell">אסמכתא</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow key={p.id} data-testid={`row-payment-${p.id}`}>
                    <TableCell className="text-sm font-medium">{clientMap.get(p.clientId) || "לא ידוע"}</TableCell>
                    <TableCell className="text-sm font-semibold">{formatCurrency(parseFloat(p.amount))}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{p.paymentDate || "-"}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{paymentMethodLabels[p.paymentMethod || ""] || p.paymentMethod}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{p.referenceNumber || "-"}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(p.id)}>
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
