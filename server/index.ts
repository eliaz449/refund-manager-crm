import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { sendToAllRecipients, formatReminderMessage, logWhatsAppConfig } from "./whatsapp";

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
          const result = await sendToAllRecipients(msg);
          await storage.markReminderWhatsappNotified(reminder.id);
          console.log(`[WhatsApp] Reminder ${reminder.id} → ✓ ${result.sent} sent, ✗ ${result.failed} failed`);
        } catch (err: any) {
          console.error(`[WhatsApp] Reminder ${reminder.id} error:`, err.message);
        }
      }
    } catch (err: any) {
      console.error("[WhatsApp] Scheduler error:", err.message);
    }
  }, 60_000);
  // ────────────────────────────────────────────────────────────────
})();
