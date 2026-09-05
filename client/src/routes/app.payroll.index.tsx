import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  BadgeIndianRupee,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Download,
  Eye,
  FileText,
  Lock,
  Mail,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, Field, PageHeader, StatCard, StatusBadge, TableSkeleton, TablePagination } from "@/components/bits";
import { useApp, useDelayed, useEmployeeName } from "@/lib/store";
import { downloadPayslipPDF, emailPayslipToEmployee } from "@/lib/payslip-exporter";
import { inr, type PayrollLine, type PayrollRun } from "@/lib/mock-data";
import { api } from "@/lib/api";

export const Route = createFileRoute("/app/payroll/")({
  head: () => ({
    meta: [
      { title: "Payroll Operations · PeoplePay360" },
      { name: "description", content: "Execute monthly payroll runs, sequential rule calculation, PDF payslip generation, and analytics." },
      { property: "og:title", content: "Payroll Operations · PeoplePay360" },
    ],
  }),
  component: PayrollList,
});

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function PayrollList() {
  const { payroll, employees, update, log, role, persona } = useApp();
  const nameOf = useEmployeeName();
  const ready = useDelayed();
  const navigate = useNavigate();

  // RBAC permissions
  const canManage = role === "payroll_manager" || role === "admin" || role === "payroll_user";
  const canFullAdmin = role === "payroll_manager" || role === "admin";
  const isRestricted = role === "employee" || role === "hr_manager";

  // Dashboard Analytics state
  const [analytics, setAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Selected Run State
  const [selectedRunId, setSelectedRunId] = useState<string>(payroll[0]?.id ?? "");
  const [payslipModalLine, setPayslipModalLine] = useState<{ run: PayrollRun; line: PayrollLine } | null>(null);

  // Filters & Table Pagination
  const [q, setQ] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [page, setPage] = useState(1);

  // 2-Step Payrun Creation Wizard State
  const [openWizard, setOpenWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [wizardMonth, setWizardMonth] = useState<number>(new Date().getMonth() + 1);
  const [wizardYear, setWizardYear] = useState<number>(new Date().getFullYear());
  const [wizardPayDate, setWizardPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [isSubmittingRun, setIsSubmittingRun] = useState(false);

  // Load analytics backend API on mount
  useEffect(() => {
    async function loadAnalytics() {
      try {
        setLoadingAnalytics(true);
        const data = await api.payroll.getDashboardAnalytics();
        setAnalytics(data);
      } catch (err) {
        console.warn("Using fallback client analytics:", err);
      } finally {
        setLoadingAnalytics(false);
      }
    }
    if (canManage) {
      loadAnalytics();
    }
  }, [canManage, payroll]);

  const currentRun = payroll.find((p) => p.id === selectedRunId) ?? payroll[0];

  // Eligible Active Employees for Wizard Step 2
  const activeEmployees = useMemo(() => {
    return employees.filter((e) => e.status === "active" || e.status === "onboarding");
  }, [employees]);

  const filteredWizardEmployees = useMemo(() => {
    if (selectedDept === "all") return activeEmployees;
    return activeEmployees.filter((e) => e.department === selectedDept);
  }, [activeEmployees, selectedDept]);

  // Pre-select all eligible employees when opening Step 2
  const handleOpenWizard = () => {
    setWizardStep(1);
    setSelectedEmpIds(activeEmployees.map((e) => e.id));
    setOpenWizard(true);
  };

  const toggleSelectAll = () => {
    if (selectedEmpIds.length === filteredWizardEmployees.length) {
      setSelectedEmpIds([]);
    } else {
      setSelectedEmpIds(filteredWizardEmployees.map((e) => e.id));
    }
  };

  const toggleSelectEmp = (id: string) => {
    if (selectedEmpIds.includes(id)) {
      setSelectedEmpIds((prev) => prev.filter((item) => item !== id));
    } else {
      setSelectedEmpIds((prev) => [...prev, id]);
    }
  };

  // Submit 2-Step Payrun Creation
  const handleCreatePayrunSubmit = async () => {
    if (selectedEmpIds.length === 0) {
      toast.error("Select at least one employee for the payroll run");
      return;
    }

    try {
      setIsSubmittingRun(true);
      const res = await api.payroll.create({
        periodMonth: wizardMonth,
        periodYear: wizardYear,
        payDate: wizardPayDate,
        employeeIds: selectedEmpIds,
      });

      const periodStr = `${MONTH_NAMES[wizardMonth - 1]} ${wizardYear}`;
      const eligible = employees.filter((e) => selectedEmpIds.includes(e.id));
      const newRun: PayrollRun = {
        id: res.id || `PR-${Date.now().toString().slice(-4)}`,
        period: periodStr,
        cycle: `Monthly · 1–30`,
        status: "draft",
        createdBy: persona.name,
        lines: eligible.map((e) => ({
          employeeId: e.id,
          basicSalary: Math.round(e.ctc / 12 * 0.5),
          hra: Math.round(e.ctc / 12 * 0.2),
          specialAllowance: Math.round(e.ctc / 12 * 0.3),
          bonus: 0,
          gross: Math.round(e.ctc / 12),
          providentFund: 1800,
          professionalTax: 200,
          incomeTax: Math.round(e.ctc / 12 * 0.05),
          deductions: 2000 + Math.round(e.ctc / 12 * 0.05),
          net: Math.round(e.ctc / 12) - (2000 + Math.round(e.ctc / 12 * 0.05)),
        })),
      };

      update("payroll", [newRun, ...payroll]);
      setSelectedRunId(newRun.id);
      log(`Created Payrun ${newRun.id} for ${periodStr} (${selectedEmpIds.length} employees)`, "Payroll");

      if (res.warnings && res.warnings.length > 0) {
        toast.warning(`Payrun created with ${res.warnings.length} operational warning(s)`, {
          description: "Review readiness banner for missing bank details or missing contracts.",
        });
      } else {
        toast.success(`Payrun created for ${periodStr}`, {
          description: `${selectedEmpIds.length} employees included with sequential calculation rules.`,
        });
      }

      setOpenWizard(false);
    } catch (err: any) {
      toast.error("Failed to create payrun", { description: err.message });
    } finally {
      setIsSubmittingRun(false);
    }
  };

  // Status Action Handlers
  const handleRecomputeRun = async (runId: string) => {
    try {
      await api.payroll.compute(runId);
      toast.success("Payrun recomputed", {
        description: "Sequential calculation engine executed on all employee rules.",
      });
      log(`Recomputed payrun ${runId}`, "Payroll");
    } catch (err: any) {
      toast.error("Recomputation failed", { description: err.message });
    }
  };

  const handleValidateRun = async (runId: string) => {
    try {
      const res = await api.payroll.validate(runId);
      update(
        "payroll",
        payroll.map((p) => (p.id === runId ? { ...p, status: "pending_approval" as const } : p)),
      );
      toast.success("Payrun validated", {
        description: `${res.warnings?.length || 0} warning(s) flagged during audit.`,
      });
      log(`Validated payrun ${runId}`, "Payroll");
    } catch (err: any) {
      toast.error("Validation failed", { description: err.message });
    }
  };

  const handleMarkPaid = async (runId: string) => {
    try {
      await api.payroll.markPaid(runId);
      update(
        "payroll",
        payroll.map((p) =>
          p.id === runId
            ? { ...p, status: "paid" as const, paymentDate: new Date().toISOString().slice(0, 10), approvedBy: persona.name }
            : p,
        ),
      );
      toast.success("Payrun marked as PAID", {
        description: "Locked as read-only. Disbursal completed.",
      });
      log(`Marked payrun ${runId} as PAID`, "Payroll");
    } catch (err: any) {
      toast.error("Failed to mark as paid", { description: err.message });
    }
  };

  const handleSendAllEmails = async (runId: string) => {
    try {
      const res = await api.payroll.sendEmails(runId);
      toast.success(`Payslip email dispatch initiated`, {
        description: res.message || `Dispatched payslips to employees.`,
      });
    } catch (err: any) {
      toast.error("Email dispatch failed", { description: err.message });
    }
  };

  const handleRetryFailedEmails = async (runId: string) => {
    try {
      const res = await api.payroll.retryFailedEmails(runId);
      toast.success(`Email retry completed`, {
        description: `Retried ${res.retriedCount} email(s), ${res.successfullyResentCount} sent successfully.`,
      });
    } catch (err: any) {
      toast.error("Retry failed", { description: err.message });
    }
  };

  // Data mapping for compensation lines
  const linesWithMeta = useMemo(() => {
    if (!currentRun) return [];
    return currentRun.lines
      .map((line) => {
        const emp = employees.find((e) => e.id === line.employeeId);
        return { line, emp };
      })
      .filter(({ line, emp }) => {
        const empName = emp ? emp.name.toLowerCase() : "";
        const matchQ = empName.includes(q.toLowerCase()) || line.employeeId.toLowerCase().includes(q.toLowerCase());
        const matchDept = deptFilter === "all" || emp?.department === deptFilter;
        return matchQ && matchDept;
      });
  }, [currentRun, employees, q, deptFilter]);

  const PAGE_SIZE = 5;
  const totalPages = Math.ceil(linesWithMeta.length / PAGE_SIZE) || 1;
  const paginatedLines = useMemo(() => {
    return linesWithMeta.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [linesWithMeta, page]);

  // Derived KPI metrics
  const totalPayrollGross = currentRun ? currentRun.lines.reduce((s, l) => s + l.gross + l.bonus, 0) : 0;
  const employeesProcessed = currentRun ? currentRun.lines.length : 0;
  const totalDeductions = currentRun ? currentRun.lines.reduce((s, l) => s + l.deductions, 0) : 0;
  const netSalaryDisbursal = currentRun ? currentRun.lines.reduce((s, l) => s + l.net, 0) : 0;

  const departments = useMemo(() => Array.from(new Set(employees.map((e) => e.department))).sort(), [employees]);

  if (isRestricted) {
    return (
      <EmptyState
        icon={<Lock className="size-8 text-muted-foreground" />}
        title="Access Restricted"
        description="Payroll operations and salary computation are restricted to Payroll Users and Payroll Managers."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Payroll Operations & Payruns"
        description="Sequential salary computation engine, 2-step payrun wizard, validation rules, and bulk email payslip delivery."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedRunId} onValueChange={setSelectedRunId}>
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {payroll.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.period} ({p.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {canManage && (
              <Button onClick={handleOpenWizard}>
                <Plus className="mr-2 size-4" /> Create Payrun (Wizard)
              </Button>
            )}
          </div>
        }
      />

      {/* Operational Warnings Banner */}
      {analytics?.validationWarnings && analytics.validationWarnings.length > 0 && (
        <Card className="border-warning/50 bg-warning/10">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="size-5 shrink-0 text-warning-foreground mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-warning-foreground">
                Operational Readiness Warnings ({analytics.validationWarnings.length})
              </p>

              <div className="mt-1 flex flex-wrap gap-2 text-xs">
                {analytics.validationWarnings.map((w: any, idx: number) => (
                  <span key={idx} className="rounded bg-background/80 px-2 py-1 border border-warning/30">
                    <strong>{w.employeeName}</strong>: {w.message}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 6 Core Dashboard KPI Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard
          label="Total Gross Payroll"
          value={inr(totalPayrollGross)}
          hint="Gross salary obligation"
          icon={<Coins className="size-5" />}
          tone="default"
        />
        <StatCard
          label="Employees Included"
          value={employeesProcessed}
          hint={`${activeEmployees.length} active eligible`}
          icon={<Users className="size-5" />}
          tone="default"
        />
        <StatCard
          label="Attendance Health"
          value={`${analytics?.kpis?.attendanceHealthPct || 95}%`}
          hint="Present vs Total Ratio"
          icon={<Clock className="size-5" />}
          tone="success"
        />
        <StatCard
          label="Statutory Deductions"
          value={inr(totalDeductions)}
          hint="PF, PT & TDS Total"
          icon={<CreditCard className="size-5" />}
          tone="default"
        />
        <StatCard
          label="Net Salary Disbursal"
          value={inr(netSalaryDisbursal)}
          hint="Take-home disbursal"
          icon={<BadgeIndianRupee className="size-5" />}
          tone="accent"
        />
        <StatCard
          label="Payrun Status"
          value={<StatusBadge status={currentRun?.status ?? "draft"} />}
          hint={currentRun?.period ?? "Active"}
          icon={<CheckCircle2 className="size-5" />}
          tone={currentRun?.status === "paid" ? "success" : "warning"}
        />
      </div>

      {/* Workflow Actions Header Strip */}
      {currentRun && (
        <Card className="border-border/80 bg-card">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-display font-semibold text-lg">{currentRun.period}</p>
                <StatusBadge status={currentRun.status} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cycle: {currentRun.cycle} · Prepared by {currentRun.createdBy}
                {currentRun.approvedBy && ` · Signed off by ${currentRun.approvedBy}`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {currentRun.status !== "paid" && canManage && (
                <>
                  <Button size="sm" variant="outline" onClick={() => handleRecomputeRun(currentRun.id)}>
                    <RefreshCw className="size-3.5 mr-1.5" /> Recompute Rules
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleValidateRun(currentRun.id)}>
                    <FileText className="size-3.5 mr-1.5" /> Validate Run
                  </Button>
                </>
              )}

              {currentRun.status !== "paid" && canFullAdmin && (
                <Button
                  size="sm"
                  className="bg-success text-success-foreground hover:bg-success/90"
                  onClick={() => handleMarkPaid(currentRun.id)}
                >
                  <CheckCircle2 className="size-3.5 mr-1.5" /> Mark Paid & Lock
                </Button>
              )}

              {canManage && (
                <Button size="sm" variant="outline" onClick={() => handleSendAllEmails(currentRun.id)}>
                  <Send className="size-3.5 mr-1.5" /> Email Payslips
                </Button>
              )}

              {canManage && (
                <Button size="sm" variant="ghost" onClick={() => handleRetryFailedEmails(currentRun.id)}>
                  <Mail className="size-3.5 mr-1.5" /> Retry Failed Emails
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Employee Compensation Records Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Employee Compensation Lines</CardTitle>
              <CardDescription>
                Basic salary, allowances, statutory deductions (PF, PT, TDS) and net salaries
              </CardDescription>
            </div>
          </div>

          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search employee or ID..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {!ready ? (
            <div className="p-4">
              <TableSkeleton rows={6} />
            </div>
          ) : linesWithMeta.length === 0 ? (
            <EmptyState
              title="No compensation records"
              description="No employee lines match the current filters."
              icon={<BadgeIndianRupee className="size-8" />}
            />
          ) : (
            <>
              {/* Pagination ON TOP of Employee Compensation Records */}
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={linesWithMeta.length}
                pageSize={5}
                onPageChange={setPage}
              />

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Basic Salary</TableHead>
                      <TableHead className="text-right">Allowances</TableHead>
                      <TableHead className="text-right">Deductions</TableHead>
                      <TableHead className="text-right font-bold text-foreground">Net Salary</TableHead>
                      <TableHead>Pay Period</TableHead>
                      <TableHead>Email Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLines.map(({ line, emp }) => {
                      const allowanceSum = line.hra + line.specialAllowance + (line.bonus || 0);
                      return (
                        <TableRow key={line.employeeId}>
                          <TableCell>
                            <div className="font-medium">{emp ? emp.name : nameOf(line.employeeId)}</div>
                            <div className="text-xs text-muted-foreground">{emp?.designation}</div>
                          </TableCell>
                          <TableCell className="font-mono text-xs font-semibold text-primary">
                            {emp?.code ?? line.employeeId}
                          </TableCell>
                          <TableCell>{emp?.department ?? "General"}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {inr(line.basicSalary)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {inr(allowanceSum)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-destructive">
                            -{inr(line.deductions)}
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums text-primary">
                            {inr(line.net)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {currentRun?.period ?? "—"}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              {(line as any).emailStatus || "sent"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2"
                                onClick={() => currentRun && setPayslipModalLine({ run: currentRun, line })}
                                title="View payslip"
                              >
                                <Eye className="size-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2"
                                onClick={() => {
                                  if (!currentRun) return;
                                  downloadPayslipPDF({
                                    employeeName: emp?.name ?? line.employeeId,
                                    employeeCode: emp?.code ?? line.employeeId,
                                    department: emp?.department ?? "—",
                                    designation: emp?.designation ?? "—",
                                    bankAccount: emp?.bankAccount ?? "—",
                                    pan: emp?.pan ?? "—",
                                    period: currentRun.period,
                                    basic: line.basicSalary,
                                    hra: line.hra,
                                    specialAllowance: line.specialAllowance,
                                    bonus: line.bonus,
                                    gross: line.gross + (line.bonus || 0),
                                    pf: line.providentFund,
                                    pt: line.professionalTax,
                                    tds: line.incomeTax,
                                    deductions: line.deductions,
                                    net: line.net,
                                  });
                                }}
                                title="Download payslip PDF"
                              >
                                <Download className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Bottom Pagination */}
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={linesWithMeta.length}
                pageSize={5}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* 2-Step Payrun Creation Wizard Dialog */}
      <Dialog open={openWizard} onOpenChange={setOpenWizard}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              2-Step Payrun Wizard: {wizardStep === 1 ? "Step 1 - Period & Structure" : "Step 2 - Employee Selection"}
            </DialogTitle>
            <DialogDescription>
              {wizardStep === 1
                ? "Select period month, year, and scheduled payment date."
                : `Select active employees to include in ${MONTH_NAMES[wizardMonth - 1]} ${wizardYear} payrun.`}
            </DialogDescription>
          </DialogHeader>

          {wizardStep === 1 ? (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Period Month">
                  <Select value={String(wizardMonth)} onValueChange={(v) => setWizardMonth(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTH_NAMES.map((name, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          {name} ({String(i + 1).padStart(2, "0")})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Period Year">
                  <Select value={String(wizardYear)} onValueChange={(v) => setWizardYear(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2026">2026</SelectItem>
                      <SelectItem value="2027">2027</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Scheduled Disbursal Pay Date">
                <Input
                  type="date"
                  value={wizardPayDate}
                  onChange={(e) => setWizardPayDate(e.target.value)}
                />
              </Field>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-primary">Sequential Calculation Engine Notice</p>
                <p>
                  Rules are computed in strict priority order (Basic → Allowances → Gross → PF → PT → TDS → Net).
                  Attendance and approved leave data for the selected period will be factored into working days.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <Select value={selectedDept} onValueChange={setSelectedDept}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                  {selectedEmpIds.length === filteredWizardEmployees.length ? "Deselect All" : "Select All"}
                </Button>
              </div>

              <div className="max-h-60 overflow-y-auto border rounded-md divide-y">
                {filteredWizardEmployees.map((emp) => {
                  const isChecked = selectedEmpIds.includes(emp.id);
                  return (
                    <div key={emp.id} className="flex items-center justify-between p-2.5 hover:bg-muted/30">
                      <div className="flex items-center gap-2.5">
                        <Checkbox checked={isChecked} onCheckedChange={() => toggleSelectEmp(emp.id)} />
                        <div>
                          <p className="text-sm font-medium leading-none">{emp.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {emp.code} · {emp.department} · {emp.designation}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-primary">
                        {inr(Math.round(emp.ctc / 12))} / mo
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Selected: <strong>{selectedEmpIds.length}</strong> of {filteredWizardEmployees.length} employees</span>
                <span>Estimated Gross: <strong>{inr(filteredWizardEmployees.filter(e => selectedEmpIds.includes(e.id)).reduce((s, e) => s + Math.round(e.ctc / 12), 0))}</strong></span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {wizardStep === 2 && (
              <Button variant="outline" onClick={() => setWizardStep(1)}>
                Back to Step 1
              </Button>
            )}
            <Button variant="ghost" onClick={() => setOpenWizard(false)}>
              Cancel
            </Button>
            {wizardStep === 1 ? (
              <Button onClick={() => setWizardStep(2)}>Next: Select Employees</Button>
            ) : (
              <Button onClick={handleCreatePayrunSubmit} disabled={isSubmittingRun}>
                {isSubmittingRun ? "Computing Rules..." : "Create Payrun"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Itemized Payslip Modal */}
      {payslipModalLine && (
        <Dialog open={!!payslipModalLine} onOpenChange={(o) => !o && setPayslipModalLine(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>Itemized Payslip · {payslipModalLine.run.period}</DialogTitle>
                <StatusBadge status={payslipModalLine.run.status} />
              </div>
              <DialogDescription>
                Employee: {nameOf(payslipModalLine.line.employeeId)} ({payslipModalLine.line.employeeId})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-sm">
              <div className="rounded-lg border border-border bg-muted/30 p-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Designation:</span>
                  <p className="font-medium">{employees.find((e) => e.id === payslipModalLine.line.employeeId)?.designation || "Software Engineer"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Department:</span>
                  <p className="font-medium">{employees.find((e) => e.id === payslipModalLine.line.employeeId)?.department || "Engineering"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Bank Account:</span>
                  <p className="font-medium">{employees.find((e) => e.id === payslipModalLine.line.employeeId)?.bankAccount || "HDFC0001234"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">PAN Number:</span>
                  <p className="font-medium">{employees.find((e) => e.id === payslipModalLine.line.employeeId)?.pan || "ABCDE1234F"}</p>
                </div>
              </div>

              {/* Earnings vs Deductions Table */}
              <div className="grid grid-cols-2 gap-3">
                <div className="border rounded-lg p-3 space-y-1.5">
                  <p className="font-semibold text-xs text-foreground uppercase tracking-wider">
                    Earnings / Allowances
                  </p>
                  <div className="flex justify-between text-xs">
                    <span>Basic Salary:</span>
                    <span className="font-medium">{inr(payslipModalLine.line.basicSalary)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>HRA:</span>
                    <span className="font-medium">{inr(payslipModalLine.line.hra)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Special Allowance:</span>
                    <span className="font-medium">{inr(payslipModalLine.line.specialAllowance)}</span>
                  </div>
                  <div className="border-t pt-1 flex justify-between font-semibold text-xs">
                    <span>Gross Earnings:</span>
                    <span>{inr(payslipModalLine.line.gross + (payslipModalLine.line.bonus || 0))}</span>
                  </div>
                </div>

                <div className="border rounded-lg p-3 space-y-1.5">
                  <p className="font-semibold text-xs text-destructive uppercase tracking-wider">
                    Deductions & Tax
                  </p>
                  <div className="flex justify-between text-xs">
                    <span>PF (12%):</span>
                    <span className="font-medium">{inr(payslipModalLine.line.providentFund)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Professional Tax:</span>
                    <span className="font-medium">{inr(payslipModalLine.line.professionalTax)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>TDS (Income Tax):</span>
                    <span className="font-medium">{inr(payslipModalLine.line.incomeTax)}</span>
                  </div>
                  <div className="border-t pt-1 flex justify-between font-semibold text-xs text-destructive">
                    <span>Total Deductions:</span>
                    <span>-{inr(payslipModalLine.line.deductions)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-primary/10 p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Take-Home Net Salary</p>
                  <p className="text-xs text-muted-foreground">Direct Bank Deposit</p>
                </div>
                <div className="text-2xl font-bold font-display text-primary tabular-nums">
                  {inr(payslipModalLine.line.net)}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const emp = employees.find((e) => e.id === payslipModalLine.line.employeeId);
                  downloadPayslipPDF({
                    employeeName: emp?.name ?? payslipModalLine.line.employeeId,
                    employeeCode: emp?.code ?? payslipModalLine.line.employeeId,
                    department: emp?.department ?? "—",
                    designation: emp?.designation ?? "—",
                    bankAccount: emp?.bankAccount ?? "—",
                    pan: emp?.pan ?? "—",
                    period: payslipModalLine.run.period,
                    basic: payslipModalLine.line.basicSalary,
                    hra: payslipModalLine.line.hra,
                    specialAllowance: payslipModalLine.line.specialAllowance,
                    bonus: payslipModalLine.line.bonus,
                    gross: payslipModalLine.line.gross + (payslipModalLine.line.bonus || 0),
                    pf: payslipModalLine.line.providentFund,
                    pt: payslipModalLine.line.professionalTax,
                    tds: payslipModalLine.line.incomeTax,
                    deductions: payslipModalLine.line.deductions,
                    net: payslipModalLine.line.net,
                  });
                }}
              >
                <Download className="mr-1.5 size-4" /> Download PDF
              </Button>

              <Button
                variant="secondary"
                onClick={() => {
                  const emp = employees.find((e) => e.id === payslipModalLine.line.employeeId);
                  emailPayslipToEmployee(
                    {
                      employeeName: emp?.name ?? payslipModalLine.line.employeeId,
                      employeeCode: emp?.code ?? payslipModalLine.line.employeeId,
                      department: emp?.department ?? "—",
                      designation: emp?.designation ?? "—",
                      bankAccount: emp?.bankAccount ?? "—",
                      pan: emp?.pan ?? "—",
                      period: payslipModalLine.run.period,
                      basic: payslipModalLine.line.basicSalary,
                      hra: payslipModalLine.line.hra,
                      specialAllowance: payslipModalLine.line.specialAllowance,
                      bonus: payslipModalLine.line.bonus,
                      gross: payslipModalLine.line.gross + (payslipModalLine.line.bonus || 0),
                      pf: payslipModalLine.line.providentFund,
                      pt: payslipModalLine.line.professionalTax,
                      tds: payslipModalLine.line.incomeTax,
                      deductions: payslipModalLine.line.deductions,
                      net: payslipModalLine.line.net,
                    },
                    payslipModalLine.line.employeeId,
                  );
                }}
              >
                <Send className="mr-1.5 size-4" /> Email Payslip
              </Button>
              <Button onClick={() => setPayslipModalLine(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

