import { eq, desc, sql, and, or, count, isNull, isNotNull } from "drizzle-orm";
import { db } from "./db";
import {
  users, clients, cases, tasks, payments, communicationLogs, transactions, passwordResetTokens, clientNotes, webhookEvents, reminders,
  partnerLeads, partnerLeadActivities, documents, portalSessions, portalDocUploads,
  type User, type InsertUser,
  type Document, type InsertDocument,
  type Client, type InsertClient,
  type Case, type InsertCase,
  type Task, type InsertTask,
  type Payment, type InsertPayment,
  type CommunicationLog, type InsertCommunicationLog,
  type Transaction, type InsertTransaction,
  type ClientNote, type InsertClientNote,
  type WebhookEvent, type InsertWebhookEvent,
  type Reminder, type InsertReminder,
  type PartnerLead, type InsertPartnerLead,
  type PartnerLeadActivity, type InsertPartnerLeadActivity,
  type PortalSession, type InsertPortalSession,
  type PortalDocUpload, type InsertPortalDocUpload,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(id: string, passwordHash: string): Promise<void>;
  createResetToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  getValidResetToken(token: string): Promise<{ id: string; userId: string; token: string; expiresAt: Date } | undefined>;
  markResetTokenUsed(id: string): Promise<void>;
  getUsers(): Promise<User[]>;

  getClients(): Promise<Client[]>;
  getDeletedClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  findClientByPhoneOrEmail(phone?: string, email?: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<void>;
  restoreClient(id: string): Promise<Client | undefined>;

  getCases(): Promise<Case[]>;
  getCase(id: string): Promise<Case | undefined>;
  getCasesByClient(clientId: string): Promise<Case[]>;
  createCase(c: InsertCase): Promise<Case>;
  updateCase(id: string, c: Partial<InsertCase>): Promise<Case | undefined>;
  deleteCase(id: string): Promise<void>;

  getTasks(): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  getTasksByClient(clientId: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<void>;

  getPayments(): Promise<Payment[]>;
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentsByClient(clientId: string): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, payment: Partial<InsertPayment>): Promise<Payment | undefined>;
  deletePayment(id: string): Promise<void>;

  getCommunicationLogs(clientId: string): Promise<CommunicationLog[]>;
  createCommunicationLog(log: InsertCommunicationLog): Promise<CommunicationLog>;

  getTransactions(): Promise<Transaction[]>;
  getTransactionsByClient(clientId: string): Promise<Transaction[]>;
  createTransaction(tx: InsertTransaction): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;

  getClientNotes(clientId: string): Promise<ClientNote[]>;
  createClientNote(note: InsertClientNote): Promise<ClientNote>;
  updateClientNote(id: string, content: string): Promise<ClientNote | undefined>;
  deleteClientNote(id: string): Promise<void>;

  getDashboardStats(): Promise<{
    totalLeads: number;
    activeClients: number;
    openCases: number;
    totalRevenue: number;
    totalExpenses: number;
    pendingTasks: number;
  }>;

  createWebhookEvent(event: Partial<InsertWebhookEvent>): Promise<WebhookEvent>;
  updateWebhookEvent(id: string, update: Partial<InsertWebhookEvent>): Promise<void>;
  getWebhookEvents(limit?: number): Promise<WebhookEvent[]>;

  getRemindersByClient(clientId: string): Promise<Reminder[]>;
  getActiveReminders(): Promise<Reminder[]>;
  getAllUpcomingReminders(): Promise<Reminder[]>;
  createReminder(reminder: InsertReminder): Promise<Reminder>;
  updateReminder(id: string, update: Partial<InsertReminder>): Promise<Reminder | undefined>;
  deleteReminder(id: string): Promise<void>;
  getPendingWhatsappReminders(): Promise<Reminder[]>;
  markReminderWhatsappNotified(id: string): Promise<void>;
  getPendingEmailReminders(): Promise<Reminder[]>;
  markReminderEmailNotified(id: string): Promise<void>;

  getPartnerLeads(partnerId?: string): Promise<PartnerLead[]>;
  getPartnerLead(id: string): Promise<PartnerLead | undefined>;
  createPartnerLead(lead: InsertPartnerLead): Promise<PartnerLead>;
  updatePartnerLead(id: string, update: Partial<InsertPartnerLead>): Promise<PartnerLead | undefined>;
  deletePartnerLead(id: string): Promise<void>;
  getPartnerLeadActivities(partnerLeadId?: string): Promise<PartnerLeadActivity[]>;
  createPartnerLeadActivity(activity: InsertPartnerLeadActivity): Promise<PartnerLeadActivity>;

  getDocumentsByClient(clientId: string): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  createDocument(doc: InsertDocument): Promise<Document>;
  deleteDocument(id: string): Promise<void>;

  createPortalSession(session: InsertPortalSession): Promise<PortalSession>;
  getPortalSession(id: string): Promise<PortalSession | undefined>;
  getPortalSessionByToken(token: string): Promise<PortalSession | undefined>;
  getPortalSessionsByClient(clientId: string): Promise<PortalSession[]>;
  getAllPortalSessions(): Promise<PortalSession[]>;
  updatePortalSession(id: string, update: Partial<InsertPortalSession>): Promise<PortalSession | undefined>;

  createPortalDocUpload(upload: InsertPortalDocUpload): Promise<PortalDocUpload>;
  getPortalDocUpload(id: string): Promise<PortalDocUpload | undefined>;
  getPortalDocUploads(portalSessionId: string): Promise<PortalDocUpload[]>;
  getPortalDocUploadsByClient(clientId: string): Promise<PortalDocUpload[]>;
  deletePortalDocUpload(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUserPassword(id: string, passwordHash: string): Promise<void> {
    await db.update(users).set({ passwordHash }).where(eq(users.id, id));
  }

  async createResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await db.insert(passwordResetTokens).values({ userId, token, expiresAt });
  }

  async getValidResetToken(token: string) {
    const [row] = await db.select().from(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.token, token),
        eq(passwordResetTokens.used, false),
        sql`${passwordResetTokens.expiresAt} > NOW()`
      ));
    return row ? { id: row.id, userId: row.userId, token: row.token, expiresAt: row.expiresAt } : undefined;
  }

  async markResetTokenUsed(id: string): Promise<void> {
    await db.update(passwordResetTokens).set({ used: true }).where(eq(passwordResetTokens.id, id));
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getClients(): Promise<Client[]> {
    return db.select().from(clients)
      .where(isNull(clients.deletedAt))
      .orderBy(desc(clients.createdAt));
  }

  async getDeletedClients(): Promise<Client[]> {
    return db.select().from(clients)
      .where(isNotNull(clients.deletedAt))
      .orderBy(desc(clients.deletedAt));
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async findClientByPhoneOrEmail(phone?: string, email?: string): Promise<Client | undefined> {
    if (!phone && !email) return undefined;
    const matchConditions = [];
    if (phone) matchConditions.push(eq(clients.phone, phone));
    if (email) matchConditions.push(eq(clients.email, email));
    const [client] = await db.select().from(clients)
      .where(and(isNull(clients.deletedAt), or(...matchConditions)))
      .limit(1);
    return client;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [created] = await db.insert(clients).values(client).returning();
    return created;
  }

  async updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined> {
    const [updated] = await db.update(clients)
      .set({ ...client, updatedAt: new Date() })
      .where(and(eq(clients.id, id), isNull(clients.deletedAt)))
      .returning();
    return updated;
  }

  async deleteClient(id: string): Promise<void> {
    await db.update(clients)
      .set({ deletedAt: new Date() } as any)
      .where(eq(clients.id, id));
  }

  async restoreClient(id: string): Promise<Client | undefined> {
    const [restored] = await db.update(clients)
      .set({ deletedAt: null, updatedAt: new Date() } as any)
      .where(eq(clients.id, id))
      .returning();
    return restored;
  }

  async getCases(): Promise<Case[]> {
    return db.select().from(cases).orderBy(desc(cases.createdAt));
  }

  async getCase(id: string): Promise<Case | undefined> {
    const [c] = await db.select().from(cases).where(eq(cases.id, id));
    return c;
  }

  async getCasesByClient(clientId: string): Promise<Case[]> {
    return db.select().from(cases).where(eq(cases.clientId, clientId)).orderBy(desc(cases.createdAt));
  }

  async createCase(c: InsertCase): Promise<Case> {
    const [created] = await db.insert(cases).values(c).returning();
    return created;
  }

  async updateCase(id: string, c: Partial<InsertCase>): Promise<Case | undefined> {
    const [updated] = await db.update(cases).set({ ...c, updatedAt: new Date() }).where(eq(cases.id, id)).returning();
    return updated;
  }

  async deleteCase(id: string): Promise<void> {
    await db.delete(cases).where(eq(cases.id, id));
  }

  async getTasks(): Promise<Task[]> {
    return db.select().from(tasks).orderBy(desc(tasks.createdAt));
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async getTasksByClient(clientId: string): Promise<Task[]> {
    return db.select().from(tasks).where(eq(tasks.clientId, clientId)).orderBy(desc(tasks.createdAt));
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [created] = await db.insert(tasks).values(task).returning();
    return created;
  }

  async updateTask(id: string, task: Partial<InsertTask>): Promise<Task | undefined> {
    const [updated] = await db.update(tasks).set({ ...task, updatedAt: new Date() }).where(eq(tasks.id, id)).returning();
    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async getPayments(): Promise<Payment[]> {
    return db.select().from(payments).orderBy(desc(payments.createdAt));
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment;
  }

  async getPaymentsByClient(clientId: string): Promise<Payment[]> {
    return db.select().from(payments).where(eq(payments.clientId, clientId)).orderBy(desc(payments.createdAt));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [created] = await db.insert(payments).values(payment).returning();
    return created;
  }

  async updatePayment(id: string, payment: Partial<InsertPayment>): Promise<Payment | undefined> {
    const [updated] = await db.update(payments).set(payment).where(eq(payments.id, id)).returning();
    return updated;
  }

  async deletePayment(id: string): Promise<void> {
    await db.delete(payments).where(eq(payments.id, id));
  }

  async getCommunicationLogs(clientId: string): Promise<CommunicationLog[]> {
    return db.select().from(communicationLogs).where(eq(communicationLogs.clientId, clientId)).orderBy(desc(communicationLogs.date));
  }

  async createCommunicationLog(log: InsertCommunicationLog): Promise<CommunicationLog> {
    const [created] = await db.insert(communicationLogs).values(log).returning();
    return created;
  }

  async getTransactions(): Promise<Transaction[]> {
    return db.select().from(transactions).orderBy(desc(transactions.createdAt));
  }

  async getTransactionsByClient(clientId: string): Promise<Transaction[]> {
    return db.select().from(transactions).where(eq(transactions.clientId, clientId)).orderBy(desc(transactions.createdAt));
  }

  async createTransaction(tx: InsertTransaction): Promise<Transaction> {
    const [created] = await db.insert(transactions).values(tx).returning();
    return created;
  }

  async deleteTransaction(id: string): Promise<void> {
    await db.delete(transactions).where(eq(transactions.id, id));
  }

  async getClientNotes(clientId: string): Promise<ClientNote[]> {
    return db.select().from(clientNotes).where(eq(clientNotes.clientId, clientId)).orderBy(desc(clientNotes.createdAt));
  }

  async createClientNote(note: InsertClientNote): Promise<ClientNote> {
    const [created] = await db.insert(clientNotes).values(note).returning();
    return created;
  }

  async updateClientNote(id: string, content: string): Promise<ClientNote | undefined> {
    const [updated] = await db.update(clientNotes).set({ content, updatedAt: new Date() }).where(eq(clientNotes.id, id)).returning();
    return updated;
  }

  async deleteClientNote(id: string): Promise<void> {
    await db.delete(clientNotes).where(eq(clientNotes.id, id));
  }

  async createWebhookEvent(event: Partial<InsertWebhookEvent>): Promise<WebhookEvent> {
    const [created] = await db.insert(webhookEvents).values(event as InsertWebhookEvent).returning();
    return created;
  }

  async updateWebhookEvent(id: string, update: Partial<InsertWebhookEvent>): Promise<void> {
    await db.update(webhookEvents).set(update).where(eq(webhookEvents.id, id));
  }

  async getWebhookEvents(limit = 100): Promise<WebhookEvent[]> {
    return db.select().from(webhookEvents).orderBy(desc(webhookEvents.receivedAt)).limit(limit);
  }

  async getRemindersByClient(clientId: string): Promise<Reminder[]> {
    return db.select().from(reminders)
      .where(and(eq(reminders.clientId, clientId), eq(reminders.isDismissed, false)))
      .orderBy(reminders.reminderAt);
  }

  async getActiveReminders(): Promise<Reminder[]> {
    return db.select().from(reminders)
      .where(and(
        eq(reminders.isDismissed, false),
        sql`(${reminders.snoozedUntil} IS NULL OR ${reminders.snoozedUntil} <= NOW())`,
        sql`${reminders.reminderAt} <= NOW() + INTERVAL '1 minute'`
      ))
      .orderBy(reminders.reminderAt);
  }

  async getAllUpcomingReminders(): Promise<Reminder[]> {
    return db.select().from(reminders)
      .where(eq(reminders.isDismissed, false))
      .orderBy(reminders.reminderAt);
  }

  async createReminder(reminder: InsertReminder): Promise<Reminder> {
    const [created] = await db.insert(reminders).values(reminder).returning();
    return created;
  }

  async updateReminder(id: string, update: Partial<InsertReminder>): Promise<Reminder | undefined> {
    const [updated] = await db.update(reminders).set(update).where(eq(reminders.id, id)).returning();
    return updated;
  }

  async deleteReminder(id: string): Promise<void> {
    await db.delete(reminders).where(eq(reminders.id, id));
  }

  async getPendingWhatsappReminders(): Promise<Reminder[]> {
    return db.select().from(reminders)
      .where(and(
        eq(reminders.isDismissed, false),
        eq(reminders.whatsappNotified, false),
        sql`${reminders.reminderAt} <= NOW()`,
        sql`(${reminders.snoozedUntil} IS NULL OR ${reminders.snoozedUntil} <= NOW())`
      ))
      .orderBy(reminders.reminderAt);
  }

  async markReminderWhatsappNotified(id: string): Promise<void> {
    await db.update(reminders).set({ whatsappNotified: true }).where(eq(reminders.id, id));
  }

  async getPendingEmailReminders(): Promise<Reminder[]> {
    return db.select().from(reminders)
      .where(and(
        eq(reminders.isDismissed, false),
        eq(reminders.emailNotified, false),
        sql`${reminders.reminderAt} <= NOW()`,
        sql`(${reminders.snoozedUntil} IS NULL OR ${reminders.snoozedUntil} <= NOW())`
      ))
      .orderBy(reminders.reminderAt);
  }

  async markReminderEmailNotified(id: string): Promise<void> {
    await db.update(reminders).set({ emailNotified: true }).where(eq(reminders.id, id));
  }

  async getDashboardStats() {
    const [leadCount] = await db.select({ count: count() }).from(clients).where(and(eq(clients.status, "lead"), isNull(clients.deletedAt)));
    const [activeCount] = await db.select({ count: count() }).from(clients).where(and(eq(clients.status, "active"), isNull(clients.deletedAt)));
    const [openCaseCount] = await db.select({ count: count() }).from(cases).where(
      and(
        sql`${cases.status} NOT IN ('completed', 'cancelled')`
      )
    );
    const [pendingTaskCount] = await db.select({ count: count() }).from(tasks).where(
      sql`${tasks.status} != 'completed'`
    );
    const [revenueResult] = await db.select({ total: sql<string>`COALESCE(SUM(${transactions.amount}::numeric), 0)` }).from(transactions).where(eq(transactions.type, "income"));
    const [expenseResult] = await db.select({ total: sql<string>`COALESCE(SUM(${transactions.amount}::numeric), 0)` }).from(transactions).where(eq(transactions.type, "expense"));

    return {
      totalLeads: leadCount.count,
      activeClients: activeCount.count,
      openCases: openCaseCount.count,
      totalRevenue: parseFloat(revenueResult.total || "0"),
      totalExpenses: parseFloat(expenseResult.total || "0"),
      pendingTasks: pendingTaskCount.count,
    };
  }

  async getPartnerLeads(partnerId?: string): Promise<PartnerLead[]> {
    if (partnerId) {
      return db.select().from(partnerLeads).where(eq(partnerLeads.partnerId, partnerId)).orderBy(desc(partnerLeads.createdAt));
    }
    return db.select().from(partnerLeads).orderBy(desc(partnerLeads.createdAt));
  }

  async getPartnerLead(id: string): Promise<PartnerLead | undefined> {
    const [row] = await db.select().from(partnerLeads).where(eq(partnerLeads.id, id));
    return row;
  }

  async createPartnerLead(lead: InsertPartnerLead): Promise<PartnerLead> {
    const [created] = await db.insert(partnerLeads).values(lead).returning();
    return created;
  }

  async updatePartnerLead(id: string, update: Partial<InsertPartnerLead>): Promise<PartnerLead | undefined> {
    const [updated] = await db.update(partnerLeads).set({ ...update, updatedAt: new Date() }).where(eq(partnerLeads.id, id)).returning();
    return updated;
  }

  async deletePartnerLead(id: string): Promise<void> {
    await db.delete(partnerLeads).where(eq(partnerLeads.id, id));
  }

  async getPartnerLeadActivities(partnerLeadId?: string): Promise<PartnerLeadActivity[]> {
    if (partnerLeadId) {
      return db.select().from(partnerLeadActivities).where(eq(partnerLeadActivities.partnerLeadId, partnerLeadId)).orderBy(desc(partnerLeadActivities.createdAt));
    }
    return db.select().from(partnerLeadActivities).orderBy(desc(partnerLeadActivities.createdAt));
  }

  async createPartnerLeadActivity(activity: InsertPartnerLeadActivity): Promise<PartnerLeadActivity> {
    const [created] = await db.insert(partnerLeadActivities).values(activity).returning();
    return created;
  }

  async getDocumentsByClient(clientId: string): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.clientId, clientId)).orderBy(desc(documents.createdAt));
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [row] = await db.select().from(documents).where(eq(documents.id, id));
    return row;
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const [created] = await db.insert(documents).values(doc).returning();
    return created;
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async createPortalSession(session: InsertPortalSession): Promise<PortalSession> {
    const [created] = await db.insert(portalSessions).values(session).returning();
    return created;
  }

  async getPortalSession(id: string): Promise<PortalSession | undefined> {
    const [row] = await db.select().from(portalSessions).where(eq(portalSessions.id, id));
    return row;
  }

  async getPortalSessionByToken(token: string): Promise<PortalSession | undefined> {
    const [row] = await db.select().from(portalSessions).where(eq(portalSessions.token, token));
    return row;
  }

  async getPortalSessionsByClient(clientId: string): Promise<PortalSession[]> {
    return db.select().from(portalSessions)
      .where(eq(portalSessions.clientId, clientId))
      .orderBy(desc(portalSessions.createdAt));
  }

  async getAllPortalSessions(): Promise<PortalSession[]> {
    return db.select().from(portalSessions).orderBy(desc(portalSessions.createdAt));
  }

  async updatePortalSession(id: string, update: Partial<InsertPortalSession>): Promise<PortalSession | undefined> {
    const [updated] = await db.update(portalSessions).set(update).where(eq(portalSessions.id, id)).returning();
    return updated;
  }

  async createPortalDocUpload(upload: InsertPortalDocUpload): Promise<PortalDocUpload> {
    const [created] = await db.insert(portalDocUploads).values(upload).returning();
    return created;
  }

  async getPortalDocUpload(id: string): Promise<PortalDocUpload | undefined> {
    const [row] = await db.select().from(portalDocUploads).where(eq(portalDocUploads.id, id));
    return row;
  }

  async getPortalDocUploads(portalSessionId: string): Promise<PortalDocUpload[]> {
    return db.select().from(portalDocUploads)
      .where(eq(portalDocUploads.portalSessionId, portalSessionId))
      .orderBy(desc(portalDocUploads.uploadedAt));
  }

  async getPortalDocUploadsByClient(clientId: string): Promise<PortalDocUpload[]> {
    return db.select().from(portalDocUploads)
      .where(eq(portalDocUploads.clientId, clientId))
      .orderBy(desc(portalDocUploads.uploadedAt));
  }

  async deletePortalDocUpload(id: string): Promise<void> {
    await db.delete(portalDocUploads).where(eq(portalDocUploads.id, id));
  }
}

export const storage = new DatabaseStorage();
