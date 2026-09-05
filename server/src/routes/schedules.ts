import { Router } from "express";
import { prisma } from "../lib/prisma";
import { resolveEmployee } from "../lib/resolve-employee";

const router = Router();

// Automatic hours calculation helper
export function calculateHours(
  startTime: string,
  endTime: string,
  breakDurationMinutes: number = 60,
  daysCount: number = 5,
) {
  const [sh = 9, sm = 0] = startTime.split(":").map(Number);
  const [eh = 18, em = 0] = endTime.split(":").map(Number);

  let startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  // Handle overnight shift (e.g. 22:00 to 06:00)
  if (endMin <= startMin) {
    endMin += 24 * 60;
  }

  const elapsedMinutes = endMin - startMin;
  const workMinutes = Math.max(0, elapsedMinutes - (breakDurationMinutes || 0));
  const dailyHours = Math.round((workMinutes / 60) * 100) / 100;
  const weeklyHours = Math.round(dailyHours * daysCount * 100) / 100;

  return { dailyHours, weeklyHours };
}

// ── GET /api/schedules ────────────────────────────────────────────────────────
// Lists all work schedules with assigned employee IDs and details
router.get("/", async (req, res) => {
  try {
    const { employeeId } = req.query as { employeeId?: string };

    let realEmpId: string | undefined = undefined;
    if (employeeId) {
      const emp = await resolveEmployee(employeeId);
      if (emp) realEmpId = emp.id;
    }

    // Query schedules from PostgreSQL
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        s.*,
        COALESCE(
          json_agg(
            json_build_object(
              'employeeId', es.employee_id,
              'assignedAt', es.assigned_at
            )
          ) FILTER (WHERE es.employee_id IS NOT NULL),
          '[]'
        ) as assignments
      FROM work_schedules s
      LEFT JOIN employee_schedules es ON s.id = es.schedule_id
      GROUP BY s.id
      ORDER BY s.is_default DESC, s.created_at ASC;
    `);

    // Fetch employees for mapping names & codes
    const allEmployees = await prisma.employees.findMany({
      select: { id: true, employee_code: true, full_name: true, department_id: true, designation_id: true },
    });
    const empMap = new Map(allEmployees.map((e) => [e.id, e]));

    const mapped = rows.map((r) => {
      const assignments = Array.isArray(r.assignments) ? r.assignments : [];
      const assignedIds = assignments.map((a: any) => a.employeeId);
      const assignedDetails = assignedIds.map((id: string) => {
        const emp = empMap.get(id);
        return {
          id,
          code: emp?.employee_code || id,
          name: emp?.full_name || id,
        };
      });

      return {
        id: r.id,
        code: r.code || r.id,
        name: r.name,
        description: r.description || "",
        shiftType: r.shift_type || "General",
        workingDays: Array.isArray(r.working_days) ? r.working_days : [],
        startTime: r.start_time,
        endTime: r.end_time,
        breakDurationMinutes: Number(r.break_duration_minutes || 60),
        breakStartTime: r.break_start_time || undefined,
        breakEndTime: r.break_end_time || undefined,
        dailyHours: Number(r.daily_hours || 8),
        weeklyHours: Number(r.weekly_hours || 40),
        color: r.color || "#3b82f6",
        isDefault: Boolean(r.is_default),
        status: r.status || "active",
        assignedEmployeeIds: assignedIds,
        assignedEmployees: assignedDetails,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      };
    });

    // If filtered by employee, return schedules where this employee is assigned (or default)
    if (realEmpId) {
      const mySchedules = mapped.filter((s) => s.assignedEmployeeIds.includes(realEmpId!));
      if (mySchedules.length > 0) {
        return res.json({ success: true, data: mySchedules });
      }
      // Fallback to default schedule if none assigned
      const defaultSch = mapped.filter((s) => s.isDefault);
      return res.json({ success: true, data: defaultSch.length > 0 ? defaultSch : mapped.slice(0, 1) });
    }

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error("[schedules] Fetch error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch work schedules" });
  }
});

// ── GET /api/schedules/my-schedule ────────────────────────────────────────────
// Returns current authenticated employee's active schedule
router.get("/my-schedule", async (req, res) => {
  try {
    const { employeeId } = req.query as { employeeId?: string };
    if (!employeeId) {
      return res.status(400).json({ success: false, error: "Employee identifier required" });
    }

    const emp = await resolveEmployee(employeeId);
    if (!emp) return res.status(404).json({ success: false, error: "Employee not found" });

    // Find assigned schedule
    const assignedRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT s.* FROM work_schedules s
       JOIN employee_schedules es ON s.id = es.schedule_id
       WHERE es.employee_id = $1::uuid LIMIT 1;`,
      emp.id,
    );

    let scheduleRow = assignedRows[0];
    if (!scheduleRow) {
      // Fallback to default schedule
      const defaultRows: any[] = await prisma.$queryRawUnsafe(
        `SELECT * FROM work_schedules WHERE is_default = true LIMIT 1;`,
      );
      scheduleRow = defaultRows[0];
    }

    if (!scheduleRow) {
      return res.status(404).json({ success: false, error: "No schedule assigned" });
    }

    const mapped = {
      id: scheduleRow.id,
      code: scheduleRow.code || scheduleRow.id,
      name: scheduleRow.name,
      description: scheduleRow.description || "",
      shiftType: scheduleRow.shift_type || "General",
      workingDays: Array.isArray(scheduleRow.working_days) ? scheduleRow.working_days : [],
      startTime: scheduleRow.start_time,
      endTime: scheduleRow.end_time,
      breakDurationMinutes: Number(scheduleRow.break_duration_minutes || 60),
      breakStartTime: scheduleRow.break_start_time || undefined,
      breakEndTime: scheduleRow.break_end_time || undefined,
      dailyHours: Number(scheduleRow.daily_hours || 8),
      weeklyHours: Number(scheduleRow.weekly_hours || 40),
      color: scheduleRow.color || "#3b82f6",
      isDefault: Boolean(scheduleRow.is_default),
      status: scheduleRow.status || "active",
      employee: {
        id: emp.id,
        code: emp.employee_code,
        name: emp.full_name,
      },
    };

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error("[schedules] My schedule error:", err);
    res.status(500).json({ success: false, error: "Failed to retrieve employee schedule" });
  }
});

// ── POST /api/schedules (HR / ADMIN ONLY) ──────────────────────────────────────
// Creates a new work schedule with auto-computed weekly hours
router.post("/", async (req, res) => {
  try {
    const {
      name,
      description = "",
      shiftType = "General",
      workingDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      startTime = "09:00",
      endTime = "18:00",
      breakDurationMinutes = 60,
      breakStartTime = "13:00",
      breakEndTime = "14:00",
      color = "#3b82f6",
      isDefault = false,
      assignedEmployeeIds = [],
    } = req.body as {
      name: string;
      description?: string;
      shiftType?: string;
      workingDays?: string[];
      startTime?: string;
      endTime?: string;
      breakDurationMinutes?: number;
      breakStartTime?: string;
      breakEndTime?: string;
      color?: string;
      isDefault?: boolean;
      assignedEmployeeIds?: string[];
    };

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Schedule name is required" });
    }

    const days = Array.isArray(workingDays) && workingDays.length > 0
      ? workingDays
      : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

    // Automatic daily & weekly hours calculation
    const { dailyHours, weeklyHours } = calculateHours(
      startTime,
      endTime,
      Number(breakDurationMinutes) || 0,
      days.length,
    );

    // If this is set as default, clear previous default flag
    if (isDefault) {
      await prisma.$executeRawUnsafe(`UPDATE work_schedules SET is_default = false;`);
    }

    const inserted: any[] = await prisma.$queryRawUnsafe(
      `INSERT INTO work_schedules (
        name, description, shift_type, working_days, start_time, end_time,
        break_duration_minutes, break_start_time, break_end_time, daily_hours, weekly_hours,
        color, is_default, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4::text[], $5, $6, $7, $8, $9, $10, $11, $12, $13, 'active', NOW(), NOW())
      RETURNING *;`,
      name.trim(),
      description.trim(),
      shiftType,
      days,
      startTime,
      endTime,
      Number(breakDurationMinutes) || 0,
      breakStartTime || null,
      breakEndTime || null,
      dailyHours,
      weeklyHours,
      color,
      Boolean(isDefault),
    );

    const newSchedule = inserted[0];

    // Assign initial employees if provided
    if (Array.isArray(assignedEmployeeIds) && assignedEmployeeIds.length > 0) {
      for (const empIdOrCode of assignedEmployeeIds) {
        const emp = await resolveEmployee(empIdOrCode);
        if (emp) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO employee_schedules (schedule_id, employee_id, assigned_at)
             VALUES ($1::uuid, $2::uuid, NOW())
             ON CONFLICT (employee_id) DO UPDATE SET schedule_id = $1::uuid, assigned_at = NOW();`,
            newSchedule.id,
            emp.id,
          );

          // Update active contract weekly hours
          await prisma.contracts.updateMany({
            where: { employee_id: emp.id, status: "active" },
            data: { working_hours_per_week: weeklyHours },
          });
        }
      }
    }

    res.status(201).json({
      success: true,
      message: "Schedule created successfully in database",
      data: {
        id: newSchedule.id,
        name: name.trim(),
        dailyHours,
        weeklyHours,
        workingDays: days,
      },
    });
  } catch (err) {
    console.error("[schedules] Create error:", err);
    res.status(500).json({ success: false, error: "Failed to create work schedule" });
  }
});

// ── PATCH /api/schedules/:id (HR / ADMIN ONLY) ─────────────────────────────────
// Updates schedule definition in database, recomputes weekly hours, updates assignments
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const existingRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM work_schedules WHERE id = $1::uuid LIMIT 1;`,
      id,
    );
    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ success: false, error: "Schedule not found" });
    }

    const {
      name = existing.name,
      description = existing.description,
      shiftType = existing.shift_type,
      workingDays = existing.working_days,
      startTime = existing.start_time,
      endTime = existing.end_time,
      breakDurationMinutes = existing.break_duration_minutes,
      breakStartTime = existing.break_start_time,
      breakEndTime = existing.break_end_time,
      color = existing.color,
      isDefault = existing.is_default,
      status = existing.status,
      assignedEmployeeIds,
    } = req.body as any;

    const days = Array.isArray(workingDays) && workingDays.length > 0 ? workingDays : existing.working_days;

    // Recalculate daily & weekly hours
    const { dailyHours, weeklyHours } = calculateHours(
      startTime,
      endTime,
      Number(breakDurationMinutes) || 0,
      days.length,
    );

    if (isDefault && !existing.is_default) {
      await prisma.$executeRawUnsafe(`UPDATE work_schedules SET is_default = false;`);
    }

    await prisma.$executeRawUnsafe(
      `UPDATE work_schedules SET
        name = $1,
        description = $2,
        shift_type = $3,
        working_days = $4::text[],
        start_time = $5,
        end_time = $6,
        break_duration_minutes = $7,
        break_start_time = $8,
        break_end_time = $9,
        daily_hours = $10,
        weekly_hours = $11,
        color = $12,
        is_default = $13,
        status = $14,
        updated_at = NOW()
      WHERE id = $15::uuid;`,
      name.trim(),
      description.trim(),
      shiftType,
      days,
      startTime,
      endTime,
      Number(breakDurationMinutes) || 0,
      breakStartTime || null,
      breakEndTime || null,
      dailyHours,
      weeklyHours,
      color,
      Boolean(isDefault),
      status,
      id,
    );

    // Update assignments if provided
    if (Array.isArray(assignedEmployeeIds)) {
      const resolvedTargetIds: string[] = [];
      for (const item of assignedEmployeeIds) {
        const emp = await resolveEmployee(item);
        if (emp) resolvedTargetIds.push(emp.id);
      }

      // Reassign selected employees to this schedule
      for (const empId of resolvedTargetIds) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO employee_schedules (schedule_id, employee_id, assigned_at)
           VALUES ($1::uuid, $2::uuid, NOW())
           ON CONFLICT (employee_id) DO UPDATE SET schedule_id = $1::uuid, assigned_at = NOW();`,
          id,
          empId,
        );

        // Sync contract hours
        await prisma.contracts.updateMany({
          where: { employee_id: empId, status: "active" },
          data: { working_hours_per_week: weeklyHours },
        });
      }
    }

    res.json({
      success: true,
      message: "Schedule updated in database",
      data: { id, dailyHours, weeklyHours },
    });
  } catch (err) {
    console.error("[schedules] Patch error:", err);
    res.status(500).json({ success: false, error: "Failed to update schedule" });
  }
});

// ── DELETE /api/schedules/:id (HR / ADMIN ONLY) ────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const existingRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM work_schedules WHERE id = $1::uuid LIMIT 1;`,
      id,
    );
    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ success: false, error: "Schedule not found" });
    }

    if (existing.is_default) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete the default organization schedule. Set another default schedule first.",
      });
    }

    // Find default schedule to reassign orphaned employees
    const defaultRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, weekly_hours FROM work_schedules WHERE is_default = true LIMIT 1;`,
    );
    const defaultSch = defaultRows[0];

    if (defaultSch) {
      await prisma.$executeRawUnsafe(
        `UPDATE employee_schedules SET schedule_id = $1::uuid WHERE schedule_id = $2::uuid;`,
        defaultSch.id,
        id,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `DELETE FROM employee_schedules WHERE schedule_id = $1::uuid;`,
        id,
      );
    }

    await prisma.$executeRawUnsafe(
      `DELETE FROM work_schedules WHERE id = $1::uuid;`,
      id,
    );

    res.json({ success: true, message: "Schedule deleted from database" });
  } catch (err) {
    console.error("[schedules] Delete error:", err);
    res.status(500).json({ success: false, error: "Failed to delete schedule" });
  }
});

// ── POST /api/schedules/:id/assign (HR / ADMIN ONLY) ───────────────────────────
// Assigns schedule to employees and updates contracts
router.post("/:id/assign", async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeIds } = req.body as { employeeIds: string[] };

    if (!Array.isArray(employeeIds)) {
      return res.status(400).json({ success: false, error: "employeeIds array is required" });
    }

    const schRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM work_schedules WHERE id = $1::uuid LIMIT 1;`,
      id,
    );
    const schedule = schRows[0];
    if (!schedule) {
      return res.status(404).json({ success: false, error: "Schedule not found" });
    }

    const resolvedIds: string[] = [];
    for (const item of employeeIds) {
      const emp = await resolveEmployee(item);
      if (emp) resolvedIds.push(emp.id);
    }

    // Clear old assignments for this schedule that are not in resolvedIds
    if (resolvedIds.length > 0) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM employee_schedules 
         WHERE schedule_id = $1::uuid AND employee_id NOT IN (${resolvedIds.map((_, i) => `$${i + 2}::uuid`).join(", ")});`,
        id,
        ...resolvedIds,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `DELETE FROM employee_schedules WHERE schedule_id = $1::uuid;`,
        id,
      );
    }

    // Insert or update new assignments
    for (const empId of resolvedIds) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO employee_schedules (schedule_id, employee_id, assigned_at)
         VALUES ($1::uuid, $2::uuid, NOW())
         ON CONFLICT (employee_id) DO UPDATE SET schedule_id = $1::uuid, assigned_at = NOW();`,
        id,
        empId,
      );

      // Synchronize contract weekly committed hours
      await prisma.contracts.updateMany({
        where: { employee_id: empId, status: "active" },
        data: { working_hours_per_week: Number(schedule.weekly_hours || 40) },
      });
    }

    res.json({
      success: true,
      message: `Assigned ${resolvedIds.length} employee(s) to schedule in database`,
      data: {
        scheduleId: id,
        assignedCount: resolvedIds.length,
      },
    });
  } catch (err) {
    console.error("[schedules] Assign error:", err);
    res.status(500).json({ success: false, error: "Failed to assign schedule" });
  }
});

export default router;
