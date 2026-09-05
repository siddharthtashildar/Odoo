import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/salary/structures
router.get("/structures", async (_req, res) => {
  try {
    const structures = await prisma.salary_structures.findMany({
      orderBy: { created_at: "desc" },
      include: {
        salary_structure_rules: {
          include: { salary_rules: true },
          orderBy: { sequence: "asc" },
        },
        departments: { select: { name: true } },
        designations: { select: { title: true } },
      },
    });

    const mapped = structures.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? "",
      status: s.status,
      effectiveDate: s.effective_date.toISOString().slice(0, 10),
      department: s.departments?.name ?? "All",
      designation: s.designations?.title ?? "",
      rules: s.salary_structure_rules.map((sr) => ({
        id: sr.id,
        sequence: sr.sequence,
        name: sr.salary_rules.name,
        code: sr.salary_rules.code,
        type: sr.salary_rules.rule_type,
        calculationType: sr.salary_rules.calculation_type,
        fixedAmount: Number(sr.salary_rules.fixed_amount ?? 0),
        percentage: Number(sr.salary_rules.percentage ?? 0),
      })),
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch salary structures" });
  }
});

// GET /api/salary/records
router.get("/records", async (_req, res) => {
  try {
    const assignments = await prisma.employee_salary_structures.findMany({
      where: { is_current: true },
      include: {
        employees: { select: { full_name: true, employee_code: true } },
        salary_structures: { select: { name: true } },
      },
    });

    const mapped = assignments.map((a) => ({
      id: a.id,
      employeeId: a.employee_id,
      employeeName: a.employees.full_name,
      employeeCode: a.employees.employee_code,
      structureId: a.structure_id,
      structureName: a.salary_structures.name,
      effectiveFrom: a.effective_from.toISOString().slice(0, 10),
      effectiveTo: a.effective_to?.toISOString().slice(0, 10) ?? null,
      isCurrent: a.is_current,
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch salary records" });
  }
});

// POST /api/salary/structures
router.post("/structures", async (req, res) => {
  try {
    const { name, description, status, effectiveDate } = req.body as {
      name: string;
      description?: string;
      status?: string;
      effectiveDate: string;
    };

    const structure = await prisma.salary_structures.create({
      data: {
        name,
        description: description ?? null,
        status: (status as any) ?? "draft",
        effective_date: new Date(effectiveDate),
      },
    });

    res.status(201).json({ success: true, data: { id: structure.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create salary structure" });
  }
});

// PATCH /api/salary/structures/:id
router.patch("/structures/:id", async (req, res) => {
  try {
    const { name, description, status } = req.body as Record<string, string>;
    const updated = await prisma.salary_structures.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(status && { status: status as any }),
        updated_at: new Date(),
      },
    });
    res.json({ success: true, data: { id: updated.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update salary structure" });
  }
});

// DELETE /api/salary/structures/:id
router.delete("/structures/:id", async (req, res) => {
  try {
    await prisma.salary_structures.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to delete salary structure" });
  }
});

export default router;
