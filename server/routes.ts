import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import crypto from "crypto";
import { storage } from "./storage";
import { requireAuth, requireOwner, requirePartner } from "./auth";
import { insertClientSchema, insertCaseSchema, insertTaskSchema, insertPaymentSchema, insertCommunicationLogSchema, insertTransactionSchema, insertClientNoteSchema, insertPartnerLeadSchema } from "@shared/schema";
import { sendCallMeBot, formatNewLeadMessage, formatReminderMessage, isLeadAlreadyNotified, markLeadNotified } from "./whatsapp";

const partialClientSchema = insertClientSchema.partial();
const partialCaseSchema = insertCaseSchema.partial();
const partialTaskSchema = insertTaskSchema.partial();
const partialPaymentSchema = insertPaymentSchema.partial();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/client-error", async (req, res) => {
    const { source, message, stack, componentStack } = req.body ?? {};
    console.error(`[ClientError:${source}] ${message}\n${stack ?? ""}\n${componentStack ?? ""}`);
    res.json({ ok: true });
  });

  app.get("/api/dashboard/stats", requireAuth, async (_req, res) => {
    const stats = await storage.getDashboardStats();
    res.json(stats);
  });

  app.get("/api/users", requireAuth, async (_req, res) => {
    const users = await storage.getUsers();
    res.json(users.map(u => ({ ...u, passwordHash: undefined })));
  });

  app.get("/api/clients", requireAuth, async (_req, res) => {
    const clients = await storage.getClients();
    res.json(clients);
  });

  app.get("/api/clients/:id", requireAuth, async (req, res) => {
    const client = await storage.getClient(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    res.json(client);
  });

  app.post("/api/clients", requireAuth, async (req, res) => {
    const parsed = insertClientSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const client = await storage.createClient(parsed.data);
    res.status(201).json(client);
    // Send WhatsApp notification for new leads (fire-and-forget, never blocks response)
    console.log(`[WhatsApp:Lead] Client created — id=${client.id}, status=${client.status}, name=${client.fullName}`);
    if (client.status === "lead") {
      if (isLeadAlreadyNotified(client.id)) {
        console.log(`[WhatsApp:Lead] ⚠️  Skipping duplicate — id=${client.id} already notified`);
      } else {
        markLeadNotified(client.id);
        const msg = formatNewLeadMessage({
          name: client.fullName,
          phone: client.phone ?? "",
          source: client.source ?? "other",
          createdAt: client.createdAt ?? new Date(),
        });
        sendCallMeBot(msg).catch(err => console.error("[WhatsApp:Lead] ❌ Error:", err));
      }
    } else {
      console.log(`[WhatsApp:Lead] Status='${client.status}' — no WA (only sent for 'lead')`);
    }
  });

  app.patch("/api/clients/:id", requireAuth, async (req, res) => {
    const body = { ...req.body };
    if (typeof body.firstContactAt === "string") body.firstContactAt = new Date(body.firstContactAt);
    if (typeof body.lastContactAt === "string") body.lastContactAt = new Date(body.lastContactAt);
    const parsed = partialClientSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateClient(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Client not found" });
    res.json(updated);
  });

  app.post("/api/clients/:id/contact-attempt", requireAuth, async (req, res) => {
    const client = await storage.getClient(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });

    const newAttempts = (client.contactAttempts || 0) + 1;
    const now = new Date();
    const statusMap: Record<number, string> = {
      1: "no_answer_1", 2: "no_answer_2", 3: "no_answer_3",
      4: "no_answer_4", 5: "no_answer_5", 6: "no_answer_6",
    };
    const newContactStatus = statusMap[newAttempts] || "no_answer_6";

    const updateData: Record<string, any> = {
      contactAttempts: newAttempts,
      lastContactAt: now,
      contactStatus: newContactStatus,
    };

    const updated = await storage.updateClient(req.params.id, updateData);
    res.json(updated);
  });

  app.delete("/api/clients/:id", requireAuth, async (req, res) => {
    await storage.deleteClient(req.params.id);
    res.status(204).send();
  });

  app.get("/api/cases", requireAuth, async (_req, res) => {
    const allCases = await storage.getCases();
    res.json(allCases);
  });

  app.get("/api/cases/:id", requireAuth, async (req, res) => {
    const c = await storage.getCase(req.params.id);
    if (!c) return res.status(404).json({ message: "Case not found" });
    res.json(c);
  });

  app.get("/api/clients/:clientId/cases", requireAuth, async (req, res) => {
    const clientCases = await storage.getCasesByClient(req.params.clientId);
    res.json(clientCases);
  });

  app.post("/api/cases", requireAuth, async (req, res) => {
    const parsed = insertCaseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const c = await storage.createCase(parsed.data);
    res.status(201).json(c);
  });

  app.patch("/api/cases/:id", requireAuth, async (req, res) => {
    const parsed = partialCaseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateCase(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Case not found" });
    res.json(updated);
  });

  app.delete("/api/cases/:id", requireAuth, async (req, res) => {
    await storage.deleteCase(req.params.id);
    res.status(204).send();
  });

  app.get("/api/tasks", requireAuth, async (_req, res) => {
    const allTasks = await storage.getTasks();
    res.json(allTasks);
  });

  app.get("/api/tasks/:id", requireAuth, async (req, res) => {
    const task = await storage.getTask(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(task);
  });

  app.get("/api/clients/:clientId/tasks", requireAuth, async (req, res) => {
    const clientTasks = await storage.getTasksByClient(req.params.clientId);
    res.json(clientTasks);
  });

  app.post("/api/tasks", requireAuth, async (req, res) => {
    const parsed = insertTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const task = await storage.createTask(parsed.data);
    res.status(201).json(task);
  });

  app.patch("/api/tasks/:id", requireAuth, async (req, res) => {
    const parsed = partialTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateTask(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Task not found" });
    res.json(updated);
  });

  app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
    await storage.deleteTask(req.params.id);
    res.status(204).send();
  });

  app.get("/api/payments", requireAuth, async (_req, res) => {
    const allPayments = await storage.getPayments();
    res.json(allPayments);
  });

  app.get("/api/payments/:id", requireAuth, async (req, res) => {
    const payment = await storage.getPayment(req.params.id);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    res.json(payment);
  });

  app.get("/api/clients/:clientId/payments", requireAuth, async (req, res) => {
    const clientPayments = await storage.getPaymentsByClient(req.params.clientId);
    res.json(clientPayments);
  });

  app.post("/api/payments", requireAuth, async (req, res) => {
    const parsed = insertPaymentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const payment = await storage.createPayment(parsed.data);
    res.status(201).json(payment);
  });

  app.patch("/api/payments/:id", requireAuth, async (req, res) => {
    const parsed = partialPaymentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updatePayment(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Payment not found" });
    res.json(updated);
  });

  app.delete("/api/payments/:id", requireAuth, async (req, res) => {
    await storage.deletePayment(req.params.id);
    res.status(204).send();
  });

  app.get("/api/clients/:clientId/communications", requireAuth, async (req, res) => {
    const logs = await storage.getCommunicationLogs(req.params.clientId);
    res.json(logs);
  });

  app.post("/api/communications", requireAuth, async (req, res) => {
    const parsed = insertCommunicationLogSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const log = await storage.createCommunicationLog(parsed.data);
    res.status(201).json(log);
  });

  app.get("/api/transactions", requireAuth, async (_req, res) => {
    const allTx = await storage.getTransactions();
    res.json(allTx);
  });

  app.get("/api/clients/:clientId/transactions", requireAuth, async (req, res) => {
    const clientTx = await storage.getTransactionsByClient(req.params.clientId);
    res.json(clientTx);
  });

  app.post("/api/transactions", requireAuth, async (req, res) => {
    const parsed = insertTransactionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const tx = await storage.createTransaction(parsed.data);
    res.status(201).json(tx);
  });

  app.delete("/api/transactions/:id", requireAuth, async (req, res) => {
    await storage.deleteTransaction(req.params.id);
    res.status(204).send();
  });

  app.get("/api/clients/:clientId/notes", requireAuth, async (req, res) => {
    const notes = await storage.getClientNotes(req.params.clientId);
    res.json(notes);
  });

  app.post("/api/clients/:clientId/notes", requireAuth, async (req, res) => {
    const parsed = insertClientNoteSchema.safeParse({ ...req.body, clientId: req.params.clientId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const note = await storage.createClientNote(parsed.data);
    res.status(201).json(note);
  });

  app.patch("/api/notes/:id", requireAuth, async (req, res) => {
    const { content } = req.body;
    if (!content || typeof content !== "string") return res.status(400).json({ message: "Content is required" });
    const updated = await storage.updateClientNote(req.params.id, content);
    if (!updated) return res.status(404).json({ message: "Note not found" });
    res.json(updated);
  });

  app.delete("/api/notes/:id", requireAuth, async (req, res) => {
    await storage.deleteClientNote(req.params.id);
    res.status(204).send();
  });

  // ─── Reminders ─────────────────────────────────────────────────
  app.get("/api/reminders/active", requireAuth, async (_req, res) => {
    const active = await storage.getActiveReminders();
    res.json(active);
  });

  app.get("/api/clients/:id/reminders", requireAuth, async (req, res) => {
    const items = await storage.getRemindersByClient(req.params.id);
    res.json(items);
  });

  app.get("/api/reminders", requireAuth, async (_req, res) => {
    const all = await storage.getAllUpcomingReminders();
    res.json(all);
  });

  app.post("/api/clients/:id/reminders", requireAuth, async (req, res) => {
    const { content, reminderAt } = req.body;
    if (!content || !reminderAt) return res.status(400).json({ message: "content and reminderAt required" });
    const reminder = await storage.createReminder({
      clientId: req.params.id,
      content,
      reminderAt: new Date(reminderAt),
    });
    res.status(201).json(reminder);
  });

  app.patch("/api/reminders/:id", requireAuth, async (req, res) => {
    const updated = await storage.updateReminder(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: "Reminder not found" });
    res.json(updated);
  });

  app.delete("/api/reminders/:id", requireAuth, async (req, res) => {
    await storage.deleteReminder(req.params.id);
    res.status(204).send();
  });
  // ────────────────────────────────────────────────────────────────

  // ─── Lead Webhook (generic, accepts leads from any landing page) ─────────
  const VALID_SOURCES = ["referral", "website", "social_media", "direct", "other"] as const;
  const maskVal = (s: string | undefined) => s ? `"${s.substring(0, 6)}..." (len=${s.length})` : "(not set)";

  const leadWebhookHandler = async (req: any, res: any) => {
    const receivedAt = new Date().toISOString();
    // Use the original raw bytes that arrived — critical for HMAC verification
    const rawBodyBuffer: Buffer = Buffer.isBuffer((req as any).rawBody)
      ? (req as any).rawBody
      : Buffer.from(JSON.stringify(req.body || {}));
    const rawBodyStr = rawBodyBuffer.toString("utf8");

    const safeHeaders = Object.fromEntries(
      Object.entries(req.headers).filter(([k]) => !["cookie"].includes(k))
    );
    const sigHeader = req.headers["x-lead-signature"] ?? req.headers["x-landy-signature"];
    const receivedSignature = typeof sigHeader === "string" ? sigHeader.trim() : undefined;

    // ── STEP 1: Log receipt & save audit record immediately ──
    console.log(`[Lead] ── STEP 1: Request received at ${receivedAt}`);
    console.log(`[Lead]    Path: ${req.path}`);
    console.log(`[Lead]    Content-Type: ${req.headers["content-type"]}`);
    console.log(`[Lead]    Body keys: ${JSON.stringify(Object.keys(req.body || {}))}`);
    console.log(`[Lead]    Raw body: ${rawBodyStr.substring(0, 600)}`);

    let auditId: string | undefined;
    try {
      const audit = await storage.createWebhookEvent({
        source: "lead",
        rawHeaders: JSON.stringify(safeHeaders),
        rawBody: rawBodyStr,
        receivedSignature,
        processingStatus: "received",
      });
      auditId = audit.id;
      console.log(`[Lead]    Audit record created: ${auditId}`);
    } catch (auditErr: any) {
      console.error(`[Lead]    WARNING: Could not create audit record: ${auditErr.message}`);
    }

    // ── STEP 2: Authentication (HMAC-SHA256) ──
    // Sender computes: HMAC-SHA256(secret, rawBody) → hex
    // Accept LEAD_WEBHOOK_SECRET (preferred) or LANDY_WEBHOOK_SECRET (legacy) for safe cutover.
    const expectedSecret = (process.env.LEAD_WEBHOOK_SECRET ?? process.env.LANDY_WEBHOOK_SECRET)?.trim();
    console.log(`[Lead] ── STEP 2: Auth check (HMAC-SHA256)`);
    console.log(`[Lead]    Received signature: ${maskVal(receivedSignature)}`);

    if (!expectedSecret) {
      const reason = "LEAD_WEBHOOK_SECRET not configured in env";
      console.warn(`[Lead]    Auth FAILED: ${reason}`);
      if (auditId) await storage.updateWebhookEvent(auditId, { authStatus: "no_secret", processingStatus: "auth_failed", errorMessage: reason });
      return res.status(401).json({ success: false, error: "Unauthorized", reason });
    }

    if (!receivedSignature) {
      const reason = "x-lead-signature (or x-landy-signature) header missing from request";
      console.warn(`[Lead]    Auth FAILED: ${reason}`);
      if (auditId) await storage.updateWebhookEvent(auditId, { authStatus: "failed", processingStatus: "auth_failed", errorMessage: reason });
      return res.status(401).json({ success: false, error: "Unauthorized", reason });
    }

    const expectedHmac = crypto
      .createHmac("sha256", expectedSecret)
      .update(rawBodyBuffer)
      .digest("hex");

    console.log(`[Lead]    Computed HMAC   : ${maskVal(expectedHmac)}`);

    const recvBuf = Buffer.from(receivedSignature, "utf8");
    const expBuf  = Buffer.from(expectedHmac, "utf8");
    const signaturesMatch = recvBuf.length === expBuf.length &&
      crypto.timingSafeEqual(recvBuf, expBuf);

    if (!signaturesMatch) {
      const reason = `HMAC mismatch — received ${maskVal(receivedSignature)}, computed ${maskVal(expectedHmac)}`;
      console.warn(`[Lead]    Auth FAILED: ${reason}`);
      if (auditId) await storage.updateWebhookEvent(auditId, { authStatus: "failed", processingStatus: "auth_failed", errorMessage: reason });
      return res.status(401).json({ success: false, error: "Unauthorized", reason });
    }

    console.log(`[Lead]    Auth PASSED`);
    if (auditId) await storage.updateWebhookEvent(auditId, { authStatus: "ok" });

    // ── STEP 3: Payload mapping ──
    console.log(`[Lead] ── STEP 3: Payload mapping`);
    const body = req.body || {};
    const fd = body.form_data || body.formData || body.data || {};

    const full_name  = body.full_name  || body.name      || body.fullName  || fd.full_name  || fd.name      || fd.fullName  || "";
    const phone      = body.phone      || body.telephone  || body.tel       || fd.phone      || fd.telephone  || fd.tel       || "";
    const email      = body.email      || body.mail       || fd.email       || fd.mail       || "";
    const page_name  = body.page_name  || body.pageName   || fd.page_name   || fd.pageName   || "";
    const rawSource  = body.source     || body.utm_source || fd.source      || "website";
    const notes      = body.notes      || body.message    || body.comment   || fd.notes      || fd.message    || fd.comment   || (page_name ? `דף נחיתה: ${page_name}` : "");
    const address    = body.address    || fd.address      || "";
    const tax_id     = body.tax_id     || body.taxId      || fd.tax_id      || fd.taxId      || "";

    const normalized = { full_name, phone, email, source: rawSource, page_name, notes, address, tax_id };
    console.log(`[Lead]    Mapped payload: ${JSON.stringify(normalized)}`);
    if (auditId) await storage.updateWebhookEvent(auditId, { normalizedPayload: JSON.stringify(normalized) });

    // ── STEP 4: Validation ──
    console.log(`[Lead] ── STEP 4: Validation`);
    if (!full_name || !phone) {
      const missing = [...(!full_name ? ["full_name"] : []), ...(!phone ? ["phone"] : [])];
      const msg = `Missing required fields: ${missing.join(", ")}`;
      console.warn(`[Lead]    Validation FAILED — ${msg}`);
      if (auditId) await storage.updateWebhookEvent(auditId, { processingStatus: "validation_failed", errorMessage: msg });
      return res.status(400).json({ success: false, error: msg, missing });
    }
    console.log(`[Lead]    Validation PASSED — name="${full_name}", phone="${phone}"`);

    const source: string = VALID_SOURCES.includes(rawSource as any) ? rawSource : "website";
    const clientData = {
      fullName: full_name,
      phone,
      email: email || undefined,
      source: source as any,
      status: "lead" as const,
      clientProcessStatus: "lead" as const,
      ...(notes    && { notes }),
      ...(address  && { address }),
      ...(tax_id   && { taxId: tax_id }),
    };

    // ── STEP 5: Database write ──
    console.log(`[Lead] ── STEP 5: Database write`);
    try {
      const existing = await storage.findClientByPhoneOrEmail(phone, email || "");

      if (existing) {
        console.log(`[Lead]    Existing client found: ${existing.id} (${existing.fullName}) — updating`);
        const { status, clientProcessStatus, ...updateData } = clientData;
        await storage.updateClient(existing.id, updateData);
        console.log(`[Lead]    SUCCESS — Updated client ${existing.id}`);
        if (auditId) await storage.updateWebhookEvent(auditId, {
          processingStatus: "updated",
          createdClientId: existing.id,
          action: "updated",
        });
        return res.status(200).json({ success: true, action: "updated", clientId: existing.id, receivedAt });
      }

      console.log(`[Lead]    No existing client — creating new lead`);
      const newClient = await storage.createClient(clientData);
      console.log(`[Lead]    SUCCESS — Created lead ${newClient.id} (${newClient.fullName})`);
      if (auditId) await storage.updateWebhookEvent(auditId, {
        processingStatus: "created",
        createdClientId: newClient.id,
        action: "created",
      });
      // WhatsApp notification for new lead (fire-and-forget, deduped)
      console.log(`[WhatsApp:Lead] Lead id=${newClient.id}, name=${newClient.fullName}`);
      if (isLeadAlreadyNotified(newClient.id)) {
        console.log(`[WhatsApp:Lead] ⚠️  Skipping duplicate — id=${newClient.id} already notified`);
      } else {
        markLeadNotified(newClient.id);
        const msg = formatNewLeadMessage({
          name: newClient.fullName,
          phone: newClient.phone ?? phone,
          source: source,
          createdAt: newClient.createdAt ?? new Date(),
        });
        sendCallMeBot(msg).catch(err => console.error("[WhatsApp:Lead] ❌ Error:", err));
      }
      return res.status(200).json({ success: true, action: "created", clientId: newClient.id, receivedAt });

    } catch (err: any) {
      const errMsg = `DB error: ${err.message}`;
      console.error(`[Lead]    DATABASE ERROR: ${err.message}`);
      if (auditId) await storage.updateWebhookEvent(auditId, { processingStatus: "db_error", errorMessage: errMsg });
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

  // Primary endpoint for new landing pages
  app.post("/api/webhooks/lead", leadWebhookHandler);
  // Legacy alias — kept so existing senders (old Landy integration) keep working
  app.post("/api/webhooks/landy", leadWebhookHandler);

  // ─── Webhook Events (audit log viewer) ─────────────────────────
  app.get("/api/webhook-events", requireAuth, async (_req, res) => {
    const events = await storage.getWebhookEvents(200);
    res.json(events);
  });

  // ─── Twilio WhatsApp Inbound ─────────────────────────────────────
  // Public — Twilio calls this when user sends a WhatsApp message to the sandbox
  app.post("/api/twilio/whatsapp-inbound", async (req, res) => {
    const msgBody: string = (req.body.Body ?? "").trim();
    const from: string = req.body.From ?? "";
    console.log(`[WhatsApp:Bot] From=${from} Body="${msgBody}"`);

    const ownerPhone = process.env.WHATSAPP_OWNER_PHONE?.trim();
    if (ownerPhone) {
      const fromDigits = from.replace(/\D/g, "");
      const ownerDigits = ownerPhone.replace(/\D/g, "");
      if (!fromDigits.endsWith(ownerDigits) && !ownerDigits.endsWith(fromDigits)) {
        console.warn(`[WhatsApp:Bot] Unauthorized sender: ${from}`);
        return res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
      }
    }

    const reply = await handleWhatsAppCommand(msgBody);
    res.type("text/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(reply)}</Message></Response>`
    );
  });

  function escapeXml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  async function handleWhatsAppCommand(body: string): Promise<string> {
    const cmd = body.trim();
    const cmdLower = cmd.toLowerCase();

    if (cmdLower === "עזרה" || cmdLower === "help" || cmd === "?") {
      return [
        "📋 *פקודות זמינות:*",
        "",
        "• *סטטוס* — סטטיסטיקות המערכת",
        "• *לידים* — 5 הלידים האחרונים",
        "• *לקוחות* — לקוחות פעילים",
        "• *חפש [שם]* — חיפוש לקוח לפי שם",
        "• *עזרה* — תפריט זה",
      ].join("\n");
    }

    if (cmdLower === "סטטוס" || cmdLower === "סטטיסטיקות") {
      try {
        const stats = await storage.getDashboardStats();
        return [
          "📊 *TaxPro CRM — סטטוס*",
          `🔥 לידים: ${stats.totalLeads}`,
          `✅ לקוחות פעילים: ${stats.activeClients}`,
          `📁 תיקים פתוחים: ${stats.openCases}`,
          `📋 משימות ממתינות: ${stats.pendingTasks}`,
          `💰 הכנסות: ₪${Number(stats.totalRevenue).toLocaleString("he-IL")}`,
        ].join("\n");
      } catch { return "❌ שגיאה בטעינת סטטיסטיקות"; }
    }

    if (cmdLower === "לידים" || cmdLower === "רשימת לידים") {
      try {
        const all = await storage.getClients();
        const leads = all
          .filter(c => c.status === "lead")
          .sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime())
          .slice(0, 5);
        if (leads.length === 0) return "📭 אין לידים פתוחים כרגע";
        const lines = leads.map((l, i) => `${i + 1}. ${l.fullName} — ${l.phone ?? "ללא טלפון"}`);
        return ["🔥 *5 הלידים האחרונים:*", ...lines].join("\n");
      } catch { return "❌ שגיאה בטעינת לידים"; }
    }

    if (cmdLower === "לקוחות") {
      try {
        const all = await storage.getClients();
        const active = all.filter(c => c.status === "active");
        if (active.length === 0) return "📭 אין לקוחות פעילים";
        const preview = active.slice(0, 5).map((c, i) => `${i + 1}. ${c.fullName}`);
        return [`👥 *לקוחות פעילים (${active.length} סה"כ):*`, ...preview].join("\n");
      } catch { return "❌ שגיאה בטעינת לקוחות"; }
    }

    const searchMatch = cmd.match(/^חפש\s+(.+)/i);
    if (searchMatch) {
      const query = searchMatch[1].trim().toLowerCase();
      try {
        const all = await storage.getClients();
        const results = all.filter(c => c.fullName.toLowerCase().includes(query)).slice(0, 5);
        if (results.length === 0) return `🔍 לא נמצאו תוצאות עבור "${searchMatch[1].trim()}"`;
        const lines = results.map(c => `• ${c.fullName} — ${c.status} — ${c.phone ?? "ללא טלפון"}`);
        return [`🔍 *תוצאות עבור "${searchMatch[1].trim()}":*`, ...lines].join("\n");
      } catch { return "❌ שגיאה בחיפוש"; }
    }

    return `❓ לא הבנתי. שלח *עזרה* לרשימת הפקודות.`;
  }
  // ────────────────────────────────────────────────────────────────

  // ─── Partner Dashboard ───────────────────────────────────────────
  // Owner endpoints (admin/user/accountant)
  app.get("/api/partners", requireOwner, async (_req, res) => {
    const allUsers = await storage.getUsers();
    const partners = allUsers.filter(u => u.role === "partner").map(u => ({
      id: u.id, fullName: u.fullName, email: u.email, createdAt: u.createdAt,
    }));
    res.json(partners);
  });

  app.get("/api/partner-leads", requireOwner, async (req, res) => {
    const partnerId = (req.query.partnerId as string) || undefined;
    const leads = await storage.getPartnerLeads(partnerId);
    res.json(leads);
  });

  app.get("/api/partner-leads/:id/activities", requireOwner, async (req, res) => {
    const activities = await storage.getPartnerLeadActivities(req.params.id);
    res.json(activities);
  });

  app.get("/api/partner-activities", requireOwner, async (_req, res) => {
    const activities = await storage.getPartnerLeadActivities();
    res.json(activities.slice(0, 100));
  });

  // Owner shares an existing client OR raw lead with a partner
  app.post("/api/partner-leads/share", requireOwner, async (req, res) => {
    const { partnerId, clientId, fullName, phone, email, notes } = req.body ?? {};
    if (!partnerId) return res.status(400).json({ message: "partnerId חובה" });

    let leadData: any = { partnerId, source: "owner_shared", notes };
    if (clientId) {
      const client = await storage.getClient(clientId);
      if (!client) return res.status(404).json({ message: "לקוח לא נמצא" });
      leadData = { ...leadData, clientId: client.id, fullName: client.fullName, phone: client.phone, email: client.email };
    } else {
      if (!fullName) return res.status(400).json({ message: "fullName חובה" });
      leadData = { ...leadData, fullName, phone, email };
    }

    const lead = await storage.createPartnerLead(leadData);
    await storage.createPartnerLeadActivity({
      partnerLeadId: lead.id,
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      actorRole: "owner",
      action: "lead_shared",
      details: `הליד "${lead.fullName}" שותף עם השותף`,
    });
    res.json(lead);
  });

  // Partner endpoints
  app.get("/api/partner/leads", requirePartner, async (req, res) => {
    const leads = await storage.getPartnerLeads(req.user!.id);
    res.json(leads);
  });

  app.post("/api/partner/leads", requirePartner, async (req, res) => {
    const { fullName, phone, email, notes } = req.body ?? {};
    if (!fullName) return res.status(400).json({ message: "שם מלא חובה" });

    const lead = await storage.createPartnerLead({
      partnerId: req.user!.id,
      fullName, phone, email, notes,
      source: "partner_added",
      status: "new",
    });
    await storage.createPartnerLeadActivity({
      partnerLeadId: lead.id,
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      actorRole: "partner",
      action: "lead_added",
      details: `השותף הוסיף ליד חדש: "${lead.fullName}"`,
    });
    res.json(lead);
  });

  app.patch("/api/partner/leads/:id", requirePartner, async (req, res) => {
    const existing = await storage.getPartnerLead(req.params.id);
    if (!existing) return res.status(404).json({ message: "ליד לא נמצא" });
    if (existing.partnerId !== req.user!.id) return res.status(403).json({ message: "אין הרשאה" });

    const { status, notes, phone, email, fullName } = req.body ?? {};
    const update: any = {};
    if (status !== undefined) update.status = status;
    if (notes !== undefined) update.notes = notes;
    if (phone !== undefined) update.phone = phone;
    if (email !== undefined) update.email = email;
    if (fullName !== undefined) update.fullName = fullName;

    const updated = await storage.updatePartnerLead(req.params.id, update);

    if (status !== undefined && status !== existing.status) {
      await storage.createPartnerLeadActivity({
        partnerLeadId: existing.id,
        actorId: req.user!.id,
        actorName: req.user!.fullName,
        actorRole: "partner",
        action: "status_changed",
        details: `סטטוס עודכן: ${existing.status} → ${status}`,
      });
    }
    if (notes !== undefined && notes !== existing.notes) {
      await storage.createPartnerLeadActivity({
        partnerLeadId: existing.id,
        actorId: req.user!.id,
        actorName: req.user!.fullName,
        actorRole: "partner",
        action: "note_added",
        details: notes ? `הערה עודכנה: "${(notes as string).slice(0, 200)}"` : "הערה נמחקה",
      });
    }
    res.json(updated);
  });

  app.get("/api/partner/leads/:id/activities", requirePartner, async (req, res) => {
    const lead = await storage.getPartnerLead(req.params.id);
    if (!lead || lead.partnerId !== req.user!.id) return res.status(404).json({ message: "ליד לא נמצא" });
    const activities = await storage.getPartnerLeadActivities(req.params.id);
    res.json(activities);
  });
  // ────────────────────────────────────────────────────────────────

  // ─── WhatsApp Test Endpoint ──────────────────────────────────────
  app.post("/api/test-whatsapp", requireAuth, async (req, res) => {
    const phone  = process.env.CALLMEBOT_PHONE?.trim();
    const apikey = process.env.CALLMEBOT_APIKEY?.trim();
    if (!phone || !apikey) {
      return res.status(400).json({ success: false, error: "CALLMEBOT_PHONE or CALLMEBOT_APIKEY not configured." });
    }
    const message = [
      "✅ בדיקת חיבור WhatsApp — TaxPro CRM",
      `זמן: ${new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}`,
      "המערכת מחוברת ועובדת!",
    ].join("\n");
    try {
      await sendCallMeBot(message);
      res.json({ success: true });
    } catch (err: any) {
      res.json({ success: false, error: err.message });
    }
  });
  // ────────────────────────────────────────────────────────────────

  return httpServer;
}
