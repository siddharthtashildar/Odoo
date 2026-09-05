import { Router } from "express";
import { prisma } from "../lib/prisma";
import { resolveEmployee } from "../lib/resolve-employee";

const router = Router();

// GET /api/contracts
router.get("/", async (_req, res) => {
  try {
    const contracts = await prisma.contracts.findMany({
      orderBy: { created_at: "desc" },
      include: {
        employees: { select: { full_name: true, employee_code: true } },
        departments: { select: { name: true } },
        designations: { select: { title: true } },
      },
    });

    const mapped = contracts.map((c) => {
      const typeMap: Record<string, any> = {
        permanent: "Full-time",
        fixed_term: "Fixed-term",
        intern: "Internship",
        consultant: "Consultancy",
      };
      return {
        id: c.id,
        contractNumber: c.contract_number,
        employeeId: c.employee_id,
        employeeName: c.employees.full_name,
        employeeCode: c.employees.employee_code,
        contractType: typeMap[c.contract_type] ?? "Full-time",
        department: c.departments?.name ?? "Engineering",
        designation: c.designations?.title ?? "Staff",
        salary: Number(c.salary),
        startDate: c.start_date.toISOString().slice(0, 10),
        endDate: c.end_date?.toISOString().slice(0, 10) ?? "2027-12-31",
        status: (c.status === "active" ? "Active" : c.status === "draft" ? "Draft" : "Expired") as any,
        employeeAccepted: c.employee_accepted,
        terms: "Standard enterprise employment terms and conditions.",
        noticePeriodDays: 30,
      };
    });

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch contracts" });
  }
});

// POST /api/contracts
router.post("/", async (req, res) => {
  try {
    const { employeeId, contractType, salary, startDate, endDate, status } = req.body as {
      employeeId: string;
      contractType: string;
      salary: number;
      startDate: string;
      endDate?: string;
      status?: string;
    };

    const emp = await resolveEmployee(employeeId);
    if (!emp) return res.status(404).json({ success: false, error: "Employee not found" });
    const effectiveStart = new Date(startDate || new Date().toISOString().slice(0, 10));
    const effectiveEnd = endDate ? new Date(endDate) : null;
    if (effectiveEnd && effectiveEnd < effectiveStart) return res.status(400).json({ success: false, error: "End date must be after start date" });
    if ((status ?? "draft") === "active") {
      const overlap = await prisma.contracts.findFirst({ where: { employee_id: emp.id, start_date: { lte: effectiveEnd ?? new Date("2999-12-31") }, OR: [{ end_date: null }, { end_date: { gte: effectiveStart } }], status: "active" } });
      if (overlap) return res.status(409).json({ success: false, error: "An overlapping active contract already exists" });
    }

    const count = await prisma.contracts.count();
    const contractNumber = `CT-${String(count + 1).padStart(4, "0")}`;
    const normContractType =
      contractType === "intern" ? "intern" :
      contractType === "consultant" ? "consultant" :
      contractType === "fixed_term" || contractType === "contract" ? "fixed_term" :
      contractType === "probation" ? "probation" : "permanent";

    const contract = await prisma.contracts.create({
      data: {
        contract_number: contractNumber,
        employee_id: emp.id,
        department_id: emp.department_id,
        designation_id: emp.designation_id,
        contract_type: normContractType as any,
        salary: Number(salary),
        start_date: effectiveStart,
        end_date: effectiveEnd,
        status: (status ?? "draft") as any,
      },
    });

    res.status(201).json({ success: true, data: { id: contract.id, contractNumber: contract.contract_number } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create contract" });
  }
});

// PATCH /api/contracts/:id
router.patch("/:id", async (req, res) => {
  try {
    const { status, startDate, endDate, salary, contractType, terms } = req.body as {
      status?: string;
      startDate?: string;
      endDate?: string;
      salary?: number;
      contractType?: string;
      terms?: string;
    };

    const updateData: any = { updated_at: new Date() };
    if (status) updateData.status = status;
    if (startDate) updateData.start_date = new Date(startDate);
    if (endDate) updateData.end_date = new Date(endDate);
    if (salary) updateData.salary = Number(salary);
    if (contractType) {
      const normType =
        contractType === "intern" ? "intern" :
        contractType === "consultant" ? "consultant" :
        contractType === "fixed_term" || contractType === "contract" ? "fixed_term" :
        contractType === "probation" ? "probation" :
        contractType === "Fixed-term" ? "fixed_term" :
        contractType === "Internship" ? "intern" :
        contractType === "Consultancy" ? "consultant" : "permanent";
      updateData.contract_type = normType;
    }
    if (terms) updateData.working_hours_per_week = terms; // Note: storing in working_hours_per_week as placeholder

    const updated = await prisma.contracts.update({
      where: { id: req.params.id },
      data: updateData,
    });
    res.json({ success: true, data: { id: updated.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update contract" });
  }
});

export default router;
