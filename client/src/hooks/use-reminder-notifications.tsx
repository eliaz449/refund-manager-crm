import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell, Phone, X, Clock } from "lucide-react";
import type { Reminder } from "@shared/schema";
import { useQuery as useClientQuery } from "@tanstack/react-query";
import type { Client } from "@shared/schema";
import { useLocation } from "wouter";

function ReminderModal({
  reminder,
  onDismiss,
  onSnooze,
}: {
  reminder: Reminder;
  onDismiss: () => void;
  onSnooze: () => void;
}) {
  const { data: clients } = useClientQuery<Client[]>({ queryKey: ["/api/clients"] });
  const client = clients?.find(c => c.id === reminder.clientId);
  const [, setLocation] = useLocation();

  const reminderTime = new Date(reminder.reminderAt).toLocaleTimeString("he-IL", {
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <Dialog open onOpenChange={() => onDismiss()}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <Bell className="w-5 h-5" />
            תזכורת — {reminderTime}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {client && (
            <div className="bg-muted rounded-lg p-3 space-y-1">
              <p className="font-semibold">{client.fullName}</p>
              {client.phone && (
                <a
                  href={`tel:${client.phone}`}
                  className="flex items-center gap-1.5 text-sm text-primary"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span dir="ltr">{client.phone}</span>
                </a>
              )}
            </div>
          )}
          <p className="text-sm">{reminder.content}</p>
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={onSnooze}
            >
              <Clock className="w-3.5 h-3.5 ml-1" />
              דחה 15 דקות
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => {
                onDismiss();
                if (client) setLocation(`/clients/${client.id}`);
              }}
            >
              פתח לקוח
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onDismiss}
              className="h-8 w-8 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ReminderNotifications() {
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState<Reminder | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());

  const { data: active = [] } = useQuery<Reminder[]>({
    queryKey: ["/api/reminders/active"],
    refetchInterval: 30000,
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/reminders/${id}`, { isDismissed: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: (id: string) => {
      const snoozedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      return apiRequest("PATCH", `/api/reminders/${id}`, { snoozedUntil });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/active"] });
    },
  });

  useEffect(() => {
    if (active.length === 0) return;
    const now = Date.now();
    for (const r of active) {
      const due = new Date(r.reminderAt).getTime();
      if (due <= now && !notifiedRef.current.has(r.id)) {
        notifiedRef.current.add(r.id);
        setCurrent(r);

        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("תזכורת CRM", {
            body: r.content,
            icon: "/favicon.ico",
          });
        }
        break;
      }
    }
  }, [active]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  if (!current) return null;

  return (
    <ReminderModal
      reminder={current}
      onDismiss={() => {
        dismissMutation.mutate(current.id);
        setCurrent(null);
      }}
      onSnooze={() => {
        snoozeMutation.mutate(current.id);
        notifiedRef.current.delete(current.id);
        setCurrent(null);
      }}
    />
  );
}
