import { Router } from "express";
import { prisma } from "../lib/prisma";
import { resolveEmployee } from "../lib/resolve-employee";

const router = Router();

// GET /api/reimbursements
router.get("/", async (req, res) => {
  try {
    const { employeeId } = req.query as { employeeId?: string };
    let realEmpId = employeeId;
    if (employeeId) {
      const emp = await resolveEmployee(employeeId);
      if (emp) realEmpId = emp.id;
    }

    const items = await prisma.reimbursements.findMany({
      where: realEmpId ? { employee_id: realEmpId } : undefined,
      orderBy: { created_at: "desc" },
      include: {
        employees: { select: { full_name: true } },
        reimbursement_categories: { select: { name: true } },
      },
    });

    const mapped = items.map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      employeeName: r.employees.full_name,
      category: r.reimbursement_categories.name,
      expenseDate: r.expense_date.toISOString().slice(0, 10),
      amount: Number(r.amount),
      approvedAmount: r.approved_amount ? Number(r.approved_amount) : null,
      description: r.description ?? "",
      status: r.status,
      managerNote: r.manager_note ?? "",
      financeNote: r.finance_note ?? "",
      createdAt: r.created_at.toISOString(),
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch reimbursements" });
  }
});

// POST /api/reimbursements
router.post("/", async (req, res) => {
  try {
    const { employeeId, categoryName, expenseDate, amount, description } = req.body as {
      employeeId: string;
      categoryName: string;
      expenseDate: string;
      amount: number;
      description?: string;
    };

    const emp = await resolveEmployee(employeeId);
    if (!emp) return res.status(404).json({ success: false, error: "Employee not found" });

    let category = await prisma.reimbursement_categories.findUnique({ where: { name: categoryName } });
    if (!category) {
      category = await prisma.reimbursement_categories.create({ data: { name: categoryName } });
    }

    const item = await prisma.reimbursements.create({
      data: {
        employee_id: emp.id,
        category_id: category.id,
        expense_date: new Date(expenseDate || new Date().toISOString().slice(0, 10)),
        amount: Number(amount),
        description: description ?? null,
        status: "submitted",
      },
    });

    res.status(201).json({ success: true, data: { id: item.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create reimbursement" });
  }
});

// PATCH /api/reimbursements/:id
router.patch("/:id", async (req, res) => {
  try {
    const { status, managerNote, financeNote, approvedAmount } = req.body as {
      status?: string;
      managerNote?: string;
      financeNote?: string;
      approvedAmount?: number;
    };

    const updated = await prisma.reimbursements.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status: status as any }),
        ...(managerNote !== undefined && { manager_note: managerNote }),
        ...(financeNote !== undefined && { finance_note: financeNote }),
        ...(approvedAmount !== undefined && { approved_amount: approvedAmount }),
        updated_at: new Date(),
      },
    });

    res.json({ success: true, data: { id: updated.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update reimbursement" });
  }
});

export default router;
