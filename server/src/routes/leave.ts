import { Router } from "express";
import { prisma } from "../lib/prisma";
import { resolveEmployee } from "../lib/resolve-employee";

const router = Router();

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

    const mapped = requests.map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      employeeName: r.employees_leave_requests_employee_idToemployees.full_name,
      leaveType: r.leave_types.name,
      leaveTypeCode: r.leave_types.code,
      startDate: r.start_date.toISOString().slice(0, 10),
      endDate: r.end_date.toISOString().slice(0, 10),
      days: Number(r.days),
      reason: r.reason ?? "",
      status: r.status,
      createdAt: r.created_at.toISOString(),
    }));

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

    const request = await prisma.leave_requests.create({
      data: {
        employee_id: emp.id,
        leave_type_id: leaveType.id,
        start_date: new Date(startDate),
        end_date: new Date(endDate),
        days: Number(days) || 1,
        reason: reason ?? null,
        status: "pending",
      },
    });

    res.status(201).json({ success: true, data: { id: request.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to submit leave request" });
  }
});

// PATCH /api/leave/:id — approve / reject / cancel
router.patch("/:id", async (req, res) => {
  try {
    const { status } = req.body as { status: string };
    const updated = await prisma.leave_requests.update({
      where: { id: req.params.id },
      data: { status: status as any, updated_at: new Date() },
    });
    res.json({ success: true, data: { id: updated.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update leave request" });
  }
});

export default router;
