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
      const statusMap: Record<string, "Pending" | "In Progress" | "Completed" | "Delayed"> = {
        pending: "Pending",
        in_progress: "In Progress",
        completed: "Completed",
        cancelled: "Delayed",
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
        startDate: p.started_at.toISOString().slice(0, 10),
        dueDate: new Date(p.started_at.getTime() + 30 * 86400000).toISOString().slice(0, 10),
        buddy: "Rohan Mehta",
        assignedHr: "Sana Iqbal",
        status: statusMap[p.status] ?? "In Progress",
        invitationSentDate: p.started_at.toISOString().slice(0, 10),
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
      };

      const clearance = p.offboarding_clearance_tasks.map((c) => {
        const deptMap: Record<string, "IT" | "Finance" | "HR" | "Admin"> = {
          IT: "IT",
          Finance: "Finance",
          HR: "HR",
          Admin: "Admin",
          Facilities: "Admin",
        };

        return {
          id: c.id,
          department: deptMap[c.department] ?? "Admin",
          item: c.task_name,
          cleared: c.status === "completed",
          clearedBy: c.completed_by ? "Authorized Officer" : undefined,
          clearedAt: c.completed_at?.toISOString().slice(0, 10),
          remarks: undefined,
        };
      });

      return {
        id: p.id,
        employeeId: p.employee_id,
        employeeCode: p.employees.employee_code,
        employeeName: p.employees.full_name,
        lastWorkingDay: p.last_working_date.toISOString().slice(0, 10),
        resignationDate: p.resignation_date?.toISOString().slice(0, 10) ?? p.created_at.toISOString().slice(0, 10),
        reason: p.reason ?? "Voluntary career transition",
        status: statusMap[p.status] ?? "Clearance",
        handoverTo: "Team Member",
        exitInterviewDone: p.exit_interview_completed,
        exitInterviewNotes: p.exit_interview_notes ?? undefined,
        fnfStatus: fnfStatusMap[p.final_settlement_status ?? "pending"] ?? "Pending",
        clearance,
      };
    });

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch offboarding cases" });
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
