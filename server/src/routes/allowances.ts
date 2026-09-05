import { Router } from "express";
import { prisma } from "../lib/prisma";
import { resolveEmployee } from "../lib/resolve-employee";

const router = Router();

// GET /api/allowances
router.get("/", async (req, res) => {
  try {
    const { employeeId } = req.query as { employeeId?: string };
    let realEmpId = employeeId;
    if (employeeId) {
      const emp = await resolveEmployee(employeeId);
      if (emp) realEmpId = emp.id;
    }

    const items = await prisma.employee_allowances.findMany({
      where: realEmpId ? { employee_id: realEmpId } : undefined,
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
      type: (a.allowance_types.name || "House Rent Allowance") as any,
      allowanceType: a.allowance_types.name,
      allowanceCode: a.allowance_types.code,
      amount: Number(a.amount),
      frequency: a.frequency,
      status: (String(a.status).toLowerCase() === "active" || String(a.status).toLowerCase() === "approved" ? "approved" : String(a.status).toLowerCase() === "rejected" ? "rejected" : "pending") as any,
      effectiveDate: a.effective_from.toISOString().slice(0, 10),
      effectiveFrom: a.effective_from.toISOString().slice(0, 10),
      expiryDate: a.effective_to?.toISOString().slice(0, 10) ?? "2027-12-31",
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
    const { employeeId, allowanceTypeCode, allowanceType: altName, amount, frequency, effectiveFrom, effectiveTo, status } = req.body as {
      employeeId: string;
      allowanceTypeCode?: string;
      allowanceType?: string;
      amount: number;
      frequency?: string;
      effectiveFrom: string;
      effectiveTo?: string;
      status?: string;
    };

    const emp = await resolveEmployee(employeeId);
    if (!emp) return res.status(404).json({ success: false, error: "Employee not found" });

    const lookup = (allowanceTypeCode || altName || "").trim().toUpperCase();
    let allowanceType = await prisma.allowance_types.findFirst({
      where: {
        OR: [
          { code: { equals: lookup, mode: "insensitive" } },
          { name: { contains: lookup, mode: "insensitive" } },
        ],
      },
    });

    if (!allowanceType) {
      allowanceType = await prisma.allowance_types.findFirst();
    }
    if (!allowanceType) return res.status(400).json({ success: false, error: "No allowance type configured" });

    const initialStatus = status === "pending" ? "pending" : "active";

    const item = await prisma.employee_allowances.create({
      data: {
        employee_id: emp.id,
        allowance_type_id: allowanceType.id,
        amount: Number(amount),
        frequency: (frequency as any) ?? "monthly",
        effective_from: new Date(effectiveFrom || new Date().toISOString().slice(0, 10)),
        effective_to: effectiveTo ? new Date(effectiveTo) : null,
        status: initialStatus as any,
      },
      include: {
        employees: { select: { full_name: true } },
        allowance_types: { select: { name: true, code: true } },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: item.id,
        employeeId: item.employee_id,
        employeeName: item.employees.full_name,
        type: (item.allowance_types.name || "House Rent Allowance") as any,
        allowanceType: item.allowance_types.name,
        allowanceCode: item.allowance_types.code,
        amount: Number(item.amount),
        frequency: item.frequency,
        status: item.status === "active" ? "approved" : item.status === "inactive" ? "rejected" : "pending",
        effectiveDate: item.effective_from.toISOString().slice(0, 10),
        effectiveFrom: item.effective_from.toISOString().slice(0, 10),
        expiryDate: item.effective_to?.toISOString().slice(0, 10) ?? "2027-12-31",
        effectiveTo: item.effective_to?.toISOString().slice(0, 10) ?? null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create allowance" });
  }
});

// PATCH /api/allowances/:id
router.patch("/:id", async (req, res) => {
  try {
    const { status, amount } = req.body as { status?: string; amount?: number };
    let normStatus: string | undefined = undefined;
    if (status) {
      const s = status.toLowerCase();
      if (s === "approved" || s === "active") normStatus = "active";
      else if (s === "rejected" || s === "inactive") normStatus = "inactive";
      else if (s === "pending") normStatus = "pending";
    }

    const updated = await prisma.employee_allowances.update({
      where: { id: req.params.id },
      data: {
        ...(normStatus && { status: normStatus as any }),
        ...(amount !== undefined && { amount }),
      },
      include: {
        employees: { select: { full_name: true } },
        allowance_types: { select: { name: true, code: true } },
      },
    });

    res.json({
      success: true,
      data: {
        id: updated.id,
        employeeId: updated.employee_id,
        employeeName: updated.employees.full_name,
        type: (updated.allowance_types.name || "House Rent Allowance") as any,
        allowanceType: updated.allowance_types.name,
        allowanceCode: updated.allowance_types.code,
        amount: Number(updated.amount),
        frequency: updated.frequency,
        status: updated.status === "active" ? "approved" : updated.status === "inactive" ? "rejected" : "pending",
        effectiveDate: updated.effective_from.toISOString().slice(0, 10),
        effectiveFrom: updated.effective_from.toISOString().slice(0, 10),
        expiryDate: updated.effective_to?.toISOString().slice(0, 10) ?? "2027-12-31",
        effectiveTo: updated.effective_to?.toISOString().slice(0, 10) ?? null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update allowance" });
  }
});

export default router;
