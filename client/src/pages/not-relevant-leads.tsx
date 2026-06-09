import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CircleSlash, Search, RotateCcw, Eye, MessageCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@shared/schema";

const STATUS_LABELS: Record<string, string> = {
  not_relevant: "לא רלוונטי",
  not_interested: "לא מעוניין",
  wrong_info: "השאיר פרטים בטעות",
};

const STATUS_COLORS: Record<string, string> = {
  not_relevant: "bg-gray-200 text-gray-700",
  not_interested: "bg-orange-100 text-orange-700",
  wrong_info: "bg-purple-100 text-purple-700",
};

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

export default function NotRelevantLeads() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: clients, isLoading } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const filtered = useMemo(() => {
    const HIDDEN = ["not_relevant", "not_interested", "wrong_info"];
    return (clients || []).filter(c => {
      if (!c.contactStatus || !HIDDEN.includes(c.contactStatus)) return false;
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        (c.fullName || "").toLowerCase().includes(s) ||
        (c.taxId || "").includes(s) ||
        (c.phone || "").includes(s)
      );
    });
  }, [clients, search]);

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/clients/${id}`, { contactStatus: "new", notRelevantReason: null });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "הליד הוחזר לרשימה הראשית" });
    },
  });

  // Group by status
  const grouped = useMemo(() => {
    const map: Record<string, Client[]> = { not_relevant: [], not_interested: [], wrong_info: [] };
    for (const c of filtered) {
      if (c.contactStatus && map[c.contactStatus]) map[c.contactStatus].push(c);
    }
    return map;
  }, [filtered]);

  const total = filtered.length;

  return (
    <div className="p-4 sm:p-6 space-y-6" dir="rtl">
      <PageHeader
        title="לידים לא רלוונטיים"
        description="לקוחות שסומנו כלא רלוונטיים / לא מעוניינים / השאירו פרטים בטעות"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">סה״כ</div>
            <div className="text-2xl font-bold mt-1">{total}</div>
          </CardContent>
        </Card>
        {(["not_relevant", "not_interested", "wrong_info"] as const).map(s => (
          <Card key={s}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{STATUS_LABELS[s]}</div>
              <div className="text-2xl font-bold mt-1">{grouped[s].length}</div>
            </CardContent>
          </Card>
        ))}
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
      ) : total === 0 ? (
        <EmptyState
          icon={CircleSlash}
          title="אין לידים לא רלוונטיים"
          description="לקוחות יופיעו כאן כשתסמני אותם כלא רלוונטיים מתפריט הפעולה ברשימת הלקוחות"
        />
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <CircleSlash className="w-4 h-4" />
              רשימה ({total} לידים)
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
                  <TableHead className="text-right px-2">סיבה</TableHead>
                  <TableHead className="text-right px-2">תאריך</TableHead>
                  <TableHead className="px-2"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.id} className="hover:bg-muted/40">
                    <TableCell className="px-2 font-mono" dir="ltr">{c.taxId || "—"}</TableCell>
                    <TableCell className="px-2 font-medium">{c.fullName}</TableCell>
                    <TableCell className="px-2">
                      {c.phone ? <PhoneLink phone={c.phone} /> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="px-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[c.contactStatus || ""] || "bg-muted"}`}>
                        {STATUS_LABELS[c.contactStatus || ""] || c.contactStatus}
                      </span>
                    </TableCell>
                    <TableCell className="px-2 max-w-[300px]">
                      {c.notRelevantReason
                        ? <span className="text-xs text-muted-foreground" title={c.notRelevantReason}>{c.notRelevantReason}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="px-2 whitespace-nowrap text-muted-foreground">
                      {c.updatedAt ? new Date(c.updatedAt).toLocaleDateString("he-IL") : "—"}
                    </TableCell>
                    <TableCell className="px-2">
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => setLocation(`/clients/${c.id}`)}
                          title="פתח לקוח"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => {
                            if (confirm(`להחזיר את ${c.fullName} לרשימת הלקוחות הראשית?`)) {
                              restoreMutation.mutate(c.id);
                            }
                          }}
                          disabled={restoreMutation.isPending}
                          title="החזר ללקוחות"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-green-600" />
                        </Button>
                      </div>
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
