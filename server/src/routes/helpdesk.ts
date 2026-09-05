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
        employees: { select: { full_name: true } },
        it_ticket_comments: {
          orderBy: { created_at: "asc" },
          include: { users: { select: { email: true } } },
        },
      },
    });

    const mapped = tickets.map((t) => ({
      id: t.id,
      ticketNumber: t.ticket_number,
      employeeId: t.employee_id,
      employeeName: t.employees.full_name,
      category: t.category,
      priority: t.priority,
      subject: t.subject,
      description: t.description ?? "",
      status: t.status,
      linkedAssetId: t.linked_asset_id ?? null,
      createdAt: t.created_at.toISOString(),
      resolvedAt: t.resolved_at?.toISOString() ?? null,
      comments: t.it_ticket_comments.map((c) => ({
        id: c.id,
        author: c.users.email,
        comment: c.comment,
        createdAt: c.created_at.toISOString(),
      })),
    }));

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

    const count = await prisma.it_tickets.count();
    const ticketNumber = `TKT-${String(count + 1).padStart(4, "0")}`;

    const ticket = await prisma.it_tickets.create({
      data: {
        ticket_number: ticketNumber,
        employee_id: emp.id,
        category: (category as any) || "other",
        priority: (priority as any) ?? "medium",
        subject,
        description: description ?? null,
        status: "open",
      },
    });

    res.status(201).json({ success: true, data: { id: ticket.id, ticketNumber: ticket.ticket_number } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create ticket" });
  }
});

// PATCH /api/helpdesk/:id
router.patch("/:id", async (req, res) => {
  try {
    const { status, priority } = req.body as { status?: string; priority?: string };
    const now = new Date();
    const updated = await prisma.it_tickets.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status: status as any }),
        ...(priority && { priority: priority as any }),
        ...(status === "resolved" && { resolved_at: now }),
        ...(status === "closed" && { closed_at: now }),
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
    const { userId, comment } = req.body as { userId: string; comment: string };
    const created = await prisma.it_ticket_comments.create({
      data: { ticket_id: req.params.id, user_id: userId, comment },
    });
    res.status(201).json({ success: true, data: { id: created.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to add comment" });
  }
});

export default router;
