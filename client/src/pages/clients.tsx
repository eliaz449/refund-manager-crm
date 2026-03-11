import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Search, Phone, Mail, MoreHorizontal, Eye, Trash2, Clock } from "lucide-react";
import { formatDateTime, relativeTime } from "@/lib/date-utils";
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
import type { Client } from "@shared/schema";

const sourceLabels: Record<string, string> = {
  referral: "הפניה",
  website: "אתר",
  social_media: "רשתות חברתיות",
  direct: "ישיר",
  recommended: "מומלצים",
  other: "אחר",
};

export default function Clients() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newClientSource, setNewClientSource] = useState("direct");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: clients, isLoading } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      await apiRequest("POST", "/api/clients", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setDialogOpen(false);
      toast({ title: "הלקוח נוצר בהצלחה" });
    },
    onError: (err: Error) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "הלקוח נמחק" });
    },
  });

  const filtered = clients?.filter(c => {
    const matchesSearch = c.fullName.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search);
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    formData.forEach((val, key) => {
      if (val) data[key] = val.toString();
    });
    createMutation.mutate(data);
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-auto h-full">
      <PageHeader
        title="לקוחות"
        description={`${clients?.length || 0} לקוחות סה״כ`}
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-client" className="w-full sm:w-auto"><Plus className="w-4 h-4 ml-2" />הוסף לקוח</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>לקוח חדש</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">שם מלא *</Label>
                  <Input id="fullName" name="fullName" required data-testid="input-client-name" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">אימייל</Label>
                    <Input id="email" name="email" type="email" data-testid="input-client-email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">טלפון</Label>
                    <Input id="phone" name="phone" data-testid="input-client-phone" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientType">סוג לקוח</Label>
                    <Select name="clientType" defaultValue="private_individual">
                      <SelectTrigger data-testid="select-client-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private_individual">יחיד/שכיר</SelectItem>
                        <SelectItem value="self_employed">עצמאי</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source">מקור</Label>
                    <Select name="source" defaultValue="direct" value={newClientSource} onValueChange={setNewClientSource}>
                      <SelectTrigger data-testid="select-client-source"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="referral">הפניה</SelectItem>
                        <SelectItem value="website">אתר אינטרנט</SelectItem>
                        <SelectItem value="social_media">רשתות חברתיות</SelectItem>
                        <SelectItem value="direct">ישיר</SelectItem>
                        <SelectItem value="recommended">מומלצים</SelectItem>
                        <SelectItem value="other">אחר</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {(newClientSource === "recommended" || newClientSource === "referral") && (
                  <div className="space-y-2">
                    <Label htmlFor="recommendedBy">שם הממליץ</Label>
                    <Input id="recommendedBy" name="recommendedBy" data-testid="input-client-recommended-by" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="taxId">תעודת זהות / ח.פ.</Label>
                  <Input id="taxId" name="taxId" data-testid="input-client-taxid" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">כתובת</Label>
                  <Input id="address" name="address" data-testid="input-client-address" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">הערות</Label>
                  <Textarea id="notes" name="notes" rows={3} data-testid="input-client-notes" />
                </div>
                <div className="flex justify-start gap-2">
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-client">
                    {createMutation.isPending ? "יוצר..." : "צור לקוח"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש לקוחות..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
            data-testid="input-search-clients"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px]" data-testid="select-filter-status">
            <SelectValue placeholder="סינון לפי סטטוס" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            <SelectItem value="lead">ליד</SelectItem>
            <SelectItem value="active">פעיל</SelectItem>
            <SelectItem value="inactive">לא פעיל</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={search ? Search : Plus}
          title={search ? "לא נמצאו לקוחות תואמים" : "אין לקוחות עדיין"}
          description={search ? "נסה לשנות את מילות החיפוש" : "צור את הלקוח הראשון שלך כדי להתחיל"}
          action={!search ? (
            <Button onClick={() => setDialogOpen(true)} data-testid="button-empty-add-client">
              <Plus className="w-4 h-4 ml-2" />הוסף לקוח
            </Button>
          ) : undefined}
        />
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {filtered.map(client => (
              <Card
                key={client.id}
                className="hover-elevate cursor-pointer"
                onClick={() => setLocation(`/clients/${client.id}`)}
                data-testid={`card-client-${client.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate" data-testid={`text-client-name-${client.id}`}>{client.fullName}</p>
                        <StatusBadge status={client.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {client.clientType === "self_employed" ? "עצמאי" : "יחיד/שכיר"}
                        {client.source ? ` · ${sourceLabels[client.source] || client.source}` : ""}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" data-testid={`button-menu-client-${client.id}`}>
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLocation(`/clients/${client.id}`); }}>
                          <Eye className="w-4 h-4 ml-2" />צפה
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(client.id); }}
                        >
                          <Trash2 className="w-4 h-4 ml-2" />מחק
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex flex-col gap-1 mt-2">
                    {client.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        <span dir="ltr">{client.phone}</span>
                      </div>
                    )}
                    {client.email && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{client.email}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      <span>{formatDateTime(client.createdAt)}</span>
                    </div>
                    <StatusBadge status={client.clientProcessStatus} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[18%]">שם</TableHead>
                    <TableHead className="w-[20%]">פרטי קשר</TableHead>
                    <TableHead className="w-[10%]">סוג</TableHead>
                    <TableHead className="w-[10%]">סטטוס</TableHead>
                    <TableHead className="hidden lg:table-cell w-[10%]">תהליך</TableHead>
                    <TableHead className="hidden lg:table-cell w-[10%]">מקור</TableHead>
                    <TableHead className="w-[16%]">תאריך יצירה</TableHead>
                    <TableHead className="w-[48px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(client => (
                    <TableRow
                      key={client.id}
                      className="cursor-pointer"
                      onClick={() => setLocation(`/clients/${client.id}`)}
                      data-testid={`row-client-${client.id}`}
                    >
                      <TableCell className="truncate">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{client.fullName}</p>
                          <p className="text-xs text-muted-foreground truncate">{client.taxId || "ללא ת.ז."}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 min-w-0">
                          {client.email && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
                              <Mail className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{client.email}</span>
                            </div>
                          )}
                          {client.phone && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{client.phone}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">{client.clientType === "self_employed" ? "עצמאי" : "יחיד/שכיר"}</span>
                      </TableCell>
                      <TableCell><StatusBadge status={client.status} /></TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <StatusBadge status={client.clientProcessStatus} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {sourceLabels[client.source || ""] || client.source}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-start gap-1.5" data-testid={`text-created-at-${client.id}`}>
                          <Clock className="w-3 h-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs whitespace-nowrap">{formatDateTime(client.createdAt)}</p>
                            <p className="text-[11px] text-muted-foreground">{relativeTime(client.createdAt)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="w-[48px]">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button size="icon" variant="ghost" data-testid={`button-menu-client-${client.id}`}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLocation(`/clients/${client.id}`); }}>
                              <Eye className="w-4 h-4 ml-2" />צפה
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(client.id); }}
                            >
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
        </>
      )}
    </div>
  );
}
