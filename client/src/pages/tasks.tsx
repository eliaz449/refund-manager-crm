import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, MoreHorizontal, Trash2, CheckCircle2 } from "lucide-react";
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
import type { Task, Client, User } from "@shared/schema";

const taskCategoryLabels: Record<string, string> = {
  tax_return: "דוח מס",
  document_collection: "איסוף מסמכים",
  client_communication: "תקשורת עם לקוח",
  vat_report: 'דוח מע"מ',
  annual_report: "דוח שנתי",
  bookkeeping_update: "עדכון הנהלת חשבונות",
  consultation: "ייעוץ",
  other: "אחר",
};

export default function Tasks() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: allTasks, isLoading } = useQuery<Task[]>({ queryKey: ["/api/tasks"] });
  const { data: clients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: usersData } = useQuery<User[]>({ queryKey: ["/api/users"] });

  const clientMap = new Map(clients?.map(c => [c.id, c.fullName]) || []);
  const userMap = new Map(usersData?.map(u => [u.id, u.fullName]) || []);

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      await apiRequest("POST", "/api/tasks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setDialogOpen(false);
      toast({ title: "המשימה נוצרה בהצלחה" });
    },
    onError: (err: Error) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      await apiRequest("PATCH", `/api/tasks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "המשימה עודכנה" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "המשימה נמחקה" });
    },
  });

  const filtered = allTasks?.filter(t => {
    const matchesSearch = t.taskName.toLowerCase().includes(search.toLowerCase()) ||
      (clientMap.get(t.clientId || "") || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

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
        title="משימות"
        description={`${allTasks?.length || 0} משימות סה״כ`}
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-task"><Plus className="w-4 h-4 ml-2" />משימה חדשה</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>משימה חדשה</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>שם משימה *</Label>
                  <Input name="taskName" required data-testid="input-task-name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>לקוח</Label>
                    <Select name="clientId">
                      <SelectTrigger data-testid="select-task-client"><SelectValue placeholder="בחר לקוח" /></SelectTrigger>
                      <SelectContent>
                        {clients?.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>מטפל אחראי</Label>
                    <Select name="assignedTo">
                      <SelectTrigger data-testid="select-task-assigned"><SelectValue placeholder="בחר מטפל" /></SelectTrigger>
                      <SelectContent>
                        {usersData?.map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>תאריך יעד</Label>
                    <Input name="dueDate" type="date" data-testid="input-task-duedate" />
                  </div>
                  <div className="space-y-2">
                    <Label>עדיפות</Label>
                    <Select name="priority" defaultValue="medium">
                      <SelectTrigger data-testid="select-task-priority"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">נמוכה</SelectItem>
                        <SelectItem value="medium">בינונית</SelectItem>
                        <SelectItem value="high">גבוהה</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>קטגוריה</Label>
                  <Select name="taskCategory" defaultValue="other">
                    <SelectTrigger data-testid="select-task-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tax_return">דוח מס</SelectItem>
                      <SelectItem value="document_collection">איסוף מסמכים</SelectItem>
                      <SelectItem value="client_communication">תקשורת עם לקוח</SelectItem>
                      <SelectItem value="vat_report">דוח מע״מ</SelectItem>
                      <SelectItem value="annual_report">דוח שנתי</SelectItem>
                      <SelectItem value="bookkeeping_update">עדכון הנהלת חשבונות</SelectItem>
                      <SelectItem value="consultation">ייעוץ</SelectItem>
                      <SelectItem value="other">אחר</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>הערות</Label>
                  <Textarea name="notes" rows={3} data-testid="input-task-notes" />
                </div>
                <div className="flex justify-start gap-2">
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-task">
                    {createMutation.isPending ? "יוצר..." : "צור משימה"}
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
            placeholder="חיפוש משימות..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
            data-testid="input-search-tasks"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-filter-task-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            <SelectItem value="not_started">טרם התחיל</SelectItem>
            <SelectItem value="in_progress">בטיפול</SelectItem>
            <SelectItem value="completed">הושלם</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-12 w-full" />))}</CardContent></Card>
      ) : filtered.length === 0 ? (
        <EmptyState title={search ? "לא נמצאו משימות תואמות" : "אין משימות עדיין"} description="צור משימה חדשה כדי להתחיל" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>משימה</TableHead>
                  <TableHead className="hidden md:table-cell">לקוח</TableHead>
                  <TableHead className="hidden md:table-cell">תאריך יעד</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>עדיפות</TableHead>
                  <TableHead className="hidden lg:table-cell">מטפל</TableHead>
                  <TableHead className="hidden lg:table-cell">קטגוריה</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(t => (
                  <TableRow key={t.id} data-testid={`row-task-${t.id}`}>
                    <TableCell className="text-sm font-medium">{t.taskName}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{clientMap.get(t.clientId || "") || "-"}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{t.dueDate || "-"}</TableCell>
                    <TableCell><StatusBadge status={t.status} /></TableCell>
                    <TableCell><StatusBadge status={t.priority} /></TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{userMap.get(t.assignedTo || "") || "-"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{taskCategoryLabels[t.taskCategory || ""] || t.taskCategory}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {t.status !== "completed" && (
                            <DropdownMenuItem onClick={() => updateMutation.mutate({ id: t.id, data: { status: "completed" } })}>
                              <CheckCircle2 className="w-4 h-4 ml-2" />סמן כהושלם
                            </DropdownMenuItem>
                          )}
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
