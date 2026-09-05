import { Router } from "express";
import { prisma } from "../lib/prisma";
import { resolveEmployee } from "../lib/resolve-employee";

const router = Router();

// GET /api/helpdesk
router.get("/", async (req, res) => {
  try {
    const { employeeId } = req.query as { employeeId?: string };
    let realEmpId = employeeId;
    if (employeeId) {
      const emp = await resolveEmployee(employeeId);
      if (emp) realEmpId = emp.id;
    }

    const tickets = await prisma.it_tickets.findMany({
      where: realEmpId ? { employee_id: realEmpId } : undefined,
      orderBy: { created_at: "desc" },
      include: {
        employees: { select: { id: true, employee_code: true, full_name: true, email: true } },
        users: { select: { id: true, email: true } },
        it_ticket_comments: {
          orderBy: { created_at: "asc" },
          include: { users: { select: { email: true, employee_id: true } } },
        },
      },
    });

    const statusMap = {
      open: "Open",
      assigned: "In Progress",
      in_progress: "In Progress",
      waiting_for_employee: "Waiting for User",
      resolved: "Resolved",
      closed: "Closed",
    } as const;

    const categoryMap: Record<string, string> = {
      hardware: "Hardware",
      software: "Software",
      network: "Network",
      email: "Email",
      account_access: "Account Access",
      vpn: "Network",
      other: "Other",
    };

    const priorityMap: Record<string, string> = {
      critical: "Critical",
      high: "High",
      medium: "Medium",
      low: "Low",
    };

    const mapped = tickets.map((t) => {
      const emp = t.employees;
      const techName = t.users?.email ? t.users.email.split("@")[0] : "Karan Shah (IT Lead)";

      return {
        id: t.ticket_number || t.id,
        ticketId: t.id,
        ticketNumber: t.ticket_number,
        employeeId: emp?.employee_code || emp?.id || t.employee_id,
        employeeCode: emp?.employee_code,
        requesterId: emp?.employee_code || emp?.id || t.employee_id,
        employeeName: emp?.full_name ?? "Employee",
        category: (categoryMap[t.category] ?? "Other") as any,
        priority: (priorityMap[t.priority] ?? "Medium") as any,
        subject: t.subject,
        description: t.description ?? "",
        status: (statusMap[t.status as keyof typeof statusMap] ?? "Open") as any,
        assignedTechnician: techName,
        createdDate: t.created_at.toISOString().slice(0, 10),
        updatedDate: (t.resolved_at ?? t.updated_at ?? t.created_at).toISOString().slice(0, 10),
        linkedAssetId: t.linked_asset_id ?? null,
        createdAt: t.created_at.toISOString(),
        resolvedAt: t.resolved_at?.toISOString() ?? null,
        comments: t.it_ticket_comments.map((c) => ({
          id: c.id,
          author: c.users?.email ? c.users.email.split("@")[0] : "IT Support",
          text: c.comment,
          comment: c.comment,
          at: c.created_at.toISOString().slice(0, 16).replace("T", " "),
          createdAt: c.created_at.toISOString(),
        })),
      };
    });

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch helpdesk tickets" });
  }
});

// POST /api/helpdesk
router.post("/", async (req, res) => {
  try {
    const { employeeId, category, priority, subject, description } = req.body as {
      employeeId: string;
      category: string;
      priority?: string;
      subject: string;
      description?: string;
    };

    const emp = await resolveEmployee(employeeId);
    if (!emp) return res.status(404).json({ success: false, error: "Employee not found" });

    const normCat =
      category?.toLowerCase() === "hardware"
        ? "hardware"
        : category?.toLowerCase() === "software" || category?.toLowerCase() === "payroll system"
          ? "software"
          : category?.toLowerCase() === "network" || category?.toLowerCase() === "vpn"
            ? "network"
            : category?.toLowerCase() === "email"
              ? "email"
              : category?.toLowerCase()?.includes("access")
                ? "account_access"
                : "other";

    const normPriority =
      priority?.toLowerCase() === "critical"
        ? "critical"
        : priority?.toLowerCase() === "high"
          ? "high"
          : priority?.toLowerCase() === "low"
            ? "low"
            : "medium";

    const count = await prisma.it_tickets.count();
    const ticketNumber = `TKT-${String(count + 1).padStart(4, "0")}`;

    const ticket = await prisma.it_tickets.create({
      data: {
        ticket_number: ticketNumber,
        employee_id: emp.id,
        category: normCat as any,
        priority: normPriority as any,
        subject,
        description: description ?? null,
        status: "open",
      },
    });

    // If initial description was provided, add it as initial opening comment
    if (description && description.trim()) {
      let commenterUser = await prisma.users.findFirst({
        where: { OR: [{ employee_id: emp.id }, { email: emp.email }] },
      });
      if (!commenterUser) {
        commenterUser = await prisma.users.findFirst();
      }
      if (commenterUser) {
        await prisma.it_ticket_comments.create({
          data: {
            ticket_id: ticket.id,
            user_id: commenterUser.id,
            comment: description.trim(),
          },
        });
      }
    }

    res.status(201).json({ success: true, data: { id: ticket.id, ticketNumber: ticket.ticket_number } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create ticket" });
  }
});

// PATCH /api/helpdesk/:id
router.patch("/:id", async (req, res) => {
  try {
    const { status, priority, category } = req.body as {
      status?: string;
      priority?: string;
      category?: string;
    };

    const targetId = req.params.id;
    // Resolve ticket by id or ticket_number
    const existing = await prisma.it_tickets.findFirst({
      where: {
        OR: [{ id: targetId }, { ticket_number: targetId }],
      },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Ticket not found" });
    }

    const normStatus = status
      ? status.toLowerCase() === "open"
        ? "open"
        : status.toLowerCase() === "in progress" || status.toLowerCase() === "in_progress" || status.toLowerCase() === "assigned"
          ? "in_progress"
          : status.toLowerCase() === "waiting for user" || status.toLowerCase() === "waiting_for_employee"
            ? "waiting_for_employee"
            : status.toLowerCase() === "resolved"
              ? "resolved"
              : status.toLowerCase() === "closed"
                ? "closed"
                : undefined
      : undefined;

    const normPriority = priority
      ? priority.toLowerCase() === "critical"
        ? "critical"
        : priority.toLowerCase() === "high"
          ? "high"
          : priority.toLowerCase() === "low"
            ? "low"
            : "medium"
      : undefined;

    const normCat = category
      ? category.toLowerCase() === "hardware"
        ? "hardware"
        : category.toLowerCase() === "software" || category.toLowerCase() === "payroll system"
          ? "software"
          : category.toLowerCase() === "network" || category.toLowerCase() === "vpn"
            ? "network"
            : category.toLowerCase() === "email"
              ? "email"
              : category.toLowerCase()?.includes("access")
                ? "account_access"
                : "other"
      : undefined;

    const now = new Date();
    const updated = await prisma.it_tickets.update({
      where: { id: existing.id },
      data: {
        ...(normStatus && { status: normStatus as any }),
        ...(normPriority && { priority: normPriority as any }),
        ...(normCat && { category: normCat as any }),
        ...(normStatus === "resolved" && { resolved_at: now }),
        ...(normStatus === "closed" && { closed_at: now }),
        updated_at: now,
      },
    });

    res.json({ success: true, data: { id: updated.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update ticket" });
  }
});

// POST /api/helpdesk/:id/comments
router.post("/:id/comments", async (req, res) => {
  try {
    const { userId, comment, author } = req.body as { userId?: string; comment: string; author?: string };

    const targetId = req.params.id;
    const existing = await prisma.it_tickets.findFirst({
      where: {
        OR: [{ id: targetId }, { ticket_number: targetId }],
      },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Ticket not found" });
    }

    // Safely resolve commenter user
    let user = null;
    const identifier = userId || author;

    if (identifier) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
      if (isUuid) {
        user = await prisma.users.findUnique({ where: { id: identifier } });
      }
      if (!user) {
        user = await prisma.users.findFirst({
          where: {
            OR: [
              { email: identifier },
              { email: { contains: identifier, mode: "insensitive" } },
            ],
          },
        });
      }
      if (!user) {
        const emp = await resolveEmployee(identifier);
        if (emp) {
          user = await prisma.users.findFirst({
            where: {
              OR: [{ employee_id: emp.id }, { email: emp.email }],
            },
          });
        }
      }
    }

    if (!user) {
      user = await prisma.users.findFirst();
    }

    if (!user) {
      return res.status(400).json({ success: false, error: "No system user found to associate comment" });
    }

    const created = await prisma.it_ticket_comments.create({
      data: {
        ticket_id: existing.id,
        user_id: user.id,
        comment,
      },
      include: {
        users: { select: { email: true } },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: created.id,
        comment: created.comment,
        author: created.users?.email ? created.users.email.split("@")[0] : "Support",
        createdAt: created.created_at.toISOString(),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to add comment" });
  }
});

export default router;
