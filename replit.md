# TaxPro CRM - Tax Refund & Accounting Management Platform

## Overview
A production-ready CRM platform for managing a tax refund and accounting firm. Built with a modern full-stack architecture.

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

## Key Features
- Dashboard with KPI stats and charts (Recharts)
- Client management with full CRUD, search, filters
- Client detail page with tabs (Details, Cases, Tasks, Payments)
- Case management with service types and status tracking
- Task management with priority, category, and completion
- Payment recording and tracking
- Transaction ledger with income/expense tracking
- Seed data with 5 realistic clients, 5 cases, 6 tasks, 5 payments, 6 transactions
