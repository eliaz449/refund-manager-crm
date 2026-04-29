import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import crypto from "crypto";
import { storage } from "./storage";
import { requireAuth } from "./auth";
import { insertClientSchema, insertCaseSchema, insertTaskSchema, insertPaymentSchema, insertCommunicationLogSchema, insertTransactionSchema, insertClientNoteSchema } from "@shared/schema";
import { sendWhatsAppMessage, sendToAllRecipients, getRecipientPhones, formatNewLeadMessage, formatReminderMessage } from "./whatsapp";

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
    if (client.status === "lead") {
      sendToAllRecipients(formatNewLeadMessage({
        name: client.fullName,
        phone: client.phone ?? "",
        source: client.source ?? "other",
        createdAt: client.createdAt ?? new Date(),
      })).catch(err => console.error("[WhatsApp] Lead notify error:", err));
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

  // ─── Landy Webhook ─────────────────────────────────────────────
  const VALID_SOURCES = ["referral", "website", "social_media", "direct", "other"] as const;
  const maskVal = (s: string | undefined) => s ? `"${s.substring(0, 6)}..." (len=${s.length})` : "(not set)";

  app.post("/api/webhooks/landy", async (req, res) => {
    const receivedAt = new Date().toISOString();
    // Use the original raw bytes that arrived — critical for HMAC verification
    const rawBodyBuffer: Buffer = Buffer.isBuffer((req as any).rawBody)
      ? (req as any).rawBody
      : Buffer.from(JSON.stringify(req.body || {}));
    const rawBodyStr = rawBodyBuffer.toString("utf8");

    const safeHeaders = Object.fromEntries(
      Object.entries(req.headers).filter(([k]) => !["cookie"].includes(k))
    );
    const receivedSignature = typeof req.headers["x-landy-signature"] === "string"
      ? req.headers["x-landy-signature"].trim()
      : undefined;

    // ── STEP 1: Log receipt & save audit record immediately (nothing is lost after this point) ──
    console.log(`[Landy] ── STEP 1: Request received at ${receivedAt}`);
    console.log(`[Landy]    Content-Type: ${req.headers["content-type"]}`);
    console.log(`[Landy]    Body keys: ${JSON.stringify(Object.keys(req.body || {}))}`);
    console.log(`[Landy]    Raw body: ${rawBodyStr.substring(0, 600)}`);

    let auditId: string | undefined;
    try {
      const audit = await storage.createWebhookEvent({
        source: "landy",
        rawHeaders: JSON.stringify(safeHeaders),
        rawBody: rawBodyStr,
        receivedSignature,
        processingStatus: "received",
      });
      auditId = audit.id;
      console.log(`[Landy]    Audit record created: ${auditId}`);
    } catch (auditErr: any) {
      console.error(`[Landy]    WARNING: Could not create audit record: ${auditErr.message}`);
    }

    // ── STEP 2: Authentication (HMAC-SHA256) ──
    // Landy computes: HMAC-SHA256(secret, rawBody) → hex
    const expectedSecret = process.env.LANDY_WEBHOOK_SECRET?.trim();
    console.log(`[Landy] ── STEP 2: Auth check (HMAC-SHA256)`);
    console.log(`[Landy]    Received signature: ${maskVal(receivedSignature)}`);

    if (!expectedSecret) {
      const reason = "LANDY_WEBHOOK_SECRET not configured in env";
      console.warn(`[Landy]    Auth FAILED: ${reason}`);
      if (auditId) await storage.updateWebhookEvent(auditId, { authStatus: "no_secret", processingStatus: "auth_failed", errorMessage: reason });
      return res.status(401).json({ success: false, error: "Unauthorized", reason });
    }

    if (!receivedSignature) {
      const reason = "x-landy-signature header missing from request";
      console.warn(`[Landy]    Auth FAILED: ${reason}`);
      if (auditId) await storage.updateWebhookEvent(auditId, { authStatus: "failed", processingStatus: "auth_failed", errorMessage: reason });
      return res.status(401).json({ success: false, error: "Unauthorized", reason });
    }

    const expectedHmac = crypto
      .createHmac("sha256", expectedSecret)
      .update(rawBodyBuffer)
      .digest("hex");

    console.log(`[Landy]    Computed HMAC   : ${maskVal(expectedHmac)}`);

    const recvBuf = Buffer.from(receivedSignature, "utf8");
    const expBuf  = Buffer.from(expectedHmac, "utf8");
    const signaturesMatch = recvBuf.length === expBuf.length &&
      crypto.timingSafeEqual(recvBuf, expBuf);

    if (!signaturesMatch) {
      const reason = `HMAC mismatch — received ${maskVal(receivedSignature)}, computed ${maskVal(expectedHmac)}`;
      console.warn(`[Landy]    Auth FAILED: ${reason}`);
      if (auditId) await storage.updateWebhookEvent(auditId, { authStatus: "failed", processingStatus: "auth_failed", errorMessage: reason });
      return res.status(401).json({ success: false, error: "Unauthorized", reason });
    }

    console.log(`[Landy]    Auth PASSED`);
    if (auditId) await storage.updateWebhookEvent(auditId, { authStatus: "ok" });

    // ── STEP 3: Payload mapping ──
    console.log(`[Landy] ── STEP 3: Payload mapping`);
    const body = req.body || {};
    const fd = body.form_data || body.formData || body.data || {};

    const full_name  = body.full_name  || body.name      || body.fullName  || fd.full_name  || fd.name      || fd.fullName  || "";
    const phone      = body.phone      || body.telephone  || body.tel       || fd.phone      || fd.telephone  || fd.tel       || "";
    const email      = body.email      || body.mail       || fd.email       || fd.mail       || "";
    const page_name  = body.page_name  || body.pageName   || fd.page_name   || fd.pageName   || "";
    const rawSource  = body.source     || body.utm_source || fd.source      || "landy";
    const notes      = body.notes      || body.message    || body.comment   || fd.notes      || fd.message    || fd.comment   || (page_name ? `דף נחיתה: ${page_name}` : "");
    const address    = body.address    || fd.address      || "";
    const tax_id     = body.tax_id     || body.taxId      || fd.tax_id      || fd.taxId      || "";

    const normalized = { full_name, phone, email, source: rawSource, page_name, notes, address, tax_id };
    console.log(`[Landy]    Mapped payload: ${JSON.stringify(normalized)}`);
    if (auditId) await storage.updateWebhookEvent(auditId, { normalizedPayload: JSON.stringify(normalized) });

    // ── STEP 4: Validation ──
    console.log(`[Landy] ── STEP 4: Validation`);
    if (!full_name || !phone) {
      const missing = [...(!full_name ? ["full_name"] : []), ...(!phone ? ["phone"] : [])];
      const msg = `Missing required fields: ${missing.join(", ")}`;
      console.warn(`[Landy]    Validation FAILED — ${msg}`);
      if (auditId) await storage.updateWebhookEvent(auditId, { processingStatus: "validation_failed", errorMessage: msg });
      return res.status(400).json({ success: false, error: msg, missing });
    }
    console.log(`[Landy]    Validation PASSED — name="${full_name}", phone="${phone}"`);

    const source: string = VALID_SOURCES.includes(rawSource as any) ? rawSource : "other";
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
    console.log(`[Landy] ── STEP 5: Database write`);
    try {
      const existing = await storage.findClientByPhoneOrEmail(phone, email || "");

      if (existing) {
        console.log(`[Landy]    Existing client found: ${existing.id} (${existing.fullName}) — updating`);
        const { status, clientProcessStatus, ...updateData } = clientData;
        await storage.updateClient(existing.id, updateData);
        console.log(`[Landy]    SUCCESS — Updated client ${existing.id}`);
        if (auditId) await storage.updateWebhookEvent(auditId, {
          processingStatus: "updated",
          createdClientId: existing.id,
          action: "updated",
        });
        return res.status(200).json({ success: true, action: "updated", clientId: existing.id, receivedAt });
      }

      console.log(`[Landy]    No existing client — creating new lead`);
      const newClient = await storage.createClient(clientData);
      console.log(`[Landy]    SUCCESS — Created lead ${newClient.id} (${newClient.fullName})`);
      if (auditId) await storage.updateWebhookEvent(auditId, {
        processingStatus: "created",
        createdClientId: newClient.id,
        action: "created",
      });
      // WhatsApp notification for new Landy lead (fire-and-forget)
      sendToAllRecipients(formatNewLeadMessage({
        name: newClient.fullName,
        phone: newClient.phone ?? phone,
        source: "landy",
        createdAt: newClient.createdAt ?? new Date(),
      })).catch(err => console.error("[WhatsApp] Landy lead notify error:", err));
      return res.status(200).json({ success: true, action: "created", clientId: newClient.id, receivedAt });

    } catch (err: any) {
      const errMsg = `DB error: ${err.message}`;
      console.error(`[Landy]    DATABASE ERROR: ${err.message}`);
      if (auditId) await storage.updateWebhookEvent(auditId, { processingStatus: "db_error", errorMessage: errMsg });
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // ─── Webhook Events (audit log viewer) ─────────────────────────
  app.get("/api/webhook-events", requireAuth, async (_req, res) => {
    const events = await storage.getWebhookEvents(200);
    res.json(events);
  });

  // ─── WhatsApp Test Endpoint ──────────────────────────────────────
  app.post("/api/test-whatsapp", requireAuth, async (req, res) => {
    const phones = getRecipientPhones();
    if (phones.length === 0) {
      return res.status(400).json({ success: false, error: "No recipients configured. Set WHATSAPP_RECIPIENT_PHONES env var." });
    }
    const message = [
      "✅ בדיקת חיבור WhatsApp — TaxPro CRM",
      `זמן: ${new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}`,
      "המערכת מחוברת ועובדת!",
    ].join("\n");
    const result = await sendToAllRecipients(message);
    console.log(`[WhatsApp] Test broadcast: ${result.sent} sent, ${result.failed} failed`);
    res.json({ success: result.sent > 0, sent: result.sent, failed: result.failed, recipients: phones.length });
  });
  // ────────────────────────────────────────────────────────────────

  return httpServer;
}
