import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowRight, Phone, Mail, MapPin, FileText, Briefcase, CheckSquare, CreditCard, Save } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Client, Case, Task, Payment } from "@shared/schema";
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

  const [editData, setEditData] = useState<Partial<Client>>({});

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

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">הלקוח לא נמצא</p>
        <Button variant="outline" onClick={() => setLocation("/clients")} className="mt-4">
          <ArrowRight className="w-4 h-4 ml-2" />חזרה ללקוחות
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={() => setLocation("/clients")} data-testid="button-back">
          <ArrowRight className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-client-name">{client.fullName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={client.status} />
            <StatusBadge status={client.clientProcessStatus} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
        {client.address && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />{client.address}
          </div>
        )}
      </div>

      <Tabs defaultValue="details">
        <TabsList data-testid="tabs-client-detail">
          <TabsTrigger value="details" data-testid="tab-details"><FileText className="w-4 h-4 ml-1" />פרטים</TabsTrigger>
          <TabsTrigger value="cases" data-testid="tab-cases"><Briefcase className="w-4 h-4 ml-1" />תיקים ({clientCases?.length || 0})</TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks"><CheckSquare className="w-4 h-4 ml-1" />משימות ({clientTasks?.length || 0})</TabsTrigger>
          <TabsTrigger value="payments" data-testid="tab-payments"><CreditCard className="w-4 h-4 ml-1" />תשלומים ({clientPayments?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <Card>
            <CardContent className="p-5 space-y-4">
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
                  <Select value={editData.clientProcessStatus || ""} onValueChange={(v) => setEditData({ ...editData, clientProcessStatus: v as any })}>
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
              </div>
              <div className="space-y-2">
                <Label>כתובת</Label>
                <Input
                  value={editData.address || ""}
                  onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                  data-testid="input-edit-address"
                />
              </div>
              <div className="space-y-2">
                <Label>הערות</Label>
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
        </TabsContent>

        <TabsContent value="cases" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {clientCases && clientCases.length > 0 ? (
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
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">אין תיקים ללקוח זה</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {clientTasks && clientTasks.length > 0 ? (
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
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">אין משימות ללקוח זה</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {clientPayments && clientPayments.length > 0 ? (
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
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">אין תשלומים ללקוח זה</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
