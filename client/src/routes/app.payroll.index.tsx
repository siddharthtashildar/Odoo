import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  BadgeIndianRupee,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Play,
  Plus,
  Receipt,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { EmptyState, Field, PageHeader, StatCard, StatusBadge, TableSkeleton } from "@/components/bits";
import { useApp, useDelayed, useEmployeeName } from "@/lib/store";
import {
  calculatePayrollLine,
  inr,
  type PayrollLine,
  type PayrollRun,
  type PayrollStatus,
} from "@/lib/mock-data";

export const Route = createFileRoute("/app/payroll/")({
  head: () => ({
    meta: [
      { title: "Payroll Management · PeoplePay360" },
      { name: "description", content: "Execute monthly payroll runs, compute Indian statutory deductions, and generate payslips." },
      { property: "og:title", content: "Payroll Management · PeoplePay360" },
    ],
  }),
  component: PayrollList,
});

function PayrollList() {
  const { payroll, employees, update, log, role, persona } = useApp();
  const nameOf = useEmployeeName();
  const ready = useDelayed();
  const navigate = useNavigate();

  const [openNewRun, setOpenNewRun] = useState(false);
  const [period, setPeriod] = useState("");
  const [error, setError] = useState<string | undefined>();

  const [selectedRunId, setSelectedRunId] = useState<string>(payroll[0]?.id ?? "");
  const [payslipModalLine, setPayslipModalLine] = useState<{ run: PayrollRun; line: PayrollLine } | null>(null);

  const [q, setQ] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");

  const canManage = role === "payroll_user" || role === "payroll_manager" || role === "admin" || role === "hr_manager";
  const canApprove = role === "payroll_manager" || role === "admin";

  const currentRun = payroll.find((p) => p.id === selectedRunId) ?? payroll[0];

  // 6 Required Summary Cards computed from selected or overall run
  const activeEmployees = employees.filter((e) => e.status !== "exited");
  const totalPayrollGross = currentRun ? currentRun.lines.reduce((s, l) => s + l.gross + l.bonus, 0) : 0;
  const employeesProcessed = currentRun ? currentRun.lines.length : 0;
  const pendingPayrollRuns = payroll.filter((p) => p.status !== "paid").length;
  const totalDeductions = currentRun ? currentRun.lines.reduce((s, l) => s + l.deductions, 0) : 0;
  const netSalaryDisbursal = currentRun ? currentRun.lines.reduce((s, l) => s + l.net, 0) : 0;
  const currentPayrollStatus = currentRun ? currentRun.status : "draft";

  // Rows of employee payroll lines for the selected run
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

  // Chart data: Gross vs Net salary
  const grossVsNetData = useMemo(() => {
    return (currentRun?.lines.slice(0, 5) ?? []).map((l) => ({
      name: nameOf(l.employeeId).split(" ")[0],
      Gross: l.gross + l.bonus,
      Deductions: l.deductions,
      Net: l.net,
    }));
  }, [currentRun, nameOf]);

  // Chart data: Monthly payroll trend
  const monthlyTrendData = [
    { period: "Jun 26", amount: 785000 },
    { period: "Jul 26", amount: 840000 },
    { period: "Aug 26", amount: 890000 },
    { period: "Sep 26", amount: netSalaryDisbursal },
  ];

  const handleCreateRun = () => {
    if (period.trim().length < 4) return setError("Give the run a period name, e.g. October 2026.");
    if (payroll.some((p) => p.period.toLowerCase() === period.trim().toLowerCase()))
      return setError("A run already exists for that period.");
    setError(undefined);

    const eligible = employees.filter((e) => e.status !== "exited");
    const newRun: PayrollRun = {
      id: `PR-${2610 + payroll.length}`,
      period: period.trim(),
      cycle: "Monthly · 1–30",
      status: "draft",
      createdBy: persona.name,
      lines: eligible.map((e) => calculatePayrollLine(e.id, e.ctc)),
    };

    update("payroll", [newRun, ...payroll]);
    setSelectedRunId(newRun.id);
    log(`Created draft payroll run ${newRun.id} for ${newRun.period}`, "Payroll");
    toast.success("Payroll run created", {
      description: `${newRun.lines.length} employee compensation lines computed.`,
    });

    setPeriod("");
    setOpenNewRun(false);
  };

  const handleProcessRun = (runId: string) => {
    update(
      "payroll",
      payroll.map((p) =>
        p.id === runId
          ? {
              ...p,
              status: "pending_approval" as const,
            }
          : p,
      ),
    );
    log(`Processed payroll run ${runId} and submitted for manager sign-off`, "Payroll");
    toast.success("Payroll run processed", {
      description: "Submitted to Finance Controller / Payroll Manager for sign-off.",
    });
  };

  const handleMarkAsPaid = (runId: string) => {
    update(
      "payroll",
      payroll.map((p) =>
        p.id === runId
          ? {
              ...p,
              status: "paid" as const,
              paymentDate: new Date().toISOString().slice(0, 10),
              approvedBy: persona.name,
            }
          : p,
      ),
    );
    log(`Released payouts and marked run ${runId} as PAID`, "Payroll");
    toast.success("Disbursement completed", {
      description: "All bank transfer vouchers and payslips released to employees.",
    });
  };

  const departments = useMemo(() => Array.from(new Set(employees.map((e) => e.department))).sort(), [employees]);

  return (
    <>
      <PageHeader
        title="Payroll Operations"
        description="Statutory salary schedules, allowance components, PF/PT deductions, and direct disbursal processing."
        actions={
          <div className="flex items-center gap-2">
            <Select value={selectedRunId} onValueChange={setSelectedRunId}>
              <SelectTrigger className="w-[180px]">
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
              <Button onClick={() => setOpenNewRun(true)}>
                <Plus className="mr-2 size-4" /> Create Payroll
              </Button>
            )}
          </div>
        }
      />

      {/* 6 Required Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard
          label="Total Payroll"
          value={inr(totalPayrollGross)}
          hint="Gross salary obligations"
          icon={<Coins className="size-5" />}
          tone="default"
        />
        <StatCard
          label="Employees Processed"
          value={employeesProcessed}
          hint={`${activeEmployees.length} active eligible`}
          icon={<Users className="size-5" />}
          tone="default"
        />
        <StatCard
          label="Pending Runs"
          value={pendingPayrollRuns}
          hint="Drafts / Pending approval"
          icon={<Clock className="size-5" />}
          tone="warning"
        />
        <StatCard
          label="Total Deductions"
          value={inr(totalDeductions)}
          hint="PF, PT & Income Tax"
          icon={<CreditCard className="size-5" />}
          tone="default"
        />
        <StatCard
          label="Net Salary Disbursal"
          value={inr(netSalaryDisbursal)}
          hint="Take-home payout sum"
          icon={<BadgeIndianRupee className="size-5" />}
          tone="accent"
        />
        <StatCard
          label="Payroll Status"
          value={<StatusBadge status={currentPayrollStatus} />}
          hint={`${currentRun?.period ?? "Active"}`}
          icon={<CheckCircle2 className="size-5" />}
          tone={currentPayrollStatus === "paid" ? "success" : "warning"}
        />
      </div>

      {/* Action Header Strip for Selected Run */}
      {currentRun && (
        <Card className="border-border/70 bg-card">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-display font-semibold text-lg">{currentRun.period}</p>
                <StatusBadge status={currentRun.status} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cycle: {currentRun.cycle} · Prepared by {currentRun.createdBy}
                {currentRun.approvedBy && ` · Approved by ${currentRun.approvedBy}`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {currentRun.status === "draft" && canManage && (
                <Button size="sm" onClick={() => handleProcessRun(currentRun.id)}>
                  <Play className="size-3.5 mr-1.5" /> Process Payroll
                </Button>
              )}

              {currentRun.status === "pending_approval" && canApprove && (
                <Button
                  size="sm"
                  className="bg-success text-success-foreground hover:bg-success/90"
                  onClick={() => handleMarkAsPaid(currentRun.id)}
                >
                  <CheckCircle2 className="size-3.5 mr-1.5" /> Approve & Mark Paid
                </Button>
              )}

              {currentRun.status === "paid" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    toast.success(`Exporting bank disbursement manifest for ${currentRun.period}`)
                  }
                >
                  <Download className="size-3.5 mr-1.5" /> Export Bank File
                </Button>
              )}

              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate({ to: `/app/payroll/${currentRun.id}` })}
              >
                Full Audit Run <Eye className="size-3.5 ml-1.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analytics Charts: Gross vs Net + Monthly Trend */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gross vs Net Salary Breakdown</CardTitle>
            <CardDescription>Sample employee take-home vs statutory deductions for {currentRun?.period}</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grossVsNetData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} />
                <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip
                  formatter={(v: number) => inr(v)}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Legend />
                <Bar dataKey="Gross" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Deductions" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Net" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Payroll Cost Trend</CardTitle>
            <CardDescription>Net salary disbursement trajectory over recent cycles</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrendData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="period" stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} />
                <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip
                  formatter={(v: number) => inr(v)}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  name="Net Payroll"
                  stroke="var(--chart-3)"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Main Payroll Table (All Section 14 columns) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Employee Compensation Records</CardTitle>
              <CardDescription>
                Basic salary, allowances, statutory Indian deductions (PF, PT, TDS) and net salaries
              </CardDescription>
            </div>
          </div>

          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search employee..."
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
              title="No payroll records"
              description="No employee lines match the current filters."
              icon={<BadgeIndianRupee className="size-8" />}
            />
          ) : (
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
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linesWithMeta.map(({ line, emp }) => {
                    const allowanceSum = line.hra + line.specialAllowance + line.bonus;
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
                          {currentRun.period}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={currentRun.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={() => setPayslipModalLine({ run: currentRun, line })}
                              title="View payslip"
                            >
                              <Eye className="size-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={() =>
                                toast.success(`Downloading PDF Payslip for ${emp?.name ?? line.employeeId}`)
                              }
                              title="Download payslip"
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
          )}
        </CardContent>
      </Card>

      {/* Create New Payroll Run Dialog */}
      <Dialog open={openNewRun} onOpenChange={setOpenNewRun}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Payroll Cycle</DialogTitle>
            <DialogDescription>
              Initialize compensation schedules for active staff members.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Field label="Cycle Period Name" error={error}>
              <Input
                placeholder="e.g. October 2026"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
            </Field>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Standard Indian CTC breakdown will be calculated automatically (50% Basic, 25% HRA, 25% Special Allowance,
              statutory PF ₹1,800, PT ₹200, and mock TDS).
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNewRun(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRun}>Create Draft Cycle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Payslip Dialog */}
      {payslipModalLine && (
        <Dialog open={!!payslipModalLine} onOpenChange={(o) => !o && setPayslipModalLine(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>Salary Payslip · {payslipModalLine.run.period}</DialogTitle>
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
                  <p className="font-medium">
                    {employees.find((e) => e.id === payslipModalLine.line.employeeId)?.designation}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Department:</span>
                  <p className="font-medium">
                    {employees.find((e) => e.id === payslipModalLine.line.employeeId)?.department}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Bank Account:</span>
                  <p className="font-medium">
                    {employees.find((e) => e.id === payslipModalLine.line.employeeId)?.bankAccount}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">PAN:</span>
                  <p className="font-medium">
                    {employees.find((e) => e.id === payslipModalLine.line.employeeId)?.pan}
                  </p>
                </div>
              </div>

              {/* Earnings vs Deductions Table */}
              <div className="grid grid-cols-2 gap-3">
                <div className="border rounded-lg p-3 space-y-1.5">
                  <p className="font-semibold text-xs text-foreground uppercase tracking-wider">
                    Earnings
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
                  {payslipModalLine.line.bonus > 0 && (
                    <div className="flex justify-between text-xs text-success">
                      <span>Performance Bonus:</span>
                      <span className="font-medium">+{inr(payslipModalLine.line.bonus)}</span>
                    </div>
                  )}
                  <div className="border-t pt-1 flex justify-between font-semibold text-xs">
                    <span>Gross Earnings:</span>
                    <span>{inr(payslipModalLine.line.gross + payslipModalLine.line.bonus)}</span>
                  </div>
                </div>

                <div className="border rounded-lg p-3 space-y-1.5">
                  <p className="font-semibold text-xs text-destructive uppercase tracking-wider">
                    Deductions
                  </p>
                  <div className="flex justify-between text-xs">
                    <span>Provident Fund (PF):</span>
                    <span className="font-medium">{inr(payslipModalLine.line.providentFund)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Professional Tax (PT):</span>
                    <span className="font-medium">{inr(payslipModalLine.line.professionalTax)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Income Tax (TDS):</span>
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
                  <p className="text-xs text-muted-foreground">Deposited into salary account</p>
                </div>
                <div className="text-2xl font-bold font-display text-primary tabular-nums">
                  {inr(payslipModalLine.line.net)}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  toast.success("Downloaded formal PDF payslip receipt");
                }}
              >
                <Download className="mr-1.5 size-4" /> Download PDF
              </Button>
              <Button onClick={() => setPayslipModalLine(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
