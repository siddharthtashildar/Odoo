import { Router } from "express";
import { prisma } from "../lib/prisma";

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
          },
        },
        onboarding_tasks: {
          orderBy: { sequence: "asc" },
        },
      },
    });

    const mapped = processes.map((p) => {
      const rawStatus = p.status as string;
      const statusMap: Record<string, "Invitation Sent" | "Account Created" | "In Progress" | "Completed" | "Overdue"> = {
        in_progress: "In Progress",
        invitation_sent: "Invitation Sent",
        account_created: "Account Created",
        completed: "Completed",
        overdue: "Overdue",
        pending: "Invitation Sent",
      };

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

      return {
        id: p.id,
        employeeId: p.employee_id,
        employeeCode: p.employees.employee_code,
        employeeName: p.employees.full_name,
        startDate: p.started_at instanceof Date ? p.started_at.toISOString().slice(0, 10) : String(p.started_at),
        dueDate: (() => {
          const d = p.started_at instanceof Date ? p.started_at : new Date(String(p.started_at));
          return new Date(d.getTime() + 30 * 86400000).toISOString().slice(0, 10);
        })(),
        buddy: (p as any).buddy ?? "Rohan Mehta",
        assignedHr: (p as any).assigned_hr ?? "Sana Iqbal",
        status: statusMap[rawStatus] ?? "In Progress",
        invitationSentDate: p.started_at instanceof Date ? p.started_at.toISOString().slice(0, 10) : String(p.started_at),
        accountCreatedDate: p.completed_at?.toISOString().slice(0, 10),
        tasks,
      };
    });

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error(err);
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
        status: "invitation_sent",
        assigned_hr: assignedHr ?? "Sana Iqbal",
        buddy: buddy ?? "Rohan Mehta",
        notes: notes ?? null,
        onboarding_tasks: {
          create: defaultTasks.map((t) => ({
            task_name: t.task_name,
            responsible_department: t.responsible_department,
            sequence: t.sequence,
            status: "not_started",
          })),
        },
      } as any,
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
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create onboarding case" });
  }
});

// ── PATCH /api/onboarding/:id ─────────────────────────────────────────────────
router.patch("/onboarding/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status?: string };

    const statusMap: Record<string, string> = {
      "Invitation Sent": "invitation_sent",
      "Account Created": "account_created",
      "In Progress": "in_progress",
      "Completed": "completed",
      "Overdue": "overdue",
    };

    const dbStatus = statusMap[status ?? ""] ?? status ?? undefined;

    await prisma.onboarding_processes.update({
      where: { id },
      data: {
        ...(dbStatus && { status: dbStatus }),
        ...(dbStatus === "completed" && { completed_at: new Date() }),
      } as any,
    });

    res.json({ success: true, data: { id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update onboarding case" });
  }
});

// ── PATCH /api/onboarding/:id/tasks/:taskId ───────────────────────────────────
router.patch("/onboarding/:id/tasks/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;
    const { done } = req.body as { done: boolean };

    await prisma.onboarding_tasks.update({
      where: { id: taskId },
      data: {
        status: done ? "completed" : "not_started",
        completed_at: done ? new Date() : null,
      },
    });

    res.json({ success: true, data: { id: taskId } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update task" });
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
          },
        },
        offboarding_clearance_tasks: {
          orderBy: { department: "asc" },
        },
      },
    });

    const mapped = processes.map((p) => {
      const rawStatus = p.status as string;
      const statusMap: Record<string, "Initiated" | "Clearance" | "Exit Interview" | "Settlement" | "Completed"> = {
        initiated: "Initiated",
        in_progress: "Clearance",
        exit_interview_completed: "Exit Interview",
        settled: "Settlement",
        completed: "Completed",
      };

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

      const fnfRaw = p.final_settlement_status ?? "pending";

      return {
        id: p.id,
        employeeId: p.employee_id,
        employeeCode: p.employees.employee_code,
        employeeName: p.employees.full_name,
        lastWorkingDay: p.last_working_date.toISOString().slice(0, 10),
        resignationDate: p.resignation_date?.toISOString().slice(0, 10) ?? p.created_at.toISOString().slice(0, 10),
        reason: p.reason ?? "Voluntary career transition",
        status: statusMap[rawStatus] ?? "Clearance",
        handoverTo: "Team Member",
        exitInterviewDone: p.exit_interview_completed,
        exitInterviewNotes: p.exit_interview_notes ?? undefined,
        exitInterviewStatus: p.exit_interview_completed ? "Completed" : "Pending",
        assetsReturned: (p as any).assets_returned ?? false,
        accessRevoked: (p as any).access_revoked ?? false,
        fnfStatus: fnfStatusMap[fnfRaw] ?? "Pending",
        finalSettlement: fnfStatusMap[fnfRaw] === "Disbursed" ? "settled" : fnfRaw,
        finalPayrollStatus: fnfStatusMap[fnfRaw] === "Disbursed" ? "Processed" : "Pending",
        clearanceStatus: clearance.every((c) => c.cleared) ? "Cleared" : "Pending",
        clearance,
      };
    });

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error(err);
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
        status: "initiated",
        exit_interview_completed: false,
        final_settlement_status: "pending",
        offboarding_clearance_tasks: {
          create: defaultClearance.map((c) => ({
            department: c.department,
            task_name: c.task_name,
            status: "not_started",
          })),
        },
      } as any,
      include: {
        employees: { select: { id: true, employee_code: true, full_name: true, email: true } },
        offboarding_clearance_tasks: true,
      },
    });

    // Mark employee as offboarding
    await prisma.employees.update({
      where: { id: employeeId },
      data: { status: "exited", exit_date: new Date(lastWorkingDay) },
    });

    res.json({
      success: true,
      data: { id: process.id, employeeId: process.employee_id, employeeName: process.employees.full_name },
    });
  } catch (err) {
    console.error(err);
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

    // Map frontend FNF status to DB value
    if (finalSettlement !== undefined) {
      const fnfMap: Record<string, string> = {
        settled: "settled",
        pending: "pending",
        Disbursed: "disbursed",
        Approved: "approved",
      };
      patch["final_settlement_status"] = fnfMap[finalSettlement] ?? finalSettlement;
    }

    // Map frontend status to DB offboarding_status_enum
    if (status !== undefined) {
      const sMap: Record<string, string> = {
        "Initiated": "initiated",
        "Clearance": "in_progress",
        "Exit Interview": "exit_interview_completed",
        "Settlement": "settled",
        "Completed": "completed",
      };
      patch["status"] = sMap[status] ?? "in_progress";
    }

    if (completeOffboarding) {
      patch["status"] = "completed";
      patch["final_settlement_status"] = "settled";
      patch["employee_marked_exited"] = true;
      // Also mark all clearance tasks as done
      await prisma.offboarding_clearance_tasks.updateMany({
        where: { offboarding_process_id: id },
        data: { status: "completed", completed_at: new Date() },
      });
      // Mark employee as exited
      const proc = await prisma.offboarding_processes.findUnique({
        where: { id },
        select: { employee_id: true },
      });
      if (proc) {
        await prisma.employees.update({
          where: { id: proc.employee_id },
          data: { status: "exited" },
        });
      }
    }

    await prisma.offboarding_processes.update({
      where: { id },
      data: patch as any,
    });

    res.json({ success: true, data: { id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update offboarding case" });
  }
});

// ── PATCH /api/offboarding/:id/clearance/:taskId ──────────────────────────────
router.patch("/offboarding/:id/clearance/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;
    const { cleared } = req.body as { cleared: boolean };

    await prisma.offboarding_clearance_tasks.update({
      where: { id: taskId },
      data: {
        status: cleared ? "completed" : "not_started",
        completed_at: cleared ? new Date() : null,
      } as any,
    });

    res.json({ success: true, data: { id: taskId } });
  } catch (err) {
    console.error(err);
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
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch provisioning records" });
  }
});

export default router;
