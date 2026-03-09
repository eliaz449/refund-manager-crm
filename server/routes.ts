import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { insertClientSchema, insertCaseSchema, insertTaskSchema, insertPaymentSchema, insertCommunicationLogSchema, insertTransactionSchema } from "@shared/schema";

const partialClientSchema = insertClientSchema.partial();
const partialCaseSchema = insertCaseSchema.partial();
const partialTaskSchema = insertTaskSchema.partial();
const partialPaymentSchema = insertPaymentSchema.partial();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/dashboard/stats", async (_req, res) => {
    const stats = await storage.getDashboardStats();
    res.json(stats);
  });

  app.get("/api/users", async (_req, res) => {
    const users = await storage.getUsers();
    res.json(users.map(u => ({ ...u, passwordHash: undefined })));
  });

  app.get("/api/clients", async (_req, res) => {
    const clients = await storage.getClients();
    res.json(clients);
  });

  app.get("/api/clients/:id", async (req, res) => {
    const client = await storage.getClient(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    res.json(client);
  });

  app.post("/api/clients", async (req, res) => {
    const parsed = insertClientSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const client = await storage.createClient(parsed.data);
    res.status(201).json(client);
  });

  app.patch("/api/clients/:id", async (req, res) => {
    const parsed = partialClientSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateClient(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Client not found" });
    res.json(updated);
  });

  app.delete("/api/clients/:id", async (req, res) => {
    await storage.deleteClient(req.params.id);
    res.status(204).send();
  });

  app.get("/api/cases", async (_req, res) => {
    const allCases = await storage.getCases();
    res.json(allCases);
  });

  app.get("/api/cases/:id", async (req, res) => {
    const c = await storage.getCase(req.params.id);
    if (!c) return res.status(404).json({ message: "Case not found" });
    res.json(c);
  });

  app.get("/api/clients/:clientId/cases", async (req, res) => {
    const clientCases = await storage.getCasesByClient(req.params.clientId);
    res.json(clientCases);
  });

  app.post("/api/cases", async (req, res) => {
    const parsed = insertCaseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const c = await storage.createCase(parsed.data);
    res.status(201).json(c);
  });

  app.patch("/api/cases/:id", async (req, res) => {
    const parsed = partialCaseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateCase(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Case not found" });
    res.json(updated);
  });

  app.delete("/api/cases/:id", async (req, res) => {
    await storage.deleteCase(req.params.id);
    res.status(204).send();
  });

  app.get("/api/tasks", async (_req, res) => {
    const allTasks = await storage.getTasks();
    res.json(allTasks);
  });

  app.get("/api/tasks/:id", async (req, res) => {
    const task = await storage.getTask(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(task);
  });

  app.get("/api/clients/:clientId/tasks", async (req, res) => {
    const clientTasks = await storage.getTasksByClient(req.params.clientId);
    res.json(clientTasks);
  });

  app.post("/api/tasks", async (req, res) => {
    const parsed = insertTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const task = await storage.createTask(parsed.data);
    res.status(201).json(task);
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    const parsed = partialTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateTask(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Task not found" });
    res.json(updated);
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    await storage.deleteTask(req.params.id);
    res.status(204).send();
  });

  app.get("/api/payments", async (_req, res) => {
    const allPayments = await storage.getPayments();
    res.json(allPayments);
  });

  app.get("/api/payments/:id", async (req, res) => {
    const payment = await storage.getPayment(req.params.id);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    res.json(payment);
  });

  app.get("/api/clients/:clientId/payments", async (req, res) => {
    const clientPayments = await storage.getPaymentsByClient(req.params.clientId);
    res.json(clientPayments);
  });

  app.post("/api/payments", async (req, res) => {
    const parsed = insertPaymentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const payment = await storage.createPayment(parsed.data);
    res.status(201).json(payment);
  });

  app.patch("/api/payments/:id", async (req, res) => {
    const parsed = partialPaymentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updatePayment(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Payment not found" });
    res.json(updated);
  });

  app.delete("/api/payments/:id", async (req, res) => {
    await storage.deletePayment(req.params.id);
    res.status(204).send();
  });

  app.get("/api/clients/:clientId/communications", async (req, res) => {
    const logs = await storage.getCommunicationLogs(req.params.clientId);
    res.json(logs);
  });

  app.post("/api/communications", async (req, res) => {
    const parsed = insertCommunicationLogSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const log = await storage.createCommunicationLog(parsed.data);
    res.status(201).json(log);
  });

  app.get("/api/transactions", async (_req, res) => {
    const allTx = await storage.getTransactions();
    res.json(allTx);
  });

  app.get("/api/clients/:clientId/transactions", async (req, res) => {
    const clientTx = await storage.getTransactionsByClient(req.params.clientId);
    res.json(clientTx);
  });

  app.post("/api/transactions", async (req, res) => {
    const parsed = insertTransactionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const tx = await storage.createTransaction(parsed.data);
    res.status(201).json(tx);
  });

  app.delete("/api/transactions/:id", async (req, res) => {
    await storage.deleteTransaction(req.params.id);
    res.status(204).send();
  });

  // ─── Landy Webhook ─────────────────────────────────────────────
  const VALID_SOURCES = ["referral", "website", "social_media", "direct", "other"] as const;

  app.post("/api/webhooks/landy", async (req, res) => {
    const receivedAt = new Date().toISOString();
    const body = req.body || {};
    const formData = body.form_data || body.formData || {};

    console.log(`\n========== [Landy Webhook DEBUG MODE] ==========`);
    console.log(`[Landy Webhook] Incoming request at ${receivedAt}`);
    console.log(`[Landy Webhook] ALL HEADERS:`, JSON.stringify(req.headers, null, 2));
    console.log(`[Landy Webhook] x-landy-signature raw value: "${req.headers["x-landy-signature"]}"`);
    console.log(`[Landy Webhook] x-landy-signature length: ${typeof req.headers["x-landy-signature"] === "string" ? req.headers["x-landy-signature"].length : "N/A"}`);
    console.log(`[Landy Webhook] FULL BODY:`, JSON.stringify(body, null, 2));
    console.log(`[Landy Webhook] FULL BODY KEYS:`, Object.keys(body));
    console.log(`[Landy Webhook] form_data KEYS:`, Object.keys(formData));
    console.log(`[Landy Webhook] Content-Type: ${req.headers["content-type"]}`);

    const full_name = body.full_name || body.name || body.fullName || formData.full_name || formData.name || formData.fullName || "";
    const phone = body.phone || body.telephone || body.tel || formData.phone || formData.telephone || formData.tel || "";
    const email = body.email || body.mail || formData.email || formData.mail || "";
    const rawSource = body.source || body.page_name || body.pageName || body.utm_source || formData.source || formData.page_name || "landy";
    const notes = body.notes || body.message || body.comment || formData.notes || formData.message || formData.comment || "";
    const address = body.address || formData.address || "";
    const tax_id = body.tax_id || body.taxId || formData.tax_id || formData.taxId || "";

    console.log(`[Landy Webhook] MAPPED FIELDS:`);
    console.log(`  full_name = "${full_name}"`);
    console.log(`  phone     = "${phone}"`);
    console.log(`  email     = "${email}"`);
    console.log(`  source    = "${rawSource}"`);
    console.log(`  notes     = "${notes}"`);
    console.log(`  address   = "${address}"`);
    console.log(`  tax_id    = "${tax_id}"`);

    if (!full_name || !phone) {
      const missing = [];
      if (!full_name) missing.push("full_name (tried: body.full_name, body.name, body.fullName, form_data.full_name, form_data.name)");
      if (!phone) missing.push("phone (tried: body.phone, body.telephone, body.tel, form_data.phone, form_data.telephone)");
      console.warn(`[Landy Webhook] MISSING REQUIRED FIELDS: ${missing.join(", ")}`);
      console.log(`========== [END DEBUG] ==========\n`);
      return res.status(200).json({
        success: false,
        error: "Missing required fields",
        missing,
        receivedAt,
        debug_body_keys: Object.keys(body),
        debug_form_data_keys: Object.keys(formData),
      });
    }

    const source: string = VALID_SOURCES.includes(rawSource as any) ? rawSource : "other";

    const clientData = {
      fullName: full_name,
      phone,
      email: email || undefined,
      source: source as any,
      status: "lead" as const,
      clientProcessStatus: "lead" as const,
      ...(notes && { notes }),
      ...(address && { address }),
      ...(tax_id && { taxId: tax_id }),
    };

    console.log(`[Landy Webhook] CLIENT DATA TO SAVE:`, JSON.stringify(clientData, null, 2));

    try {
      const existing = await storage.findClientByPhoneOrEmail(phone, email || "");
      console.log(`[Landy Webhook] EXISTING CLIENT LOOKUP: ${existing ? `found id=${existing.id}` : "not found"}`);

      if (existing) {
        const { status, clientProcessStatus, ...updateData } = clientData;
        await storage.updateClient(existing.id, updateData);
        console.log(`[Landy Webhook] RESULT: UPDATED existing client id=${existing.id} name="${full_name}"`);
        console.log(`========== [END DEBUG] ==========\n`);
        return res.status(200).json({
          success: true,
          action: "updated",
          message: `Client already exists — record updated`,
          clientId: existing.id,
          receivedAt,
        });
      }

      const newClient = await storage.createClient(clientData);
      console.log(`[Landy Webhook] RESULT: CREATED new client id=${newClient.id} name="${full_name}"`);
      console.log(`========== [END DEBUG] ==========\n`);
      return res.status(200).json({
        success: true,
        action: "created",
        message: "New lead created successfully",
        clientId: newClient.id,
        receivedAt,
      });
    } catch (err: any) {
      console.error(`[Landy Webhook] DATABASE ERROR:`, err.message || err);
      console.error(`[Landy Webhook] FULL ERROR:`, JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
      console.log(`========== [END DEBUG] ==========\n`);
      return res.status(200).json({
        success: false,
        error: "Internal server error",
        debug_error: err.message,
        receivedAt,
      });
    }
  });

  return httpServer;
}
