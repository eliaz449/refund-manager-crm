import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { sendCallMeBot, formatReminderMessage, logWhatsAppConfig } from "./whatsapp";
import { sendReminderEmail, isEmailConfigured } from "./email";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

setupAuth(app);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && !path.startsWith("/api/auth")) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Tells us which build is currently running — used to verify deploys
  // without DB access. Bumped manually each time we want to confirm deploy.
  app.get("/api/version", (_req, res) => {
    res.json({
      version: "2026-06-10-email-reminders",
      features: {
        reminderEmailScheduler: true,
        documentsUpload: true,
        notRelevantPage: true,
      },
    });
  });

  // Debug: probes the email scheduler from outside.
  // Returns counts + the LAST scheduler error (if any).
  app.get("/api/debug/email-reminder-status", async (_req, res) => {
    try {
      const { storage } = await import("./storage");
      const { isEmailConfigured } = await import("./email");
      const { db } = await import("./db");
      const { reminders } = await import("@shared/schema");
      const { desc } = await import("drizzle-orm");

      const pending = await storage.getPendingEmailReminders();
      const all = await db.select().from(reminders).orderBy(desc(reminders.createdAt)).limit(10);

      res.json({
        emailConfigured: isEmailConfigured(),
        pendingCount: pending.length,
        pending: pending.map(r => ({
          id: r.id,
          content: r.content,
          reminderAt: r.reminderAt,
          emailNotified: r.emailNotified,
        })),
        lastError: (global as any).__lastEmailSchedulerError ?? null,
        serverNow: new Date().toISOString(),
        recentReminders: all.map(r => ({
          id: r.id,
          content: r.content,
          reminderAt: r.reminderAt,
          isDismissed: r.isDismissed,
          whatsappNotified: r.whatsappNotified,
          emailNotified: r.emailNotified,
          snoozedUntil: r.snoozedUntil,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message, stack: err.stack?.substring(0, 500) });
    }
  });

  // Debug: force-trigger the email scheduler ONCE — picks up all pending
  // reminders right now without waiting for the next 60s tick.
  app.post("/api/debug/run-email-scheduler", async (_req, res) => {
    try {
      const { storage } = await import("./storage");
      const { sendReminderEmail, isEmailConfigured } = await import("./email");
      if (!isEmailConfigured()) {
        return res.status(503).json({ error: "RESEND_API_KEY not set" });
      }
      const pending = await storage.getPendingEmailReminders();
      const results: any[] = [];
      for (const reminder of pending) {
        try {
          const client = await storage.getClient(reminder.clientId);
          await sendReminderEmail({
            clientId: reminder.clientId,
            clientName: client?.fullName ?? "לקוח",
            clientPhone: client?.phone ?? null,
            reminderNote: reminder.content,
            scheduledAt: reminder.reminderAt,
          });
          await storage.markReminderEmailNotified(reminder.id);
          results.push({ id: reminder.id, sent: true });
        } catch (err: any) {
          results.push({ id: reminder.id, sent: false, error: err.message });
        }
      }
      res.json({ pendingCount: pending.length, results });
    } catch (err: any) {
      res.status(500).json({ error: err.message, stack: err.stack?.substring(0, 500) });
    }
  });

  const { runMigrations } = await import("./migrations");
  await runMigrations().catch(err => console.error("Migrations error:", err));
  const { seedDatabase } = await import("./seed");
  await seedDatabase().catch(err => console.error("Seed error:", err));
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
      logWhatsAppConfig();
    },
  );

  // ─── WhatsApp Reminder Scheduler ──────────────────────────────────
  // Runs every 60 seconds — finds reminders that are past-due and
  // haven't had a WhatsApp sent yet, sends one, then marks them done.
  setInterval(async () => {
    try {
      const pending = await storage.getPendingWhatsappReminders();
      if (pending.length === 0) return;
      console.log(`[WhatsApp] Scheduler: ${pending.length} pending reminder(s)`);
      for (const reminder of pending) {
        try {
          const client = await storage.getClient(reminder.clientId);
          const msg = formatReminderMessage({
            taskTitle: reminder.content,
            clientName: client?.fullName ?? "לקוח לא ידוע",
            reminderAt: reminder.reminderAt,
          });
          await sendCallMeBot(msg);
          await storage.markReminderWhatsappNotified(reminder.id);
          console.log(`[WhatsApp] Reminder ${reminder.id} → ✅ sent`);
        } catch (err: any) {
          console.error(`[WhatsApp] Reminder ${reminder.id} error:`, err.message);
        }
      }
    } catch (err: any) {
      console.error("[WhatsApp] Scheduler error:", err.message);
    }
  }, 60_000);

  // ─── Email Reminder Scheduler ─────────────────────────────────────
  // Sends a styled HTML email (template mirrors the lead-notification
  // email) to REMINDER_EMAIL_TO when a reminder comes due.
  setInterval(async () => {
    if (!isEmailConfigured()) {
      (global as any).__lastEmailSchedulerError = "RESEND_API_KEY not set";
      return;
    }
    try {
      const pending = await storage.getPendingEmailReminders();
      if (pending.length === 0) return;
      console.log(`[Email] Scheduler: ${pending.length} pending reminder(s)`);
      for (const reminder of pending) {
        try {
          const client = await storage.getClient(reminder.clientId);
          await sendReminderEmail({
            clientId: reminder.clientId,
            clientName: client?.fullName ?? "לקוח לא ידוע",
            clientPhone: client?.phone ?? null,
            reminderNote: reminder.content,
            scheduledAt: reminder.reminderAt,
          });
          await storage.markReminderEmailNotified(reminder.id);
          console.log(`[Email] Reminder ${reminder.id} → ✅ sent`);
        } catch (err: any) {
          const msg = `Reminder ${reminder.id}: ${err.message}`;
          console.error(`[Email] ${msg}`);
          (global as any).__lastEmailSchedulerError = msg;
        }
      }
    } catch (err: any) {
      console.error("[Email] Scheduler error:", err.message);
      (global as any).__lastEmailSchedulerError = `Scheduler: ${err.message}`;
    }
  }, 60_000);
  // ────────────────────────────────────────────────────────────────
})();
