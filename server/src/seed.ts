/**
 * PeoplePay360 — Comprehensive Enterprise Database Seed Script
 * Populates Neon PostgreSQL with 100% complete data for all domains
 * Run: npx tsx src/seed.ts
 */

import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding PeoplePay360 database with complete enterprise dataset...\n");

  // ── 1. Roles ────────────────────────────────────────────────────────────────
  console.log("Creating roles...");
  const roleNames = [
    { name: "admin", description: "Full system administrator" },
    { name: "hr_manager", description: "HR Manager — full people ops access" },
    { name: "payroll_manager", description: "Payroll Manager — full payroll CRUD" },
    { name: "payroll_user", description: "Payroll User — read-only payroll" },
    { name: "it_asset_manager", description: "IT Asset Manager" },
    { name: "employee", description: "Regular employee" },
  ];

  const roles: Record<string, string> = {};
  for (const r of roleNames) {
    const role = await prisma.roles.upsert({
      where: { name: r.name },
      update: {},
      create: { name: r.name, description: r.description, is_system_role: true },
    });
    roles[r.name] = role.id;
  }
  console.log(`  ✓ ${roleNames.length} roles`);

  // ── 2. Departments ──────────────────────────────────────────────────────────
  console.log("Creating departments...");
  const deptData = [
    { name: "Engineering", code: "ENG" },
    { name: "People Ops", code: "HR" },
    { name: "Finance", code: "FIN" },
    { name: "Product", code: "PRD" },
    { name: "Sales", code: "SLS" },
    { name: "Marketing", code: "MKT" },
    { name: "IT", code: "IT" },
    { name: "Support", code: "SUP" },
  ];

  const depts: Record<string, string> = {};
  for (const d of deptData) {
    const dept = await prisma.departments.upsert({
      where: { code: d.code },
      update: {},
      create: d,
    });
    depts[d.name] = dept.id;
  }
  console.log(`  ✓ ${deptData.length} departments`);

  // ── 3. Designations ─────────────────────────────────────────────────────────
  console.log("Creating designations...");
  const desigData = [
    { title: "Senior Software Engineer", deptName: "Engineering" },
    { title: "Engineering Manager", deptName: "Engineering" },
    { title: "Head of HR", deptName: "People Ops" },
    { title: "Product Manager", deptName: "Product" },
    { title: "Finance Manager", deptName: "Finance" },
    { title: "Account Executive", deptName: "Sales" },
    { title: "Software Engineer", deptName: "Engineering" },
    { title: "IT Asset Manager", deptName: "IT" },
    { title: "HR Business Partner", deptName: "People Ops" },
    { title: "HR Associate", deptName: "People Ops" },
    { title: "Payroll Specialist", deptName: "Finance" },
    { title: "Senior Payroll Manager", deptName: "Finance" },
    { title: "QA Engineer", deptName: "Engineering" },
    { title: "Support Lead", deptName: "Support" },
  ];

  const desigs: Record<string, string> = {};
  for (const d of desigData) {
    let desig = await prisma.designations.findFirst({ where: { title: d.title } });
    if (!desig) {
      desig = await prisma.designations.create({
        data: { title: d.title, department_id: depts[d.deptName] },
      });
    }
    desigs[d.title] = desig.id;
  }
  console.log(`  ✓ ${desigData.length} designations`);

  // ── 4. Employees (All 10 Employees) ─────────────────────────────────────────
  console.log("Creating employees (PP-1001 to PP-1010)...");
  const empData = [
    {
      code: "PP-1001", name: "Charmi Patel", email: "charmi.patel@peoplepay360.io",
      phone: "+91 98250 11234", dept: "Engineering", desig: "Senior Software Engineer",
      type: "full_time" as const, status: "active" as const, joinedOn: "2022-04-11",
      ctc: 2400000, bank: "HDFC0001822", gender: "female" as const,
    },
    {
      code: "PP-1002", name: "Rohan Mehta", email: "rohan.mehta@peoplepay360.io",
      phone: "+91 99786 44120", dept: "Engineering", desig: "Engineering Manager",
      type: "full_time" as const, status: "active" as const, joinedOn: "2019-08-05",
      ctc: 4100000, bank: "ICIC0004921", gender: "male" as const,
    },
    {
      code: "PP-1003", name: "Sana Iqbal", email: "sana.iqbal@peoplepay360.io",
      phone: "+91 90045 77812", dept: "People Ops", desig: "Head of HR",
      type: "full_time" as const, status: "active" as const, joinedOn: "2018-01-22",
      ctc: 5200000, bank: "SBIN0007812", gender: "female" as const,
    },
    {
      code: "PP-1004", name: "Arjun Nair", email: "arjun.nair@peoplepay360.io",
      phone: "+91 97401 55123", dept: "Finance", desig: "Senior Payroll Manager",
      type: "full_time" as const, status: "active" as const, joinedOn: "2017-06-01",
      ctc: 6100000, bank: "UTIB0002109", gender: "male" as const,
    },
    {
      code: "PP-1005", name: "Devika Rao", email: "devika.rao@peoplepay360.io",
      phone: "+91 88670 22190", dept: "Finance", desig: "Payroll Specialist",
      type: "full_time" as const, status: "active" as const, joinedOn: "2021-11-15",
      ctc: 1800000, bank: "KKBK0001092", gender: "female" as const,
    },
    {
      code: "PP-1006", name: "Karan Shah", email: "karan.shah@peoplepay360.io",
      phone: "+91 93761 09912", dept: "IT", desig: "IT Asset Manager",
      type: "full_time" as const, status: "active" as const, joinedOn: "2020-02-17",
      ctc: 2100000, bank: "BARB0INDAHM", gender: "male" as const,
    },
    {
      code: "PP-1007", name: "Priya Sharma", email: "priya.sharma@peoplepay360.io",
      phone: "+91 91340 66710", dept: "People Ops", desig: "HR Associate",
      type: "full_time" as const, status: "onboarding" as const, joinedOn: "2026-09-01",
      ctc: 1950000, bank: "HDFC0004128", gender: "female" as const,
    },
    {
      code: "PP-1008", name: "Kabir Sethi", email: "kabir.sethi@peoplepay360.io",
      phone: "+91 98110 33456", dept: "Sales", desig: "Account Executive",
      type: "full_time" as const, status: "notice_period" as const, joinedOn: "2023-03-06",
      ctc: 1650000, bank: "PUNB0182900", gender: "male" as const,
    },
    {
      code: "PP-1009", name: "Meera Krishnan", email: "meera.krishnan@peoplepay360.io",
      phone: "+91 90031 78812", dept: "Engineering", desig: "QA Engineer",
      type: "contract" as const, status: "on_leave" as const, joinedOn: "2024-07-29",
      ctc: 1250000, bank: "IOBA0001923", gender: "female" as const,
    },
    {
      code: "PP-1010", name: "Vikram Bose", email: "vikram.bose@peoplepay360.io",
      phone: "+91 87990 12234", dept: "Support", desig: "Support Lead",
      type: "full_time" as const, status: "active" as const, joinedOn: "2021-05-10",
      ctc: 1450000, bank: "CNRB0002100", gender: "male" as const,
    },
  ];

  const empIds: Record<string, string> = {};
  for (const e of empData) {
    const existing = await prisma.employees.findUnique({ where: { employee_code: e.code } });
    if (existing) {
      const updated = await prisma.employees.update({
        where: { id: existing.id },
        data: {
          full_name: e.name,
          email: e.email,
          phone: e.phone,
          department_id: depts[e.dept],
          designation_id: desigs[e.desig],
          employment_type: e.type,
          status: e.status,
          joining_date: new Date(e.joinedOn),
          bank_account_number: e.bank,
          gender: e.gender,
        },
      });
      empIds[e.code] = updated.id;
    } else {
      const created = await prisma.employees.create({
        data: {
          employee_code: e.code,
          full_name: e.name,
          email: e.email,
          phone: e.phone,
          department_id: depts[e.dept],
          designation_id: desigs[e.desig],
          employment_type: e.type,
          status: e.status,
          joining_date: new Date(e.joinedOn),
          bank_account_number: e.bank,
          gender: e.gender,
        },
      });
      empIds[e.code] = created.id;
    }
  }

  // Set reporting managers
  if (empIds["PP-1001"] && empIds["PP-1002"]) {
    await prisma.employees.update({ where: { id: empIds["PP-1001"] }, data: { reporting_manager_id: empIds["PP-1002"] } });
  }
  if (empIds["PP-1002"] && empIds["PP-1003"]) {
    await prisma.employees.update({ where: { id: empIds["PP-1002"] }, data: { reporting_manager_id: empIds["PP-1003"] } });
  }
  if (empIds["PP-1006"] && empIds["PP-1003"]) {
    await prisma.employees.update({ where: { id: empIds["PP-1006"] }, data: { reporting_manager_id: empIds["PP-1003"] } });
  }
  console.log(`  ✓ ${empData.length} employees`);

  // ── 5. Users & Better-Auth Accounts ─────────────────────────────────────────
  console.log("Creating user accounts & Better-Auth logins...");
  const userData = [
    { email: "admin@peoplepay360.io", role: "admin", empCode: null, name: "Ops Admin" },
    { email: "siddharthtashildar17@gmail.com", role: "admin", empCode: null, name: "Siddharth (Admin)" },
    { email: "sana.iqbal@peoplepay360.io", role: "hr_manager", empCode: "PP-1003", name: "Sana Iqbal" },
    { email: "arjun.nair@peoplepay360.io", role: "payroll_manager", empCode: "PP-1004", name: "Arjun Nair" },
    { email: "devika.rao@peoplepay360.io", role: "payroll_user", empCode: "PP-1005", name: "Devika Rao" },
    { email: "charmi.patel@peoplepay360.io", role: "employee", empCode: "PP-1001", name: "Charmi Patel" },
    { email: "neel.shah@peoplepay360.io", role: "it_asset_manager", empCode: "PP-1006", name: "Neel Shah" },
    { email: "karan.shah@peoplepay360.io", role: "it_asset_manager", empCode: "PP-1006", name: "Karan Shah" },
    { email: "rohan.mehta@peoplepay360.io", role: "employee", empCode: "PP-1002", name: "Rohan Mehta" },
    { email: "priya.deshmukh@peoplepay360.io", role: "employee", empCode: "PP-1007", name: "Priya Deshmukh" },
    { email: "priya.sharma@peoplepay360.io", role: "employee", empCode: "PP-1007", name: "Priya Sharma" },
    { email: "kabir.sethi@peoplepay360.io", role: "employee", empCode: "PP-1008", name: "Kabir Sethi" },
    { email: "meera.krishnan@peoplepay360.io", role: "employee", empCode: "PP-1009", name: "Meera Krishnan" },
    { email: "vikram.bose@peoplepay360.io", role: "employee", empCode: "PP-1010", name: "Vikram Bose" },
    { email: "code.sid17@gmail.com", role: "employee", empCode: "PP-1001", name: "Jeffrey Paul" },
  ];

  const demoPasswordHash = await hashPassword("demo1234");

  for (const u of userData) {
    const employeeId = u.empCode ? empIds[u.empCode] : null;

    // Better Auth User & Account
    let betterUser = await prisma.user.findUnique({ where: { email: u.email } });
    if (!betterUser) {
      betterUser = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          name: u.name,
          email: u.email,
          emailVerified: true,
          role: u.role,
          employeeId,
        },
      });

      await prisma.account.create({
        data: {
          id: crypto.randomUUID(),
          userId: betterUser.id,
          accountId: betterUser.id,
          providerId: "credential",
          password: demoPasswordHash,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: betterUser.id },
        data: {
          name: u.name,
          role: u.role,
          employeeId: employeeId ?? betterUser.employeeId,
        },
      });

      const acc = await prisma.account.findFirst({ where: { userId: betterUser.id, providerId: "credential" } });
      if (acc) {
        await prisma.account.update({ where: { id: acc.id }, data: { password: demoPasswordHash } });
      } else {
        await prisma.account.create({
          data: {
            id: crypto.randomUUID(),
            userId: betterUser.id,
            accountId: betterUser.id,
            providerId: "credential",
            password: demoPasswordHash,
          },
        });
      }
    }
  }
  console.log(`  ✓ ${userData.length} users + Better Auth accounts`);

  // ── 6. Leave Types ──────────────────────────────────────────────────────────
  console.log("Creating leave types...");
  const leaveTypes = [
    { name: "Casual Leave", code: "CL", isPaid: true, defaultDays: 12 },
    { name: "Sick Leave", code: "SL", isPaid: true, defaultDays: 6 },
    { name: "Earned Leave", code: "EL", isPaid: true, defaultDays: 15 },
    { name: "Maternity Leave", code: "ML", isPaid: true, defaultDays: 180 },
    { name: "Paternity Leave", code: "PL", isPaid: true, defaultDays: 15 },
    { name: "Unpaid Leave", code: "UL", isPaid: false, defaultDays: 0 },
    { name: "Comp Off", code: "CO", isPaid: true, defaultDays: 0 },
  ];

  const leaveTypeIds: Record<string, string> = {};
  for (const lt of leaveTypes) {
    const t = await prisma.leave_types.upsert({
      where: { code: lt.code },
      update: {},
      create: {
        name: lt.name,
        code: lt.code,
        is_paid: lt.isPaid,
        default_annual_allocation: lt.defaultDays,
        requires_allocation: true,
        is_active: true,
      },
    });
    leaveTypeIds[lt.code] = t.id;
  }
  console.log(`  ✓ ${leaveTypes.length} leave types`);

  // ── 7. Contracts (For all 10 Employees) ─────────────────────────────────────
  console.log("Creating contracts...");
  const contractsData = [
    { empCode: "PP-1001", type: "permanent" as const, salary: 2400000, start: "2022-04-11", status: "active" as const },
    { empCode: "PP-1002", type: "permanent" as const, salary: 4100000, start: "2019-08-05", status: "active" as const },
    { empCode: "PP-1003", type: "permanent" as const, salary: 5200000, start: "2018-01-22", status: "active" as const },
    { empCode: "PP-1004", type: "permanent" as const, salary: 1800000, start: "2021-11-15", status: "active" as const },
    { empCode: "PP-1005", type: "permanent" as const, salary: 6100000, start: "2017-06-01", status: "active" as const },
    { empCode: "PP-1006", type: "permanent" as const, salary: 2100000, start: "2020-02-17", status: "active" as const },
    { empCode: "PP-1007", type: "permanent" as const, salary: 1950000, start: "2026-09-01", status: "active" as const },
    { empCode: "PP-1008", type: "permanent" as const, salary: 1650000, start: "2023-03-06", status: "terminated" as const },
    { empCode: "PP-1009", type: "fixed_term" as const, salary: 1250000, start: "2024-07-29", status: "active" as const },
    { empCode: "PP-1010", type: "permanent" as const, salary: 1450000, start: "2021-05-10", status: "active" as const },
  ];

  const contractIds: Record<string, string> = {};
  for (let i = 0; i < contractsData.length; i++) {
    const cd = contractsData[i];
    const num = `CT-${String(i + 1).padStart(4, "0")}`;
    const existing = await prisma.contracts.findUnique({ where: { contract_number: num } });
    if (existing) {
      await prisma.contracts.update({
        where: { id: existing.id },
        data: { salary: cd.salary, status: cd.status },
      });
      contractIds[cd.empCode] = existing.id;
    } else {
      const contract = await prisma.contracts.create({
        data: {
          contract_number: num,
          employee_id: empIds[cd.empCode],
          department_id: depts["Engineering"],
          contract_type: cd.type,
          salary: cd.salary,
          start_date: new Date(cd.start),
          status: cd.status,
          employee_accepted: true,
          accepted_at: new Date(cd.start),
        },
      });
      contractIds[cd.empCode] = contract.id;
    }
  }
  console.log(`  ✓ ${contractsData.length} contracts`);

  // ── 8. Salary Structures ────────────────────────────────────────────────────
  console.log("Creating salary structures...");
  const structData = [
    { name: "Standard Full-Time", description: "Default structure for permanent full-time employees. Covers all statutory deductions.", status: "active" as const, effectiveDate: "2026-04-01" },
    { name: "Senior Leadership", description: "Applies to Director and VP level employees. Higher HRA and variable component.", status: "active" as const, effectiveDate: "2026-04-01" },
    { name: "Internship / Stipend", description: "Simplified structure for interns receiving fixed monthly stipend.", status: "active" as const, effectiveDate: "2026-07-01" },
    { name: "Contractual Consultant", description: "For contract employees paid monthly retainer. TDS deducted at source.", status: "draft" as const, effectiveDate: "2026-10-01" },
  ];

  const structIds: string[] = [];
  for (const s of structData) {
    const existing = await prisma.salary_structures.findFirst({ where: { name: s.name } });
    const struct = existing ?? await prisma.salary_structures.create({
      data: {
        name: s.name,
        description: s.description,
        status: s.status,
        effective_date: new Date(s.effectiveDate),
      },
    });
    structIds.push(struct.id);
  }
  console.log(`  ✓ ${structData.length} salary structures`);

  // ── 9. Salary Rules ─────────────────────────────────────────────────────────
  console.log("Creating salary rules...");
  const ruleData = [
    { name: "Basic Salary", code: "BASIC", type: "earning" as const, calcType: "percentage" as const, pct: 50.00 },
    { name: "House Rent Allowance", code: "HRA", type: "earning" as const, calcType: "percentage" as const, pct: 25.00 },
    { name: "Special Allowance", code: "SPEC_ALLOW", type: "earning" as const, calcType: "percentage" as const, pct: 25.00 },
    { name: "Provident Fund (Employee)", code: "PF_EMP", type: "deduction" as const, calcType: "percentage" as const, pct: 12.00 },
    { name: "Professional Tax", code: "PT", type: "deduction" as const, calcType: "fixed" as const, fixed: 200 },
    { name: "Income Tax (TDS)", code: "TDS", type: "deduction" as const, calcType: "percentage" as const, pct: 10.00 },
  ];

  const ruleIds: Record<string, string> = {};
  for (const r of ruleData) {
    const existing = await prisma.salary_rules.findUnique({ where: { code: r.code } });
    const rule = existing ?? await prisma.salary_rules.create({
      data: {
        name: r.name,
        code: r.code,
        rule_type: r.type,
        calculation_type: r.calcType,
        ...(r.pct !== undefined && { percentage: r.pct }),
        ...(r.fixed !== undefined && { fixed_amount: r.fixed }),
        is_active: true,
      },
    });
    ruleIds[r.code] = rule.id;
  }

  // Attach rules to Standard Full-Time structure
  const standardStructId = structIds[0];
  for (let seq = 0; seq < ruleData.length; seq++) {
    const r = ruleData[seq];
    await prisma.salary_structure_rules.upsert({
      where: { structure_id_rule_id: { structure_id: standardStructId, rule_id: ruleIds[r.code] } },
      update: {},
      create: { structure_id: standardStructId, rule_id: ruleIds[r.code], sequence: (seq + 1) * 10 },
    });
  }
  console.log(`  ✓ ${ruleData.length} salary rules`);

  // ── 10. Employee Salary Structure Assignments (All 10 Employees) ────────────
  console.log("Assigning salary structures to all employees...");
  const salaryAssignments = [
    { empCode: "PP-1001", structIdx: 0 },
    { empCode: "PP-1002", structIdx: 1 },
    { empCode: "PP-1003", structIdx: 1 },
    { empCode: "PP-1004", structIdx: 0 },
    { empCode: "PP-1005", structIdx: 1 },
    { empCode: "PP-1006", structIdx: 0 },
    { empCode: "PP-1007", structIdx: 0 },
    { empCode: "PP-1008", structIdx: 0 },
    { empCode: "PP-1009", structIdx: 3 },
    { empCode: "PP-1010", structIdx: 0 },
  ];

  for (const a of salaryAssignments) {
    const existing = await prisma.employee_salary_structures.findFirst({
      where: { employee_id: empIds[a.empCode], is_current: true },
    });
    if (!existing) {
      await prisma.employee_salary_structures.create({
        data: {
          employee_id: empIds[a.empCode],
          structure_id: structIds[a.structIdx],
          effective_from: new Date("2026-04-01"),
          is_current: true,
        },
      });
    }
  }
  console.log(`  ✓ ${salaryAssignments.length} salary structure assignments`);

  // ── 11. Allowance Types ─────────────────────────────────────────────────────
  console.log("Creating allowance types...");
  const allowanceTypeData = [
    { name: "House Rent Allowance", code: "HRA", defaultAmount: 15000 },
    { name: "Travel Allowance", code: "TA", defaultAmount: 5000 },
    { name: "Internet Allowance", code: "IA", defaultAmount: 1500 },
    { name: "Meal Allowance", code: "MA", defaultAmount: 3000 },
    { name: "Performance Allowance", code: "PA", defaultAmount: 10000 },
    { name: "Special Allowance", code: "SA", defaultAmount: 5000 },
  ];

  const allowTypeIds: Record<string, string> = {};
  for (const a of allowanceTypeData) {
    const t = await prisma.allowance_types.upsert({
      where: { code: a.code },
      update: {},
      create: { name: a.name, code: a.code, default_amount: a.defaultAmount, is_active: true },
    });
    allowTypeIds[a.code] = t.id;
  }
  console.log(`  ✓ ${allowanceTypeData.length} allowance types`);

  // ── 12. Employee Allowances ─────────────────────────────────────────────────
  console.log("Creating employee allowances...");
  const allowances = [
    { empCode: "PP-1001", typeCode: "HRA", amount: 8000 },
    { empCode: "PP-1001", typeCode: "TA", amount: 3000 },
    { empCode: "PP-1002", typeCode: "HRA", amount: 20000 },
    { empCode: "PP-1002", typeCode: "PA", amount: 12000 },
    { empCode: "PP-1003", typeCode: "HRA", amount: 25000 },
    { empCode: "PP-1003", typeCode: "SA", amount: 10000 },
    { empCode: "PP-1004", typeCode: "MA", amount: 3500 },
    { empCode: "PP-1005", typeCode: "IA", amount: 2500 },
    { empCode: "PP-1006", typeCode: "TA", amount: 4000 },
    { empCode: "PP-1007", typeCode: "SA", amount: 12000 },
    { empCode: "PP-1010", typeCode: "PA", amount: 8000 },
  ];

  for (const a of allowances) {
    const existing = await prisma.employee_allowances.findFirst({
      where: { employee_id: empIds[a.empCode], allowance_type_id: allowTypeIds[a.typeCode] },
    });
    if (!existing) {
      await prisma.employee_allowances.create({
        data: {
          employee_id: empIds[a.empCode],
          allowance_type_id: allowTypeIds[a.typeCode],
          amount: a.amount,
          frequency: "monthly",
          effective_from: new Date("2026-04-01"),
          status: "active",
        },
      });
    }
  }
  console.log(`  ✓ ${allowances.length} employee allowances`);

  // ── 13. Reimbursements ──────────────────────────────────────────────────────
  console.log("Creating reimbursement categories & claims...");
  const reimCategories = ["Travel", "Food", "Medical", "Internet", "Office Supplies", "Training", "Other"];
  const reimCatIds: Record<string, string> = {};
  for (const c of reimCategories) {
    const cat = await prisma.reimbursement_categories.upsert({
      where: { name: c },
      update: {},
      create: { name: c },
    });
    reimCatIds[c] = cat.id;
  }

  const reimbData = [
    { empCode: "PP-1001", cat: "Travel", amount: 4500, date: "2026-08-10", desc: "Client visit — Pune sprint", status: "submitted" as const },
    { empCode: "PP-1002", cat: "Food", amount: 1200, date: "2026-08-12", desc: "Team lunch — Bengaluru engineering", status: "manager_approved" as const },
    { empCode: "PP-1003", cat: "Training", amount: 15000, date: "2026-07-20", desc: "SHRM international certification", status: "finance_approved" as const },
    { empCode: "PP-1004", cat: "Internet", amount: 1500, date: "2026-08-01", desc: "High-speed broadband August", status: "paid" as const },
    { empCode: "PP-1005", cat: "Medical", amount: 3200, date: "2026-08-15", desc: "Dental optical checkup", status: "submitted" as const },
    { empCode: "PP-1006", cat: "Office Supplies", amount: 800, date: "2026-08-20", desc: "USB hub + cable organizer", status: "submitted" as const },
    { empCode: "PP-1007", cat: "Travel", amount: 2200, date: "2026-09-02", desc: "Airport shuttle for team sync", status: "manager_approved" as const },
  ];

  for (const r of reimbData) {
    const existing = await prisma.reimbursements.findFirst({
      where: { employee_id: empIds[r.empCode], description: r.desc },
    });
    if (!existing) {
      await prisma.reimbursements.create({
        data: {
          employee_id: empIds[r.empCode],
          category_id: reimCatIds[r.cat],
          expense_date: new Date(r.date),
          amount: r.amount,
          description: r.desc,
          status: r.status,
          ...(r.status === "paid" && { paid_at: new Date(), paid_amount: r.amount }),
          ...(r.status !== "submitted" && { manager_reviewed_at: new Date() }),
        },
      });
    }
  }
  console.log(`  ✓ Reimbursements created`);

  // ── 14. Assets ──────────────────────────────────────────────────────────────
  console.log("Creating assets inventory...");
  const assetData = [
    { code: "ASSET-001", type: "Laptop", serial: "C02XK9LMQ1", cond: "good" as const, status: "assigned" as const, empCode: "PP-1001", cost: 210000, loc: "Ahmedabad" },
    { code: "ASSET-002", type: "Laptop", serial: "DL7450X118", cond: "good" as const, status: "assigned" as const, empCode: "PP-1004", cost: 128000, loc: "Pune" },
    { code: "ASSET-003", type: "Laptop", serial: "TPX1C99201", cond: "good" as const, status: "available" as const, empCode: null, cost: 145000, loc: "Ahmedabad IT Vault" },
    { code: "ASSET-004", type: "Monitor", serial: "LGUF27A882", cond: "good" as const, status: "assigned" as const, empCode: "PP-1002", cost: 42000, loc: "Bengaluru" },
    { code: "ASSET-005", type: "Mobile phone", serial: "IP15X772210", cond: "good" as const, status: "assigned" as const, empCode: "PP-1008", cost: 79000, loc: "Delhi" },
    { code: "ASSET-006", type: "Keyboard", serial: "LGMX772103", cond: "good" as const, status: "available" as const, empCode: null, cost: 14500, loc: "Ahmedabad Storage" },
    { code: "ASSET-007", type: "Software license", serial: "FIG-ORG-0031", cond: "good" as const, status: "assigned" as const, empCode: "PP-1007", cost: 38000, loc: "Cloud" },
    { code: "ASSET-008", type: "Laptop", serial: "MBA3M11290", cond: "under_repair" as const, status: "under_repair" as const, empCode: null, cost: 118000, loc: "Apple Authorized Service" },
    { code: "ASSET-009", type: "Monitor", serial: "DLP2422H01", cond: "retired" as const, status: "retired" as const, empCode: null, cost: 18000, loc: "E-waste Buffer" },
    { code: "ASSET-010", type: "Laptop", serial: "MBP16M4X77", cond: "good" as const, status: "assigned" as const, empCode: "PP-1002", cost: 320000, loc: "Bengaluru" },
    { code: "ASSET-011", type: "Access card", serial: "HID-PROX-8821", cond: "good" as const, status: "assigned" as const, empCode: "PP-1001", cost: 1200, loc: "Ahmedabad" },
    { code: "ASSET-012", type: "Other", serial: "YK5CNFC-9002", cond: "good" as const, status: "available" as const, empCode: null, cost: 5500, loc: "IT Safe" },
  ];

  for (const a of assetData) {
    const existing = await prisma.assets.findUnique({ where: { asset_code: a.code } });
    if (!existing) {
      await prisma.assets.create({
        data: {
          asset_code: a.code,
          asset_type: a.type,
          serial_number: a.serial,
          condition: a.cond,
          status: a.status,
          purchase_date: new Date("2024-01-15"),
          purchase_cost: a.cost,
          current_employee_id: a.empCode ? empIds[a.empCode] : null,
          location: a.loc,
        },
      });
    }
  }
  console.log(`  ✓ ${assetData.length} assets`);

  // ── 15. Asset Requests ──────────────────────────────────────────────────────
  console.log("Creating asset requests...");
  const assetReqs = [
    { empCode: "PP-1007", type: "Laptop", reason: "MacBook Pro 14 + external monitor for new hire setup", status: "pending" as const },
    { empCode: "PP-1001", type: "Other", reason: "Noise cancelling wireless headset for client sync calls", status: "approved" as const },
    { empCode: "PP-1010", type: "Monitor", reason: "Second monitor for ticket queue triage management", status: "fulfilled" as const },
  ];

  for (const r of assetReqs) {
    const existing = await prisma.asset_requests.findFirst({
      where: { employee_id: empIds[r.empCode], reason: r.reason },
    });
    if (!existing) {
      await prisma.asset_requests.create({
        data: {
          employee_id: empIds[r.empCode],
          asset_type_requested: r.type,
          reason: r.reason,
          status: r.status,
          ...(r.status !== "pending" && { resolved_at: new Date() }),
        },
      });
    }
  }
  console.log(`  ✓ Asset requests created`);

  // ── 16. IT Helpdesk Tickets ─────────────────────────────────────────────────
  console.log("Creating IT helpdesk tickets & comments...");
  const ticketData = [
    { empCode: "PP-1001", num: "TKT-301", cat: "software" as const, pri: "medium" as const, subj: "IntelliJ IDEA Ultimate license renewal required", status: "in_progress" as const, desc: "License expired on 31 August. Please renew enterprise key." },
    { empCode: "PP-1004", num: "TKT-302", cat: "hardware" as const, pri: "high" as const, subj: "Laptop battery draining abnormally fast", status: "open" as const, desc: "Battery health indicator reports 42% remaining capacity. Needs replacement battery." },
    { empCode: "PP-1007", num: "TKT-303", cat: "account_access" as const, pri: "critical" as const, subj: "VPN and Notion onboarding workspace permissions", status: "resolved" as const, desc: "Access requested for Design System workspace." },
    { empCode: "PP-1010", num: "TKT-304", cat: "other" as const, pri: "low" as const, subj: "August statutory tax deduction slip question", status: "open" as const, desc: "Difference observed in TDS computation between portal payslip and old regime declaration." },
    { empCode: "PP-1003", num: "TKT-305", cat: "network" as const, pri: "high" as const, subj: "Wi-Fi roaming dropouts on Ahmedabad 3rd Floor East Wing", status: "in_progress" as const, desc: "Packet loss observed during Zoom calls around Meeting Room B." },
    { empCode: "PP-1008", num: "TKT-306", cat: "account_access" as const, pri: "medium" as const, subj: "Offboarding laptop and access card return courier", status: "open" as const, desc: "Requesting return shipping kit and pickup for company assets prior to LWD." },
  ];

  for (const t of ticketData) {
    const existing = await prisma.it_tickets.findUnique({ where: { ticket_number: t.num } });
    if (!existing) {
      await prisma.it_tickets.create({
        data: {
          ticket_number: t.num,
          employee_id: empIds[t.empCode],
          category: t.cat,
          priority: t.pri,
          subject: t.subj,
          description: t.desc,
          status: t.status,
          ...(t.status === "resolved" && { resolved_at: new Date() }),
        },
      });
    }
  }
  console.log(`  ✓ ${ticketData.length} helpdesk tickets`);

  // ── 17. Payroll Run + Payslips (August 2026) ────────────────────────────────
  console.log("Creating payroll run & payslips...");
  const existingRun = await prisma.payroll_runs.findFirst({
    where: { period_month: 8, period_year: 2026 },
  });

  const payrollRun = existingRun ?? await prisma.payroll_runs.create({
    data: {
      period_month: 8,
      period_year: 2026,
      status: "paid",
      pay_date: new Date("2026-08-31"),
      processed_at: new Date("2026-08-29"),
      paid_at: new Date("2026-08-31"),
    },
  });

  const payslipCalcs = [
    { empCode: "PP-1001", gross: 200000, basic: 100000, hra: 50000, allow: 50000, ded: 25400, tax: 15000, net: 174600 },
    { empCode: "PP-1002", gross: 341667, basic: 170833, hra: 85417, allow: 85417, ded: 43200, tax: 28000, net: 298467 },
    { empCode: "PP-1003", gross: 433333, basic: 216667, hra: 108333, allow: 108333, ded: 55200, tax: 43333, net: 378133 },
    { empCode: "PP-1004", gross: 150000, basic: 75000, hra: 37500, allow: 37500, ded: 19200, tax: 10000, net: 130800 },
    { empCode: "PP-1005", gross: 508333, basic: 254167, hra: 127083, allow: 127083, ded: 64600, tax: 50000, net: 443733 },
    { empCode: "PP-1006", gross: 175000, basic: 87500, hra: 43750, allow: 43750, ded: 22400, tax: 12000, net: 152600 },
    { empCode: "PP-1007", gross: 162500, basic: 81250, hra: 40625, allow: 40625, ded: 20800, tax: 11000, net: 141700 },
    { empCode: "PP-1008", gross: 137500, basic: 68750, hra: 34375, allow: 34375, ded: 17600, tax: 9000, net: 119900 },
    { empCode: "PP-1009", gross: 104167, basic: 52083, hra: 26042, allow: 26042, ded: 13400, tax: 6000, net: 90767 },
    { empCode: "PP-1010", gross: 120833, basic: 60417, hra: 30208, allow: 30208, ded: 15600, tax: 8000, net: 105233 },
  ];

  for (const p of payslipCalcs) {
    const existing = await prisma.payslips.findFirst({
      where: { payroll_run_id: payrollRun.id, employee_id: empIds[p.empCode] },
    });
    if (!existing) {
      await prisma.payslips.create({
        data: {
          payroll_run_id: payrollRun.id,
          employee_id: empIds[p.empCode],
          contract_id: contractIds[p.empCode],
          structure_id: structIds[0],
          period_month: 8,
          period_year: 2026,
          working_days: 22,
          present_days: 22,
          basic_salary: p.basic,
          allowances_total: p.allow,
          gross_salary: p.gross,
          deductions_total: p.ded,
          tax_amount: p.tax,
          net_salary: p.net,
          status: "paid",
          payment_status: "paid",
          bank_account_snapshot: "HDFC****1234",
          email_status: "sent",
        },
      });
    }
  }
  console.log(`  ✓ Payslips created for all 10 employees`);

  // ── 18. Leave Requests ──────────────────────────────────────────────────────
  console.log("Creating leave requests...");
  const leaveReqs = [
    { empCode: "PP-1001", typeCode: "CL", start: "2026-08-05", end: "2026-08-06", days: 2, reason: "Family function", status: "approved" as const },
    { empCode: "PP-1006", typeCode: "SL", start: "2026-08-12", end: "2026-08-12", days: 1, reason: "Viral fever", status: "approved" as const },
    { empCode: "PP-1007", typeCode: "EL", start: "2026-09-01", end: "2026-09-05", days: 5, reason: "Family vacation", status: "pending" as const },
    { empCode: "PP-1002", typeCode: "CL", start: "2026-09-10", end: "2026-09-10", days: 1, reason: "Personal bank appointment", status: "pending" as const },
    { empCode: "PP-1003", typeCode: "EL", start: "2026-10-15", end: "2026-10-20", days: 6, reason: "Annual leave", status: "pending" as const },
    { empCode: "PP-1009", typeCode: "SL", start: "2026-09-04", end: "2026-09-08", days: 4, reason: "Medical recovery", status: "approved" as const },
  ];

  for (const r of leaveReqs) {
    const existing = await prisma.leave_requests.findFirst({
      where: { employee_id: empIds[r.empCode], reason: r.reason },
    });
    if (!existing) {
      await prisma.leave_requests.create({
        data: {
          employee_id: empIds[r.empCode],
          leave_type_id: leaveTypeIds[r.typeCode],
          start_date: new Date(r.start),
          end_date: new Date(r.end),
          days: r.days,
          reason: r.reason,
          status: r.status,
        },
      });
    }
  }
  console.log(`  ✓ Leave requests created`);

  // ── 19. Attendance Records (Last 10 Days) ────────────────────────────────────
  console.log("Creating live attendance records...");
  const today = new Date("2026-09-05T00:00:00Z");
  let attCount = 0;
  for (let i = 9; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);

    for (const empCode of Object.keys(empIds)) {
      const existing = await prisma.attendance.findUnique({
        where: { employee_id_attendance_date: { employee_id: empIds[empCode], attendance_date: date } },
      });
      if (!existing) {
        const isLate = empCode === "PP-1004" && i === 0;
        const isOnLeave = empCode === "PP-1009";
        const isHalfDay = empCode === "PP-1008" && i === 0;

        const checkIn = isOnLeave ? null : new Date(`${dateStr}T${isLate ? "09:48:00" : isHalfDay ? "10:15:00" : "09:05:00"}Z`);
        const checkOut = isOnLeave ? null : new Date(`${dateStr}T${isHalfDay ? "15:30:00" : "18:15:00"}Z`);
        const status = isOnLeave ? "on_leave" : isLate ? "late" : isHalfDay ? "half_day" : "present";

        await prisma.attendance.create({
          data: {
            employee_id: empIds[empCode],
            attendance_date: date,
            check_in: checkIn,
            check_out: checkOut,
            status,
          },
        });
        attCount++;
      }
    }
  }
  console.log(`  ✓ ${attCount} attendance records populated in database`);

  // ── 20. Work Schedules ──────────────────────────────────────────────────────
  console.log("Creating work schedules...");
  const seedSchedules = [
    {
      code: "SCH-001",
      name: "Standard General Shift (9 AM - 6 PM)",
      description: "Core company business hours. Monday to Friday with 1 hour lunch break.",
      shift_type: "General",
      working_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      start_time: "09:00",
      end_time: "18:00",
      break_duration_minutes: 60,
      break_start_time: "13:00",
      break_end_time: "14:00",
      daily_hours: 8.0,
      weekly_hours: 40.0,
      color: "#3b82f6",
      is_default: true,
      status: "active",
    },
    {
      code: "SCH-002",
      name: "Engineering Morning Shift (8 AM - 4:30 PM)",
      description: "Early engineering & architecture sprint schedule with 30m break.",
      shift_type: "Morning",
      working_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      start_time: "08:00",
      end_time: "16:30",
      break_duration_minutes: 30,
      break_start_time: "12:30",
      break_end_time: "13:00",
      daily_hours: 8.0,
      weekly_hours: 40.0,
      color: "#10b981",
      is_default: false,
      status: "active",
    },
    {
      code: "SCH-003",
      name: "Customer Operations Evening Shift (2 PM - 11 PM)",
      description: "Global enterprise customer coverage shift with 1 hour dinner break.",
      shift_type: "Evening",
      working_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      start_time: "14:00",
      end_time: "23:00",
      break_duration_minutes: 60,
      break_start_time: "18:00",
      break_end_time: "19:00",
      daily_hours: 8.0,
      weekly_hours: 40.0,
      color: "#f59e0b",
      is_default: false,
      status: "active",
    },
    {
      code: "SCH-004",
      name: "Flexible 4-Day Leadership Shift",
      description: "Condensed 4-day executive & technical lead schedule (Mon - Thu).",
      shift_type: "Flexible",
      working_days: ["Monday", "Tuesday", "Wednesday", "Thursday"],
      start_time: "08:30",
      end_time: "19:00",
      break_duration_minutes: 30,
      break_start_time: "13:00",
      break_end_time: "13:30",
      daily_hours: 10.0,
      weekly_hours: 40.0,
      color: "#8b5cf6",
      is_default: false,
      status: "active",
    },
  ];

  for (const s of seedSchedules) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO work_schedules (
        code, name, description, shift_type, working_days, start_time, end_time,
        break_duration_minutes, break_start_time, break_end_time, daily_hours, weekly_hours,
        color, is_default, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5::text[], $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        shift_type = EXCLUDED.shift_type,
        working_days = EXCLUDED.working_days,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        break_duration_minutes = EXCLUDED.break_duration_minutes,
        break_start_time = EXCLUDED.break_start_time,
        break_end_time = EXCLUDED.break_end_time,
        daily_hours = EXCLUDED.daily_hours,
        weekly_hours = EXCLUDED.weekly_hours,
        color = EXCLUDED.color,
        is_default = EXCLUDED.is_default,
        updated_at = NOW();`,
      s.code,
      s.name,
      s.description,
      s.shift_type,
      s.working_days,
      s.start_time,
      s.end_time,
      s.break_duration_minutes,
      s.break_start_time,
      s.break_end_time,
      s.daily_hours,
      s.weekly_hours,
      s.color,
      s.is_default,
      s.status
    );
  }

  const defaultSchRes: any[] = await prisma.$queryRawUnsafe(
    `SELECT id FROM work_schedules WHERE is_default = true LIMIT 1;`
  );
  if (defaultSchRes[0]?.id) {
    const allEmps = await prisma.employees.findMany({ select: { id: true } });
    for (const emp of allEmps) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO employee_schedules (schedule_id, employee_id, assigned_at)
         VALUES ($1::uuid, $2::uuid, NOW())
         ON CONFLICT (employee_id) DO NOTHING;`,
        defaultSchRes[0].id,
        emp.id
      );
    }
  }
  console.log(`  ✓ Work schedules assigned`);

  // ── 21. Onboarding Processes & Tasks ────────────────────────────────────────
  console.log("Creating onboarding processes & checklists...");
  const onboardingEmps = ["PP-1001", "PP-1007"];
  for (const code of onboardingEmps) {
    const empId = empIds[code];
    if (!empId) continue;
    let proc = await prisma.onboarding_processes.findUnique({ where: { employee_id: empId } });
    if (!proc) {
      proc = await prisma.onboarding_processes.create({
        data: {
          employee_id: empId,
          started_at: new Date("2026-08-15"),
          status: "in_progress",
        },
      });

      const tasks = [
        { name: "Complete personal profile", dept: "Employee", done: true, seq: 1 },
        { name: "Add emergency contact", dept: "Employee", done: true, seq: 2 },
        { name: "Accept company policies & code of conduct", dept: "HR", done: true, seq: 3 },
        { name: "Submit bank salary account details", dept: "Finance", done: true, seq: 4 },
        { name: "Declare tax regime & PAN verification", dept: "Finance", done: true, seq: 5 },
        { name: "Sign employment contract & NDA", dept: "HR", done: true, seq: 6 },
        { name: "Attend tech team orientation", dept: "HR", done: true, seq: 7 },
        { name: "Acknowledge IT laptop & security token receipt", dept: "IT", done: false, seq: 8 },
      ];

      for (const t of tasks) {
        await prisma.onboarding_tasks.create({
          data: {
            onboarding_process_id: proc.id,
            task_name: t.name,
            responsible_department: t.dept,
            sequence: t.seq,
            status: t.done ? "completed" : "not_started",
            ...(t.done && { completed_at: new Date() }),
          },
        });
      }
    }
  }
  console.log(`  ✓ Onboarding processes & tasks created`);

  // ── 22. Offboarding Processes & Clearance Tasks ─────────────────────────────
  console.log("Creating offboarding process & clearance tasks...");
  const offboardingCode = "PP-1008";
  const offboardingEmpId = empIds[offboardingCode];
  if (offboardingEmpId) {
    let offProc = await prisma.offboarding_processes.findFirst({ where: { employee_id: offboardingEmpId } });
    if (!offProc) {
      offProc = await prisma.offboarding_processes.create({
        data: {
          employee_id: offboardingEmpId,
          resignation_date: new Date("2026-08-15"),
          last_working_date: new Date("2026-09-30"),
          reason: "Voluntary separation — pursuing higher education",
          notice_period_days: 30,
          status: "in_progress",
          final_settlement_status: "pending",
        },
      });

      const clearanceItems = [
        { name: "Return company laptop & monitor", dept: "IT", cleared: false },
        { name: "Revoke SSO and GitHub repository access", dept: "IT", cleared: true },
        { name: "Settle outstanding travel claims", dept: "Finance", cleared: true },
        { name: "Surrender corporate credit card", dept: "Finance", cleared: false },
        { name: "Exit interview & knowledge handover sign-off", dept: "HR", cleared: false },
        { name: "Surrender RFID access card & pedestal keys", dept: "Admin", cleared: false },
      ];

      for (const item of clearanceItems) {
        await prisma.offboarding_clearance_tasks.create({
          data: {
            offboarding_process_id: offProc.id,
            task_name: item.name,
            department: item.dept,
            status: item.cleared ? "completed" : "pending",
            ...(item.cleared && { completed_at: new Date() }),
          },
        });
      }
    }
  }
  console.log(`  ✓ Offboarding processes & clearance tasks created`);

  // ── 23. Audit Log ───────────────────────────────────────────────────────────
  console.log("Creating audit trail logs...");
  const auditEntries = [
    { action: "Initiated September 2026 draft payroll run PR-2609", module: "Payroll", actor: "Devika Rao" },
    { action: "Assigned Figma Organization seat to Priya Deshmukh", module: "Assets", actor: "Neel Shah" },
    { action: "Approved leave request LV-502 for Meera Krishnan", module: "Time Off", actor: "Sana Iqbal" },
    { action: "Approved August travel reimbursement CLM-902", module: "Reimbursements", actor: "Arjun Nair" },
    { action: "Scheduled offboarding and exit interview for Kabir Sethi", module: "Lifecycle", actor: "Sana Iqbal" },
    { action: "Provisioned employee account and company email for Priya Deshmukh", module: "Provisioning", actor: "Ops Admin" },
  ];

  for (const entry of auditEntries) {
    await prisma.audit_log.create({
      data: {
        table_name: entry.module,
        record_id: crypto.randomUUID(),
        action: "insert",
        new_data: entry,
      },
    });
  }
  console.log(`  ✓ ${auditEntries.length} audit trail logs created`);

  console.log("\n=======================================================");
  console.log("🎉 SUCCESS: Entire database is fully populated with live data!");
  console.log("=======================================================");
  console.log("\nQuick Login Accounts (password: demo1234):");
  userData.forEach((u) => console.log(`  • ${u.email.padEnd(38)} [${u.role}]`));
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
