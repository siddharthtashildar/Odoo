/**
 * PeoplePay360 — Database Seed Script
 * Populates the Neon PostgreSQL database with all demo data
 * Run: npx tsx src/seed.ts
 */

import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding PeoplePay360 database...\n");

  // ── 1. Roles ────────────────────────────────────────────────────────────────
  console.log("Creating roles...");
  const roleNames = [
    { name: "admin", description: "Full system administrator" },
    { name: "hr_manager", description: "HR Manager — full people ops access" },
    { name: "hr_user", description: "HR User — limited HR access" },
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
    { title: "Sales Executive", deptName: "Sales" },
    { title: "Software Engineer", deptName: "Engineering" },
    { title: "IT Asset Manager", deptName: "IT" },
    { title: "HR Business Partner", deptName: "People Ops" },
    { title: "Payroll Specialist", deptName: "Finance" },
    { title: "Senior Payroll Manager", deptName: "Finance" },
  ];

  const desigs: Record<string, string> = {};
  for (const d of desigData) {
    const desig = await prisma.designations.upsert({
      where: { id: (await prisma.designations.findFirst({ where: { title: d.title } }))?.id ?? "00000000-0000-0000-0000-000000000000" },
      update: {},
      create: { title: d.title, department_id: depts[d.deptName] },
    });
    desigs[d.title] = desig.id;
  }
  console.log(`  ✓ ${desigData.length} designations`);

  // ── 4. Employees ────────────────────────────────────────────────────────────
  console.log("Creating employees...");
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
      phone: "+91 87634 22190", dept: "Finance", desig: "Senior Payroll Manager",
      type: "full_time" as const, status: "active" as const, joinedOn: "2020-03-15",
      ctc: 3200000, bank: "AXIS0002341", gender: "male" as const,
    },
    {
      code: "PP-1005", name: "Devika Rao", email: "devika.rao@peoplepay360.io",
      phone: "+91 94512 88231", dept: "People Ops", desig: "HR Business Partner",
      type: "full_time" as const, status: "active" as const, joinedOn: "2021-06-10",
      ctc: 4800000, bank: "KOTAK0005512", gender: "female" as const,
    },
    {
      code: "PP-1006", name: "Karan Shah", email: "karan.shah@peoplepay360.io",
      phone: "+91 78923 44001", dept: "Engineering", desig: "Software Engineer",
      type: "full_time" as const, status: "active" as const, joinedOn: "2023-01-03",
      ctc: 2800000, bank: "HDFC0008832", gender: "male" as const,
    },
    {
      code: "PP-1007", name: "Priya Sharma", email: "priya.sharma@peoplepay360.io",
      phone: "+91 99001 55432", dept: "Product", desig: "Product Manager",
      type: "full_time" as const, status: "active" as const, joinedOn: "2021-09-20",
      ctc: 1800000, bank: "HDFC0009921", gender: "female" as const,
    },
  ];

  const empIds: Record<string, string> = {};
  for (const e of empData) {
    const existing = await prisma.employees.findUnique({ where: { employee_code: e.code } });
    const emp = existing ?? await prisma.employees.create({
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
    empIds[e.code] = emp.id;
  }
  // Set reporting manager for Charmi → Rohan, Rohan → Sana
  await prisma.employees.update({ where: { id: empIds["PP-1001"] }, data: { reporting_manager_id: empIds["PP-1002"] } });
  await prisma.employees.update({ where: { id: empIds["PP-1002"] }, data: { reporting_manager_id: empIds["PP-1003"] } });
  await prisma.employees.update({ where: { id: empIds["PP-1006"] }, data: { reporting_manager_id: empIds["PP-1002"] } });
  console.log(`  ✓ ${empData.length} employees`);

  // ── 5. Users (login accounts) ───────────────────────────────────────────────
  console.log("Creating user accounts...");
  const userData = [
    { email: "admin@peoplepay360.io", role: "admin", empCode: null },
    { email: "sana.iqbal@peoplepay360.io", role: "hr_manager", empCode: "PP-1003" },
    { email: "devika.rao@peoplepay360.io", role: "hr_user", empCode: "PP-1005" },
    { email: "arjun.nair@peoplepay360.io", role: "payroll_manager", empCode: "PP-1004" },
    { email: "charmi.patel@peoplepay360.io", role: "payroll_user", empCode: "PP-1001" },
    { email: "karan.shah@peoplepay360.io", role: "it_asset_manager", empCode: "PP-1006" },
    { email: "rohan.mehta@peoplepay360.io", role: "employee", empCode: "PP-1002" },
    { email: "priya.sharma@peoplepay360.io", role: "employee", empCode: "PP-1007" },
  ];

  const demoPasswordHash = await hashPassword("demo1234");

  for (const u of userData) {
    // Legacy users table
    await prisma.users.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        password_hash: "$2b$10$demo_hash_not_real_for_hackathon_only",
        role_id: roles[u.role],
        employee_id: u.empCode ? empIds[u.empCode] : null,
        is_active: true,
      },
    });

    // Better Auth User & Account
    let betterUser = await prisma.user.findUnique({ where: { email: u.email } });
    if (!betterUser) {
      const empName = u.empCode ? empData.find((e) => e.code === u.empCode)?.name ?? u.email : "System Admin";
      betterUser = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          name: empName,
          email: u.email,
          emailVerified: true,
          role: u.role,
          employeeId: u.empCode ? empIds[u.empCode] : null,
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

  // ── 7. Contracts ────────────────────────────────────────────────────────────
  console.log("Creating contracts...");
  const contractsData = [
    { empCode: "PP-1001", type: "permanent" as const, salary: 200000, start: "2022-04-11", status: "active" as const },
    { empCode: "PP-1002", type: "permanent" as const, salary: 341667, start: "2019-08-05", status: "active" as const },
    { empCode: "PP-1003", type: "permanent" as const, salary: 433333, start: "2018-01-22", status: "active" as const },
    { empCode: "PP-1004", type: "permanent" as const, salary: 266667, start: "2020-03-15", status: "active" as const },
    { empCode: "PP-1005", type: "permanent" as const, salary: 400000, start: "2021-06-10", status: "active" as const },
    { empCode: "PP-1006", type: "permanent" as const, salary: 233333, start: "2023-01-03", status: "active" as const },
    { empCode: "PP-1007", type: "permanent" as const, salary: 150000, start: "2021-09-20", status: "active" as const },
  ];

  const contractIds: Record<string, string> = {};
  for (let i = 0; i < contractsData.length; i++) {
    const cd = contractsData[i];
    const num = `CT-${String(i + 1).padStart(4, "0")}`;
    const existing = await prisma.contracts.findUnique({ where: { contract_number: num } });
    const contract = existing ?? await prisma.contracts.create({
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
  console.log(`  ✓ ${contractsData.length} contracts`);

  // ── 8. Salary Structures ────────────────────────────────────────────────────
  console.log("Creating salary structures...");
  const structData = [
    { name: "Standard Full-Time", description: "Default structure for permanent full-time employees", status: "active" as const, effectiveDate: "2026-04-01" },
    { name: "Senior Leadership", description: "Applies to Director and VP level employees", status: "active" as const, effectiveDate: "2026-04-01" },
    { name: "Internship / Stipend", description: "Simplified structure for interns", status: "active" as const, effectiveDate: "2026-07-01" },
    { name: "Contractual Consultant", description: "For contract employees paid monthly retainer", status: "draft" as const, effectiveDate: "2026-10-01" },
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
    { name: "Basic Salary", code: "BASIC", type: "earning" as const, calcType: "percentage" as const, pct: 40.00 },
    { name: "House Rent Allowance", code: "HRA", type: "earning" as const, calcType: "percentage" as const, pct: 16.00 },
    { name: "Special Allowance", code: "SPEC_ALLOW", type: "earning" as const, calcType: "percentage" as const, pct: 5.33 },
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

  // ── 10. Employee Salary Structure Assignments ───────────────────────────────
  console.log("Assigning salary structures to employees...");
  const salaryAssignments = [
    { empCode: "PP-1001", structIdx: 0 },
    { empCode: "PP-1002", structIdx: 0 },
    { empCode: "PP-1003", structIdx: 1 },
    { empCode: "PP-1004", structIdx: 0 },
    { empCode: "PP-1005", structIdx: 1 },
    { empCode: "PP-1006", structIdx: 0 },
    { empCode: "PP-1007", structIdx: 0 },
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
    { empCode: "PP-1005", typeCode: "IA", amount: 1500 },
    { empCode: "PP-1006", typeCode: "MA", amount: 3000 },
    { empCode: "PP-1007", typeCode: "TA", amount: 2500 },
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

  // ── 13. Reimbursement Categories ────────────────────────────────────────────
  console.log("Creating reimbursement categories...");
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
  console.log(`  ✓ ${reimCategories.length} reimbursement categories`);

  // ── 14. Reimbursements ──────────────────────────────────────────────────────
  console.log("Creating reimbursements...");
  const reimbData = [
    { empCode: "PP-1001", cat: "Travel", amount: 4500, date: "2026-08-10", desc: "Client visit — Pune", status: "submitted" as const },
    { empCode: "PP-1002", cat: "Food", amount: 1200, date: "2026-08-12", desc: "Team lunch — Bengaluru", status: "manager_approved" as const },
    { empCode: "PP-1003", cat: "Training", amount: 15000, date: "2026-07-20", desc: "SHRM certification", status: "finance_approved" as const },
    { empCode: "PP-1004", cat: "Internet", amount: 1500, date: "2026-08-01", desc: "Broadband August", status: "paid" as const },
    { empCode: "PP-1005", cat: "Medical", amount: 3200, date: "2026-08-15", desc: "Dental — Wisdom tooth", status: "submitted" as const },
    { empCode: "PP-1006", cat: "Office Supplies", amount: 800, date: "2026-08-20", desc: "USB hub + cable organizer", status: "submitted" as const },
  ];

  for (const r of reimbData) {
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
  console.log(`  ✓ ${reimbData.length} reimbursements`);

  // ── 15. Assets ──────────────────────────────────────────────────────────────
  console.log("Creating assets...");
  const assetData = [
    { code: "ASSET-001", type: "Laptop", serial: "APL-MBP-2024-001", cond: "good" as const, status: "assigned" as const, empCode: "PP-1001", cost: 145000 },
    { code: "ASSET-002", type: "Laptop", serial: "DELL-XPS-2024-001", cond: "good" as const, status: "assigned" as const, empCode: "PP-1002", cost: 125000 },
    { code: "ASSET-003", type: "Monitor", serial: "LG-27UK-2024-001", cond: "good" as const, status: "assigned" as const, empCode: "PP-1001", cost: 35000 },
    { code: "ASSET-004", type: "Laptop", serial: "HP-ELITEBOOK-2023-001", cond: "good" as const, status: "assigned" as const, empCode: "PP-1003", cost: 95000 },
    { code: "ASSET-005", type: "Mobile phone", serial: "SAMS-S24-2024-001", cond: "good" as const, status: "assigned" as const, empCode: "PP-1003", cost: 80000 },
    { code: "ASSET-006", type: "Laptop", serial: "LENOVO-T14-2023-001", cond: "good" as const, status: "available" as const, empCode: null, cost: 85000 },
    { code: "ASSET-007", type: "Laptop", serial: "APL-MBP-2023-002", cond: "under_repair" as const, status: "under_repair" as const, empCode: null, cost: 130000 },
    { code: "ASSET-008", type: "Access card", serial: "CARD-2024-001", cond: "good" as const, status: "assigned" as const, empCode: "PP-1004", cost: 500 },
    { code: "ASSET-009", type: "Software license", serial: "ADOBE-ENT-2024", cond: "good" as const, status: "assigned" as const, empCode: "PP-1005", cost: 45000 },
    { code: "ASSET-010", type: "Laptop", serial: "APL-MBA-2024-001", cond: "good" as const, status: "assigned" as const, empCode: "PP-1006", cost: 110000 },
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
          location: "Office - Ahmedabad",
        },
      });
    }
  }
  console.log(`  ✓ ${assetData.length} assets`);

  // ── 16. Asset Requests ──────────────────────────────────────────────────────
  console.log("Creating asset requests...");
  const assetReqs = [
    { empCode: "PP-1007", type: "Laptop", reason: "MacBook for design work", status: "pending" as const },
    { empCode: "PP-1006", type: "Monitor", reason: "Second monitor for productivity", status: "approved" as const },
    { empCode: "PP-1002", type: "Mobile phone", reason: "Company phone for client calls", status: "fulfilled" as const },
  ];

  for (const r of assetReqs) {
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
  console.log(`  ✓ ${assetReqs.length} asset requests`);

  // ── 17. IT Helpdesk Tickets ─────────────────────────────────────────────────
  console.log("Creating helpdesk tickets...");
  const ticketData = [
    { empCode: "PP-1001", num: "TKT-0001", cat: "software" as const, pri: "high" as const, subj: "VS Code license not activating", status: "resolved" as const },
    { empCode: "PP-1006", num: "TKT-0002", cat: "hardware" as const, pri: "medium" as const, subj: "Keyboard keys sticking", status: "in_progress" as const },
    { empCode: "PP-1002", num: "TKT-0003", cat: "network" as const, pri: "critical" as const, subj: "VPN dropping frequently in Bengaluru office", status: "open" as const },
    { empCode: "PP-1007", num: "TKT-0004", cat: "account_access" as const, pri: "medium" as const, subj: "Cannot access Figma enterprise account", status: "assigned" as const },
    { empCode: "PP-1004", num: "TKT-0005", cat: "email" as const, pri: "low" as const, subj: "Email signature not saving", status: "closed" as const },
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
          status: t.status,
          ...(t.status === "resolved" && { resolved_at: new Date() }),
          ...(t.status === "closed" && { closed_at: new Date() }),
        },
      });
    }
  }
  console.log(`  ✓ ${ticketData.length} helpdesk tickets`);

  // ── 18. Payroll Run + Payslips ──────────────────────────────────────────────
  console.log("Creating payroll run for Aug 2026...");
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
    { empCode: "PP-1001", contractIdx: 0, gross: 200000, basic: 80000, hra: 32000, allow: 13333, ded: 29533, tax: 8000, net: 163800 },
    { empCode: "PP-1002", contractIdx: 1, gross: 341667, basic: 136667, hra: 54667, allow: 22778, ded: 50511, tax: 13667, net: 269156 },
    { empCode: "PP-1003", contractIdx: 2, gross: 433333, basic: 173333, hra: 86667, allow: 43333, ded: 55200, tax: 34667, net: 334467 },
    { empCode: "PP-1004", contractIdx: 3, gross: 266667, basic: 106667, hra: 42667, allow: 17778, ded: 38844, tax: 10667, net: 215156 },
    { empCode: "PP-1005", contractIdx: 4, gross: 400000, basic: 160000, hra: 80000, allow: 40000, ded: 52000, tax: 32000, net: 295800 },
    { empCode: "PP-1006", contractIdx: 5, gross: 233333, basic: 93333, hra: 37333, allow: 15556, ded: 33756, tax: 9333, net: 176910 },
    { empCode: "PP-1007", contractIdx: 6, gross: 150000, basic: 60000, hra: 24000, allow: 10000, ded: 21600, tax: 6000, net: 127800 },
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
  console.log(`  ✓ Payroll run Aug 2026 + ${payslipCalcs.length} payslips`);

  // ── 19. Leave Requests ──────────────────────────────────────────────────────
  console.log("Creating leave requests...");
  const leaveReqs = [
    { empCode: "PP-1001", typeCode: "CL", start: "2026-08-05", end: "2026-08-06", days: 2, reason: "Family function", status: "approved" as const },
    { empCode: "PP-1006", typeCode: "SL", start: "2026-08-12", end: "2026-08-12", days: 1, reason: "Fever", status: "approved" as const },
    { empCode: "PP-1007", typeCode: "EL", start: "2026-09-01", end: "2026-09-05", days: 5, reason: "Vacation", status: "pending" as const },
    { empCode: "PP-1002", typeCode: "CL", start: "2026-09-10", end: "2026-09-10", days: 1, reason: "Personal work", status: "pending" as const },
    { empCode: "PP-1003", typeCode: "EL", start: "2026-10-15", end: "2026-10-20", days: 6, reason: "Annual leave", status: "pending" as const },
  ];

  for (const r of leaveReqs) {
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
  console.log(`  ✓ ${leaveReqs.length} leave requests`);

  // ── 20. Attendance (last 7 days) ────────────────────────────────────────────
  console.log("Creating attendance records...");
  const today = new Date();
  let attCount = 0;
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);

    for (const empCode of Object.keys(empIds)) {
      const existing = await prisma.attendance.findUnique({
        where: { employee_id_attendance_date: { employee_id: empIds[empCode], attendance_date: date } },
      });
      if (!existing) {
        const checkIn = new Date(`${dateStr}T09:00:00Z`);
        const checkOut = new Date(`${dateStr}T18:00:00Z`);
        await prisma.attendance.create({
          data: {
            employee_id: empIds[empCode],
            attendance_date: date,
            check_in: checkIn,
            check_out: checkOut,
            status: "present",
          },
        });
        attCount++;
      }
    }
  }
  console.log(`  ✓ ${attCount} attendance records`);

  console.log("\n✅ Database seeded successfully!");
  console.log("\nDemo login emails:");
  userData.forEach((u) => console.log(`  ${u.email.padEnd(40)} → ${u.role}`));
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
