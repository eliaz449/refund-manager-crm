import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarClock, Search, Eye, Phone, MessageCircle } from "lucide-react";
import type { Client } from "@shared/schema";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(value);
}

function PhoneLink({ phone }: { phone: string }) {
  const cleaned = phone.replace(/\D/g, "");
  return (
    <div className="flex items-center gap-1">
      <a href={`tel:${phone}`} onClick={e => e.stopPropagation()} className="text-xs text-blue-600 hover:underline" dir="ltr">
        {phone}
      </a>
      <a
        href={`https://wa.me/${cleaned.startsWith("0") ? "972" + cleaned.slice(1) : cleaned}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        title="WhatsApp"
      >
        <MessageCircle className="w-3 h-3 text-green-600" />
      </a>
    </div>
  );
}

export default function NextYearLeads() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const { data: clients, isLoading } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  // Only clients with receiptDate filled
  const eligibleClients = useMemo(() => {
    return (clients || []).filter(c => !!c.receiptDate);
  }, [clients]);

  const filtered = useMemo(() => {
    if (!search.trim()) return eligibleClients;
    const s = search.toLowerCase();
    return eligibleClients.filter(c =>
      (c.fullName || "").toLowerCase().includes(s) ||
      (c.taxId || "").includes(s) ||
      (c.phone || "").includes(s)
    );
  }, [eligibleClients, search]);

  // Group by year of receipt
  const grouped = useMemo(() => {
    const map = new Map<number, Client[]>();
    for (const c of filtered) {
      if (!c.receiptDate) continue;
      const year = new Date(c.receiptDate).getFullYear();
      const arr = map.get(year) || [];
      arr.push(c);
      map.set(year, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [filtered]);

  const totalRefund = eligibleClients.reduce((sum, c) => sum + parseFloat(c.refundEstimateAmount || "0"), 0);
  const totalCommission = eligibleClients.reduce((sum, c) => sum + parseFloat(c.commissionAmount || "0"), 0);

  return (
    <div className="p-4 sm:p-6 space-y-6" dir="rtl">
      <PageHeader
        title="לידים לשנה הבאה"
        description="לקוחות שקיבלו תקבול — חיכי להם בשנת המס הבאה"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">סה״כ לקוחות</div>
            <div className="text-2xl font-bold mt-1">{eligibleClients.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">סה״כ החזרים</div>
            <div className="text-2xl font-bold mt-1 text-green-700">{formatCurrency(totalRefund)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">סה״כ עמלות</div>
            <div className="text-2xl font-bold mt-1 text-blue-700">{formatCurrency(totalCommission)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="חיפוש לפי שם / ת.ז. / טלפון..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-9"
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : eligibleClients.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="w-10 h-10" />}
          title="אין עדיין לקוחות לשנה הבאה"
          description='לקוחות יופיעו כאן אוטומטית ברגע שתמלאי "תאריך תקבול" בפרטי הלקוח/ה'
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([year, clientsOfYear]) => (
            <Card key={year}>
              <CardHeader className="pb-2">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <CalendarClock className="w-4 h-4" />
                  קיבלו תקבול ב-{year}
                  <span className="text-xs text-muted-foreground">({clientsOfYear.length} לקוחות)</span>
                </h3>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right px-2">ת.ז.</TableHead>
                      <TableHead className="text-right px-2">שם</TableHead>
                      <TableHead className="text-right px-2">טלפון</TableHead>
                      <TableHead className="text-right px-2">סטטוס</TableHead>
                      <TableHead className="text-right px-2">סכום החזר</TableHead>
                      <TableHead className="text-right px-2">עמלה</TableHead>
                      <TableHead className="text-right px-2">תאריך תקבול</TableHead>
                      <TableHead className="px-2"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientsOfYear.map(c => (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => setLocation(`/clients/${c.id}`)}
                      >
                        <TableCell className="px-2 font-mono" dir="ltr">{c.taxId || "—"}</TableCell>
                        <TableCell className="px-2 font-medium">{c.fullName}</TableCell>
                        <TableCell className="px-2">
                          {c.phone ? <PhoneLink phone={c.phone} /> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="px-2">
                          {c.customStatus
                            ? <span className="truncate block max-w-[140px]" title={c.customStatus}>{c.customStatus}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="px-2 whitespace-nowrap text-green-700 font-medium">
                          {c.refundEstimateAmount ? formatCurrency(parseFloat(c.refundEstimateAmount)) : "—"}
                        </TableCell>
                        <TableCell className="px-2 whitespace-nowrap text-blue-700">
                          {c.commissionAmount ? formatCurrency(parseFloat(c.commissionAmount)) : "—"}
                        </TableCell>
                        <TableCell className="px-2 whitespace-nowrap">
                          {c.receiptDate ? new Date(c.receiptDate).toLocaleDateString("he-IL") : "—"}
                        </TableCell>
                        <TableCell className="px-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => setLocation(`/clients/${c.id}`)}
                            title="פתח לקוח"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
