import { eq, desc, sql, and, or, count } from "drizzle-orm";
import { db } from "./db";
import {
  users, clients, cases, tasks, payments, communicationLogs, transactions,
  type User, type InsertUser,
  type Client, type InsertClient,
  type Case, type InsertCase,
  type Task, type InsertTask,
  type Payment, type InsertPayment,
  type CommunicationLog, type InsertCommunicationLog,
  type Transaction, type InsertTransaction,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;

  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  findClientByPhoneOrEmail(phone?: string, email?: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<void>;

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

  getDashboardStats(): Promise<{
    totalLeads: number;
    activeClients: number;
    openCases: number;
    totalRevenue: number;
    totalExpenses: number;
    pendingTasks: number;
  }>;
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

  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getClients(): Promise<Client[]> {
    return db.select().from(clients).orderBy(desc(clients.createdAt));
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async findClientByPhoneOrEmail(phone?: string, email?: string): Promise<Client | undefined> {
    const conditions = [];
    if (phone) conditions.push(eq(clients.phone, phone));
    if (email) conditions.push(eq(clients.email, email));
    if (conditions.length === 0) return undefined;
    const [client] = await db.select().from(clients).where(or(...conditions)).limit(1);
    return client;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [created] = await db.insert(clients).values(client).returning();
    return created;
  }

  async updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined> {
    const [updated] = await db.update(clients).set({ ...client, updatedAt: new Date() }).where(eq(clients.id, id)).returning();
    return updated;
  }

  async deleteClient(id: string): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
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

  async getDashboardStats() {
    const [leadCount] = await db.select({ count: count() }).from(clients).where(eq(clients.status, "lead"));
    const [activeCount] = await db.select({ count: count() }).from(clients).where(eq(clients.status, "active"));
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
}

export const storage = new DatabaseStorage();
