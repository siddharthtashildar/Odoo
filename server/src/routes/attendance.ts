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
      checkIn: r.check_in ? r.check_in.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—",
      checkOut: r.check_out ? r.check_out.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—",
      workingHours: Number(r.working_hours ?? 0),
      status: formatAttendanceStatus(r.status),
      location: "Office - Ahmedabad" as const,
      remarks: r.is_manually_corrected ? "Manually corrected" : undefined,
      isManuallyCorrected: r.is_manually_corrected,
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch attendance" });
  }
});

function parseTimeString(baseDate: Date, timeStr: string): Date | null {
  const trimmed = timeStr.trim();
  if (!trimmed || trimmed === "—") return null;
  const isoTry = new Date(trimmed);
  if (!isNaN(isoTry.getTime()) && trimmed.includes("-")) {
    return isoTry;
  }
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (match) {
    const res = new Date(baseDate);
    let h = parseInt(match[1]!, 10);
    const m = parseInt(match[2]!, 10);
    const s = match[3] ? parseInt(match[3]!, 10) : 0;
    const mer = match[4]?.toUpperCase();
    if (mer === "PM" && h < 12) h += 12;
    if (mer === "AM" && h === 12) h = 0;
    res.setHours(h, m, s, 0);
    return res;
  }
  return null;
}

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
      // Calculate working_hours
      const checkInTime = existing.check_in ? existing.check_in.getTime() : now.getTime();
      const diffHours = Math.max(0, (now.getTime() - checkInTime) / (1000 * 60 * 60));
      const hoursRounded = Math.round(diffHours * 10) / 10;

      // Punch out
      const updated = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          check_out: now,
          working_hours: hoursRounded,
          status: normStatus as any,
          updated_at: now,
        },
        include: { employees: { select: { full_name: true, employee_code: true } } },
      });

      return res.json({
        success: true,
        data: {
          id: updated.id,
          employeeId: updated.employee_id,
          employeeName: updated.employees.full_name,
          date: updated.attendance_date.toISOString().slice(0, 10),
          checkIn: updated.check_in ? updated.check_in.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—",
          checkOut: updated.check_out ? updated.check_out.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—",
          workingHours: Number(updated.working_hours ?? 0),
          status: formatAttendanceStatus(updated.status),
          location: "Office - Ahmedabad",
          action: "punch_out",
        },
      });
    }

    // Punch in
    const created = await prisma.attendance.create({
      data: {
        employee_id: emp.id,
        attendance_date: attendanceDate,
        check_in: now,
        status: normStatus as any,
      },
      include: { employees: { select: { full_name: true, employee_code: true } } },
    });

    res.status(201).json({
      success: true,
      data: {
        id: created.id,
        employeeId: created.employee_id,
        employeeName: created.employees.full_name,
        date: created.attendance_date.toISOString().slice(0, 10),
        checkIn: created.check_in ? created.check_in.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—",
        checkOut: "—",
        workingHours: 0,
        status: formatAttendanceStatus(created.status),
        location: "Office - Ahmedabad",
        action: "punch_in",
      },
    });
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

    const existing = await prisma.attendance.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, error: "Record not found" });

    const newCheckIn = checkIn !== undefined ? parseTimeString(existing.attendance_date, checkIn) : existing.check_in;
    const newCheckOut = checkOut !== undefined ? parseTimeString(existing.attendance_date, checkOut) : existing.check_out;

    let workingHours = existing.working_hours ? Number(existing.working_hours) : 0;
    if (newCheckIn && newCheckOut) {
      const diff = Math.max(0, (newCheckOut.getTime() - newCheckIn.getTime()) / (1000 * 60 * 60));
      workingHours = Math.round(diff * 10) / 10;
    }

    const updated = await prisma.attendance.update({
      where: { id: req.params.id },
      data: {
        ...(checkIn !== undefined && { check_in: newCheckIn }),
        ...(checkOut !== undefined && { check_out: newCheckOut }),
        ...(status && { status: normAttendanceStatus(status) as any }),
        working_hours: workingHours,
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
