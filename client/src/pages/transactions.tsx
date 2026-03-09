import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, MoreHorizontal, Trash2, TrendingUp, TrendingDown } from "lucide-react";
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
import { StatCard } from "@/components/stat-card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Transaction, Client } from "@shared/schema";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(value);
}

export default function Transactions() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: allTx, isLoading } = useQuery<Transaction[]>({ queryKey: ["/api/transactions"] });
  const { data: clients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const clientMap = new Map(clients?.map(c => [c.id, c.fullName]) || []);

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      await apiRequest("POST", "/api/transactions", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setDialogOpen(false);
      toast({ title: "התנועה נרשמה בהצלחה" });
    },
    onError: (err: Error) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "התנועה נמחקה" });
    },
  });

  const filtered = allTx?.filter(t => {
    const clientName = clientMap.get(t.clientId) || "";
    const matchesSearch = clientName.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase()) ||
      t.category?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || t.type === typeFilter;
    return matchesSearch && matchesType;
  }) || [];

  const totalIncome = allTx?.filter(t => t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0) || 0;
  const totalExpense = allTx?.filter(t => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0) || 0;

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
        title="תנועות"
        description="מעקב הכנסות והוצאות"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-transaction"><Plus className="w-4 h-4 ml-2" />הוסף תנועה</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>תנועה חדשה</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>לקוח *</Label>
                    <Select name="clientId" required>
                      <SelectTrigger data-testid="select-tx-client"><SelectValue placeholder="בחר לקוח" /></SelectTrigger>
                      <SelectContent>
                        {clients?.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>סוג *</Label>
                    <Select name="type" required defaultValue="income">
                      <SelectTrigger data-testid="select-tx-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">הכנסה</SelectItem>
                        <SelectItem value="expense">הוצאה</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>סכום *</Label>
                    <Input name="amount" type="number" step="0.01" required data-testid="input-tx-amount" />
                  </div>
                  <div className="space-y-2">
                    <Label>תאריך</Label>
                    <Input name="transactionDate" type="date" data-testid="input-tx-date" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>קטגוריה</Label>
                  <Input name="category" placeholder="לדוגמה: הנהלת חשבונות, החזר מס" data-testid="input-tx-category" />
                </div>
                <div className="space-y-2">
                  <Label>תיאור</Label>
                  <Textarea name="description" rows={2} data-testid="input-tx-description" />
                </div>
                <div className="flex justify-start gap-2">
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-tx">
                    {createMutation.isPending ? "מוסיף..." : "הוסף תנועה"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="סה״כ הכנסות" value={formatCurrency(totalIncome)} icon={TrendingUp} />
        <StatCard title="סה״כ הוצאות" value={formatCurrency(totalExpense)} icon={TrendingDown} />
        <StatCard title="רווח נקי" value={formatCurrency(totalIncome - totalExpense)} icon={TrendingUp} />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש תנועות..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
            data-testid="input-search-transactions"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-filter-tx-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסוגים</SelectItem>
            <SelectItem value="income">הכנסה</SelectItem>
            <SelectItem value="expense">הוצאה</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-12 w-full" />))}</CardContent></Card>
      ) : filtered.length === 0 ? (
        <EmptyState title="אין תנועות" description="רשום את התנועה הראשונה" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>לקוח</TableHead>
                  <TableHead>סוג</TableHead>
                  <TableHead>סכום</TableHead>
                  <TableHead className="hidden md:table-cell">קטגוריה</TableHead>
                  <TableHead className="hidden md:table-cell">תאריך</TableHead>
                  <TableHead className="hidden lg:table-cell">תיאור</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(t => (
                  <TableRow key={t.id} data-testid={`row-tx-${t.id}`}>
                    <TableCell className="text-sm font-medium">{clientMap.get(t.clientId) || "לא ידוע"}</TableCell>
                    <TableCell><StatusBadge status={t.type} /></TableCell>
                    <TableCell className={`text-sm font-semibold ${t.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {t.type === "income" ? "+" : "-"}{formatCurrency(parseFloat(t.amount))}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{t.category || "-"}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{t.transactionDate || "-"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground truncate max-w-[200px]">{t.description || "-"}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(t.id)}>
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
