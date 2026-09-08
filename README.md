# 🚀 PeoplePay360

> **Enterprise-Grade HRMS, Attendance, Leave Management, IT Asset Tracking, Dynamic Payroll Engine, Shift Scheduling & IT Helpdesk Platform.**

PeoplePay360 is a full-stack, modern human resource and workforce management platform built with high-performance modern web technologies. It provides seamless self-service portals for employees alongside robust management hubs for HR, Payroll, IT Asset, and Administrative teams.

---

## 🛠️ Technology Stack

### **Frontend (`/client`)**
- **Framework**: [React 19](https://react.dev/) with [TanStack Start](https://tanstack.com/start/latest) & [TanStack Router](https://tanstack.com/router/latest) (File-based routing & SSR)
- **Styling & UI**: [Tailwind CSS v4](https://tailwindcss.com/), [Radix UI Primitives](https://www.radix-ui.com/), [Lucide React Icons](https://lucide.dev/)
- **Build Tool**: [Vite 8](https://vitejs.dev/) with Nitro Server Engine
- **State & Data**: TanStack Query (React Query v5), Custom App Context Provider
- **Language**: TypeScript (Strict Mode enabled)

### **Backend (`/server`)**
- **Runtime & Server**: [Node.js](https://nodejs.org/), [Express 5](https://expressjs.com/)
- **ORM & Database**: [Prisma ORM 6](https://www.prisma.io/), [PostgreSQL](https://www.postgresql.org/)
- **Authentication**: [Better-Auth](https://better-auth.com/) (Role-based access control & session handling)
- **Mail Services**: [Nodemailer](https://nodemailer.com/) (User credentials & notification emails)
- **TypeScript**: Typed routes, Prisma schemas, and execution via `tsx`

---

## ✨ Core Features & Modules

- **👤 Personnel & Employee Directory**: Manage employee lifecycle, profiles, employment types (Full-time, Contract, Intern), department/designation mapping, and bank details.
- **🕒 Attendance Tracking & Scheduling**: Punch in/out logging, calendar views, shift schedule management, assignment workflows, and supervisor manual corrections.
- **🌴 Leave Management**: Flexible leave types, request submission, and multi-tier approval workflows.
- **💰 Dynamic Payroll Engine**: Automated monthly payroll runs, salary structures (Basic, HRA, Special Allowances, PF, PT, TDS tax calculations), payslip generation, and disbursals.
- **💻 IT Asset Management**: Hardware/accessory inventory tracking, lifecycle status, employee allocations, and request workflows.
- **🧾 Reimbursements & Allowances**: Expense claim submissions, finance approvals, and recurring monthly allowances.
- **🎫 IT Helpdesk Support**: Internal support ticketing system with priority tagging and comment threads.
- **🔐 Role-Based Access Control (RBAC)**: Distinct workspace views for `employee`, `hr_manager`, `payroll_manager`, `payroll_user`, `it_asset_manager`, and `admin`.

---

## 📁 Repository Structure

```
PeoplePay360/
├── client/                     # React 19 + TanStack Start Frontend
│   ├── src/
│   │   ├── components/         # Radix UI primitives & custom UI elements
│   │   ├── lib/                # REST API client, store provider, mock data
│   │   ├── routes/             # TanStack file-based page routes
│   │   └── routeTree.gen.ts    # Generated router tree
│   └── package.json
│
├── server/                     # Express 5 + Prisma Backend
│   ├── prisma/
│   │   └── schema.prisma       # PostgreSQL Prisma schema
│   ├── src/
│   │   ├── lib/                # Auth, Prisma singleton, helper utilities
│   │   ├── routes/             # Express API endpoints
│   │   ├── seed.ts             # Database seeder script
│   │   └── server.ts           # Express application entry point
│   └── package.json
├── AGENTS.md                   # Complete architectural reference & data contracts
├── CONTEXT.md                  # Project context summary
└── README.md                   # Main GitHub documentation
```

---

## ⚡ Quick Start Guide (Commands)

### 1. Prerequisite Checklist
- **Node.js**: v18.x or higher
- **PostgreSQL**: Running locally or via remote host (e.g. Supabase / Neon / Render)
- **Git** & **GitHub CLI** (`gh`) *(optional for GitHub operations)*

---

### 2. Setup Environment Variables

#### Backend Environment (`server/.env`):
```env
PORT=5000
DATABASE_URL="postgresql://postgres:password@localhost:5432/peoplepay360?schema=public"
BETTER_AUTH_SECRET="your-super-secret-key-at-least-32-chars-long"
BETTER_AUTH_URL="http://localhost:5000"
CLIENT_URL="http://localhost:8081"
```

#### Frontend Environment (`client/.env`):
```env
VITE_API_BASE_URL="http://localhost:5000"
```

---

### 3. Installation & Database Setup Commands

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/PeoplePay360.git
cd PeoplePay360

# Install Root & Subproject Dependencies
npm install
cd server && npm install
cd ../client && npm install
```

```bash
# Set up Database Schema and Seed Data
cd ../server

# Generate Prisma Client
npm run prisma:generate

# Push Schema to PostgreSQL
npx prisma db push

# Seed initial database records (Employees, Assets, Schedules)
npm run seed
```

---

### 4. Running the Development Servers

Open two terminal windows or run background processes:

#### Terminal 1: Backend Server (Port 5000)
```bash
cd server
npm run dev
```

#### Terminal 2: Frontend Client (Port 8081)
```bash
cd client
npm run dev
```

Visit the frontend app in your browser at `http://localhost:8081`.

---

## 🪛 Build & Verification Commands

Before pushing changes to GitHub, execute the type-checks and production builds to ensure zero compiler errors:

```bash
# 1. Type-check the Backend
cd server
npx tsc --noEmit

# 2. Type-check the Frontend
cd ../client
npx tsc --noEmit

# 3. Test Production SSR / Vite Build
npm run build
```

---

## 🐙 GitHub Repository Setup Commands

Commands to initialize, commit, create a repository on GitHub, and push the codebase:

```bash
# Initialize git repository (if not already initialized)
git init

# Stage all files
git add .

# Initial commit
git commit -m "feat: initial commit for PeoplePay360 full-stack platform"

# Rename default branch to main
git branch -M main

# Using GitHub CLI (gh) to create & push a new repository
gh repo create PeoplePay360 --public --source=. --remote=origin --push

# Alternatively, using standard git commands with pre-created repo URL:
# git remote add origin https://github.com/YOUR_USERNAME/PeoplePay360.git
# git push -u origin main
```

---

## 📄 License

This project is open source and available under the [ISC License](LICENSE).
