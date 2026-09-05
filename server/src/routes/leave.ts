import { Router } from "express";
import { prisma } from "../lib/prisma";
import { resolveEmployee } from "../lib/resolve-employee";
import { sendLeaveStatusEmail } from "../lib/email";

const router = Router();

router.get("/allocations", async (req, res) => {
  try {
    const employee = typeof req.query.employeeId === "string" ? await resolveEmployee(req.query.employeeId) : null;
    const currentYear = new Date().getFullYear();

    if (employee) {
      // Ensure allocations exist for active leave types that require allocation
      const existingAllocs = await prisma.leave_allocations.findMany({
        where: { employee_id: employee.id, year: currentYear },
      });
      if (existingAllocs.length === 0) {
        const types = await prisma.leave_types.findMany({
          where: { is_active: true, requires_allocation: true },
        });
        for (const t of types) {
          const defaultDays = Number(t.default_annual_allocation) || (t.code === "CO" ? 0 : 12);
          await prisma.leave_allocations.create({
            data: {
              employee_id: employee.id,
              leave_type_id: t.id,
              year: currentYear,
              allocated_days: defaultDays,
              used_days: 0,
            },
          }).catch(() => {});
        }
      }
    }

    const rows = await prisma.leave_allocations.findMany({
      where: employee ? { employee_id: employee.id } : undefined,
      orderBy: [{ year: "desc" }, { created_at: "desc" }],
      include: {
        employees: { select: { full_name: true, employee_code: true } },
        leave_types: { select: { name: true, code: true } },
      },
    });

    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        employeeId: r.employee_id,
        employeeName: r.employees.full_name,
        employeeCode: r.employees.employee_code,
        leaveType: r.leave_types.name,
        leaveTypeCode: r.leave_types.code,
        year: r.year,
        allocatedDays: Number(r.allocated_days),
        usedDays: Number(r.used_days),
        remainingDays: Number(r.allocated_days) - Number(r.used_days),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch leave allocations" });
  }
});

router.post("/allocations", async (req, res) => {
  try {
    const employee = await resolveEmployee(req.body.employeeId);
    const type = await prisma.leave_types.findFirst({ where: { code: { equals: req.body.leaveTypeCode, mode: "insensitive" } } });
    if (!employee || !type) return res.status(404).json({ success: false, error: "Employee or leave type not found" });
    const row = await prisma.leave_allocations.upsert({
      where: { employee_id_leave_type_id_year: { employee_id: employee.id, leave_type_id: type.id, year: Number(req.body.year) } },
      create: { employee_id: employee.id, leave_type_id: type.id, year: Number(req.body.year), allocated_days: Number(req.body.allocatedDays) },
      update: { allocated_days: Number(req.body.allocatedDays), updated_at: new Date() },
    });
    res.status(201).json({ success: true, data: { id: row.id, allocatedDays: Number(row.allocated_days), usedDays: Number(row.used_days) } });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, error: "Failed to save leave allocation" });
  }
});

// GET /api/leave
router.get("/", async (req, res) => {
  try {
    const { employeeId } = req.query as { employeeId?: string };
    let realEmpId = employeeId;
    if (employeeId) {
      const emp = await resolveEmployee(employeeId);
      if (emp) realEmpId = emp.id;
    }

    const requests = await prisma.leave_requests.findMany({
      where: realEmpId ? { employee_id: realEmpId } : undefined,
      orderBy: { created_at: "desc" },
      include: {
        employees_leave_requests_employee_idToemployees: { select: { full_name: true, employee_code: true } },
        leave_types: { select: { name: true, code: true } },
      },
    });

    const mapped = requests.map((r) => {
      const typeName = r.leave_types.name.replace(/ Leave/i, "");
      return {
        id: r.id,
        employeeId: r.employee_id,
        employeeCode: r.employees_leave_requests_employee_idToemployees.employee_code,
        employeeName: r.employees_leave_requests_employee_idToemployees.full_name,
        type: (typeName || "Casual") as any,
        leaveType: r.leave_types.name,
        leaveTypeCode: r.leave_types.code,
        from: r.start_date.toISOString().slice(0, 10),
        to: r.end_date.toISOString().slice(0, 10),
        startDate: r.start_date.toISOString().slice(0, 10),
        endDate: r.end_date.toISOString().slice(0, 10),
        days: Number(r.days),
        reason: r.reason ?? "",
        status: r.status,
        submittedAt: r.created_at.toISOString().slice(0, 10),
        createdAt: r.created_at.toISOString(),
      };
    });

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch leave requests" });
  }
});

// POST /api/leave
router.post("/", async (req, res) => {
  try {
    const { employeeId, leaveTypeCode, leaveType: leaveTypeName, startDate, endDate, days, reason } = req.body as {
      employeeId: string;
      leaveTypeCode?: string;
      leaveType?: string;
      startDate: string;
      endDate: string;
      days: number;
      reason?: string;
    };

    const emp = await resolveEmployee(employeeId);
    if (!emp) return res.status(404).json({ success: false, error: "Employee not found" });

    const lookupCode = (leaveTypeCode || leaveTypeName || "CL").toUpperCase();
    let leaveType = await prisma.leave_types.findFirst({
      where: {
        OR: [
          { code: { equals: lookupCode, mode: "insensitive" } },
          { name: { contains: lookupCode, mode: "insensitive" } },
        ],
      },
    });

    if (!leaveType) {
      leaveType = await prisma.leave_types.findFirst();
    }
    if (!leaveType) return res.status(400).json({ success: false, error: "No valid leave type configured" });

    const sDate = startDate || (req.body as any).from || new Date().toISOString().slice(0, 10);
    const eDate = endDate || (req.body as any).to || sDate;
    const leaveDays = Number(days || (req.body as any).days) || 1;
    const leaveYear = new Date(sDate).getFullYear();

    let allocation = null;
    if (leaveType.requires_allocation) {
      allocation = await prisma.leave_allocations.findUnique({
        where: {
          employee_id_leave_type_id_year: {
            employee_id: emp.id,
            leave_type_id: leaveType.id,
            year: leaveYear,
          },
        },
      });

      // Auto-create initial allocation if not already created for this year
      if (!allocation) {
        const defaultDays = Number(leaveType.default_annual_allocation) || (leaveType.code === "CO" ? 0 : 12);
        allocation = await prisma.leave_allocations.create({
          data: {
            employee_id: emp.id,
            leave_type_id: leaveType.id,
            year: leaveYear,
            allocated_days: defaultDays,
            used_days: 0,
          },
        });
      }

      const remaining = Number(allocation.allocated_days) - Number(allocation.used_days);
      if (remaining < leaveDays) {
        return res.status(400).json({
          success: false,
          error: `Insufficient leave allocation. You have ${remaining} day(s) remaining for ${leaveType.name}, but requested ${leaveDays} day(s).`,
        });
      }
    }

    const request = await prisma.leave_requests.create({
      data: {
        employee_id: emp.id,
        leave_type_id: leaveType.id,
        allocation_id: allocation?.id ?? null,
        start_date: new Date(sDate),
        end_date: new Date(eDate),
        days: leaveDays,
        reason: reason ?? null,
        status: "pending",
      },
      include: {
        employees_leave_requests_employee_idToemployees: { select: { full_name: true, employee_code: true } },
        leave_types: { select: { name: true, code: true } },
      },
    });

    const typeName = request.leave_types.name.replace(/ Leave/i, "");
    res.status(201).json({
      success: true,
      data: {
        id: request.id,
        employeeId: request.employee_id,
        employeeCode: request.employees_leave_requests_employee_idToemployees.employee_code,
        employeeName: request.employees_leave_requests_employee_idToemployees.full_name,
        type: (typeName || "Casual") as any,
        leaveType: request.leave_types.name,
        leaveTypeCode: request.leave_types.code,
        from: request.start_date.toISOString().slice(0, 10),
        to: request.end_date.toISOString().slice(0, 10),
        startDate: request.start_date.toISOString().slice(0, 10),
        endDate: request.end_date.toISOString().slice(0, 10),
        days: Number(request.days),
        reason: request.reason ?? "",
        status: request.status,
        submittedAt: request.created_at.toISOString().slice(0, 10),
        createdAt: request.created_at.toISOString(),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to submit leave request" });
  }
});

// PATCH /api/leave/:id — approve / reject / cancel
router.patch("/:id", async (req, res) => {
  try {
    const { status } = req.body as { status: string };
    const normStatus = status.toLowerCase() === "approved" ? "approved" : status.toLowerCase() === "rejected" ? "rejected" : status.toLowerCase() === "cancelled" ? "cancelled" : "pending";

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id);
    if (!isUuid) {
      return res.status(404).json({ success: false, error: "Invalid leave request ID" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.leave_requests.findUnique({ where: { id: req.params.id } });
      if (!current) throw new Error("Leave request not found");

      let allocId = current.allocation_id;
      if (!allocId && normStatus === "approved") {
        const leaveType = await tx.leave_types.findUnique({ where: { id: current.leave_type_id } });
        if (leaveType?.requires_allocation) {
          const year = current.start_date.getFullYear();
          let alloc = await tx.leave_allocations.findUnique({
            where: {
              employee_id_leave_type_id_year: {
                employee_id: current.employee_id,
                leave_type_id: current.leave_type_id,
                year,
              },
            },
          });
          if (!alloc) {
            const defaultDays = Number(leaveType.default_annual_allocation) || 12;
            alloc = await tx.leave_allocations.create({
              data: {
                employee_id: current.employee_id,
                leave_type_id: current.leave_type_id,
                year,
                allocated_days: defaultDays,
                used_days: 0,
              },
            });
          }
          allocId = alloc.id;
          await tx.leave_requests.update({
            where: { id: current.id },
            data: { allocation_id: allocId },
          });
        }
      }

      if (normStatus === "approved" && current.status !== "approved" && allocId) {
        const allocation = await tx.leave_allocations.findUnique({ where: { id: allocId } });
        if (allocation) {
          const remaining = Number(allocation.allocated_days) - Number(allocation.used_days);
          if (remaining < Number(current.days)) {
            throw new Error(`Insufficient leave allocation (remaining: ${remaining}, needed: ${current.days})`);
          }
          await tx.leave_allocations.update({
            where: { id: allocId },
            data: { used_days: { increment: current.days }, updated_at: new Date() },
          });
        }
      }

      if ((normStatus === "cancelled" || normStatus === "rejected") && current.status === "approved" && allocId) {
        await tx.leave_allocations.update({
          where: { id: allocId },
          data: { used_days: { decrement: current.days }, updated_at: new Date() },
        });
      }

      return tx.leave_requests.update({
        where: { id: req.params.id },
        data: {
          status: normStatus as any,
          updated_at: new Date(),
          ...(normStatus === "cancelled" && { cancelled_at: new Date() }),
          ...(normStatus === "approved" && { hr_decision: "approved", hr_decided_at: new Date() }),
          ...(normStatus === "rejected" && { hr_decision: "rejected", hr_decided_at: new Date() }),
        },
        include: {
          employees_leave_requests_employee_idToemployees: { select: { full_name: true, employee_code: true, email: true } },
          leave_types: { select: { name: true, code: true } },
        },
      });
    });

    const empInfo = updated.employees_leave_requests_employee_idToemployees;
    if (empInfo?.email && (normStatus === "approved" || normStatus === "rejected")) {
      sendLeaveStatusEmail({
        to: empInfo.email,
        employeeName: empInfo.full_name,
        leaveType: updated.leave_types.name,
        startDate: updated.start_date.toISOString().slice(0, 10),
        endDate: updated.end_date.toISOString().slice(0, 10),
        days: Number(updated.days),
        status: normStatus as "approved" | "rejected",
        reason: updated.reason ?? undefined,
      }).catch((e) => console.warn("Leave status email error:", e));
    }

    const typeName = updated.leave_types.name.replace(/ Leave/i, "");
    res.json({
      success: true,
      data: {
        id: updated.id,
        employeeId: updated.employee_id,
        employeeCode: updated.employees_leave_requests_employee_idToemployees.employee_code,
        employeeName: updated.employees_leave_requests_employee_idToemployees.full_name,
        type: (typeName || "Casual") as any,
        leaveType: updated.leave_types.name,
        leaveTypeCode: updated.leave_types.code,
        from: updated.start_date.toISOString().slice(0, 10),
        to: updated.end_date.toISOString().slice(0, 10),
        startDate: updated.start_date.toISOString().slice(0, 10),
        endDate: updated.end_date.toISOString().slice(0, 10),
        days: Number(updated.days),
        reason: updated.reason ?? "",
        status: updated.status,
        submittedAt: updated.created_at.toISOString().slice(0, 10),
        createdAt: updated.created_at.toISOString(),
      },
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message || "Failed to update leave request" });
  }
});

export default router;
