import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { formatReminderMessage, logWhatsAppConfig } from "./whatsapp";
import { sendReminderEmail, isEmailConfigured } from "./email";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ─── Security headers (H-6) ───────────────────────────────────────────
// Vite dev needs 'unsafe-inline' / 'unsafe-eval', so only enforce a strict CSP
// in production. HSTS + noSniff + frameguard apply everywhere.
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === "production"
        ? {
            useDefaults: true,
            directives: {
              "default-src": ["'self'"],
              "script-src": ["'self'"],
              "style-src": ["'self'", "'unsafe-inline'"],
              "img-src": ["'self'", "data:", "https:"],
              "connect-src": ["'self'", "https://refund-manager-crm-production.up.railway.app"],
              "frame-ancestors": ["'none'"],
              "object-src": ["'none'"],
              "base-uri": ["'self'"],
            },
          }
        : false,
    crossOriginEmbedderPolicy: false,
    hsts: process.env.NODE_ENV === "production" ? { maxAge: 15552000, includeSubDomains: true } : false,
  }),
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// ─── Rate limiters (H-2, H-3, M-6) ────────────────────────────────────
// Login brute-force cap. Failed AND successful attempts count, so an attacker
// can't hide via "successful" test logins.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "יותר מדי ניסיונות התחברות. נסה שוב בעוד 15 דקות." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(["/api/auth/login", "/api/auth/reset-password", "/api/auth/forgot-password"], loginLimiter);

// Webhook flood protection — per IP. Attackers who don't have the HMAC secret
// still cause DB inserts into webhook_events at the current design; capping the
// hit-rate limits the audit-table growth attack.
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(["/api/webhooks/lead", "/api/webhooks/landy"], webhookLimiter);

// Public error sink used to be unbounded — cap it hard.
const clientErrorLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });
app.use("/api/client-error", clientErrorLimiter);

// Generic API limiter as belt-and-suspenders for everything else.
const genericLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/api/health" || req.path === "/api/version",
});
app.use("/api", genericLimiter);

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
      const logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      // NEVER log response bodies in production — GET /api/clients would dump the
      // entire client DB (tax IDs, phones, refund amounts) to Railway stdout.
      // Only expose short metadata in non-production for debugging.
      if (process.env.NODE_ENV !== "production" && capturedJsonResponse && !path.startsWith("/api/auth")) {
        const summary = Array.isArray(capturedJsonResponse)
          ? `array(${capturedJsonResponse.length})`
          : `keys=${Object.keys(capturedJsonResponse).slice(0, 5).join(",")}`;
        log(`${logLine} :: ${summary}`);
      } else {
        log(logLine);
      }
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

  // Debug endpoints — auth-gated. Owner only, and only outside production.
  // Previously these were open to the internet and leaked reminder PII + let
  // anyone drain the Resend quota. Kept for local development, disabled in prod.
  const { requireOwner } = await import("./auth");
  const debugGuard = (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEBUG_ENDPOINTS !== "true") {
      return res.status(404).json({ error: "not found" });
    }
    return requireOwner(req, res, next);
  };

  app.get("/api/debug/email-reminder-status", debugGuard, async (_req, res) => {
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
      res.status(500).json({ error: "internal error" });
    }
  });

  // Debug: send a test reminder email immediately without touching the
  // reminders table. Verifies the Resend pipeline works end-to-end.
  app.post("/api/debug/send-test-email", debugGuard, async (_req, res) => {
    try {
      const { sendReminderEmail, isEmailConfigured } = await import("./email");
      if (!isEmailConfigured()) {
        return res.status(503).json({ error: "RESEND_API_KEY not set" });
      }
      await sendReminderEmail({
        clientId: "test",
        clientName: "בדיקת מערכת",
        clientPhone: "0500000000",
        reminderNote: "זוהי בדיקה אוטומטית של מערכת התזכורות. אם הגיע המייל הזה — הכל עובד תקין!",
        scheduledAt: new Date(),
      });
      res.json({ ok: true, sentTo: process.env.REMINDER_EMAIL_TO ?? "edenabergel94@gmail.com" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Debug: send a specific existing reminder NOW, regardless of its time.
  app.post("/api/debug/send-reminder-now/:id", debugGuard, async (req, res) => {
    try {
      const { storage } = await import("./storage");
      const { sendReminderEmail, isEmailConfigured } = await import("./email");
      const { db } = await import("./db");
      const { reminders } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      if (!isEmailConfigured()) return res.status(503).json({ error: "RESEND_API_KEY not set" });
      const [reminder] = await db.select().from(reminders).where(eq(reminders.id, req.params.id));
      if (!reminder) return res.status(404).json({ error: "reminder not found" });
      const client = await storage.getClient(reminder.clientId);
      await sendReminderEmail({
        clientId: reminder.clientId,
        clientName: client?.fullName ?? "לקוח",
        clientPhone: client?.phone ?? null,
        reminderNote: reminder.content,
        scheduledAt: reminder.reminderAt,
      });
      await storage.markReminderEmailNotified(reminder.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Debug: force-trigger the email scheduler ONCE — picks up all pending
  // reminders right now without waiting for the next 60s tick.
  app.post("/api/debug/run-email-scheduler", debugGuard, async (_req, res) => {
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
      res.status(500).json({ error: "internal error" });
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

          // Push through Gmail Agent bot (WhatsApp) - only path
          const gaUrl = process.env.GMAIL_AGENT_WEBHOOK_URL;
          const gaSecret = process.env.GMAIL_AGENT_WEBHOOK_SECRET;
          if (!gaUrl || !gaSecret) {
            console.error(`[Reminder] ${reminder.id} — GMAIL_AGENT_WEBHOOK_URL/SECRET not set, skipping`);
            continue;
          }
          const crypto = await import("crypto");
          const payload = JSON.stringify({
            event: "reminder_due",
            reminder: {
              id: reminder.id,
              client_id: reminder.clientId,
              content: reminder.content,
              reminder_at: reminder.reminderAt,
            },
            client: client ? { id: client.id, fullName: client.fullName, phone: client.phone } : null,
            text: msg,
          });
          const signature = crypto.createHmac("sha256", gaSecret).update(payload).digest("hex");
          const gaRes = await fetch(`${gaUrl}/webhook/refund-lead`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Refund-Signature": signature },
            body: payload,
          });
          if (!gaRes.ok) {
            console.error(`[Reminder] ${reminder.id} — Gmail Agent returned ${gaRes.status}`);
            continue;
          }
          await storage.markReminderWhatsappNotified(reminder.id);
          console.log(`[WhatsApp] Reminder ${reminder.id} → ✅ via Gmail Agent`);
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
