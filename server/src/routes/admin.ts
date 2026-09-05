import { Router } from "express";
import crypto from "node:crypto";
import { prisma } from "../lib/prisma";

const router = Router();

// ── GET /api/users ─────────────────────────────────────────────────────────────
router.get("/users", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
    });

    const mapped = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role || "employee",
      active: true,
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch users" });
  }
});

// ── PATCH /api/users/:id ───────────────────────────────────────────────────────
router.patch("/users/:id", async (req, res) => {
  try {
    const { role } = req.body as { role?: string };
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { ...(role && { role }) },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update user" });
  }
});

// ── GET /api/audit ─────────────────────────────────────────────────────────────
router.get("/audit", async (_req, res) => {
  try {
    const logs = await prisma.audit_log.findMany({
      take: 100,
      orderBy: { changed_at: "desc" },
      include: {
        users: { select: { email: true } },
      },
    });

    const mapped = logs.map((l) => {
      const payload = (l.new_data as Record<string, unknown>) ?? {};
      const actor = (payload["actor"] as string) || l.users?.email || "System";
      const action = (payload["action"] as string) || `${l.action.toUpperCase()} on ${l.table_name}`;
      const module = (payload["module"] as string) || l.table_name;

      return {
        id: `L${String(l.id)}`,
        at: l.changed_at.toISOString().slice(0, 16).replace("T", " "),
        actor,
        action,
        module,
      };
    });

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch audit log" });
  }
});

// ── POST /api/audit ────────────────────────────────────────────────────────────
router.post("/audit", async (req, res) => {
  try {
    const { action, module, actor } = req.body as { action: string; module: string; actor?: string };

    const entry = await prisma.audit_log.create({
      data: {
        table_name: module || "System",
        record_id: crypto.randomUUID(),
        action: "insert",
        new_data: { action, module, actor: actor || "System" },
      },
    });

    res.status(201).json({ success: true, data: { id: `L${String(entry.id)}` } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create audit log" });
  }
});

export default router;
