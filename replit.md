# TaxPro CRM - Tax Refund & Accounting Management Platform

## Overview
A production-ready CRM platform for managing a tax refund and accounting firm. Built with a modern full-stack architecture.

## Language & RTL
- **UI Language**: Hebrew (all labels, buttons, titles, table headers, messages, placeholders)
- **Layout Direction**: RTL (`dir="rtl"` on `<html>`, `lang="he"`)
- **Backend/DB**: All field names, API routes, variables, schema remain in English
- **Font**: Rubik (primary), Open Sans (fallback) — both support Hebrew
- **Currency**: ILS formatted with `he-IL` locale
- **Search icons**: Positioned on right side (`right-3`, `pr-9`) for RTL
- **Back navigation**: Uses `ArrowRight` icon (RTL-appropriate)
- **Sidebar**: Rendered on right side (`side="right"`)
- **Status badges**: Hebrew label translations via `hebrewLabels` map in `status-badge.tsx`

## Tech Stack
- **Frontend**: React + TypeScript + Vite + TailwindCSS + Shadcn UI
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **State Management**: TanStack Query (React Query v5)
- **Routing**: Wouter

## Project Structure

### Backend
- `server/index.ts` - Express server entry point
- `server/routes.ts` - REST API routes for all entities
- `server/storage.ts` - Database storage layer (IStorage interface + DatabaseStorage implementation)
- `server/db.ts` - Database connection (Drizzle + pg)
- `server/seed.ts` - Database seeding with realistic data

### Frontend
- `client/src/App.tsx` - Root app with sidebar layout and routing
- `client/src/pages/` - Page components (Dashboard, Clients, Cases, Tasks, Payments, Transactions)
- `client/src/components/` - Reusable components (AppSidebar, StatCard, StatusBadge, PageHeader, EmptyState)

### Shared
- `shared/schema.ts` - Drizzle schema definitions, Zod insert schemas, TypeScript types

## Database Entities
- **Users** - Admin, User, Accountant roles
- **Clients** - Full client lifecycle (lead → active → inactive) with process tracking
- **Cases** - Tax refund cases, bookkeeping, reports with status tracking
- **Tasks** - Task management with categories, priorities, assignments
- **Payments** - Payment tracking with methods and status
- **Communication Logs** - Client communication history
- **Transactions** - Income/expense ledger

## API Endpoints
All endpoints prefixed with `/api/`:
- `GET/POST /clients`, `GET/PATCH/DELETE /clients/:id`
- `GET/POST /cases`, `GET/PATCH/DELETE /cases/:id`
- `GET/POST /tasks`, `GET/PATCH/DELETE /tasks/:id`
- `GET/POST /payments`, `GET/PATCH/DELETE /payments/:id`
- `GET/POST /transactions`, `DELETE /transactions/:id`
- `GET/POST /communications`
- `GET /dashboard/stats`
- `GET /users`
- `POST /webhooks/landy` - Landy lead intake webhook

## Landy Webhook Integration
- **Route**: `POST /api/webhooks/landy` (in `server/routes.ts`)
- **Auth**: `x-webhook-secret` header validated against `LANDY_WEBHOOK_SECRET` env var
- **Required fields**: `full_name`, `phone`, `email`, `source`
- **Optional fields**: `notes`, `address`, `tax_id`
- **Dedup**: Checks for existing client by phone or email before creating (uses `findClientByPhoneOrEmail` in storage)
- **New lead**: Creates client with `status: "lead"`, `clientProcessStatus: "lead"`
- **Existing lead**: Updates the existing record instead of duplicating
- **Responses**: 200 (success), 401 (bad secret), 400 (missing fields), 500 (server error)
- **Logging**: Full payload logged to console with `[Landy Webhook]` prefix
- **Extensibility**: TODO hooks for auto-creating Task or CommunicationLog on new/returning leads

## Key Features
- Dashboard with KPI stats and charts (Recharts)
- Client management with full CRUD, search, filters
- Client detail page with tabs (Details, Cases, Tasks, Payments)
- Case management with service types and status tracking
- Task management with priority, category, and completion
- Payment recording and tracking
- Transaction ledger with income/expense tracking
- Landy webhook for automatic lead intake with dedup
- Seed data with 5 realistic clients, 5 cases, 6 tasks, 5 payments, 6 transactions
