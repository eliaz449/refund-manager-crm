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
- **Auth**: Passport.js (local strategy) + express-session + connect-pg-simple + bcryptjs
- **State Management**: TanStack Query (React Query v5)
- **Routing**: Wouter

## Project Structure

### Backend
- `server/index.ts` - Express server entry point (includes session + auth setup)
- `server/auth.ts` - Authentication module (Passport.js, session, login/logout/me/change-password routes)
- `server/routes.ts` - REST API routes for all entities (all protected by `requireAuth` middleware)
- `server/storage.ts` - Database storage layer (IStorage interface + DatabaseStorage implementation)
- `server/db.ts` - Database connection (Drizzle + pg)
- `server/seed.ts` - Database seeding with realistic data + real user account creation

### Frontend
- `client/src/App.tsx` - Root app with auth gate, sidebar layout and routing
- `client/src/pages/login.tsx` - Login page with forgot password flow (Hebrew, RTL)
- `client/src/pages/settings.tsx` - Account settings page with password change
- `client/src/pages/` - Page components (Dashboard, Clients, Cases, Tasks, Payments, Transactions)
- `client/src/hooks/use-auth.ts` - Auth hook (login, logout, changePassword, user state)
- `client/src/components/` - Reusable components (AppSidebar with logout, StatCard, StatusBadge, PageHeader, EmptyState)

### Shared
- `shared/schema.ts` - Drizzle schema definitions, Zod insert schemas, TypeScript types

## Authentication System
- **Login**: `POST /api/auth/login` (email + password, returns user object)
- **Logout**: `POST /api/auth/logout` (clears session)
- **Session check**: `GET /api/auth/me` (returns current user or 401)
- **Change password**: `POST /api/auth/change-password` (requires currentPassword + newPassword)
- **Forgot password**: `POST /api/auth/forgot-password` (generates reset token, returns it in response)
- **Reset password**: `POST /api/auth/reset-password` (validates token + sets new password)
- **Validate reset token**: `GET /api/auth/validate-reset-token/:token`
- **Password reset tokens**: Stored in `password_reset_tokens` table (token, userId, expiresAt, used flag), 1-hour expiry
- **Session storage**: PostgreSQL via `connect-pg-simple` (auto-creates `session` table)
- **Session secret**: `SESSION_SECRET` env var
- **Password hashing**: bcryptjs with 12 salt rounds
- **Protected routes**: All `/api/*` routes (except `/api/health`, `/api/auth/*`, `/api/webhooks/*`) require authentication
- **Frontend**: `useAuth` hook checks `/api/auth/me`; shows login page if not authenticated
- **Account Settings page**: `/settings` route with account info display + password change form
- **Users**: Two admin accounts (Eliezer Asulin + Eden Asulin) created in seed.ts
- **Default password**: `TaxPro2026!` (should be changed after first login)

## Database Entities
- **Users** - Admin, User, Accountant roles
- **Clients** - Full client lifecycle (lead → active → inactive) with process tracking, pricing (percentage/fixed/hourly), recommendedBy field
- **Cases** - Tax refund cases, bookkeeping, reports with status tracking
- **Tasks** - Task management with categories, priorities, assignments
- **Payments** - Payment tracking with methods and status
- **Communication Logs** - Client communication history
- **Transactions** - Income/expense ledger
- **Client Notes** - Timestamped notes history per client (append-only log with edit/delete)
- **Password Reset Tokens** - Reset token storage with expiry and used flag

## Health & Deployment
- `GET /api/health` returns `{ "status": "ok" }` — lightweight health endpoint
- `server/static.ts` gracefully handles missing `dist/public` directory (returns fallback HTML instead of throwing)
- Production build: `npm run build` → `dist/index.cjs` (server) + `dist/public/` (client)
- Production start: `NODE_ENV=production node dist/index.cjs`

## API Endpoints
All endpoints prefixed with `/api/`:
- `GET /api/health` - Health check endpoint (no auth required)
- Auth: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password`
- `GET/POST /clients`, `GET/PATCH/DELETE /clients/:id`
- `GET/POST /cases`, `GET/PATCH/DELETE /cases/:id`
- `GET/POST /tasks`, `GET/PATCH/DELETE /tasks/:id`
- `GET/POST /payments`, `GET/PATCH/DELETE /payments/:id`
- `GET/POST /transactions`, `DELETE /transactions/:id`
- `GET/POST /communications`
- `GET/POST /clients/:clientId/notes`, `PATCH/DELETE /notes/:id`
- `GET /dashboard/stats`
- `GET /users`
- `POST /webhooks/landy` - Landy lead intake webhook (no session auth — uses signature)

## Landy Webhook Integration
- **Route**: `POST /api/webhooks/landy` (in `server/routes.ts`)
- **Auth**: `x-landy-signature` header compared against `LANDY_WEBHOOK_SECRET` env var (with trim)
- **Flexible field mapping** (supports multiple Landy payload formats):
  - `full_name`: body.full_name || body.name || body.fullName || form_data.full_name || form_data.name
  - `phone`: body.phone || body.telephone || body.tel || form_data.phone
  - `email`: body.email || body.mail || form_data.email
  - `source`: body.source || body.page_name || "landy" (mapped to VALID_SOURCES or "other")
  - `notes`: body.notes || body.message || body.comment || form_data equivalents
  - `address`, `tax_id`: direct or form_data
- **Required fields**: full_name, phone
- **Dedup**: Checks for existing client by phone or email before creating (uses `findClientByPhoneOrEmail` in storage)
- **New lead**: Creates client with `status: "lead"`, `clientProcessStatus: "lead"`
- **Existing lead**: Updates the existing record instead of duplicating
- **Responses**: 200 (success), 401 (bad secret), 400 (missing fields), 500 (server error)
- **Logging**: Full payload logged to console with `[Landy Webhook]` prefix
- **Extensibility**: TODO hooks for auto-creating Task or CommunicationLog on new/returning leads

## Key Features
- Dashboard with KPI stats and charts (Recharts)
- Secure authentication with session-based login for two admin users
- Client management with full CRUD, search, filters
- Client detail page is the central workspace (unified scroll: Details, Notes History, Cases, Tasks, Payments)
- Inline case/task/payment creation from client detail page
- Notes history per client with add/edit/delete
- Client pricing fields (percentage, fixed, hourly)
- "Recommended" source option with recommender name field
- Cases, Tasks, Payments managed exclusively from within client pages (no standalone top-level pages)
- Old routes (/cases, /tasks, /payments) redirect to /clients for safety
- Transaction ledger with income/expense tracking
- Landy webhook for automatic lead intake with dedup
- Seed data with 5 realistic clients, 5 cases, 6 tasks, 5 payments, 6 transactions
