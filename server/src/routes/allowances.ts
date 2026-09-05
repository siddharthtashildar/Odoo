import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/allowances
router.get("/", async (req, res) => {
  try {
    const { employeeId } = req.query as { employeeId?: string };
    const items = await prisma.employee_allowances.findMany({
      where: employeeId ? { employee_id: employeeId } : undefined,
      orderBy: { created_at: "desc" },
      include: {
        employees: { select: { full_name: true } },
        allowance_types: { select: { name: true, code: true } },
      },
    });

    const mapped = items.map((a) => ({
      id: a.id,
      employeeId: a.employee_id,
      employeeName: a.employees.full_name,
      allowanceType: a.allowance_types.name,
      allowanceCode: a.allowance_types.code,
      amount: Number(a.amount),
      frequency: a.frequency,
      status: a.status,
      effectiveFrom: a.effective_from.toISOString().slice(0, 10),
      effectiveTo: a.effective_to?.toISOString().slice(0, 10) ?? null,
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch allowances" });
  }
});

// POST /api/allowances
router.post("/", async (req, res) => {
  try {
    const { employeeId, allowanceTypeCode, amount, frequency, effectiveFrom, effectiveTo } = req.body as {
      employeeId: string;
      allowanceTypeCode: string;
      amount: number;
      frequency?: string;
      effectiveFrom: string;
      effectiveTo?: string;
    };

    const allowanceType = await prisma.allowance_types.findUnique({ where: { code: allowanceTypeCode } });
    if (!allowanceType) return res.status(400).json({ success: false, error: "Invalid allowance type" });

    const item = await prisma.employee_allowances.create({
      data: {
        employee_id: employeeId,
        allowance_type_id: allowanceType.id,
        amount,
        frequency: (frequency as any) ?? "monthly",
        effective_from: new Date(effectiveFrom),
        effective_to: effectiveTo ? new Date(effectiveTo) : null,
        status: "active",
      },
    });

    res.status(201).json({ success: true, data: { id: item.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create allowance" });
  }
});

// PATCH /api/allowances/:id
router.patch("/:id", async (req, res) => {
  try {
    const { status, amount } = req.body as { status?: string; amount?: number };
    const updated = await prisma.employee_allowances.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status: status as any }),
        ...(amount !== undefined && { amount }),
      },
    });
    res.json({ success: true, data: { id: updated.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update allowance" });
  }
});

export default router;
