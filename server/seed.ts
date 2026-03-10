import { db } from "./db";
import { users, clients, cases, tasks, payments, transactions } from "@shared/schema";
import { eq, count } from "drizzle-orm";
import bcrypt from "bcryptjs";

const INITIAL_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD || "TaxPro2026!";

async function ensureUser(fullName: string, email: string, role: "admin" | "user" | "accountant") {
  const passwordHash = await bcrypt.hash(INITIAL_PASSWORD, 12);
  const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  if (existing.length > 0) {
    const matches = await bcrypt.compare(INITIAL_PASSWORD, existing[0].passwordHash);
    if (!matches) {
      await db.update(users).set({ passwordHash }).where(eq(users.id, existing[0].id));
      console.log(`Reset password for: ${fullName} (${email})`);
    }
    return existing[0];
  }
  const [created] = await db.insert(users).values({
    fullName,
    email: email.toLowerCase(),
    passwordHash,
    role,
  }).returning();
  console.log(`Created user: ${fullName} (${email}) with role: ${role}`);
  return created;
}

export async function seedDatabase() {
  await db.execute(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
  )`);

  const adminUser = await ensureUser("Eliezer Asulin", "eliazasulin@gmail.com", "admin");
  const adminUser2 = await ensureUser("Eden Asulin", "edenabergel94@gmail.com", "admin");

  const [existing] = await db.select({ count: count() }).from(clients);
  if (existing.count > 0) return;

  const clientsData = [
    {
      fullName: "Yael Shapira",
      clientType: "private_individual" as const,
      phone: "054-987-6543",
      email: "yael.shapira@gmail.com",
      taxId: "312456789",
      address: "15 Herzl St, Tel Aviv",
      status: "active" as const,
      clientProcessStatus: "in_treatment" as const,
      leadStatus: "closed_deal" as const,
      source: "referral" as const,
      notes: "Referred by Moshe. Needs help with 2024 tax refund.",
      onboardingDate: "2025-01-15",
      assignedAccountantId: adminUser.id,
      clientDeclarationSigned: true,
      createdBy: adminUser.email,
    },
    {
      fullName: "Avi Goldstein",
      clientType: "self_employed" as const,
      phone: "052-123-4567",
      email: "avi.gold@business.co.il",
      taxId: "556789012",
      address: "42 Rothschild Blvd, Tel Aviv",
      status: "active" as const,
      clientProcessStatus: "ready_for_submission" as const,
      leadStatus: "paid_opening_fee" as const,
      source: "website" as const,
      notes: "Small business owner. Monthly bookkeeping + annual report.",
      onboardingDate: "2024-11-01",
      assignedAccountantId: adminUser2.id,
      clientDeclarationSigned: true,
      createdBy: adminUser.email,
    },
    {
      fullName: "Noa Peretz",
      clientType: "private_individual" as const,
      phone: "050-555-1234",
      email: "noa.peretz@outlook.com",
      taxId: "298765432",
      address: "8 Ben Yehuda St, Jerusalem",
      status: "lead" as const,
      clientProcessStatus: "lead" as const,
      leadStatus: "not_answered_1" as const,
      source: "social_media" as const,
      createdBy: adminUser.email,
    },
    {
      fullName: "Eitan Mizrachi",
      clientType: "self_employed" as const,
      phone: "053-777-8888",
      email: "eitan.m@tech.co.il",
      taxId: "445566778",
      address: "22 Weizmann St, Haifa",
      status: "active" as const,
      clientProcessStatus: "submitted_to_tax_authority" as const,
      leadStatus: "closed_deal" as const,
      source: "direct" as const,
      notes: "Tech freelancer. Quarterly VAT reports.",
      onboardingDate: "2024-06-15",
      assignedAccountantId: adminUser.id,
      clientDeclarationSigned: true,
      createdBy: adminUser.email,
    },
    {
      fullName: "Rivka Friedman",
      clientType: "private_individual" as const,
      phone: "058-222-3333",
      email: "rivka.f@gmail.com",
      taxId: "223344556",
      address: "5 Dizengoff St, Tel Aviv",
      status: "inactive" as const,
      clientProcessStatus: "paid_and_closed" as const,
      leadStatus: "closed_deal" as const,
      source: "referral" as const,
      notes: "2023 case completed. May return for 2024.",
      onboardingDate: "2023-03-01",
      assignedAccountantId: adminUser2.id,
      clientDeclarationSigned: true,
      createdBy: adminUser.email,
    },
  ];

  const createdClients = await db.insert(clients).values(clientsData).returning();

  const casesData = [
    {
      clientId: createdClients[0].id,
      taxYear: 2024,
      formType: "135" as const,
      serviceType: "tax_refund" as const,
      refundEstimate: "8500",
      status: "in_progress" as const,
      priority: "high" as const,
      assignedTo: adminUser.id,
      notes: "Multiple employers in 2024. Expected refund ~8,500 ILS.",
      createdBy: adminUser.email,
    },
    {
      clientId: createdClients[1].id,
      taxYear: 2024,
      serviceType: "bookkeeping" as const,
      status: "in_progress" as const,
      priority: "medium" as const,
      assignedTo: adminUser2.id,
      notes: "Monthly bookkeeping for small business.",
      hourlyRate: "250",
      createdBy: adminUser.email,
    },
    {
      clientId: createdClients[1].id,
      taxYear: 2024,
      serviceType: "annual_report" as const,
      status: "document_collection" as const,
      priority: "high" as const,
      assignedTo: adminUser2.id,
      notes: "Annual financial report needed by March.",
      createdBy: adminUser.email,
    },
    {
      clientId: createdClients[3].id,
      taxYear: 2024,
      serviceType: "vat_report" as const,
      status: "submitted" as const,
      priority: "medium" as const,
      assignedTo: adminUser.id,
      submissionDate: "2025-02-15",
      createdBy: adminUser.email,
    },
    {
      clientId: createdClients[4].id,
      taxYear: 2023,
      formType: "135" as const,
      serviceType: "tax_refund" as const,
      refundEstimate: "5200",
      status: "completed" as const,
      approvalStatus: "approved" as const,
      priority: "low" as const,
      assignedTo: adminUser2.id,
      totalPaid: "1500",
      createdBy: adminUser.email,
    },
  ];

  const createdCases = await db.insert(cases).values(casesData).returning();

  const tasksData = [
    {
      taskName: "Collect 2024 payslips from Yael",
      clientId: createdClients[0].id,
      caseId: createdCases[0].id,
      assignedTo: adminUser.id,
      dueDate: "2025-03-20",
      status: "in_progress" as const,
      priority: "high" as const,
      taskCategory: "document_collection" as const,
      createdBy: adminUser.email,
    },
    {
      taskName: "Prepare VAT report Q1 for Eitan",
      clientId: createdClients[3].id,
      caseId: createdCases[3].id,
      assignedTo: adminUser.id,
      dueDate: "2025-04-15",
      status: "not_started" as const,
      priority: "high" as const,
      taskCategory: "vat_report" as const,
      createdBy: adminUser.email,
    },
    {
      taskName: "Review Avi's monthly expenses",
      clientId: createdClients[1].id,
      caseId: createdCases[1].id,
      assignedTo: adminUser2.id,
      dueDate: "2025-03-31",
      status: "not_started" as const,
      priority: "medium" as const,
      taskCategory: "bookkeeping_update" as const,
      createdBy: adminUser.email,
    },
    {
      taskName: "Call Noa - follow up on lead",
      clientId: createdClients[2].id,
      assignedTo: adminUser.id,
      dueDate: "2025-03-12",
      status: "not_started" as const,
      priority: "medium" as const,
      taskCategory: "client_communication" as const,
      createdBy: adminUser.email,
    },
    {
      taskName: "File annual report for Avi",
      clientId: createdClients[1].id,
      caseId: createdCases[2].id,
      assignedTo: adminUser2.id,
      dueDate: "2025-03-30",
      status: "in_progress" as const,
      priority: "high" as const,
      taskCategory: "annual_report" as const,
      createdBy: adminUser.email,
    },
    {
      taskName: "Send closing documents to Rivka",
      clientId: createdClients[4].id,
      caseId: createdCases[4].id,
      assignedTo: adminUser2.id,
      dueDate: "2025-03-15",
      status: "completed" as const,
      priority: "low" as const,
      taskCategory: "client_communication" as const,
      createdBy: adminUser.email,
    },
  ];

  await db.insert(tasks).values(tasksData);

  const paymentsData = [
    {
      clientId: createdClients[0].id,
      caseId: createdCases[0].id,
      paymentDate: "2025-01-20",
      amount: "500",
      paymentMethod: "credit_card" as const,
      status: "paid" as const,
      referenceNumber: "PAY-2025-001",
      notes: "Opening fee",
    },
    {
      clientId: createdClients[1].id,
      caseId: createdCases[1].id,
      paymentDate: "2025-02-01",
      amount: "1200",
      paymentMethod: "bank_transfer" as const,
      status: "paid" as const,
      referenceNumber: "PAY-2025-002",
      notes: "Monthly bookkeeping fee - February",
    },
    {
      clientId: createdClients[3].id,
      caseId: createdCases[3].id,
      paymentDate: "2025-02-15",
      amount: "800",
      paymentMethod: "bank_transfer" as const,
      status: "paid" as const,
      referenceNumber: "PAY-2025-003",
    },
    {
      clientId: createdClients[4].id,
      caseId: createdCases[4].id,
      paymentDate: "2024-12-01",
      amount: "1500",
      paymentMethod: "credit_card" as const,
      status: "paid" as const,
      referenceNumber: "PAY-2024-015",
      notes: "Final payment for 2023 tax refund case",
    },
    {
      clientId: createdClients[1].id,
      caseId: createdCases[2].id,
      amount: "2500",
      paymentMethod: "bank_transfer" as const,
      status: "pending" as const,
      notes: "Annual report fee - pending",
    },
  ];

  await db.insert(payments).values(paymentsData);

  const transactionsData = [
    { clientId: createdClients[0].id, transactionDate: "2025-01-20", type: "income" as const, category: "Opening Fee", description: "Tax refund case opening fee", amount: "500", currency: "ILS" },
    { clientId: createdClients[1].id, transactionDate: "2025-02-01", type: "income" as const, category: "Bookkeeping", description: "Monthly bookkeeping service", amount: "1200", currency: "ILS" },
    { clientId: createdClients[3].id, transactionDate: "2025-02-15", type: "income" as const, category: "VAT Report", description: "Q4 2024 VAT report preparation", amount: "800", currency: "ILS" },
    { clientId: createdClients[4].id, transactionDate: "2024-12-01", type: "income" as const, category: "Tax Refund", description: "2023 tax refund case completion", amount: "1500", currency: "ILS" },
    { clientId: createdClients[1].id, transactionDate: "2025-01-15", type: "expense" as const, category: "Software", description: "Accounting software subscription", amount: "350", currency: "ILS" },
    { clientId: createdClients[3].id, transactionDate: "2025-02-01", type: "expense" as const, category: "Office", description: "Office supplies", amount: "180", currency: "ILS" },
  ];

  await db.insert(transactions).values(transactionsData);

  console.log("Database seeded successfully");
}
