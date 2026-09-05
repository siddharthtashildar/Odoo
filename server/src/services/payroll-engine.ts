import { prisma } from "../lib/prisma";

export interface RuleComputeContext {
  contractSalary: number;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  overtimeHours: number;
  rules: Record<string, number>;
  categories: Record<string, number>;
}

export interface ComputedRuleLine {
  ruleId?: string;
  code: string;
  name: string;
  category: string;
  sequence: number;
  amount: number;
  appearsOnPayslip: boolean;
}

export interface PayrunValidationWarning {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  type: "MISSING_BANK_DETAILS" | "MISSING_SALARY_STRUCTURE" | "MISSING_CONTRACT" | "DUPLICATE_PAYSLIP" | "EXPIRED_CONTRACT" | "NEGATIVE_NET_SALARY";
  message: string;
}

/**
 * Evaluates a rule formula expression safely against context values
 */
export function evaluateFormula(formulaStr: string, ctx: RuleComputeContext): number {
  try {
    const expr = formulaStr
      .replace(/contract\.salary/g, String(ctx.contractSalary))
      .replace(/working_days/g, String(ctx.workingDays))
      .replace(/present_days/g, String(ctx.presentDays))
      .replace(/absent_days/g, String(ctx.absentDays))
      .replace(/leave_days/g, String(ctx.leaveDays))
      .replace(/overtime_hours/g, String(ctx.overtimeHours));

    // Replace rule references like rules.BASIC or BASIC
    let replacedExpr = expr;
    for (const [code, val] of Object.entries(ctx.rules)) {
      const regex = new RegExp(`\\b${code}\\b`, "g");
      replacedExpr = replacedExpr.replace(regex, String(val));
    }
    for (const [cat, val] of Object.entries(ctx.categories)) {
      const regex = new RegExp(`\\bcategories\\.${cat}\\b`, "g");
      replacedExpr = replacedExpr.replace(regex, String(val));
    }

    // Sanitize non-math characters before evaluation
    const safeMathExpr = replacedExpr.replace(/[^0-9+\-*/().\s]/g, "");
    if (!safeMathExpr.trim()) return 0;

    const fn = new Function(`return (${safeMathExpr});`);
    const result = Number(fn());
    return isNaN(result) ? 0 : Math.round(result);
  } catch (err) {
    console.warn(`Formula evaluation fallback for "${formulaStr}":`, err);
    return 0;
  }
}

/**
 * Computes sequential rule-by-rule breakdown for a single employee
 */
export async function computeEmployeePayslip(
  employeeId: string,
  periodMonth: number,
  periodYear: number,
  overrideStructureId?: string,
) {
  const emp = await prisma.employees.findUnique({
    where: { id: employeeId },
    include: {
      contracts: { where: { status: "active" }, orderBy: { created_at: "desc" }, take: 1 },
      employee_salary_structures: { where: { is_current: true }, take: 1 },
    },
  });

  if (!emp) throw new Error("Employee not found");

  const contract = emp.contracts[0];
  const annualCtc = Number(contract?.salary || 600000);
  const monthlyGross = Math.round(annualCtc / 12);

  // 1. Fetch Attendance & Leave summary for period
  const startDate = new Date(Date.UTC(periodYear, periodMonth - 1, 1));
  const endDate = new Date(Date.UTC(periodYear, periodMonth, 0));

  const totalDaysInMonth = endDate.getDate();
  const workingDays = Math.max(1, totalDaysInMonth - 8); // ~22 days

  const attendanceLogs = await prisma.attendance.findMany({
    where: {
      employee_id: emp.id,
      attendance_date: { gte: startDate, lte: endDate },
    },
  });

  const presentDays = attendanceLogs.filter((a) => a.status === "present" || a.status === "work_from_home").length || workingDays;
  const absentDays = attendanceLogs.filter((a) => a.status === "absent").length;
  const leaveDays = attendanceLogs.filter((a) => a.status === "on_leave").length;
  const overtimeHours = attendanceLogs.reduce((acc, a) => acc + Number(a.overtime_hours || 0), 0);

  // 2. Resolve Structure & Rules
  const structureId = overrideStructureId || emp.employee_salary_structures[0]?.structure_id || contract?.salary_structure_id;

  let rules: Array<{
    id: string;
    code: string;
    name: string;
    category: string | null;
    calculation_type: string;
    fixed_amount: any;
    percentage: any;
    formula: string | null;
    sequence: number;
    appears_on_payslip: boolean | null;
  }> = [];

  if (structureId) {
    const structRules = await prisma.salary_structure_rules.findMany({
      where: { structure_id: structureId },
      include: { salary_rules: true },
      orderBy: { sequence: "asc" },
    });
    rules = structRules.map((sr) => ({
      id: sr.salary_rules.id,
      code: sr.salary_rules.code,
      name: sr.salary_rules.name,
      category: sr.salary_rules.category || "ALLOWANCE",
      calculation_type: sr.salary_rules.calculation_type,
      fixed_amount: sr.salary_rules.fixed_amount,
      percentage: sr.salary_rules.percentage,
      formula: sr.salary_rules.formula,
      sequence: sr.sequence || sr.salary_rules.priority || 10,
      appears_on_payslip: sr.salary_rules.appears_on_payslip,
    }));
  }

  // Fallback default rules if no structure is assigned
  if (rules.length === 0) {
    rules = [
      { id: "r-basic", code: "BASIC", name: "Basic Salary", category: "BASIC", calculation_type: "formula", fixed_amount: null, percentage: null, formula: "contract.salary / 12 * 0.5", sequence: 10, appears_on_payslip: true },
      { id: "r-hra", code: "HRA", name: "House Rent Allowance", category: "ALLOWANCE", calculation_type: "formula", fixed_amount: null, percentage: null, formula: "BASIC * 0.4", sequence: 20, appears_on_payslip: true },
      { id: "r-spl", code: "SPECIAL", name: "Special Allowance", category: "ALLOWANCE", calculation_type: "fixed", fixed_amount: Math.round(monthlyGross * 0.3), percentage: null, formula: null, sequence: 30, appears_on_payslip: true },
      { id: "r-pf", code: "PF", name: "Provident Fund (PF)", category: "DEDUCTION", calculation_type: "formula", fixed_amount: null, percentage: null, formula: "BASIC * 0.12 > 1800 ? 1800 : BASIC * 0.12", sequence: 40, appears_on_payslip: true },
      { id: "r-pt", code: "PT", name: "Professional Tax (PT)", category: "DEDUCTION", calculation_type: "fixed", fixed_amount: 200, percentage: null, formula: null, sequence: 50, appears_on_payslip: true },
      { id: "r-tds", code: "TDS", name: "Income Tax (TDS)", category: "TAX", calculation_type: "fixed", fixed_amount: monthlyGross > 50000 ? Math.round(monthlyGross * 0.05) : 0, percentage: null, formula: null, sequence: 60, appears_on_payslip: true },
    ];
  }

  // 3. Compute Rules in Sequence Order
  const ctx: RuleComputeContext = {
    contractSalary: annualCtc,
    workingDays,
    presentDays,
    absentDays,
    leaveDays,
    overtimeHours,
    rules: {},
    categories: { BASIC: 0, ALLOWANCE: 0, BONUS: 0, GROSS: 0, DEDUCTION: 0, TAX: 0, NET: 0 },
  };

  const computedLines: ComputedRuleLine[] = [];

  for (const rule of rules) {
    let amount = 0;

    if (rule.calculation_type === "fixed") {
      amount = Math.round(Number(rule.fixed_amount || 0));
    } else if (rule.calculation_type === "percentage") {
      const pct = Number(rule.percentage || 0);
      const base = ctx.rules["BASIC"] || monthlyGross;
      amount = Math.round((base * pct) / 100);
    } else if (rule.calculation_type === "formula" && rule.formula) {
      amount = evaluateFormula(rule.formula, ctx);
    }

    ctx.rules[rule.code] = amount;

    const cat = (rule.category || "ALLOWANCE").toUpperCase();
    ctx.categories[cat] = (ctx.categories[cat] || 0) + amount;

    computedLines.push({
      ruleId: rule.id.startsWith("r-") ? undefined : rule.id,
      code: rule.code,
      name: rule.name,
      category: cat,
      sequence: rule.sequence,
      amount,
      appearsOnPayslip: rule.appears_on_payslip ?? true,
    });
  }

  const basicSalary = ctx.categories["BASIC"] || Math.round(monthlyGross * 0.5);
  const allowancesTotal = ctx.categories["ALLOWANCE"] || Math.round(monthlyGross * 0.5);
  const grossSalary = basicSalary + allowancesTotal;
  const deductionsTotal = (ctx.categories["DEDUCTION"] || 0) + (ctx.categories["TAX"] || 0);
  const taxAmount = ctx.categories["TAX"] || 0;
  const netSalary = Math.max(0, grossSalary - deductionsTotal);

  return {
    employeeId: emp.id,
    contractId: contract?.id,
    structureId,
    workingDays,
    presentDays,
    absentDays,
    leaveDays,
    overtimeHours,
    basicSalary,
    allowancesTotal,
    grossSalary,
    deductionsTotal,
    taxAmount,
    netSalary,
    computedLines,
  };
}

/**
 * Runs validation checks across active employees prior to or during payrun creation
 */
export async function validatePayrun(periodMonth: number, periodYear: number, employeeIds?: string[]): Promise<PayrunValidationWarning[]> {
  const employees = await prisma.employees.findMany({
    where: {
      status: "active",
      ...(employeeIds && employeeIds.length > 0 && { id: { in: employeeIds } }),
    },
    include: {
      contracts: { orderBy: { created_at: "desc" }, take: 1 },
      employee_salary_structures: { where: { is_current: true }, take: 1 },
      payslips: { where: { period_month: periodMonth, period_year: periodYear } },
    },
  });

  const warnings: PayrunValidationWarning[] = [];

  for (const emp of employees) {
    if (!emp.bank_account_number || emp.bank_account_number.trim() === "") {
      warnings.push({
        employeeId: emp.id,
        employeeName: emp.full_name,
        employeeCode: emp.employee_code,
        type: "MISSING_BANK_DETAILS",
        message: `Missing bank account number for direct deposit`,
      });
    }

    if (emp.contracts.length === 0) {
      warnings.push({
        employeeId: emp.id,
        employeeName: emp.full_name,
        employeeCode: emp.employee_code,
        type: "MISSING_CONTRACT",
        message: `No active employment contract found`,
      });
    } else {
      const activeContract = emp.contracts[0];
      if (activeContract.status === "expired" || (activeContract.end_date && activeContract.end_date < new Date())) {
        warnings.push({
          employeeId: emp.id,
          employeeName: emp.full_name,
          employeeCode: emp.employee_code,
          type: "EXPIRED_CONTRACT",
          message: `Employment contract expired on ${activeContract.end_date?.toISOString().slice(0, 10)}`,
        });
      }
    }

    if (emp.employee_salary_structures.length === 0) {
      warnings.push({
        employeeId: emp.id,
        employeeName: emp.full_name,
        employeeCode: emp.employee_code,
        type: "MISSING_SALARY_STRUCTURE",
        message: `No active salary structure assigned to employee`,
      });
    }

    if (emp.payslips.length > 0) {
      warnings.push({
        employeeId: emp.id,
        employeeName: emp.full_name,
        employeeCode: emp.employee_code,
        type: "DUPLICATE_PAYSLIP",
        message: `Payslip already exists for ${periodYear}-${String(periodMonth).padStart(2, "0")}`,
      });
    }
  }

  return warnings;
}
