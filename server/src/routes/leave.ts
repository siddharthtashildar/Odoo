import { Router } from "express";
import { prisma } from "../lib/prisma";
import { resolveEmployee } from "../lib/resolve-employee";

const router = Router();

router.get("/allocations", async (req, res) => {
  try {
    const employee = typeof req.query.employeeId === "string" ? await resolveEmployee(req.query.employeeId) : null;
    const rows = await prisma.leave_allocations.findMany({
      where: employee ? { employee_id: employee.id } : undefined,
      orderBy: [{ year: "desc" }, { created_at: "desc" }],
      include: { employees: { select: { full_name: true, employee_code: true } }, leave_types: { select: { name: true, code: true } } },
    });
    res.json({ success: true, data: rows.map((r) => ({ id: r.id, employeeId: r.employee_id, employeeName: r.employees.full_name, employeeCode: r.employees.employee_code, leaveType: r.leave_types.name, leaveTypeCode: r.leave_types.code, year: r.year, allocatedDays: Number(r.allocated_days), usedDays: Number(r.used_days), remainingDays: Number(r.allocated_days) - Number(r.used_days) })) });
  } catch (err) { console.error(err); res.status(500).json({ success: false, error: "Failed to fetch leave allocations" }); }
});

router.post("/allocations", async (req, res) => {
  try {
    const employee = await resolveEmployee(req.body.employeeId);
    const type = await prisma.leave_types.findFirst({ where: { code: { equals: req.body.leaveTypeCode, mode: "insensitive" } } });
    if (!employee || !type) return res.status(404).json({ success: false, error: "Employee or leave type not found" });
    const row = await prisma.leave_allocations.upsert({ where: { employee_id_leave_type_id_year: { employee_id: employee.id, leave_type_id: type.id, year: Number(req.body.year) } }, create: { employee_id: employee.id, leave_type_id: type.id, year: Number(req.body.year), allocated_days: Number(req.body.allocatedDays) }, update: { allocated_days: Number(req.body.allocatedDays), updated_at: new Date() } });
    res.status(201).json({ success: true, data: { id: row.id, allocatedDays: Number(row.allocated_days), usedDays: Number(row.used_days) } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, error: "Failed to save leave allocation" }); }
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
        employees_leave_requests_employee_idToemployees: { select: { full_name: true } },
        leave_types: { select: { name: true, code: true } },
      },
    });

    const mapped = requests.map((r) => {
      const typeName = r.leave_types.name.replace(/ Leave/i, "");
      return {
        id: r.id,
        employeeId: r.employee_id,
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
    const allocation = leaveType.requires_allocation
      ? await prisma.leave_allocations.findUnique({ where: { employee_id_leave_type_id_year: { employee_id: emp.id, leave_type_id: leaveType.id, year: new Date(sDate).getFullYear() } } })
      : null;
    if (leaveType.requires_allocation && (!allocation || Number(allocation.allocated_days) - Number(allocation.used_days) < leaveDays)) return res.status(400).json({ success: false, error: "Insufficient leave allocation" });

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
        employees_leave_requests_employee_idToemployees: { select: { full_name: true } },
        leave_types: { select: { name: true, code: true } },
      },
    });

    const typeName = request.leave_types.name.replace(/ Leave/i, "");
    res.status(201).json({
      success: true,
      data: {
        id: request.id,
        employeeId: request.employee_id,
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
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.leave_requests.findUnique({ where: { id: req.params.id } });
      if (!current) throw new Error("Leave request not found");
      if (normStatus === "approved" && current.status !== "approved" && current.allocation_id) {
        const allocation = await tx.leave_allocations.findUnique({ where: { id: current.allocation_id } });
        if (!allocation || Number(allocation.allocated_days) - Number(allocation.used_days) < Number(current.days)) throw new Error("Insufficient leave allocation");
        await tx.leave_allocations.update({ where: { id: current.allocation_id }, data: { used_days: { increment: current.days }, updated_at: new Date() } });
      }
      if (normStatus === "cancelled" && current.status === "approved" && current.allocation_id) await tx.leave_allocations.update({ where: { id: current.allocation_id }, data: { used_days: { decrement: current.days }, updated_at: new Date() } });
      return tx.leave_requests.update({ where: { id: req.params.id }, data: { status: normStatus as any, updated_at: new Date() }, include: { employees_leave_requests_employee_idToemployees: { select: { full_name: true } }, leave_types: { select: { name: true, code: true } } } });
    });
    const typeName = updated.leave_types.name.replace(/ Leave/i, "");
    res.json({
      success: true,
      data: {
        id: updated.id,
        employeeId: updated.employee_id,
        employeeName: updated.employees_leave_requests_employee_idToemployees.full_name,
        type: (typeName || "Casual") as any,
        status: updated.status,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update leave request" });
  }
});

export default router;
