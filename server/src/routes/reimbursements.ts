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
      category: r.reimbursement_categories.name as any,
      amount: Number(r.amount),
      approvedAmount: r.approved_amount ? Number(r.approved_amount) : null,
      submittedDate: r.expense_date.toISOString().slice(0, 10),
      expenseDate: r.expense_date.toISOString().slice(0, 10),
      receiptStatus: "Uploaded" as const,
      approvalStatus: (String(r.status).toLowerCase() === "approved" ? "approved" : String(r.status).toLowerCase() === "rejected" ? "rejected" : "pending") as any,
      status: r.status,
      paymentStatus: (String(r.status).toLowerCase() === "approved" || String(r.status).toLowerCase() === "paid" ? "paid" : "unpaid") as any,
      paymentMethod: "Bank Transfer" as const,
      description: r.description ?? "",
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
      include: {
        employees: { select: { full_name: true } },
        reimbursement_categories: { select: { name: true } },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: item.id,
        employeeId: item.employee_id,
        employeeName: item.employees.full_name,
        category: item.reimbursement_categories.name as any,
        amount: Number(item.amount),
        approvedAmount: null,
        submittedDate: item.expense_date.toISOString().slice(0, 10),
        expenseDate: item.expense_date.toISOString().slice(0, 10),
        receiptStatus: "Uploaded" as const,
        approvalStatus: "pending" as const,
        status: "submitted",
        paymentStatus: "unpaid" as const,
        paymentMethod: "Bank Transfer" as const,
        description: item.description ?? "",
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create reimbursement" });
  }
});

// PATCH /api/reimbursements/:id
router.patch("/:id", async (req, res) => {
  try {
    const { status, approvalStatus, managerNote, financeNote, approvedAmount } = req.body as {
      status?: string;
      approvalStatus?: string;
      managerNote?: string;
      financeNote?: string;
      approvedAmount?: number;
    };

    let normStatus: string | undefined = undefined;
    const rawStatus = (approvalStatus || status || "").toLowerCase();
    if (rawStatus === "approved" || rawStatus === "manager_approved") normStatus = "manager_approved";
    else if (rawStatus === "rejected") normStatus = "rejected";
    else if (rawStatus === "paid") normStatus = "paid";
    else if (rawStatus === "pending" || rawStatus === "submitted") normStatus = "submitted";

    const updated = await prisma.reimbursements.update({
      where: { id: req.params.id },
      data: {
        ...(normStatus && { status: normStatus as any }),
        ...(managerNote !== undefined && { manager_note: managerNote }),
        ...(financeNote !== undefined && { finance_note: financeNote }),
        ...(approvedAmount !== undefined && { approved_amount: approvedAmount }),
        updated_at: new Date(),
      },
      include: {
        employees: { select: { full_name: true } },
        reimbursement_categories: { select: { name: true } },
      },
    });

    const isApproved = updated.status === "manager_approved" || updated.status === "finance_approved" || updated.status === "paid";
    const mappedApproval = isApproved ? "approved" : updated.status === "rejected" ? "rejected" : "pending";

    res.json({
      success: true,
      data: {
        id: updated.id,
        employeeId: updated.employee_id,
        employeeName: updated.employees.full_name,
        category: updated.reimbursement_categories.name as any,
        amount: Number(updated.amount),
        approvedAmount: updated.approved_amount ? Number(updated.approved_amount) : null,
        submittedDate: updated.expense_date.toISOString().slice(0, 10),
        expenseDate: updated.expense_date.toISOString().slice(0, 10),
        receiptStatus: "Uploaded" as const,
        approvalStatus: mappedApproval as any,
        status: updated.status,
        paymentStatus: updated.status === "paid" ? "paid" : "unpaid",
        paymentMethod: "Bank Transfer" as const,
        description: updated.description ?? "",
        managerNote: updated.manager_note ?? "",
        financeNote: updated.finance_note ?? "",
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update reimbursement" });
  }
});

export default router;
