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
import { Trash2, Search, RotateCcw, Eye } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@shared/schema";

function PhoneLink({ phone }: { phone: string }) {
  const cleaned = phone.replace(/\D/g, "");
  return (
    <a href={`tel:${phone}`} onClick={e => e.stopPropagation()} className="text-xs text-blue-600 hover:underline" dir="ltr">
      {phone}
    </a>
  );
}

const sourceLabels: Record<string, string> = {
  referral: "הפניה",
  website: "אתר",
  social_media: "רשתות",
  direct: "ישיר",
  recommended: "מומלצים",
  other: "אחר",
};

export default function DeletedClients() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: clients, isLoading } = useQuery<Client[]>({ queryKey: ["/api/clients/deleted"] });

  const filtered = useMemo(() => {
    return (clients || []).filter(c => {
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
      await apiRequest("POST", `/api/clients/${id}/restore`, {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/clients"] });
      qc.invalidateQueries({ queryKey: ["/api/clients/deleted"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "הלקוח שוחזר בהצלחה" });
    },
    onError: () => toast({ title: "שגיאה בשחזור", variant: "destructive" }),
  });

  return (
    <div className="p-4 sm:p-6 space-y-6" dir="rtl">
      <PageHeader
        title="לקוחות שנמחקו"
        description={`${clients?.length || 0} לקוחות במחזור — ניתן לשחזר`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-sm">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">סה״כ נמחקו</div>
            <div className="text-2xl font-bold mt-1 text-red-600">{clients?.length || 0}</div>
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
      ) : (clients?.length || 0) === 0 ? (
        <EmptyState
          icon={Trash2}
          title="אין לקוחות שנמחקו"
          description="לקוחות שתמחק יופיעו כאן ויוכלו להישחזר"
        />
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-red-500" />
              לקוחות שנמחקו ({filtered.length})
            </h3>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right px-2">ת.ז.</TableHead>
                  <TableHead className="text-right px-2">שם</TableHead>
                  <TableHead className="text-right px-2">טלפון</TableHead>
                  <TableHead className="text-right px-2">מקור</TableHead>
                  <TableHead className="text-right px-2">סטטוס</TableHead>
                  <TableHead className="text-right px-2">נמחק בתאריך</TableHead>
                  <TableHead className="text-right px-2">נוצר בתאריך</TableHead>
                  <TableHead className="px-2"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.id} className="hover:bg-muted/40 opacity-80">
                    <TableCell className="px-2 font-mono" dir="ltr">{c.taxId || "—"}</TableCell>
                    <TableCell className="px-2 font-medium">{c.fullName}</TableCell>
                    <TableCell className="px-2">
                      {c.phone ? <PhoneLink phone={c.phone} /> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="px-2 text-muted-foreground">
                      {c.source ? (sourceLabels[c.source] || c.source) : "—"}
                    </TableCell>
                    <TableCell className="px-2">
                      {c.customStatus
                        ? <span className="text-xs">{c.customStatus}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="px-2 whitespace-nowrap text-red-600">
                      {(c as any).deletedAt ? new Date((c as any).deletedAt).toLocaleDateString("he-IL") : "—"}
                    </TableCell>
                    <TableCell className="px-2 whitespace-nowrap text-muted-foreground">
                      {c.createdAt ? new Date(c.createdAt).toLocaleDateString("he-IL") : "—"}
                    </TableCell>
                    <TableCell className="px-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs px-2 gap-1 text-green-700 border-green-300 hover:bg-green-50"
                          onClick={() => {
                            if (confirm(`לשחזר את ${c.fullName}?`)) {
                              restoreMutation.mutate(c.id);
                            }
                          }}
                          disabled={restoreMutation.isPending}
                        >
                          <RotateCcw className="w-3 h-3" />
                          שחזר
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
