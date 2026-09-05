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
    const { employeeId, contractType, salary, startDate, endDate } = req.body as {
      employeeId: string;
      contractType: string;
      salary: number;
      startDate: string;
      endDate?: string;
    };

    const emp = await resolveEmployee(employeeId);
    if (!emp) return res.status(404).json({ success: false, error: "Employee not found" });

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
        start_date: new Date(startDate || new Date().toISOString().slice(0, 10)),
        end_date: endDate ? new Date(endDate) : null,
        status: "active",
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
    const { status } = req.body as { status: string };
    const updated = await prisma.contracts.update({
      where: { id: req.params.id },
      data: { status: status as any, updated_at: new Date() },
    });
    res.json({ success: true, data: { id: updated.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update contract" });
  }
});

export default router;
