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
  const landyPayloadSchema = z.object({
    full_name: z.string().min(1, "full_name is required"),
    phone: z.string().min(1, "phone is required"),
    email: z.string().email("invalid email format"),
    source: z.string().min(1, "source is required"),
    notes: z.string().optional(),
    address: z.string().optional(),
    tax_id: z.string().optional(),
  });

  const VALID_SOURCES = ["referral", "website", "social_media", "direct", "other"] as const;

  app.post("/api/webhooks/landy", async (req, res) => {
    const receivedAt = new Date().toISOString();

    console.log(`[Landy Webhook] Incoming request at ${receivedAt}`);
    console.log(`[Landy Webhook] Payload:`, JSON.stringify(req.body, null, 2));

    const secret = req.headers["x-landy-signature"];
    const expectedSecret = process.env.LANDY_WEBHOOK_SECRET;

    if (!expectedSecret || secret !== expectedSecret) {
      console.warn(`[Landy Webhook] Authentication failed — invalid or missing secret`);
      return res.status(401).json({
        success: false,
        error: "Unauthorized — invalid webhook secret",
      });
    }

    const parsed = landyPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      console.warn(`[Landy Webhook] Validation failed:`, fieldErrors);
      return res.status(400).json({
        success: false,
        error: "Missing or invalid required fields",
        details: fieldErrors,
      });
    }

    const { full_name, phone, email, source, notes, address, tax_id } = parsed.data;

    try {
      const existing = await storage.findClientByPhoneOrEmail(phone, email);

      if (existing) {
        const updated = await storage.updateClient(existing.id, {
          fullName: full_name,
          phone,
          email,
          source: VALID_SOURCES.includes(source as any) ? (source as any) : "other",
          ...(notes && { notes }),
          ...(address && { address }),
          ...(tax_id && { taxId: tax_id }),
        });

        console.log(`[Landy Webhook] Updated existing client: ${existing.id} (${full_name})`);

        // TODO: Optionally create a Task or CommunicationLog for follow-up on returning lead
        // await storage.createTask({ taskName: `Follow up returning lead: ${full_name}`, clientId: existing.id, ... });
        // await storage.createCommunicationLog({ clientId: existing.id, type: "webhook", content: `Lead re-submitted via Landy`, ... });

        return res.status(200).json({
          success: true,
          action: "updated",
          message: `Client already exists — record updated`,
          clientId: existing.id,
          receivedAt,
        });
      }

      const newClient = await storage.createClient({
        fullName: full_name,
        phone,
        email,
        source: VALID_SOURCES.includes(source as any) ? (source as any) : "other",
        status: "lead",
        clientProcessStatus: "lead",
        ...(notes && { notes }),
        ...(address && { address }),
        ...(tax_id && { taxId: tax_id }),
      });

      console.log(`[Landy Webhook] Created new client: ${newClient.id} (${full_name})`);

      // TODO: Auto-create Task for new lead follow-up
      // await storage.createTask({ taskName: `Contact new lead: ${full_name}`, clientId: newClient.id, priority: "high", ... });

      return res.status(200).json({
        success: true,
        action: "created",
        message: "New lead created successfully",
        clientId: newClient.id,
        receivedAt,
      });
    } catch (err: any) {
      console.error(`[Landy Webhook] Internal error:`, err);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  });

  return httpServer;
}
