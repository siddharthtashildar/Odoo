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
        employee_salary_structures: { where: { is_current: true } },
      },
    });

    const mapped = structures.map((s) => ({
      id: s.id,
      code: s.code || `STR-${s.name.toUpperCase().replace(/\s+/g, "_")}`,
      name: s.name,
      description: s.description ?? "",
      status: s.status,
      effectiveDate: s.effective_date.toISOString().slice(0, 10),
      department: s.departments?.name ?? "All",
      designation: s.designations?.title ?? "",
      totalRules: s.salary_structure_rules.length,
      totalEmployees: s.employee_salary_structures.length,
      rules: s.salary_structure_rules.map((sr) => ({
        id: sr.id,
        ruleId: sr.salary_rules.id,
        sequence: sr.sequence,
        name: sr.salary_rules.name,
        code: sr.salary_rules.code,
        category: sr.salary_rules.category || "ALLOWANCE",
        type: sr.salary_rules.rule_type,
        calculationType: sr.salary_rules.calculation_type,
        fixedAmount: Number(sr.salary_rules.fixed_amount ?? 0),
        percentage: Number(sr.salary_rules.percentage ?? 0),
        formula: sr.salary_rules.formula ?? "",
        appearsOnPayslip: sr.salary_rules.appears_on_payslip ?? true,
      })),
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch salary structures" });
  }
});

// GET /api/salary/rules — list all salary rules
router.get("/rules", async (_req, res) => {
  try {
    const rules = await prisma.salary_rules.findMany({
      orderBy: [{ priority: "asc" }, { code: "asc" }],
      include: {
        salary_structure_rules: {
          select: { structure_id: true },
        },
      },
    });

    const mapped = rules.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      category: r.category || "ALLOWANCE",
      ruleType: r.rule_type,
      calculationType: r.calculation_type,
      fixedAmount: Number(r.fixed_amount ?? 0),
      percentage: Number(r.percentage ?? 0),
      formula: r.formula ?? "",
      sequence: r.priority,
      appearsOnPayslip: r.appears_on_payslip ?? true,
      active: r.is_active,
      usedInStructuresCount: r.salary_structure_rules.length,
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch salary rules" });
  }
});

// POST /api/salary/rules — create salary rule
router.post("/rules", async (req, res) => {
  try {
    const { code, name, category, ruleType, calculationType, fixedAmount, percentage, formula, sequence, appearsOnPayslip } = req.body as {
      code: string;
      name: string;
      category: string;
      ruleType?: string;
      calculationType: string;
      fixedAmount?: number;
      percentage?: number;
      formula?: string;
      sequence?: number;
      appearsOnPayslip?: boolean;
    };

    const rule = await prisma.salary_rules.create({
      data: {
        code: code.toUpperCase(),
        name,
        category: category.toUpperCase(),
        rule_type: (ruleType as any) ?? "earning",
        calculation_type: (calculationType as any) ?? "fixed",
        fixed_amount: fixedAmount !== undefined ? fixedAmount : null,
        percentage: percentage !== undefined ? percentage : null,
        formula: formula || null,
        priority: sequence || 10,
        appears_on_payslip: appearsOnPayslip ?? true,
        is_active: true,
      },
    });

    res.status(201).json({ success: true, data: { id: rule.id, code: rule.code } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create salary rule" });
  }
});

// PATCH /api/salary/rules/:id — update salary rule
router.patch("/rules/:id", async (req, res) => {
  try {
    const { name, category, ruleType, calculationType, fixedAmount, percentage, formula, sequence, appearsOnPayslip, active } = req.body as Record<string, any>;
    const updated = await prisma.salary_rules.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(category && { category: category.toUpperCase() }),
        ...(ruleType && { rule_type: ruleType }),
        ...(calculationType && { calculation_type: calculationType }),
        ...(fixedAmount !== undefined && { fixed_amount: fixedAmount }),
        ...(percentage !== undefined && { percentage: percentage }),
        ...(formula !== undefined && { formula }),
        ...(sequence !== undefined && { priority: sequence }),
        ...(appearsOnPayslip !== undefined && { appears_on_payslip: appearsOnPayslip }),
        ...(active !== undefined && { is_active: active }),
        updated_at: new Date(),
      },
    });

    res.json({ success: true, data: { id: updated.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update salary rule" });
  }
});

// DELETE /api/salary/rules/:id — delete salary rule
router.delete("/rules/:id", async (req, res) => {
  try {
    await prisma.salary_structure_rules.deleteMany({ where: { rule_id: req.params.id } });
    await prisma.salary_rules.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to delete salary rule" });
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
    const { name, code, description, status, effectiveDate, ruleIds } = req.body as {
      name: string;
      code?: string;
      description?: string;
      status?: string;
      effectiveDate: string;
      ruleIds?: string[];
    };

    const structure = await prisma.salary_structures.create({
      data: {
        name,
        code: code || `STR-${name.toUpperCase().replace(/\s+/g, "_")}`,
        description: description ?? null,
        status: (status as any) ?? "draft",
        effective_date: new Date(effectiveDate),
      },
    });

    if (ruleIds && ruleIds.length > 0) {
      await prisma.salary_structure_rules.createMany({
        data: ruleIds.map((ruleId, idx) => ({
          structure_id: structure.id,
          rule_id: ruleId,
          sequence: (idx + 1) * 10,
        })),
      });
    }

    res.status(201).json({ success: true, data: { id: structure.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create salary structure" });
  }
});

// PATCH /api/salary/structures/:id
router.patch("/structures/:id", async (req, res) => {
  try {
    const { name, code, description, status, ruleIds } = req.body as Record<string, any>;
    const updated = await prisma.salary_structures.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(code && { code }),
        ...(description !== undefined && { description }),
        ...(status && { status: status as any }),
        updated_at: new Date(),
      },
    });

    if (ruleIds && Array.isArray(ruleIds)) {
      await prisma.salary_structure_rules.deleteMany({ where: { structure_id: req.params.id } });
      await prisma.salary_structure_rules.createMany({
        data: ruleIds.map((ruleId: string, idx: number) => ({
          structure_id: req.params.id,
          rule_id: ruleId,
          sequence: (idx + 1) * 10,
        })),
      });
    }

    res.json({ success: true, data: { id: updated.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update salary structure" });
  }
});

// DELETE /api/salary/structures/:id
router.delete("/structures/:id", async (req, res) => {
  try {
    await prisma.salary_structure_rules.deleteMany({ where: { structure_id: req.params.id } });
    await prisma.employee_salary_structures.deleteMany({ where: { structure_id: req.params.id } });
    await prisma.salary_structures.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to delete salary structure" });
  }
});

export default router;
