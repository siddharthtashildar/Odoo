import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  sendServiceAccountsEmail,
  sendAssetAllotmentEmail,
  sendOffboardingCompletionEmail,
} from "../lib/email";

const router = Router();

// ── GET /api/onboarding ────────────────────────────────────────────────────────
router.get("/onboarding", async (_req, res) => {
  try {
    const processes = await prisma.onboarding_processes.findMany({
      include: {
        employees: {
          select: {
            id: true,
            employee_code: true,
            full_name: true,
            email: true,
            joining_date: true,
            reporting_manager_id: true,
          },
        },
        onboarding_tasks: {
          orderBy: { sequence: "asc" },
        },
      },
      orderBy: { created_at: "desc" },
    });

    // Fetch managers for reference if needed
    const managerIds = processes
      .map((p) => p.employees?.reporting_manager_id)
      .filter((id): id is string => Boolean(id));

    const managers = managerIds.length > 0
      ? await prisma.employees.findMany({
          where: { id: { in: managerIds } },
          select: { id: true, full_name: true },
        })
      : [];
    const managerMap = new Map(managers.map((m) => [m.id, m.full_name]));

    const mapped = processes.map((p) => {
      const rawStatus = p.status as string;

      const tasks = p.onboarding_tasks.map((t) => {
        const ownerMap: Record<string, "Employee" | "HR" | "IT" | "Payroll" | "Manager"> = {
          HR: "HR",
          IT: "IT",
          Finance: "Payroll",
          Employee: "Employee",
          Engineering: "Manager",
        };
        const catMap: Record<string, "Personal" | "Compliance" | "Finance" | "Legal" | "Orientation" | "IT"> = {
          HR: "Orientation",
          IT: "IT",
          Finance: "Finance",
          Employee: "Personal",
        };

        return {
          id: t.id,
          label: t.task_name,
          owner: ownerMap[t.responsible_department ?? "HR"] ?? "HR",
          done: t.status === "completed",
          category: catMap[t.responsible_department ?? "HR"] ?? "Compliance",
        };
      });

      const allDone = tasks.length > 0 && tasks.every((t) => t.done);
      const anyDone = tasks.some((t) => t.done);
      const hasChangedPassword = (p as any).notes?.includes("password_changed") || false;

      let computedStatus: "Invitation Sent" | "Account Created" | "In Progress" | "Completed" | "Overdue" = "Invitation Sent";
      if (rawStatus === "completed" || allDone) {
        computedStatus = "Completed";
      } else if (hasChangedPassword || anyDone) {
        computedStatus = "In Progress";
      } else {
        computedStatus = "Invitation Sent";
      }

      const managerName = p.employees?.reporting_manager_id
        ? managerMap.get(p.employees.reporting_manager_id) ?? "Reporting Manager"
        : "HR Manager";

      return {
        id: p.id,
        employeeId: p.employee_id,
        employeeCode: p.employees?.employee_code ?? "PP-0000",
        employeeName: p.employees?.full_name ?? "Employee",
        startDate: p.started_at instanceof Date ? p.started_at.toISOString().slice(0, 10) : String(p.started_at),
        dueDate: (() => {
          const d = p.started_at instanceof Date ? p.started_at : new Date(String(p.started_at));
          return new Date(d.getTime() + 30 * 86400000).toISOString().slice(0, 10);
        })(),
        buddy: (p as any).buddy || managerName,
        assignedHr: (p as any).assigned_hr || "HR Manager",
        status: computedStatus,
        invitationSentDate: p.started_at instanceof Date ? p.started_at.toISOString().slice(0, 10) : String(p.started_at),
        accountCreatedDate: p.completed_at?.toISOString().slice(0, 10),
        tasks,
      };
    });

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error("Fetch onboarding error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch onboarding cases" });
  }
});

// ── POST /api/onboarding ───────────────────────────────────────────────────────
router.post("/onboarding", async (req, res) => {
  try {
    const { employeeId, assignedHr, buddy, notes } = req.body as {
      employeeId: string;
      assignedHr?: string;
      buddy?: string;
      notes?: string;
    };

    if (!employeeId) {
      return res.status(400).json({ success: false, error: "employeeId is required" });
    }

    // Check if onboarding process already exists for this employee
    const existing = await prisma.onboarding_processes.findUnique({
      where: { employee_id: employeeId },
      include: {
        employees: { select: { id: true, employee_code: true, full_name: true, email: true } },
      },
    });

    if (existing) {
      return res.json({
        success: true,
        data: {
          id: existing.id,
          employeeId: existing.employee_id,
          employeeName: existing.employees.full_name,
        },
      });
    }

    const defaultTasks = [
      { task_name: "Complete personal profile", responsible_department: "Employee", sequence: 1 },
      { task_name: "Add emergency contact", responsible_department: "Employee", sequence: 2 },
      { task_name: "Accept company policies", responsible_department: "HR", sequence: 3 },
      { task_name: "Complete bank details", responsible_department: "Finance", sequence: 4 },
      { task_name: "Complete tax information", responsible_department: "Finance", sequence: 5 },
      { task_name: "Review contract", responsible_department: "HR", sequence: 6 },
      { task_name: "Attend orientation", responsible_department: "HR", sequence: 7 },
      { task_name: "Receive company assets", responsible_department: "IT", sequence: 8 },
    ];

    const process = await prisma.onboarding_processes.create({
      data: {
        employee_id: employeeId,
        status: "in_progress",
        assigned_hr: assignedHr || "HR Operations",
        buddy: buddy || "Assigned Mentor",
        notes: notes || null,
        onboarding_tasks: {
          create: defaultTasks.map((t) => ({
            task_name: t.task_name,
            responsible_department: t.responsible_department,
            sequence: t.sequence,
            status: "not_started",
          })),
        },
      },
      include: {
        employees: { select: { id: true, employee_code: true, full_name: true, email: true } },
        onboarding_tasks: { orderBy: { sequence: "asc" } },
      },
    });

    res.json({
      success: true,
      data: {
        id: process.id,
        employeeId: process.employee_id,
        employeeName: process.employees.full_name,
      },
    });
  } catch (err) {
    console.error("Create onboarding error:", err);
    res.status(500).json({ success: false, error: "Failed to create onboarding case" });
  }
});

// ── PATCH /api/onboarding/:id ─────────────────────────────────────────────────
router.patch("/onboarding/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status?: string };

    const isCompleted = status === "Completed" || status === "completed";
    const dbStatus = isCompleted ? "completed" : "in_progress";

    const updated = await prisma.onboarding_processes.update({
      where: { id },
      data: {
        status: dbStatus,
        completed_at: isCompleted ? new Date() : null,
      },
      include: { employees: true },
    });

    if (isCompleted && updated.employee_id) {
      await prisma.employees.update({
        where: { id: updated.employee_id },
        data: { status: "active" },
      });
    }

    res.json({ success: true, data: { id } });
  } catch (err) {
    console.error("Update onboarding error:", err);
    res.status(500).json({ success: false, error: "Failed to update onboarding case" });
  }
});

// ── PATCH /api/onboarding/:id/tasks/:taskId ───────────────────────────────────
router.patch("/onboarding/:id/tasks/:taskId", async (req, res) => {
  try {
    const { id, taskId } = req.params;
    const { done } = req.body as { done: boolean };

    await prisma.onboarding_tasks.update({
      where: { id: taskId },
      data: {
        status: done ? "completed" : "not_started",
        completed_at: done ? new Date() : null,
      },
    });

    // Check if all tasks are completed
    const allTasks = await prisma.onboarding_tasks.findMany({
      where: { onboarding_process_id: id },
    });

    const allDone = allTasks.length > 0 && allTasks.every((t) => t.status === "completed");

    if (allDone) {
      const proc = await prisma.onboarding_processes.update({
        where: { id },
        data: {
          status: "completed",
          completed_at: new Date(),
        },
      });

      if (proc.employee_id) {
        await prisma.employees.update({
          where: { id: proc.employee_id },
          data: { status: "active" },
        });
      }
    } else {
      await prisma.onboarding_processes.update({
        where: { id },
        data: {
          status: "in_progress",
          completed_at: null,
        },
      });
    }

    res.json({ success: true, data: { id: taskId, allDone } });
  } catch (err) {
    console.error("Update task error:", err);
    res.status(500).json({ success: false, error: "Failed to update task" });
  }
});

// ── GET /api/onboarding/:id/service-accounts ──────────────────────────────────
router.get("/onboarding/:id/service-accounts", async (req, res) => {
  try {
    const { id } = req.params;
    const proc = await prisma.onboarding_processes.findUnique({
      where: { id },
      include: { employees: true },
    });
    if (!proc) {
      return res.status(404).json({ success: false, error: "Onboarding process not found" });
    }

    const accounts = await prisma.service_accounts.findMany({
      where: {
        OR: [
          { onboarding_process_id: id },
          { employee_id: proc.employee_id },
        ],
      },
      orderBy: { requested_at: "desc" },
    });

    res.json({
      success: true,
      data: accounts.map((a) => ({
        id: a.id,
        serviceName: a.service_name,
        username: a.username,
        status: a.status,
        requestedAt: a.requested_at.toISOString(),
        createdDate: a.created_date?.toISOString(),
      })),
    });
  } catch (err) {
    console.error("Fetch service accounts error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch service accounts" });
  }
});

// ── POST /api/onboarding/:id/service-accounts ─────────────────────────────────
router.post("/onboarding/:id/service-accounts", async (req, res) => {
  try {
    const { id } = req.params;
    const { accounts } = req.body as {
      accounts: Array<{ serviceName: string; username?: string; password?: string }>;
    };

    if (!accounts || accounts.length === 0) {
      return res.status(400).json({ success: false, error: "No accounts provided" });
    }

    const proc = await prisma.onboarding_processes.findUnique({
      where: { id },
      include: { employees: true },
    });
    if (!proc || !proc.employees) {
      return res.status(404).json({ success: false, error: "Onboarding process or employee not found" });
    }

    const createdAccounts = [];
    for (const acc of accounts) {
      const existing = await prisma.service_accounts.findFirst({
        where: {
          employee_id: proc.employee_id,
          service_name: acc.serviceName,
        },
      });

      if (existing) {
        const updated = await prisma.service_accounts.update({
          where: { id: existing.id },
          data: {
            username: acc.username || existing.username,
            status: "created",
            onboarding_process_id: id,
            created_date: new Date(),
          },
        });
        createdAccounts.push(updated);
      } else {
        const created = await prisma.service_accounts.create({
          data: {
            employee_id: proc.employee_id,
            service_name: acc.serviceName,
            username: acc.username || "",
            status: "created",
            onboarding_process_id: id,
            created_date: new Date(),
          },
        });
        createdAccounts.push(created);
      }
    }

    // Send email alert to the employee
    if (proc.employees.email) {
      try {
        await sendServiceAccountsEmail({
          to: proc.employees.email,
          employeeName: proc.employees.full_name,
          accounts: accounts.map((a) => ({
            serviceName: a.serviceName,
            username: a.username,
            password: a.password,
          })),
        });
      } catch (mailErr) {
        console.warn("Failed to dispatch service accounts email alert:", mailErr);
      }
    }

    res.json({
      success: true,
      data: createdAccounts.map((a) => ({
        id: a.id,
        serviceName: a.service_name,
        username: a.username,
        status: a.status,
        createdDate: a.created_date?.toISOString(),
      })),
    });
  } catch (err) {
    console.error("Create service accounts error:", err);
    res.status(500).json({ success: false, error: "Failed to create service accounts" });
  }
});

// ── GET /api/onboarding/:id/assets ────────────────────────────────────────────
router.get("/onboarding/:id/assets", async (req, res) => {
  try {
    const { id } = req.params;
    const proc = await prisma.onboarding_processes.findUnique({
      where: { id },
    });
    if (!proc) {
      return res.status(404).json({ success: false, error: "Onboarding process not found" });
    }

    const assignedAssets = await prisma.assets.findMany({
      where: { current_employee_id: proc.employee_id },
      orderBy: { created_at: "desc" },
    });

    res.json({
      success: true,
      data: assignedAssets.map((a) => ({
        id: a.id,
        assetCode: a.asset_code,
        assetType: a.asset_type,
        serialNumber: a.serial_number,
        condition: a.condition,
        status: a.status,
        location: a.location,
      })),
    });
  } catch (err) {
    console.error("Fetch onboarding assets error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch assets" });
  }
});

// ── POST /api/onboarding/:id/allot-asset ───────────────────────────────────────
router.post("/onboarding/:id/allot-asset", async (req, res) => {
  try {
    const { id } = req.params;
    const { assetId, assetCode, assetType, serialNumber, condition, location } = req.body as {
      assetId?: string;
      assetCode?: string;
      assetType: string;
      serialNumber?: string;
      condition?: "good" | "damaged" | "under_repair" | "retired";
      location?: string;
    };

    const proc = await prisma.onboarding_processes.findUnique({
      where: { id },
      include: { employees: true },
    });
    if (!proc || !proc.employees) {
      return res.status(404).json({ success: false, error: "Onboarding process or employee not found" });
    }

    let assignedAsset;
    if (assetId) {
      // Allot existing available asset
      assignedAsset = await prisma.assets.update({
        where: { id: assetId },
        data: {
          status: "assigned",
          current_employee_id: proc.employee_id,
          location: location || "HQ Operations",
        },
      });
    } else {
      // Create new asset record and assign
      const code = assetCode || `AST-${Date.now().toString().slice(-5)}`;
      assignedAsset = await prisma.assets.create({
        data: {
          asset_code: code,
          asset_type: assetType,
          serial_number: serialNumber || null,
          condition: (condition as any) || "good",
          status: "assigned",
          location: location || "HQ Operations",
          current_employee_id: proc.employee_id,
        },
      });
    }

    // Record asset assignment
    await prisma.asset_assignments.create({
      data: {
        asset_id: assignedAsset.id,
        employee_id: proc.employee_id,
        condition_at_assignment: assignedAsset.condition,
        status: "assigned",
      },
    });

    // Send Asset Allotment Email alert to employee
    if (proc.employees.email) {
      try {
        await sendAssetAllotmentEmail({
          to: proc.employees.email,
          employeeName: proc.employees.full_name,
          assetType: assignedAsset.asset_type,
          assetCode: assignedAsset.asset_code,
          serialNumber: assignedAsset.serial_number || undefined,
          condition: assignedAsset.condition,
          location: assignedAsset.location || "HQ Operations",
        });
      } catch (mailErr) {
        console.warn("Failed to dispatch asset allotment email alert:", mailErr);
      }
    }

    res.json({
      success: true,
      data: {
        id: assignedAsset.id,
        assetCode: assignedAsset.asset_code,
        assetType: assignedAsset.asset_type,
        serialNumber: assignedAsset.serial_number,
        condition: assignedAsset.condition,
        status: assignedAsset.status,
        location: assignedAsset.location,
      },
    });
  } catch (err) {
    console.error("Allot asset error:", err);
    res.status(500).json({ success: false, error: "Failed to allot asset" });
  }
});

// ── GET /api/offboarding ───────────────────────────────────────────────────────
router.get("/offboarding", async (_req, res) => {
  try {
    const processes = await prisma.offboarding_processes.findMany({
      include: {
        employees: {
          select: {
            id: true,
            employee_code: true,
            full_name: true,
            email: true,
            reporting_manager_id: true,
          },
        },
        offboarding_clearance_tasks: {
          orderBy: { department: "asc" },
        },
      },
      orderBy: { created_at: "desc" },
    });

    const mapped = processes.map((p) => {
      const rawStatus = p.status as string;

      const fnfRaw = p.final_settlement_status ?? "pending";
      const fnfStatusMap: Record<string, "Pending" | "Computed" | "Approved" | "Disbursed"> = {
        pending: "Pending",
        computed: "Computed",
        approved: "Approved",
        disbursed: "Disbursed",
        paid: "Disbursed",
        settled: "Disbursed",
      };

      const clearance = p.offboarding_clearance_tasks.map((c) => {
        const deptMap: Record<string, "IT" | "Finance" | "HR" | "Admin"> = {
          IT: "IT",
          Finance: "Finance",
          HR: "HR",
          Admin: "Admin",
          Facilities: "Admin",
        };

        const taskStatus = c.status as string;

        return {
          id: c.id,
          department: deptMap[c.department] ?? "Admin",
          item: c.task_name,
          cleared: taskStatus === "completed",
          clearedBy: c.completed_by ? "Authorized Officer" : undefined,
          clearedAt: c.completed_at?.toISOString().slice(0, 10),
          remarks: undefined,
        };
      });

      const allCleared = clearance.length > 0 && clearance.every((c) => c.cleared);

      let statusLabel: "Initiated" | "Clearance" | "Exit Interview" | "Settlement" | "Completed" = "Clearance";
      if (rawStatus === "completed" || fnfRaw === "settled" || fnfRaw === "disbursed") {
        statusLabel = "Completed";
      } else if (allCleared && p.exit_interview_completed) {
        statusLabel = "Settlement";
      } else if (p.exit_interview_completed) {
        statusLabel = "Clearance";
      } else {
        statusLabel = "Initiated";
      }

      return {
        id: p.id,
        employeeId: p.employee_id,
        employeeCode: p.employees?.employee_code ?? "PP-0000",
        employeeName: p.employees?.full_name ?? "Departing Employee",
        lastWorkingDay: p.last_working_date.toISOString().slice(0, 10),
        resignationDate: p.resignation_date?.toISOString().slice(0, 10) ?? p.created_at.toISOString().slice(0, 10),
        reason: p.reason ?? "Voluntary career transition",
        status: statusLabel,
        handoverTo: "Designated Team Peer",
        exitInterviewDone: p.exit_interview_completed,
        exitInterviewNotes: p.exit_interview_notes ?? undefined,
        exitInterviewStatus: p.exit_interview_completed ? "Completed" : "Pending",
        assetsReturned: (p as any).assets_returned ?? false,
        accessRevoked: (p as any).access_revoked ?? false,
        fnfStatus: fnfStatusMap[fnfRaw] ?? "Pending",
        finalSettlement: fnfRaw === "settled" || fnfRaw === "disbursed" ? "settled" : fnfRaw,
        finalPayrollStatus: fnfRaw === "settled" || fnfRaw === "disbursed" ? "Processed" : "Pending",
        clearanceStatus: allCleared ? "Cleared" : "Pending",
        clearance,
      };
    });

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error("Fetch offboarding error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch offboarding cases" });
  }
});

// ── POST /api/offboarding ─────────────────────────────────────────────────────
router.post("/offboarding", async (req, res) => {
  try {
    const { employeeId, lastWorkingDay, reason, resignationDate } = req.body as {
      employeeId: string;
      lastWorkingDay: string;
      reason?: string;
      resignationDate?: string;
    };

    if (!employeeId || !lastWorkingDay) {
      return res.status(400).json({ success: false, error: "employeeId and lastWorkingDay are required" });
    }

    const defaultClearance = [
      { department: "HR", task_name: "Exit interview completion" },
      { department: "IT", task_name: "Laptop and hardware return" },
      { department: "IT", task_name: "Revoke VPN and system access" },
      { department: "IT", task_name: "Remove from internal channels" },
      { department: "Finance", task_name: "Full & final settlement" },
      { department: "HR", task_name: "Collect company ID and access cards" },
      { department: "Admin", task_name: "Remove from payroll next cycle" },
    ];

    const process = await prisma.offboarding_processes.create({
      data: {
        employee_id: employeeId,
        last_working_date: new Date(lastWorkingDay),
        resignation_date: resignationDate ? new Date(resignationDate) : new Date(),
        reason: reason ?? "Voluntary resignation",
        status: "in_progress",
        exit_interview_completed: false,
        final_settlement_status: "pending",
        offboarding_clearance_tasks: {
          create: defaultClearance.map((c) => ({
            department: c.department,
            task_name: c.task_name,
            status: "not_started",
          })),
        },
      },
      include: {
        employees: { select: { id: true, employee_code: true, full_name: true, email: true } },
        offboarding_clearance_tasks: true,
      },
    });

    // Update employee status to notice_period
    await prisma.employees.update({
      where: { id: employeeId },
      data: { status: "notice_period", exit_date: new Date(lastWorkingDay) },
    });

    res.json({
      success: true,
      data: {
        id: process.id,
        employeeId: process.employee_id,
        employeeName: process.employees.full_name,
      },
    });
  } catch (err) {
    console.error("Create offboarding error:", err);
    res.status(500).json({ success: false, error: "Failed to create offboarding case" });
  }
});

// ── PATCH /api/offboarding/:id ────────────────────────────────────────────────
router.patch("/offboarding/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      accessRevoked,
      assetsReturned,
      exitInterviewDone,
      exitInterviewNotes,
      finalSettlement,
      status,
      completeOffboarding,
    } = req.body as {
      accessRevoked?: boolean;
      assetsReturned?: boolean;
      exitInterviewDone?: boolean;
      exitInterviewNotes?: string;
      finalSettlement?: string;
      status?: string;
      completeOffboarding?: boolean;
    };

    const patch: Record<string, unknown> = {};

    if (accessRevoked !== undefined) patch["access_revoked"] = accessRevoked;
    if (assetsReturned !== undefined) patch["assets_returned"] = assetsReturned;
    if (exitInterviewDone !== undefined) patch["exit_interview_completed"] = exitInterviewDone;
    if (exitInterviewNotes !== undefined) patch["exit_interview_notes"] = exitInterviewNotes;

    if (finalSettlement !== undefined) {
      const fnfMap: Record<string, string> = {
        settled: "settled",
        pending: "pending",
        Disbursed: "disbursed",
        Approved: "approved",
      };
      patch["final_settlement_status"] = fnfMap[finalSettlement] ?? finalSettlement;
    }

    if (status !== undefined) {
      patch["status"] = status === "Completed" ? "completed" : "in_progress";
    }

    if (completeOffboarding) {
      patch["status"] = "completed";
      patch["final_settlement_status"] = "settled";
      patch["employee_marked_exited"] = true;
      patch["access_revoked"] = true;
      patch["assets_returned"] = true;

      // Mark all clearance tasks as completed
      await prisma.offboarding_clearance_tasks.updateMany({
        where: { offboarding_process_id: id },
        data: { status: "completed", completed_at: new Date() },
      });

      // Mark employee as exited
      const proc = await prisma.offboarding_processes.findUnique({
        where: { id },
        select: { employee_id: true, last_working_date: true },
      });
      if (proc) {
        const emp = await prisma.employees.update({
          where: { id: proc.employee_id },
          data: { status: "exited", exit_date: proc.last_working_date || new Date() },
        });

        // Release any assets assigned to this employee
        await prisma.assets.updateMany({
          where: { current_employee_id: proc.employee_id },
          data: { status: "available", current_employee_id: null },
        });

        // Dispatch offboarding clearance and exit settlement confirmation email
        if (emp.email) {
          try {
            await sendOffboardingCompletionEmail({
              to: emp.email,
              employeeName: emp.full_name,
              lastWorkingDay: proc.last_working_date
                ? proc.last_working_date.toISOString().slice(0, 10)
                : new Date().toISOString().slice(0, 10),
            });
          } catch (mailErr) {
            console.warn("Failed to dispatch offboarding completion email:", mailErr);
          }
        }
      }
    }

    await prisma.offboarding_processes.update({
      where: { id },
      data: patch as any,
    });

    res.json({ success: true, data: { id } });
  } catch (err) {
    console.error("Update offboarding error:", err);
    res.status(500).json({ success: false, error: "Failed to update offboarding case" });
  }
});

// ── PATCH /api/offboarding/:id/clearance/:taskId ──────────────────────────────
router.patch("/offboarding/:id/clearance/:taskId", async (req, res) => {
  try {
    const { id, taskId } = req.params;
    const { cleared } = req.body as { cleared: boolean };

    await prisma.offboarding_clearance_tasks.update({
      where: { id: taskId },
      data: {
        status: cleared ? "completed" : "not_started",
        completed_at: cleared ? new Date() : null,
      },
    });

    // Check if all tasks are cleared
    const allTasks = await prisma.offboarding_clearance_tasks.findMany({
      where: { offboarding_process_id: id },
    });
    const allDone = allTasks.length > 0 && allTasks.every((t) => t.status === "completed");

    res.json({ success: true, data: { id: taskId, allCleared: allDone } });
  } catch (err) {
    console.error("Update clearance task error:", err);
    res.status(500).json({ success: false, error: "Failed to update clearance task" });
  }
});

// ── GET /api/provisioning ─────────────────────────────────────────────────────
router.get("/provisioning", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        accounts: true,
      },
    });

    const employees = await prisma.employees.findMany({
      select: { id: true, employee_code: true, full_name: true, email: true },
    });

    const mapped = users.map((u, idx) => {
      const emp = employees.find((e) => e.id === u.employeeId || e.email.toLowerCase() === u.email.toLowerCase());
      const hasAccount = u.accounts.length > 0;

      return {
        id: `PRV-${String(idx + 1).padStart(3, "0")}`,
        employeeId: emp?.id ?? u.employeeId ?? u.id,
        employeeName: emp?.full_name ?? u.name,
        companyEmail: u.email,
        overallStatus: (hasAccount ? "Completed" : "In Progress") as "Completed" | "In Progress" | "Pending" | "Failed",
        invitationStatus: (hasAccount ? "Accepted" : "Sent") as "Sent" | "Accepted" | "Pending",
        accountActivated: hasAccount,
        defaultPermissions: ["Dashboard View", "Self Service", "Attendance Punch", "Leave Request"],
        steps: [
          { step: 1, key: "ldap", label: "Directory & Single Sign-On Account", status: "completed" as const },
          { step: 2, key: "email", label: "Enterprise Google Workspace / Outlook", status: "completed" as const },
          { step: 3, key: "slack", label: "Workspace Slack & Teams Channel Invite", status: "completed" as const },
          { step: 4, key: "git", label: "Internal Code Repositories & Cloud Console", status: (hasAccount ? "completed" : "in_progress") as "completed" | "in_progress" },
        ],
        startedAt: u.createdAt ? u.createdAt.toISOString().slice(0, 10) : "2026-08-15",
        completedAt: hasAccount && u.updatedAt ? u.updatedAt.toISOString().slice(0, 10) : undefined,
      };
    });

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error("Fetch provisioning error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch provisioning records" });
  }
});

export default router;
