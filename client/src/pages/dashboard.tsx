import { useQuery } from "@tanstack/react-query";
import { Users, Briefcase, CheckSquare, TrendingUp, TrendingDown, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import type { Client, Case, Task, Payment } from "@shared/schema";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(value);
}

const CHART_COLORS = [
  "hsl(210, 95%, 42%)",
  "hsl(195, 85%, 38%)",
  "hsl(175, 75%, 32%)",
  "hsl(160, 70%, 35%)",
  "hsl(145, 65%, 32%)",
];

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalLeads: number;
    activeClients: number;
    openCases: number;
    totalRevenue: number;
    totalExpenses: number;
    pendingTasks: number;
  }>({ queryKey: ["/api/dashboard/stats"] });

  const { data: clients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: casesData } = useQuery<Case[]>({ queryKey: ["/api/cases"] });
  const { data: tasksData } = useQuery<Task[]>({ queryKey: ["/api/tasks"] });
  const { data: paymentsData } = useQuery<Payment[]>({ queryKey: ["/api/payments"] });

  const clientStatusData = clients ? [
    { name: "ליד", value: clients.filter(c => c.status === "lead").length },
    { name: "פעיל", value: clients.filter(c => c.status === "active").length },
    { name: "לא פעיל", value: clients.filter(c => c.status === "inactive").length },
  ].filter(d => d.value > 0) : [];

  const caseStatusData = casesData ? [
    { name: "חדש", count: casesData.filter(c => c.status === "new").length },
    { name: "בטיפול", count: casesData.filter(c => c.status === "in_progress").length },
    { name: "איסוף מסמכים", count: casesData.filter(c => c.status === "document_collection").length },
    { name: "הוגש", count: casesData.filter(c => c.status === "submitted").length },
    { name: "תקבול", count: casesData.filter(c => c.status === "completed").length },
  ].filter(d => d.count > 0) : [];

  const recentTasks = tasksData
    ?.filter(t => t.status !== "completed")
    .slice(0, 5) || [];

  const recentPayments = paymentsData?.slice(0, 5) || [];

  const clientMap = new Map<string, string>();
  clients?.forEach(c => { clientMap.set(c.id, c.fullName); });

  const paymentMethodLabels: Record<string, string> = {
    credit_card: "כרטיס אשראי",
    bank_transfer: "העברה בנקאית",
    check: "צ׳ק",
    cash: "מזומן",
    other: "אחר",
  };

  if (statsLoading) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title="לוח בקרה" description="סקירה כללית של ביצועי המשרד" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <PageHeader title="לוח בקרה" description="סקירה כללית של ביצועי המשרד" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="סה״כ לידים" value={stats?.totalLeads ?? 0} icon={UserPlus} />
        <StatCard title="לקוחות פעילים" value={stats?.activeClients ?? 0} icon={Users} />
        <StatCard title="תיקים פתוחים" value={stats?.openCases ?? 0} icon={Briefcase} />
        <StatCard title="משימות ממתינות" value={stats?.pendingTasks ?? 0} icon={CheckSquare} />
        <StatCard title="הכנסות" value={formatCurrency(stats?.totalRevenue ?? 0)} icon={TrendingUp} />
        <StatCard
          title="רווח נקי"
          value={formatCurrency((stats?.totalRevenue ?? 0) - (stats?.totalExpenses ?? 0))}
          icon={TrendingDown}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold" data-testid="text-chart-cases">תיקים לפי סטטוס</h3>
          </CardHeader>
          <CardContent className="pt-0">
            {caseStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={caseStatusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(210, 95%, 42%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">אין נתוני תיקים</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold" data-testid="text-chart-clients">פילוח לקוחות</h3>
          </CardHeader>
          <CardContent className="pt-0">
            {clientStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={clientStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {clientStatusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">אין נתוני לקוחות</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold" data-testid="text-pending-tasks">משימות ממתינות</h3>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {recentTasks.map(task => (
                <div key={task.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0" data-testid={`row-task-${task.id}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{task.taskName}</p>
                    <p className="text-xs text-muted-foreground">{task.dueDate ? `תאריך יעד: ${task.dueDate}` : "ללא תאריך יעד"}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={task.priority} />
                    <StatusBadge status={task.status} />
                  </div>
                </div>
              ))}
              {recentTasks.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">אין משימות ממתינות</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold" data-testid="text-recent-payments">תשלומים אחרונים</h3>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {recentPayments.map(payment => {
                const clientName = clientMap.get(payment.clientId) || "לקוח לא ידוע";
                const methodLabel = paymentMethodLabels[payment.paymentMethod || "other"] || "אחר";
                const isPartial = payment.status === "pending";
                return (
                  <div key={payment.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0" data-testid={`row-payment-${payment.id}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" data-testid={`text-payment-client-${payment.id}`}>{clientName}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs text-muted-foreground">{formatCurrency(parseFloat(payment.amount))}</p>
                        <span className="text-xs text-muted-foreground">·</span>
                        <p className="text-xs text-muted-foreground" data-testid={`text-payment-method-${payment.id}`}>{methodLabel}</p>
                        <span className="text-xs text-muted-foreground">·</span>
                        <p className="text-xs text-muted-foreground">{payment.paymentDate || "ללא תאריך"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={isPartial ? "outline" : "secondary"} className="text-xs" data-testid={`badge-payment-type-${payment.id}`}>
                        {isPartial ? "חלקי" : "מלא"}
                      </Badge>
                      <StatusBadge status={payment.status} />
                    </div>
                  </div>
                );
              })}
              {recentPayments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">אין תשלומים עדיין</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
