import { Router } from "express";
import { prisma } from "../lib/prisma";
import { resolveEmployee } from "../lib/resolve-employee";

const router = Router();

// Helper to generate payslips for all active employees (or one employee) for a given run
export async function generatePayslipsForRun(runId: string, employeeIdFilter?: string) {
  const run = await prisma.payroll_runs.findUnique({
    where: { id: runId },
    include: { payslips: true },
  });
  if (!run) throw new Error("Payroll run not found");

  const existingEmpIds = new Set(run.payslips.map((p) => p.employee_id));

  const employees = await prisma.employees.findMany({
    where: {
      status: "active",
      ...(employeeIdFilter && { id: employeeIdFilter }),
    },
    include: {
      contracts: { where: { status: "active" }, orderBy: { created_at: "desc" }, take: 1 },
    },
  });

  const generated = [];

  for (const emp of employees) {
    if (existingEmpIds.has(emp.id)) continue;

    // Ensure a contract exists
    let contract = emp.contracts[0];
    if (!contract) {
      contract = await prisma.contracts.create({
        data: {
          contract_number: `CNT-${emp.employee_code}`,
          employee_id: emp.id,
          salary: 600000,
          start_date: emp.joining_date || new Date(),
          status: "active",
        },
      });
    }

    const annualCtc = Number(contract?.salary || 600000);
    const monthlyGross = Math.round(annualCtc / 12);
    const basic = Math.round(monthlyGross * 0.5);
    const hra = Math.round(basic * 0.4);
    const special = Math.max(0, monthlyGross - basic - hra);
    const pf = Math.min(1800, Math.round(basic * 0.12));
    const pt = 200;
    const tds = monthlyGross > 50000 ? Math.round(monthlyGross * 0.05) : 0;
    const deductions = pf + pt + tds;
    const net = Math.max(0, monthlyGross - deductions);

    const payslip = await prisma.payslips.create({
      data: {
        payroll_run_id: run.id,
        employee_id: emp.id,
        contract_id: contract.id,
        period_month: run.period_month,
        period_year: run.period_year,
        working_days: 22,
        present_days: 22,
        absent_days: 0,
        leave_days: 0,
        basic_salary: basic,
        allowances_total: hra + special,
        gross_salary: monthlyGross,
        deductions_total: deductions,
        tax_amount: tds,
        net_salary: net,
        status: run.status,
        payment_status: run.status === "paid" ? "paid" : "unpaid",
        bank_account_snapshot: emp.bank_account_number || "HDFC0001234",
      },
    });

    generated.push(payslip);
  }

  return generated;
}

// GET /api/payroll
router.get("/", async (_req, res) => {
  try {
    const runs = await prisma.payroll_runs.findMany({
      orderBy: [{ period_year: "desc" }, { period_month: "desc" }],
      include: {
        payslips: {
          select: {
            id: true,
            employee_id: true,
            gross_salary: true,
            net_salary: true,
            basic_salary: true,
            allowances_total: true,
            deductions_total: true,
            tax_amount: true,
            status: true,
            payment_status: true,
          },
        },
      },
    });

    // If there is a paid run, ensure all active employees have payslips
    const paidRun = runs.find((r) => r.status === "paid");
    if (paidRun) {
      const activeCount = await prisma.employees.count({ where: { status: "active" } });
      if (paidRun.payslips.length < activeCount) {
        await generatePayslipsForRun(paidRun.id);
        // Re-fetch runs after generation
        return res.redirect(307, "/api/payroll");
      }
    }

    const mapped = runs.map((r) => ({
      id: r.id,
      period: `${r.period_year}-${String(r.period_month).padStart(2, "0")}`,
      periodMonth: r.period_month,
      periodYear: r.period_year,
      payDate: r.pay_date?.toISOString().slice(0, 10) ?? null,
      status: r.status,
      totalGross: r.payslips.reduce((s, p) => s + Number(p.gross_salary), 0),
      totalNet: r.payslips.reduce((s, p) => s + Number(p.net_salary), 0),
      employeeCount: r.payslips.length,
      lines: r.payslips.map((p) => ({
        id: p.id,
        employeeId: p.employee_id,
        gross: Number(p.gross_salary),
        net: Number(p.net_salary),
        basicSalary: Number(p.basic_salary),
        allowances: Number(p.allowances_total),
        deductions: Number(p.deductions_total),
        tax: Number(p.tax_amount),
        bonus: 0,
      })),
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch payroll runs" });
  }
});

// POST /api/payroll/generate — generate payslips on demand
router.post("/generate", async (req, res) => {
  try {
    const { employeeId, periodMonth, periodYear } = req.body as {
      employeeId?: string;
      periodMonth?: number;
      periodYear?: number;
    };

    const now = new Date();
    const m = periodMonth || (now.getMonth() + 1);
    const y = periodYear || now.getFullYear();

    let run = await prisma.payroll_runs.findFirst({
      where: { period_month: m, period_year: y },
    });

    if (!run) {
      run = await prisma.payroll_runs.create({
        data: {
          period_month: m,
          period_year: y,
          status: "paid",
          pay_date: now,
        },
      });
    }

    let realEmpId = employeeId;
    if (employeeId) {
      const emp = await resolveEmployee(employeeId);
      if (emp) realEmpId = emp.id;
    }

    const generated = await generatePayslipsForRun(run.id, realEmpId);

    res.json({
      success: true,
      data: {
        runId: run.id,
        period: `${y}-${String(m).padStart(2, "0")}`,
        generatedCount: generated.length,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to generate payslips" });
  }
});

// GET /api/payroll/:id
router.get("/:id", async (req, res) => {
  try {
    const run = await prisma.payroll_runs.findUnique({
      where: { id: req.params.id },
      include: {
        payslips: {
          include: {
            employees: { select: { full_name: true, employee_code: true } },
            payslip_lines: true,
          },
        },
      },
    });
    if (!run) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: run });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch payroll run" });
  }
});

// POST /api/payroll — create run
router.post("/", async (req, res) => {
  try {
    const { periodMonth, periodYear } = req.body as { periodMonth: number; periodYear: number };

    const run = await prisma.payroll_runs.create({
      data: { period_month: periodMonth, period_year: periodYear, status: "draft" },
    });

    res.status(201).json({ success: true, data: { id: run.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create payroll run" });
  }
});

// PATCH /api/payroll/:id — update status
router.patch("/:id", async (req, res) => {
  try {
    const { status } = req.body as { status: string };
    const now = new Date();
    const updated = await prisma.payroll_runs.update({
      where: { id: req.params.id },
      data: {
        status: status as any,
        updated_at: now,
        ...(status === "processed" && { processed_at: now }),
        ...(status === "paid" && { paid_at: now }),
      },
    });
    res.json({ success: true, data: { id: updated.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update payroll run" });
  }
});

export default router;
