import { Router } from "express";
import { prisma } from "../lib/prisma";
import { resolveEmployee } from "../lib/resolve-employee";
import { sendPayslipEmail } from "../lib/email";
import { computeEmployeePayslip, validatePayrun } from "../services/payroll-engine";
import { cacheService } from "../services/cache-service";

const router = Router();

// Helper to generate payslips for all active employees (or specified employee IDs) for a given run
export async function generatePayslipsForRun(runId: string, employeeIdsFilter?: string[], structureIdOverride?: string) {
  const run = await prisma.payroll_runs.findUnique({
    where: { id: runId },
    include: { payslips: true },
  });
  if (!run) throw new Error("Payroll run not found");

  const existingEmpIds = new Set(run.payslips.map((p) => p.employee_id));

  const employees = await prisma.employees.findMany({
    where: {
      status: "active",
      ...(employeeIdsFilter && employeeIdsFilter.length > 0 && { id: { in: employeeIdsFilter } }),
    },
  });

  const generated = [];

  for (const emp of employees) {
    if (existingEmpIds.has(emp.id)) continue;

    // Use sequential calculation engine
    const computed = await computeEmployeePayslip(emp.id, run.period_month, run.period_year, structureIdOverride);

    let contractId = computed.contractId;
    if (!contractId) {
      let contract = await prisma.contracts.findFirst({
        where: { employee_id: emp.id, status: "active" },
      });
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
      contractId = contract.id;
    }

    // Save main payslip
    const payslip = await prisma.payslips.create({
      data: {
        payroll_run_id: run.id,
        employee_id: emp.id,
        contract_id: contractId,
        period_month: run.period_month,
        period_year: run.period_year,
        working_days: computed.workingDays,
        present_days: computed.presentDays,
        absent_days: computed.absentDays,
        leave_days: computed.leaveDays,
        basic_salary: computed.basicSalary,
        allowances_total: computed.allowancesTotal,
        gross_salary: computed.grossSalary,
        deductions_total: computed.deductionsTotal,
        tax_amount: computed.taxAmount,
        net_salary: computed.netSalary,
        status: run.status,
        payment_status: run.status === "paid" ? "paid" : "unpaid",
        bank_account_snapshot: emp.bank_account_number || "HDFC0001234",
        email_status: "pending",
      },
    });

    // Save rule-by-rule payslip lines for transparency & PDF export
    if (computed.computedLines.length > 0) {
      await prisma.payslip_lines.createMany({
        data: computed.computedLines.map((line) => ({
          payslip_id: payslip.id,
          rule_id: line.ruleId || undefined,
          code: line.code,
          name: line.name,
          category: line.category,
          amount: line.amount,
        })),
      });
    }

    generated.push(payslip);
  }

  // Clear analytics cache so dashboard reflects new numbers
  cacheService.clearAll();

  return generated;
}

// GET /api/payroll — list payruns
router.get("/", async (_req, res) => {
  try {
    let runs = await prisma.payroll_runs.findMany({
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
            email_status: true,
          },
        },
      },
    });

    // If there is a paid run without payslips, generate them
    const paidRun = runs.find((r) => r.status === "paid");
    if (paidRun) {
      const activeCount = await prisma.employees.count({ where: { status: "active" } });
      if (paidRun.payslips.length < activeCount) {
        await generatePayslipsForRun(paidRun.id);
        runs = await prisma.payroll_runs.findMany({
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
                email_status: true,
              },
            },
          },
        });
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
        emailStatus: p.email_status || "pending",
      })),
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch payroll runs" });
  }
});

// GET /api/payroll/dashboard-analytics — KPIs, Charts & Operational Alerts
router.get("/dashboard-analytics", async (_req, res) => {
  try {
    const data = await cacheService.getOrSet("payroll:dashboard:analytics", 300, async () => {
      const activeEmployees = await prisma.employees.findMany({
        where: { status: "active" },
        include: {
          departments_employees_department_idTodepartments: { select: { name: true } },
          contracts: { where: { status: "active" }, take: 1 },
        },
      });

      const totalEmployeesCount = activeEmployees.length;

      // Current month payrun
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      const latestPaidRun = await prisma.payroll_runs.findFirst({
        where: { status: "paid" },
        orderBy: [{ period_year: "desc" }, { period_month: "desc" }],
        include: { payslips: true },
      });

      const totalNetPaid = latestPaidRun?.payslips.reduce((acc, p) => acc + Number(p.net_salary), 0) || 0;
      const payslipsGeneratedCount = latestPaidRun?.payslips.length || 0;
      const averageSalary = totalEmployeesCount > 0 ? Math.round(totalNetPaid / totalEmployeesCount) : 0;

      // Attendance Health
      const startOfMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
      const endOfMonth = new Date(Date.UTC(currentYear, currentMonth, 0));

      const attendanceLogs = await prisma.attendance.findMany({
        where: { attendance_date: { gte: startOfMonth, lte: endOfMonth } },
      });

      const totalAttendanceLogs = attendanceLogs.length || 1;
      const presentCount = attendanceLogs.filter((a) => a.status === "present" || a.status === "work_from_home").length;
      const absentCount = attendanceLogs.filter((a) => a.status === "absent").length;
      const lateCount = attendanceLogs.filter((a) => a.status === "late").length;
      const overtimeHoursTotal = attendanceLogs.reduce((acc, a) => acc + Number(a.overtime_hours || 0), 0);
      const attendanceHealthPct = Math.round((presentCount / totalAttendanceLogs) * 100) || 95;

      // Approved Time Off
      const approvedTimeOffCount = await prisma.leave_requests.count({
        where: { status: "approved" },
      });

      // Operational Warnings & Readiness
      const validationWarnings = await validatePayrun(currentMonth, currentYear);

      // Department Salary Breakdown
      const deptMap: Record<string, { headcount: number; totalSalary: number }> = {};
      for (const emp of activeEmployees) {
        const dName = emp.departments_employees_department_idTodepartments?.name || "General";
        if (!deptMap[dName]) deptMap[dName] = { headcount: 0, totalSalary: 0 };
        deptMap[dName].headcount += 1;
        const ctc = Number(emp.contracts[0]?.salary || 600000);
        deptMap[dName].totalSalary += Math.round(ctc / 12);
      }

      const departmentCostChart = Object.entries(deptMap).map(([dept, val]) => ({
        department: dept,
        headcount: val.headcount,
        totalMonthlyCost: val.totalSalary,
        avgSalary: val.headcount > 0 ? Math.round(val.totalSalary / val.headcount) : 0,
      }));

      // Monthly Net Salary Trend (last 6 months)
      const pastRuns = await prisma.payroll_runs.findMany({
        take: 6,
        orderBy: [{ period_year: "asc" }, { period_month: "asc" }],
        include: { payslips: { select: { net_salary: true, gross_salary: true } } },
      });

      const monthlyTrend = pastRuns.map((r) => ({
        period: `${r.period_year}-${String(r.period_month).padStart(2, "0")}`,
        totalGross: r.payslips.reduce((acc, p) => acc + Number(p.gross_salary), 0),
        totalNet: r.payslips.reduce((acc, p) => acc + Number(p.net_salary), 0),
        employeeCount: r.payslips.length,
      }));

      return {
        kpis: {
          totalNetPaid,
          payslipsGeneratedCount,
          averageSalary,
          attendanceHealthPct,
          approvedTimeOffCount,
          totalEmployeesCount,
        },
        attendanceSummary: {
          presentCount,
          absentCount,
          lateCount,
          overtimeHoursTotal,
        },
        departmentCostChart,
        monthlyTrend,
        validationWarnings,
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to compute dashboard analytics" });
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

    let realEmpIds: string[] | undefined = undefined;
    if (employeeId) {
      const emp = await resolveEmployee(employeeId);
      if (emp) realEmpIds = [emp.id];
    }

    const generated = await generatePayslipsForRun(run.id, realEmpIds);

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
            employees: { select: { full_name: true, employee_code: true, bank_account_number: true } },
            payslip_lines: { orderBy: { code: "asc" } },
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

// POST /api/payroll — 2-Step Payrun Creation Wizard
router.post("/", async (req, res) => {
  try {
    const { periodMonth, periodYear, structureId, employeeIds, payDate } = req.body as {
      periodMonth: number;
      periodYear: number;
      structureId?: string;
      employeeIds?: string[];
      payDate?: string;
    };

    const run = await prisma.payroll_runs.create({
      data: {
        period_month: periodMonth,
        period_year: periodYear,
        status: "draft",
        pay_date: payDate ? new Date(payDate) : null,
      },
    });

    // Generate payslips for selected employees
    const generated = await generatePayslipsForRun(run.id, employeeIds, structureId);

    // Validate payrun
    const warnings = await validatePayrun(periodMonth, periodYear, employeeIds);

    res.status(201).json({
      success: true,
      data: {
        id: run.id,
        generatedCount: generated.length,
        warnings,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create payroll run" });
  }
});

// POST /api/payroll/:id/compute — Recompute payrun using Sequential Calculation Engine
router.post("/:id/compute", async (req, res) => {
  try {
    const run = await prisma.payroll_runs.findUnique({
      where: { id: req.params.id },
      include: { payslips: true },
    });

    if (!run) return res.status(404).json({ success: false, error: "Payrun not found" });
    if (run.status === "paid") {
      return res.status(400).json({ success: false, error: "Paid payruns cannot be recomputed" });
    }

    const employeeIds = run.payslips.map((p) => p.employee_id);

    // Delete existing payslips and lines
    await prisma.payslip_lines.deleteMany({
      where: { payslips: { payroll_run_id: run.id } },
    });
    await prisma.payslips.deleteMany({
      where: { payroll_run_id: run.id },
    });

    // Re-generate using payroll engine
    const regenerated = await generatePayslipsForRun(run.id, employeeIds);

    await prisma.payroll_runs.update({
      where: { id: run.id },
      data: { status: "calculated", updated_at: new Date() },
    });

    res.json({
      success: true,
      data: {
        runId: run.id,
        status: "calculated",
        recomputedCount: regenerated.length,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to recompute payrun" });
  }
});

// POST /api/payroll/:id/validate — Validate payrun prior to payout
router.post("/:id/validate", async (req, res) => {
  try {
    const run = await prisma.payroll_runs.findUnique({
      where: { id: req.params.id },
      include: { payslips: true },
    });

    if (!run) return res.status(404).json({ success: false, error: "Payrun not found" });

    const employeeIds = run.payslips.map((p) => p.employee_id);
    const warnings = await validatePayrun(run.period_month, run.period_year, employeeIds);

    const updated = await prisma.payroll_runs.update({
      where: { id: run.id },
      data: { status: "approved", updated_at: new Date() },
    });

    res.json({
      success: true,
      data: {
        id: updated.id,
        status: "approved",
        warnings,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to validate payrun" });
  }
});

// POST /api/payroll/:id/mark-paid — Lock payrun as paid
router.post("/:id/mark-paid", async (req, res) => {
  try {
    const run = await prisma.payroll_runs.findUnique({ where: { id: req.params.id } });
    if (!run) return res.status(404).json({ success: false, error: "Payrun not found" });

    const now = new Date();
    await prisma.payroll_runs.update({
      where: { id: run.id },
      data: { status: "paid", paid_at: now, updated_at: now },
    });

    await prisma.payslips.updateMany({
      where: { payroll_run_id: run.id },
      data: { status: "paid", payment_status: "paid" },
    });

    cacheService.clearAll();

    res.json({ success: true, data: { id: run.id, status: "paid" } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to mark payrun as paid" });
  }
});

// POST /api/payroll/:id/send-emails — bulk email payslips to employees with status tracking
router.post("/:id/send-emails", async (req, res) => {
  try {
    const run = await prisma.payroll_runs.findUnique({
      where: { id: req.params.id },
      include: {
        payslips: {
          include: {
            employees: true,
          },
        },
      },
    });

    if (!run) return res.status(404).json({ success: false, error: "Payroll run not found" });

    let sentCount = 0;
    let failedCount = 0;
    const periodStr = `${run.period_year}-${String(run.period_month).padStart(2, "0")}`;

    for (const slip of run.payslips) {
      const emp = slip.employees;
      if (!emp || !emp.email) {
        await prisma.payslips.update({
          where: { id: slip.id },
          data: { email_status: "failed" },
        });
        failedCount++;
        continue;
      }

      try {
        await sendPayslipEmail({
          to: emp.email,
          employeeName: emp.full_name,
          period: periodStr,
          gross: Number(slip.gross_salary),
          net: Number(slip.net_salary),
          basic: Number(slip.basic_salary),
          allowances: Number(slip.allowances_total),
          deductions: Number(slip.deductions_total),
        });

        await prisma.payslips.update({
          where: { id: slip.id },
          data: { email_status: "sent" },
        });
        sentCount++;
      } catch (err) {
        console.error(`Email delivery failed for ${emp.email}:`, err);
        await prisma.payslips.update({
          where: { id: slip.id },
          data: { email_status: "failed" },
        });
        failedCount++;
      }
    }

    res.json({
      success: true,
      data: {
        runId: run.id,
        sentCount,
        failedCount,
        message: `Dispatched payslip emails: ${sentCount} sent, ${failedCount} failed.`,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to send payslip emails" });
  }
});

// POST /api/payroll/:id/retry-failed-emails — Retry failed emails
router.post("/:id/retry-failed-emails", async (req, res) => {
  try {
    const failedSlips = await prisma.payslips.findMany({
      where: {
        payroll_run_id: req.params.id,
        email_status: "failed",
      },
      include: { employees: true, payroll_runs: true },
    });

    let resentCount = 0;
    for (const slip of failedSlips) {
      const emp = slip.employees;
      if (!emp || !emp.email) continue;
      const periodStr = `${slip.period_year}-${String(slip.period_month).padStart(2, "0")}`;

      try {
        await sendPayslipEmail({
          to: emp.email,
          employeeName: emp.full_name,
          period: periodStr,
          gross: Number(slip.gross_salary),
          net: Number(slip.net_salary),
          basic: Number(slip.basic_salary),
          allowances: Number(slip.allowances_total),
          deductions: Number(slip.deductions_total),
        });

        await prisma.payslips.update({
          where: { id: slip.id },
          data: { email_status: "sent" },
        });
        resentCount++;
      } catch (err) {
        console.error(`Retry failed for ${emp.email}:`, err);
      }
    }

    res.json({
      success: true,
      data: {
        retriedCount: failedSlips.length,
        successfullyResentCount: resentCount,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to retry emails" });
  }
});

// POST /api/payroll/:id/cancel — Cancel draft or computed payrun
router.post("/:id/cancel", async (req, res) => {
  try {
    const run = await prisma.payroll_runs.findUnique({ where: { id: req.params.id } });
    if (!run) return res.status(404).json({ success: false, error: "Payrun not found" });
    if (run.status === "paid") {
      return res.status(400).json({ success: false, error: "Paid payruns cannot be cancelled" });
    }

    await prisma.payroll_runs.update({
      where: { id: run.id },
      data: { status: "draft", updated_at: new Date() },
    });

    res.json({ success: true, data: { id: run.id, status: "draft" } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to cancel payrun" });
  }
});

// POST /api/payroll/send-single-email — email payslip to a single employee
router.post("/send-single-email", async (req, res) => {
  try {
    const { employeeId, period, gross, net, basic, allowances, deductions } = req.body as {
      employeeId: string;
      period: string;
      gross: number;
      net: number;
      basic: number;
      allowances: number;
      deductions: number;
    };

    let email = "";
    let name = "Employee";

    const emp = await resolveEmployee(employeeId);
    if (emp) {
      email = emp.email;
      name = emp.full_name;
    }

    if (!email) {
      return res.status(400).json({ success: false, error: "Employee email not found" });
    }

    const result = await sendPayslipEmail({
      to: email,
      employeeName: name,
      period: period || "Current Cycle",
      gross: Number(gross || 0),
      net: Number(net || 0),
      basic: Number(basic || 0),
      allowances: Number(allowances || 0),
      deductions: Number(deductions || 0),
    });

    res.json({
      success: true,
      data: {
        message: `Payslip email sent to ${name} (${email})`,
        previewUrl: result.previewUrl,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to send single payslip email" });
  }
});

// DELETE /api/payroll/:id — delete draft run
router.delete("/:id", async (req, res) => {
  try {
    const run = await prisma.payroll_runs.findUnique({ where: { id: req.params.id } });
    if (!run) return res.status(404).json({ success: false, error: "Not found" });
    if (run.status !== "draft" && run.status !== "calculated") {
      return res.status(400).json({ success: false, error: "Only draft or calculated payroll runs can be deleted" });
    }

    await prisma.payslip_lines.deleteMany({ where: { payslips: { payroll_run_id: req.params.id } } });
    await prisma.payslips.deleteMany({ where: { payroll_run_id: req.params.id } });
    await prisma.payroll_runs.delete({ where: { id: req.params.id } });

    res.json({ success: true, message: "Payroll run deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to delete payroll run" });
  }
});

export default router;

