# PeoplePay360 — Agent Context & Architecture Manual

> **Purpose**: This document serves as the comprehensive, authoritative single source of truth for AI agents (and human engineers) working on the **PeoplePay360** codebase. It details architecture, database schema, data contracts, authentication, state management, common pitfalls, and operational procedures.

---

## 1. High-Level Overview

**PeoplePay360** is a full-stack, enterprise-grade HRMS, Attendance, Leave Management, IT Asset Tracking, Payroll Engine, and Helpdesk application.
- **Repository Root**: `c:\Users\siddh\Odoo`
- **Backend**: Node.js, Express 5, Prisma ORM 6, PostgreSQL, Better-Auth (`/server`)
- **Frontend**: React 19, TanStack Start & TanStack Router (file-based), Tailwind CSS v4, Radix UI, Vite 8 (`/client`)
- **Default Ports**:
  - Backend API: `http://localhost:5000`
  - Frontend Client: `http://localhost:8081` (or Vite preview `http://localhost:3000`)

---

## 2. Technology Stack & Directory Structure

```
c:\Users\siddh\Odoo
├── client/                     # TanStack Start / React 19 frontend
│   ├── src/
│   │   ├── components/         # Radix UI + custom components (bits.tsx, app-shell.tsx, ui/*)
│   │   ├── lib/
│   │   │   ├── api.ts          # Typed REST client (api.employees, api.attendance, etc.)
│   │   │   ├── store.tsx       # Central AppProvider, state persistence, persona memo
│   │   │   └── mock-data.ts    # Seed data types, fallbacks, currency formatters
│   │   ├── routes/             # TanStack file-based routes
│   │   │   ├── app.attendance.tsx    # Attendance tracking & calendar
│   │   │   ├── app.dashboard.tsx     # HR / Admin & Employee self-service dashboards
│   │   │   ├── app.me.tsx            # "My Workspace" employee self-service portal
│   │   │   ├── app.payslips.tsx      # Payslip viewer & generator
│   │   │   ├── app.leave.tsx         # Leave requests & approval
│   │   │   ├── app.assets.tsx        # IT asset inventory
│   │   │   ├── app.asset-requests.tsx# Hardware/accessory request workflow
│   │   │   ├── app.reimbursement.tsx # Expense claims & disbursals
│   │   │   ├── app.allowance.tsx     # Recurring monthly allowance management
│   │   │   ├── app.helpdesk.tsx      # IT support ticketing
│   │   │   ├── app.employees.*.tsx   # Employee directory & profile editor
│   │   │   └── app.payroll.*.tsx     # Payroll runs, salary structure, disbursals
│   │   └── routeTree.gen.ts    # Auto-generated TanStack route tree
│   └── package.json
│
└── server/                     # Express 5 / Prisma backend
    ├── prisma/
    │   └── schema.prisma       # PostgreSQL schema definition
    ├── src/
    │   ├── lib/
    │   │   ├── auth.ts         # Better-Auth configuration
    │   │   ├── prisma.ts       # Global PrismaClient singleton
    │   │   ├── email.ts        # Nodemailer email dispatch for credentials
    │   │   └── resolve-employee.ts # Helper to resolve employee by UUID, code, or email
    │   ├── routes/
    │   │   ├── auth.ts         # Login, logout, session endpoints
    │   │   ├── employees.ts    # CRUD for employees, auto-provisioning
    │   │   ├── attendance.ts   # Punch in/out, manual corrections
    │   │   ├── leave.ts        # Leave requests & status updates
    │   │   ├── payroll.ts      # Runs, payslips, dynamic payslip generation
    │   │   ├── salary.ts       # Salary structures & compensation records
    │   │   ├── assets.ts       # Inventory, asset assignments & requests
    │   │   ├── reimbursements.ts # Expense claims
    │   │   ├── allowances.ts   # Employee allowance records
    │   │   ├── contracts.ts    # Employment contracts
    │   │   └── helpdesk.ts     # IT tickets & comments
    │   ├── seed.ts             # Database seeder script
    │   └── server.ts           # Express entry point
    └── package.json
```

---

## 3. Database Models & Schema (PostgreSQL via Prisma)

All primary database models reside in `server/prisma/schema.prisma`.

### Key Tables & Relationships:
1. **`employees`**:
   - `id`: UUID (Primary Key)
   - `employee_code`: Unique string (e.g. `PP-1001`, `PP-1002`)
   - `full_name`, `email`, `phone`, `joining_date`, `status` (`active`, `onboarding`, `exited`)
   - `bank_name`, `bank_account_number`, `bank_ifsc_code`, `address` (location)
   - `department_id`, `designation_id`, `reporting_manager_id`
   - `employment_type` (`full_time`, `part_time`, `contract`, `intern`, `consultant`)

2. **`user` & `account` (Better-Auth)**:
   - `id`: String
   - `email`: String (Unique)
   - `name`: String
   - `role`: Enum (`employee`, `hr_manager`, `payroll_manager`, `payroll_user`, `it_asset_manager`, `admin`)
   - `employeeId`: Foreign Key linking to `employees.id`

3. **`attendance`**:
   - `id`: UUID
   - `employee_id`: FK to `employees.id`
   - `attendance_date`: Date (`YYYY-MM-DD`)
   - `check_in`, `check_out`: Timestamps
   - `working_hours`: Decimal (calculated on punch out or correction)
   - `status`: `present`, `absent`, `late`, `half_day`, `on_leave`, `holiday`, `work_from_home`
   - `is_manually_corrected`: Boolean
   - Unique constraint: `[employee_id, attendance_date]`

4. **`contracts`**:
   - `id`: UUID
   - `employee_id`: FK to `employees.id`
   - `salary`: Decimal (Annual CTC)
   - `start_date`, `end_date`: Dates
   - `status`: `draft`, `active`, `expired`, `terminated`

5. **`leave_requests` & `leave_types`**:
   - `leave_requests.employee_id`: FK to `employees.id`
   - `start_date`, `end_date`: Dates
   - `days`: Decimal
   - `status`: `pending`, `approved`, `rejected`, `cancelled`

6. **`payroll_runs` & `payslips`**:
   - `payroll_runs`: `period_month`, `period_year`, `status` (`draft`, `approved`, `paid`)
   - `payslips`: `gross_salary`, `basic_salary`, `allowances_total`, `deductions_total`, `tax_amount`, `net_salary`
   - `payslip_lines`: `code` (`BASIC`, `HRA`, `SPECIAL`, `BONUS`, `PF`, `PT`, `TDS`), `amount`

7. **`assets` & `asset_requests`**:
   - `assets`: `asset_code`, `asset_type`, `condition`, `status` (`available`, `assigned`, `under_repair`, `retired`), `current_employee_id`
   - `asset_requests`: `employee_id`, `asset_type_requested`, `reason`, `status` (`pending`, `approved`, `rejected`, `fulfilled`, `cancelled`)

8. **`reimbursements`**:
   - `employee_id`, `category_id`, `expense_date`, `amount`, `status` (`submitted`, `manager_approved`, `finance_approved`, `paid`, `rejected`)

9. **`it_tickets`**:
   - `ticket_number`, `employee_id`, `category`, `priority`, `subject`, `description`, `status` (`open`, `in_progress`, `resolved`, `closed`)

---

## 4. Authentication, Roles & Persona Handling

### Roles (`Role` type)
- `"employee"`: Self-service employee portal (attendance calendar, workspace, my payslips, leave application, asset requests).
- `"hr_manager"`: Personnel directory, contracts, onboarding/offboarding, attendance management.
- `"payroll_manager"`: Complete payroll cycles, structure adjustments, payslip generation, disbursals.
- `"payroll_user"`: Salary structure creation and payroll drafts.
- `"it_asset_manager"`: Hardware/software inventory, asset allocation, ticket triage.
- `"admin"`: Full administrative access.

> **CRITICAL RULE**: Do **NOT** use `"hr_user"`. It is obsolete and has been purged from `ROLE_ACCESS`.

### Live Persona Resolution (`client/src/lib/store.tsx`)
The `persona` object in `useApp()` is computed dynamically:
1. When authenticated, `currentUser` holds `{ id, email, name, role, employeeId, employeeCode }`.
2. The `persona` memo matches `currentUser` against the live `employees` array in state using:
   - `e.id === currentUser.employeeId` (UUID)
   - `e.code === currentUser.employeeCode` (Code, e.g. `PP-1001`)
   - Case-insensitive email match
   - Full name match
3. Falls back to static persona only if unauthenticated.

---

## 5. Critical Engineering Gotchas & Invariants

### 1. Dual ID Matching: UUID vs Employee Code
- **PostgreSQL**: Stores employee primary keys as UUIDs (e.g. `6e214b4f-8012-4217-a128-d88b4887756f`).
- **Seed / Legacy Mock Data**: Uses short alphanumeric codes (`PP-1001`, `E1001`).
- **Frontend Slices**: Whenever filtering records for the logged-in employee (attendance, leave, payslips, assets, tickets), ALWAYS match against both:
  ```ts
  const isMine =
    record.employeeId === myId ||
    (myCode && (record.employeeId === myCode || record.employeeCode === myCode));
  ```
- **Backend Helper**: Whenever accepting an employee identifier from query params or request bodies, ALWAYS wrap it with `resolveEmployee(idOrCode)`. It handles UUIDs, `PP-XXXX`, `EXXXX`, and emails transparently.

### 2. Time & Date Parsing in Attendance
- Frontend attendance sends check-in/out times in varied formats (`"09:30 AM"`, `"18:00"`, or ISO strings).
- In Node.js, `new Date("09:30 AM")` returns `Invalid Date`, which will crash Prisma queries with a 500 status.
- `server/src/routes/attendance.ts` provides `parseTimeString(baseDate, timeStr)` to safely merge times with `attendance_date`. Always use it when handling manual correction timestamps.

### 3. Payroll Fetching & Redirects
- When `GET /api/payroll` generates missing payslips for the current month, it MUST NOT issue an HTTP `307` or `302` redirect. Browsers will reject cross-origin redirected POST/GET queries under fetch CORS policies. Always re-query Prisma directly in-process and return `res.json(...)`.

### 4. TypeScript Strictness (`noUncheckedIndexedAccess`)
- `client/tsconfig.json` has strict settings enabled.
- Array destructuring like `const [y, m, d] = date.split('-')` infers `number | undefined`. Always provide defaults:
  ```ts
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number);
  ```
- Guard array lookups like `employees[0]` or use nullish coalescing.

### 5. Frontend UI Preservation
- When the user asks to fix backend issues or compiler errors, **do NOT alter or strip the frontend visual designs, page layouts, or component structure** unless explicitly instructed to redesign.

---

## 6. API Reference (Backend Routes)

| Path | Method | Purpose |
|------|--------|---------|
| `/api/auth/login` | `POST` | Authenticates with email & password, returns user & session |
| `/api/auth/session` | `GET` | Fetches active session & current employee details |
| `/api/employees` | `GET` / `POST` | Lists employees (with search/filter); creates new employee |
| `/api/employees/:id` | `GET` / `PATCH` | Fetches/updates profile details (including bank & location) |
| `/api/attendance` | `GET` / `POST` | Fetches attendance logs; punches in / out |
| `/api/attendance/:id` | `PATCH` | Manually corrects check-in, check-out, and status |
| `/api/leave` | `GET` / `POST` | Fetches leave history; submits leave requests |
| `/api/leave/:id` | `PATCH` | Approves, rejects, or cancels leave |
| `/api/payroll` | `GET` | Lists payroll runs (auto-generates current month if missing) |
| `/api/payroll/generate` | `POST` | Triggers payslip calculation for an employee or department |
| `/api/assets` | `GET` / `POST` | Lists inventory; creates new assets |
| `/api/assets/:id` | `PATCH` | Updates asset condition, status, location, or assignment |
| `/api/assets/requests` | `GET` / `POST` | Lists / submits hardware requests |
| `/api/assets/requests/:id` | `PATCH` | Approves, rejects, or fulfills requests |
| `/api/reimbursements` | `GET` / `POST` | Lists / submits expense claims |
| `/api/reimbursements/:id` | `PATCH` | Updates claim status & approved amounts |
| `/api/allowances` | `GET` / `POST` | Lists / configures recurring employee allowances |
| `/api/contracts` | `GET` / `POST` | Fetches / drafts employment contracts |
| `/api/helpdesk` | `GET` / `POST` | Fetches / submits IT support tickets |
| `/api/helpdesk/:id/comments`| `POST` | Adds comments to support tickets |

---

## 7. Verification & Build Commands

Before completing any task, execute these checks from the workspace root:

```bash
# 1. Check Server Type Compilation
cd server && npx tsc --noEmit

# 2. Check Client Type Compilation
cd ../client && npx tsc --noEmit

# 3. Test Full Client Production Build (Nitro SSR + Vite)
npm run build
```

Both type-checks must exit with code 0, and the production build must complete without errors.
