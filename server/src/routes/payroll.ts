import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/payroll
router.get("/", async (_req, res) => {
  try {
    const runs = await prisma.payroll_runs.findMany({
      orderBy: [{ period_year: "desc" }, { period_month: "desc" }],
      include: {
        payslips: {
          select: {
            employee_id: true,
            gross_salary: true,
            net_salary: true,
            basic_salary: true,
            deductions_total: true,
          },
        },
      },
    });

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
        employeeId: p.employee_id,
        gross: Number(p.gross_salary),
        net: Number(p.net_salary),
        basicSalary: Number(p.basic_salary),
        deductions: Number(p.deductions_total),
      })),
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch payroll runs" });
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
