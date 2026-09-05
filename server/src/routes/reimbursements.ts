import { Router } from "express";
import { prisma } from "../lib/prisma";
import { resolveEmployee } from "../lib/resolve-employee";
import { sendReimbursementStatusEmail } from "../lib/email";

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

    const mapped = items.map((r) => {
      const st = String(r.status).toLowerCase();
      const isApproved = st === "approved" || st === "manager_approved" || st === "finance_approved" || st === "paid";
      const isRejected = st === "rejected";
      const approvalStatus = isApproved ? "approved" : isRejected ? "rejected" : "pending";
      const paymentStatus = st === "paid" ? "paid" : "unpaid";

      return {
        id: r.id,
        employeeId: r.employee_id,
        employeeName: r.employees?.full_name ?? "Employee",
        category: r.reimbursement_categories?.name as any,
        amount: Number(r.amount),
        approvedAmount: r.approved_amount ? Number(r.approved_amount) : null,
        submittedDate: r.expense_date.toISOString().slice(0, 10),
        expenseDate: r.expense_date.toISOString().slice(0, 10),
        receiptStatus: r.receipt_url ? ("Uploaded" as const) : ("Missing" as const),
        receiptUrl: r.receipt_url ?? null,
        receiptFileName: r.receipt_url ?? null,
        approvalStatus: approvalStatus as any,
        status: r.status,
        paymentStatus: paymentStatus as any,
        paymentMethod: "Bank Transfer" as const,
        description: r.description ?? "",
        managerNote: r.manager_note ?? "",
        financeNote: r.finance_note ?? "",
        createdAt: r.created_at.toISOString(),
      };
    });

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch reimbursements" });
  }
});

// POST /api/reimbursements
router.post("/", async (req, res) => {
  try {
    const { employeeId, categoryName, expenseDate, amount, description, receiptUrl, receiptFileName } = req.body as {
      employeeId: string;
      categoryName: string;
      expenseDate: string;
      amount: number;
      description?: string;
      receiptUrl?: string;
      receiptFileName?: string;
    };

    const emp = await resolveEmployee(employeeId);
    if (!emp) return res.status(404).json({ success: false, error: "Employee not found" });

    let category = await prisma.reimbursement_categories.findUnique({ where: { name: categoryName } });
    if (!category) {
      category = await prisma.reimbursement_categories.create({ data: { name: categoryName } });
    }

    const savedUrl = receiptUrl || receiptFileName || null;
    const item = await prisma.reimbursements.create({
      data: {
        employee_id: emp.id,
        category_id: category.id,
        expense_date: new Date(expenseDate || new Date().toISOString().slice(0, 10)),
        amount: Number(amount),
        description: description ?? null,
        receipt_url: savedUrl,
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
        employeeName: item.employees?.full_name ?? "Employee",
        category: item.reimbursement_categories?.name as any,
        amount: Number(item.amount),
        approvedAmount: null,
        submittedDate: item.expense_date.toISOString().slice(0, 10),
        expenseDate: item.expense_date.toISOString().slice(0, 10),
        receiptStatus: item.receipt_url ? ("Uploaded" as const) : ("Missing" as const),
        receiptUrl: item.receipt_url ?? null,
        receiptFileName: item.receipt_url ?? null,
        approvalStatus: "pending" as const,
        status: item.status,
        paymentStatus: "unpaid" as const,
        paymentMethod: "Bank Transfer" as const,
        description: item.description ?? "",
        createdAt: item.created_at.toISOString(),
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
    const { status, approvalStatus, paymentStatus, managerNote, financeNote, approvedAmount } = req.body as {
      status?: string;
      approvalStatus?: string;
      paymentStatus?: string;
      managerNote?: string;
      financeNote?: string;
      approvedAmount?: number;
    };

    let normStatus: string | undefined = undefined;
    const rawStatus = (approvalStatus || status || "").toLowerCase();
    const rawPayment = (paymentStatus || "").toLowerCase();

    if (rawPayment === "paid" || rawStatus === "paid") {
      normStatus = "paid";
    } else if (rawStatus === "approved" || rawStatus === "manager_approved") {
      normStatus = "manager_approved";
    } else if (rawStatus === "rejected") {
      normStatus = "rejected";
    } else if (rawStatus === "pending" || rawStatus === "submitted") {
      normStatus = "submitted";
    }

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
        employees: { select: { full_name: true, email: true } },
        reimbursement_categories: { select: { name: true } },
      },
    });

    const st = String(updated.status).toLowerCase();
    const isApproved = st === "approved" || st === "manager_approved" || st === "finance_approved" || st === "paid";
    const isRejected = st === "rejected";

    if (updated.employees?.email && (isApproved || isRejected)) {
      try {
        const mailStatus: "approved" | "rejected" | "paid" = st === "paid" ? "paid" : isApproved ? "approved" : "rejected";
        await sendReimbursementStatusEmail({
          to: updated.employees.email,
          employeeName: updated.employees.full_name,
          category: updated.reimbursement_categories?.name ?? "General Expense",
          amount: Number(updated.amount),
          approvedAmount: updated.approved_amount ? Number(updated.approved_amount) : null,
          status: mailStatus,
          note: updated.manager_note || updated.finance_note || undefined,
        });
      } catch (mailErr) {
        console.warn("Failed to dispatch reimbursement status email:", mailErr);
      }
    }

    res.json({
      success: true,
      data: {
        id: updated.id,
        employeeId: updated.employee_id,
        employeeName: updated.employees?.full_name ?? "Employee",
        category: updated.reimbursement_categories?.name as any,
        amount: Number(updated.amount),
        approvedAmount: updated.approved_amount ? Number(updated.approved_amount) : null,
        submittedDate: updated.expense_date.toISOString().slice(0, 10),
        expenseDate: updated.expense_date.toISOString().slice(0, 10),
        receiptStatus: "Uploaded" as const,
        approvalStatus: (isApproved ? "approved" : isRejected ? "rejected" : "pending") as any,
        status: updated.status,
        paymentStatus: st === "paid" ? "paid" : "unpaid",
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
