import { Router } from "express";
import { prisma } from "../lib/prisma";
import { resolveEmployee } from "../lib/resolve-employee";

const router = Router();

function normAttendanceStatus(status?: string) {
  if (!status) return "present";
  const s = status.toLowerCase();
  if (s.includes("half")) return "half_day";
  if (s.includes("leave")) return "on_leave";
  if (s.includes("late")) return "late";
  if (s.includes("absent")) return "absent";
  if (s.includes("home") || s.includes("wfh")) return "work_from_home";
  if (s.includes("holiday")) return "holiday";
  return "present";
}

function formatAttendanceStatus(status: string) {
  switch (status) {
    case "present":
      return "Present";
    case "absent":
      return "Absent";
    case "late":
      return "Late";
    case "half_day":
      return "Half-day";
    case "on_leave":
      return "On Leave";
    case "holiday":
      return "Holiday";
    case "work_from_home":
      return "WFH";
    default:
      return "Present";
  }
}

// GET /api/attendance
router.get("/", async (req, res) => {
  try {
    const { employeeId } = req.query as { employeeId?: string };
    let realEmpId = employeeId;
    if (employeeId) {
      const emp = await resolveEmployee(employeeId);
      if (emp) realEmpId = emp.id;
    }

    const records = await prisma.attendance.findMany({
      where: realEmpId ? { employee_id: realEmpId } : undefined,
      orderBy: { attendance_date: "desc" },
      take: 500,
      include: {
        employees: { select: { full_name: true, employee_code: true } },
      },
    });

    const mapped = records.map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      employeeName: r.employees.full_name,
      date: r.attendance_date.toISOString().slice(0, 10),
      checkIn: r.check_in?.toISOString() ?? null,
      checkOut: r.check_out?.toISOString() ?? null,
      workingHours: Number(r.working_hours ?? 0),
      status: formatAttendanceStatus(r.status),
      isManuallyCorrected: r.is_manually_corrected,
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch attendance" });
  }
});

// POST /api/attendance — punch in/out
router.post("/", async (req, res) => {
  try {
    const { employeeId, status, date } = req.body as {
      employeeId: string;
      status?: string;
      date?: string;
    };

    const emp = await resolveEmployee(employeeId);
    if (!emp) return res.status(404).json({ success: false, error: "Employee not found" });

    const attendanceDate = new Date(date || new Date().toISOString().slice(0, 10));
    const now = new Date();
    const normStatus = normAttendanceStatus(status);

    const existing = await prisma.attendance.findUnique({
      where: { employee_id_attendance_date: { employee_id: emp.id, attendance_date: attendanceDate } },
    });

    if (existing) {
      // Punch out
      const updated = await prisma.attendance.update({
        where: { id: existing.id },
        data: { check_out: now, status: normStatus as any, updated_at: now },
      });
      return res.json({ success: true, data: { id: updated.id, action: "punch_out" } });
    }

    // Punch in
    const created = await prisma.attendance.create({
      data: {
        employee_id: emp.id,
        attendance_date: attendanceDate,
        check_in: now,
        status: normStatus as any,
      },
    });

    res.status(201).json({ success: true, data: { id: created.id, action: "punch_in" } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to record attendance" });
  }
});

// PATCH /api/attendance/:id — manual correction
router.patch("/:id", async (req, res) => {
  try {
    const { checkIn, checkOut, status } = req.body as {
      checkIn?: string;
      checkOut?: string;
      status?: string;
    };

    const updated = await prisma.attendance.update({
      where: { id: req.params.id },
      data: {
        ...(checkIn && { check_in: new Date(checkIn) }),
        ...(checkOut && { check_out: new Date(checkOut) }),
        ...(status && { status: normAttendanceStatus(status) as any }),
        is_manually_corrected: true,
        updated_at: new Date(),
      },
    });
    res.json({ success: true, data: { id: updated.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update attendance" });
  }
});

export default router;
