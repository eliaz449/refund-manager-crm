import { toast } from "@/hooks/use-toast";

export async function requestNotificationPermission(): Promise<NotificationPermission | null> {
  try {
    if (!("Notification" in window)) return null;
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return null;
  }
}

export async function showSystemNotification(title: string, body: string): Promise<boolean> {
  try {
    if (!("Notification" in window)) return false;
    if (Notification.permission !== "granted") return false;

    if ("serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, { body, icon: "/favicon.ico" });
        return true;
      } catch {
        // service worker failed — try direct constructor as last resort
      }
    }

    // Desktop browsers that support direct constructor
    try {
      new Notification(title, { body, icon: "/favicon.ico" });
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

export function showToastNotification(title: string, description: string) {
  try {
    toast({ title, description, duration: 8000 });
  } catch {}
}
