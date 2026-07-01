import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, numeric, boolean, timestamp, date, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["admin", "user", "accountant", "partner"]);
export const partnerLeadStatusEnum = pgEnum("partner_lead_status", [
  "new", "contacted", "interested", "not_interested", "in_progress", "closed_won", "closed_lost"
]);
export const partnerLeadSourceEnum = pgEnum("partner_lead_source", ["owner_shared", "partner_added"]);
export const partnerActivityActionEnum = pgEnum("partner_activity_action", [
  "lead_shared", "lead_added", "status_changed", "note_added", "lead_updated"
]);
export const clientTypeEnum = pgEnum("client_type", ["private_individual", "self_employed"]);
export const clientStatusEnum = pgEnum("client_status", ["lead", "active", "inactive"]);
export const clientProcessStatusEnum = pgEnum("client_process_status", [
  "lead", "initial_process", "waiting_for_documents", "ready_for_case_opening",
  "in_treatment", "transferred_to_accountant", "ready_for_submission",
  "submitted_to_tax_authority", "paid_and_closed", "not_relevant"
]);
export const leadStatusEnum = pgEnum("lead_status", [
  "answered", "not_answered_1", "not_answered_2", "closed_deal", "paid_opening_fee", "not_relevant"
]);
export const sourceEnum = pgEnum("source", ["referral", "website", "social_media", "direct", "other", "recommended"]);
export const pricingTypeEnum = pgEnum("pricing_type", ["percentage", "fixed", "hourly"]);
export const contactStatusEnum = pgEnum("contact_status", [
  "new", "no_answer_1", "no_answer_2", "no_answer_3", "no_answer_4", "no_answer_5", "no_answer_6",
  "talked", "sent_documents", "in_process", "closed", "not_relevant",
  "not_interested", "wrong_info", "next_year"
]);
export const refundStageEnum = pgEnum("refund_stage", [
  "details_received", "waiting_documents", "document_review",
  "submitted_to_tax", "in_treatment", "approved", "paid"
]);
export const formTypeEnum = pgEnum("form_type", ["135", "1301", "other"]);
export const serviceTypeEnum = pgEnum("service_type", [
  "tax_refund", "bookkeeping", "annual_report", "quarterly_report",
  "vat_report", "business_registration", "consultation", "other"
]);
export const approvalStatusEnum = pgEnum("approval_status", ["in_progress", "submitted", "approved", "rejected"]);
export const caseStatusEnum = pgEnum("case_status", [
  "new", "document_collection", "in_progress", "review",
  "submitted", "pending_tax_authority", "completed", "cancelled"
]);
export const priorityEnum = pgEnum("priority", ["low", "medium", "high"]);
export const taskStatusEnum = pgEnum("task_status", ["not_started", "in_progress", "completed"]);
export const taskCategoryEnum = pgEnum("task_category", [
  "tax_return", "document_collection", "client_communication", "vat_report",
  "monthly_report", "quarterly_report", "annual_report", "advance_tax_payment",
  "social_security_payment", "bookkeeping_update", "invoice_preparation",
  "expense_tracking", "business_registration", "license_renewal",
  "audit_preparation", "consultation", "other"
]);
export const recurrenceTypeEnum = pgEnum("recurrence_type", ["none", "monthly", "quarterly", "yearly"]);
export const paymentMethodEnum = pgEnum("payment_method", ["credit_card", "bank_transfer", "check", "cash", "other"]);
export const paymentStatusEnum = pgEnum("payment_status", ["paid", "pending", "cancelled"]);
export const communicationTypeEnum = pgEnum("communication_type", ["phone", "email", "whatsapp"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["income", "expense"]);
export const documentCategoryEnum = pgEnum("document_category", [
  "id_card", "form_1301", "form_135", "tax_authority_letter",
  "bank_statement", "salary_slip", "tax_certificate", "other"
]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  clientType: clientTypeEnum("client_type").notNull().default("private_individual"),
  phone: text("phone"),
  email: text("email"),
  taxId: text("tax_id"),
  dateOfBirth: date("date_of_birth"),
  idIssueDate: date("id_issue_date"),
  idDocumentNumber: text("id_document_number"),
  refundPaidToClient: numeric("refund_paid_to_client"),
  // Free-text status (replaces visible enums in UI — old enums kept for compat)
  customStatus: text("custom_status"),
  // Refund tracking — per client (one tax case)
  refundEstimateAmount: numeric("refund_estimate_amount"),
  submissionDate: date("submission_date"),
  commissionAmount: numeric("commission_amount"),
  receiptDate: date("receipt_date"),
  // Pensions — 6 years back check. JSON array of checked years (strings), e.g. ["2020","2022"].
  pensionYearsChecked: text("pension_years_checked"),
  // Reason text when contactStatus = not_relevant (free text from a dialog)
  notRelevantReason: text("not_relevant_reason"),
  // Soft delete — set when client is "deleted", null = active
  deletedAt: timestamp("deleted_at"),
  // Year notes: JSON {"2021": "הוגש", "2022": "..."} — 6 years per client
  yearNotes: text("year_notes"),
  address: text("address"),
  status: clientStatusEnum("status").notNull().default("lead"),
  clientProcessStatus: clientProcessStatusEnum("client_process_status").default("lead"),
  leadStatus: leadStatusEnum("lead_status").default("answered"),
  source: sourceEnum("source").default("direct"),
  notes: text("notes"),
  communicationLog: text("communication_log"),
  recommendedBy: text("recommended_by"),
  pricingType: pricingTypeEnum("pricing_type"),
  agreedPercentage: numeric("agreed_percentage"),
  agreedFixedAmount: numeric("agreed_fixed_amount"),
  contactStatus: contactStatusEnum("contact_status").default("new"),
  contactAttempts: integer("contact_attempts").default(0),
  firstContactAt: timestamp("first_contact_at"),
  lastContactAt: timestamp("last_contact_at"),
  closedDate: date("closed_date"),
  refundStage: refundStageEnum("refund_stage"),
  onboardingDate: date("onboarding_date"),
  lastCallDate: date("last_call_date"),
  assignedAccountantId: varchar("assigned_accountant_id"),
  clientDeclarationSigned: boolean("client_declaration_signed").default(false),
  leadCriteria: text("lead_criteria"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: text("created_by"),
});

export const cases = pgTable("cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  taxYear: integer("tax_year"),
  formType: formTypeEnum("form_type").default("other"),
  serviceType: serviceTypeEnum("service_type").notNull().default("tax_refund"),
  refundEstimate: numeric("refund_estimate"),
  submissionDate: date("submission_date"),
  openingDate: date("opening_date"),
  approvalStatus: approvalStatusEnum("approval_status").default("in_progress"),
  status: caseStatusEnum("status").notNull().default("new"),
  priority: priorityEnum("priority").default("medium"),
  assignedTo: varchar("assigned_to"),
  notes: text("notes"),
  totalPaid: numeric("total_paid"),
  hourlyRate: numeric("hourly_rate"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: text("created_by"),
});

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskName: text("task_name").notNull(),
  clientId: varchar("client_id"),
  caseId: varchar("case_id"),
  assignedTo: varchar("assigned_to"),
  dueDate: date("due_date"),
  status: taskStatusEnum("status").notNull().default("not_started"),
  priority: priorityEnum("priority").default("medium"),
  notes: text("notes"),
  taskCategory: taskCategoryEnum("task_category").default("other"),
  recurrenceType: recurrenceTypeEnum("recurrence_type").default("none"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: text("created_by"),
});

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  caseId: varchar("case_id"),
  paymentDate: date("payment_date"),
  amount: numeric("amount").notNull(),
  paymentMethod: paymentMethodEnum("payment_method").default("bank_transfer"),
  status: paymentStatusEnum("payment_status").notNull().default("pending"),
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: text("created_by"),
});

export const communicationLogs = pgTable("communication_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: communicationTypeEnum("type").notNull(),
  date: timestamp("date").defaultNow(),
  content: text("content"),
  handlerId: varchar("handler_id"),
  clientId: varchar("client_id").notNull(),
  followUpRequired: boolean("follow_up_required").default(false),
  followUpDate: date("follow_up_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  caseId: varchar("case_id"),
  transactionDate: date("transaction_date"),
  type: transactionTypeEnum("type").notNull(),
  category: text("category"),
  description: text("description"),
  amount: numeric("amount").notNull(),
  currency: text("currency").default("ILS"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clientNotes = pgTable("client_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  content: text("content").notNull(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Reminders ──────────────────────────────────────────────────
export const reminders = pgTable("reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  content: text("content").notNull(),
  reminderAt: timestamp("reminder_at").notNull(),
  snoozedUntil: timestamp("snoozed_until"),
  isDismissed: boolean("is_dismissed").default(false),
  whatsappNotified: boolean("whatsapp_notified").default(false),
  emailNotified: boolean("email_notified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertReminderSchema = createInsertSchema(reminders).omit({ id: true, createdAt: true });
export type InsertReminder = z.infer<typeof insertReminderSchema>;
export type Reminder = typeof reminders.$inferSelect;
// ────────────────────────────────────────────────────────────────

// ─── Webhook Audit Log ──────────────────────────────────────────
export const webhookAuthStatusEnum = pgEnum("webhook_auth_status", ["ok", "failed", "no_secret"]);
export const webhookProcessStatusEnum = pgEnum("webhook_process_status", [
  "received", "auth_failed", "validation_failed", "db_error", "created", "updated"
]);

export const webhookEvents = pgTable("webhook_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  receivedAt: timestamp("received_at").defaultNow(),
  source: text("source").default("landy"),
  rawHeaders: text("raw_headers"),
  rawBody: text("raw_body"),
  receivedSignature: text("received_signature"),
  normalizedPayload: text("normalized_payload"),
  authStatus: webhookAuthStatusEnum("auth_status"),
  processingStatus: webhookProcessStatusEnum("processing_status").default("received"),
  errorMessage: text("error_message"),
  createdClientId: varchar("created_client_id"),
  action: text("action"),
});

export const insertWebhookEventSchema = createInsertSchema(webhookEvents).omit({ id: true, receivedAt: true });
export type InsertWebhookEvent = z.infer<typeof insertWebhookEventSchema>;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
// ────────────────────────────────────────────────────────────────

// ─── Partner Dashboard ──────────────────────────────────────────
export const partnerLeads = pgTable("partner_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").notNull(),
  clientId: varchar("client_id"),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  status: partnerLeadStatusEnum("status").notNull().default("new"),
  notes: text("notes"),
  source: partnerLeadSourceEnum("source").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const partnerLeadActivities = pgTable("partner_lead_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerLeadId: varchar("partner_lead_id").notNull(),
  actorId: varchar("actor_id").notNull(),
  actorName: text("actor_name").notNull(),
  actorRole: text("actor_role").notNull(),
  action: partnerActivityActionEnum("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Documents ──────────────────────────────────────────────────
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  fileName: text("file_name").notNull(),
  storagePath: text("storage_path").notNull(),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  category: documentCategoryEnum("category").default("other"),
  uploadedBy: varchar("uploaded_by"),
  uploadedByName: text("uploaded_by_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
// ────────────────────────────────────────────────────────────────

export const insertPartnerLeadSchema = createInsertSchema(partnerLeads).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPartnerLead = z.infer<typeof insertPartnerLeadSchema>;
export type PartnerLead = typeof partnerLeads.$inferSelect;

export const insertPartnerLeadActivitySchema = createInsertSchema(partnerLeadActivities).omit({ id: true, createdAt: true });
export type InsertPartnerLeadActivity = z.infer<typeof insertPartnerLeadActivitySchema>;
export type PartnerLeadActivity = typeof partnerLeadActivities.$inferSelect;
// ────────────────────────────────────────────────────────────────

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export const insertCaseSchema = createInsertSchema(cases).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true });
export const insertCommunicationLogSchema = createInsertSchema(communicationLogs).omit({ id: true, createdAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export const insertClientNoteSchema = createInsertSchema(clientNotes).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertCase = z.infer<typeof insertCaseSchema>;
export type Case = typeof cases.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertCommunicationLog = z.infer<typeof insertCommunicationLogSchema>;
export type CommunicationLog = typeof communicationLogs.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertClientNote = z.infer<typeof insertClientNoteSchema>;
export type ClientNote = typeof clientNotes.$inferSelect;
