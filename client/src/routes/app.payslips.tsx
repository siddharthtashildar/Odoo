import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Download, Receipt, Eye, Printer, Mail, Calendar, Building2, CreditCard, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader, StatCard, TableSkeleton, TablePagination } from "@/components/bits";
import { useApp } from "@/lib/store";
import { inr } from "@/lib/mock-data";
import { api } from "@/lib/api";
import { downloadPayslipPDF, printPayslip, emailPayslipToEmployee, PayslipExportData } from "@/lib/payslip-exporter";

export const Route = createFileRoute("/app/payslips")({
  head: () => ({
    meta: [
      { title: "Payslips · PeoplePay360" },
      { name: "description", content: "View, print, and download published payslip statements and PDF records." },
      { property: "og:title", content: "Payslips · PeoplePay360" },
      { property: "og:description", content: "View, print, and download published payslip statements and PDF records." },
    ],
  }),
  component: Payslips,
});

interface DynamicPayslipItem {
  id: string;
  runId: string;
  period: string;
  periodMonth: number;
  periodYear: number;
  payDate: string | null;
  status: string;
  paymentStatus: string;
  employee: {
    id: string;
    code: string;
    name: string;
    email: string;
    department: string;
    designation: string;
    joiningDate: string | null;
    bankName: string;
    bankAccount: string;
    bankIfsc: string;
    pan: string;
    location: string;
  };
  attendance: {
    workingDays: number;
    presentDays: number;
    absentDays: number;
    leaveDays: number;
  };
  financials: {
    basicSalary: number;
    hra: number;
    specialAllowance: number;
    bonus: number;
    allowancesTotal: number;
    grossSalary: number;
    providentFund: number;
    professionalTax: number;
    incomeTax: number;
    deductionsTotal: number;
    netSalary: number;
  };
  lines: {
    earnings: Array<{ id?: string; code: string; name: string; amount: number }>;
    deductions: Array<{ id?: string; code: string; name: string; amount: number }>;
  };
}

function Payslips() {
  const { payroll, persona, employees, role, generatePayslips } = useApp();

  const me = employees.find(
    (e) =>
      e.id === persona.employeeId ||
      e.code === persona.employeeCode ||
      (persona.email && e.email.toLowerCase() === persona.email.toLowerCase()) ||
      (persona.name && e.name.toLowerCase() === persona.name.toLowerCase()),
  );
  const myId = me?.id || persona.employeeId;

  const canSwitch = role === "hr_manager" || role === "payroll_manager" || role === "payroll_user" || role === "admin";
  const [who, setWho] = useState(myId || (employees[0]?.id ?? ""));
  const [dynamicSlips, setDynamicSlips] = useState<DynamicPayslipItem[]>([]);
  const [loadingSlips, setLoadingSlips] = useState(true);
  const [activeSlip, setActiveSlip] = useState<DynamicPayslipItem | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (myId && !canSwitch) {
      setWho(myId);
    } else if (!who && myId) {
      setWho(myId);
    } else if (!who && employees.length > 0 && employees[0]) {
      setWho(employees[0].id);
    }
  }, [myId, canSwitch, employees, who]);

  const target = canSwitch ? (who || myId) : myId;
  const currentEmployee = employees.find((e) => e.id === target || e.code === target);

  // Dynamic fetch of live database payslips for the selected employee
  const fetchPayslips = useCallback(async () => {
    if (!target) return;
    setLoadingSlips(true);
    try {
      const res = await api.payroll.myPayslips(target);
      if (Array.isArray(res)) {
        setDynamicSlips(res as DynamicPayslipItem[]);
      } else {
        setDynamicSlips([]);
      }
    } catch (err) {
      console.warn("Could not load dynamic payslips:", err);
      // Fallback to store payroll items
      const fallback = payroll
        .filter((r) => r.status === "paid" || r.status === "approved")
        .map((r) => {
          const line = r.lines.find(
            (l) => l.employeeId === target || (currentEmployee && (l.employeeId === currentEmployee.code || l.employeeId === currentEmployee.id)),
          );
          if (!line) return null;
          return {
            id: (line as any).id || r.id,
            runId: r.id,
            period: r.period,
            periodMonth: (r as any).periodMonth ?? 10,
            periodYear: (r as any).periodYear ?? 2026,
            payDate: (r as any).payDate ?? null,
            status: r.status,
            paymentStatus: r.status === "paid" ? "paid" : "unpaid",
            employee: {
              id: currentEmployee?.id || target,
              code: currentEmployee?.code || "PP-1001",
              name: currentEmployee?.name || "Employee",
              email: currentEmployee?.email || "",
              department: currentEmployee?.department || "General",
              designation: currentEmployee?.designation || "Staff",
              joiningDate: (currentEmployee as any)?.joiningDate ?? null,
              bankName: (currentEmployee as any)?.bankName || "HDFC Bank",
              bankAccount: (currentEmployee as any)?.bankAccount || "HDFC0001234",
              bankIfsc: (currentEmployee as any)?.bankIfsc || "HDFC0000001",
              pan: (currentEmployee as any)?.pan || "ABCDE1234F",
              location: (currentEmployee as any)?.location || "HQ Operations",
            },
            attendance: { workingDays: 22, presentDays: 22, absentDays: 0, leaveDays: 0 },
            financials: {
              basicSalary: line.basicSalary || Math.round(line.gross * 0.5),
              hra: line.hra || Math.round(line.gross * 0.25),
              specialAllowance: line.specialAllowance || Math.round(line.gross * 0.25),
              bonus: line.bonus || 0,
              allowancesTotal: (line.hra || 0) + (line.specialAllowance || 0),
              grossSalary: line.gross + (line.bonus || 0),
              providentFund: line.providentFund || 1800,
              professionalTax: line.professionalTax || 200,
              incomeTax: line.incomeTax || 0,
              deductionsTotal: line.deductions,
              netSalary: line.net,
            },
            lines: { earnings: [], deductions: [] },
          } as DynamicPayslipItem;
        })
        .filter((s): s is DynamicPayslipItem => Boolean(s));

      setDynamicSlips(fallback);
    } finally {
      setLoadingSlips(false);
    }
  }, [target, currentEmployee, payroll]);

  useEffect(() => {
    fetchPayslips();
  }, [fetchPayslips]);

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;
  const totalPages = Math.ceil(dynamicSlips.length / PAGE_SIZE) || 1;
  const paginatedSlips = dynamicSlips.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalYtdPaid = dynamicSlips.reduce((sum, s) => sum + s.financials.netSalary, 0);
  const avgMonthlyNet = dynamicSlips.length > 0 ? Math.round(totalYtdPaid / dynamicSlips.length) : 0;

  const handleGenerate = async () => {
    setIsGenerating(true);
    toast.info("Generating latest pay cycle statement...");
    try {
      await generatePayslips(target);
      await fetchPayslips();
      toast.success("Payslip generated and published successfully");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate payslip";
      toast.error(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const toExportData = (s: DynamicPayslipItem): PayslipExportData => ({
    employeeName: s.employee.name,
    employeeCode: s.employee.code,
    department: s.employee.department,
    designation: s.employee.designation,
    bankAccount: s.employee.bankAccount,
    bankName: s.employee.bankName,
    bankIfsc: s.employee.bankIfsc,
    pan: s.employee.pan,
    period: s.period,
    payDate: s.payDate || undefined,
    workingDays: s.attendance.workingDays,
    presentDays: s.attendance.presentDays,
    absentDays: s.attendance.absentDays,
    leaveDays: s.attendance.leaveDays,
    basic: s.financials.basicSalary,
    hra: s.financials.hra,
    specialAllowance: s.financials.specialAllowance,
    bonus: s.financials.bonus,
    gross: s.financials.grossSalary,
    pf: s.financials.providentFund,
    pt: s.financials.professionalTax,
    tds: s.financials.incomeTax,
    deductions: s.financials.deductionsTotal,
    net: s.financials.netSalary,
  });

  return (
    <>
      <PageHeader
        title="Payslips & Pay Statements"
        description="Official published compensation statements from processed payroll runs."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isGenerating}
              onClick={handleGenerate}
            >
              <RefreshCw className={`size-3.5 mr-1.5 ${isGenerating ? "animate-spin" : ""}`} /> Generate Payslip
            </Button>
            {canSwitch && (
              <Select
                value={who}
                onValueChange={(val) => {
                  setWho(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-60 h-9 text-xs">
                  <SelectValue placeholder="Select Employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id} className="text-xs">
                      {e.name} ({e.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Net Received (YTD)"
          value={inr(totalYtdPaid)}
          hint={`${dynamicSlips.length} Published Cycle(s)`}
          tone="success"
        />
        <StatCard
          label="Average Monthly Net"
          value={inr(avgMonthlyNet)}
          hint="Post-deduction take home"
          tone="default"
        />
        <StatCard
          label="Annual CTC Snapshot"
          value={inr(currentEmployee?.ctc || 600000)}
          hint={currentEmployee?.name || "Active Employee"}
          tone="accent"
        />
      </div>

      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              {currentEmployee?.name || "Employee"} — Statement History
            </CardTitle>
            <CardDescription className="text-xs">
              {currentEmployee?.code} · {currentEmployee?.designation} · {currentEmployee?.department} · Bank: {currentEmployee?.bankAccount || "Verified"}
            </CardDescription>
          </div>
          {dynamicSlips.length > 0 && (
            <TablePagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={dynamicSlips.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loadingSlips ? (
            <div className="p-6">
              <TableSkeleton rows={4} />
            </div>
          ) : dynamicSlips.length === 0 ? (
            <EmptyState
              icon={<Receipt className="size-6" />}
              title="No payslips generated yet"
              description="No published payslips found for this employee. Click 'Generate Payslip' above to compute compensation."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pay Period</TableHead>
                    <TableHead>Pay Date</TableHead>
                    <TableHead className="text-right">Gross Earnings</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net Disbursed</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSlips.map((slip) => (
                    <TableRow key={slip.id} className="hover:bg-muted/40">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Calendar className="size-4 text-muted-foreground" />
                          <span>{slip.period}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {slip.payDate || `${slip.period}-01`}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {inr(slip.financials.grossSalary)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">
                        - {inr(slip.financials.deductionsTotal)}
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums text-primary text-base">
                        {inr(slip.financials.netSalary)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={
                            slip.status === "paid" || slip.paymentStatus === "paid"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }
                        >
                          {slip.status === "paid" ? "Paid" : "Approved"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs gap-1.5"
                            onClick={() => setActiveSlip(slip)}
                          >
                            <Eye className="size-3.5" /> View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5 border-primary/30 hover:bg-primary/5 hover:text-primary"
                            onClick={() => downloadPayslipPDF(toExportData(slip))}
                          >
                            <Download className="size-3.5" /> PDF
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payslip View / Statement Modal */}
      <Dialog open={Boolean(activeSlip)} onOpenChange={(open) => !open && setActiveSlip(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold font-display">
                  Payslip Statement · {activeSlip?.period}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Official Statement of Salary & Statutory Deductions
                </DialogDescription>
              </div>
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold px-2.5 py-0.5"
              >
                Disbursed
              </Badge>
            </div>
          </DialogHeader>

          {activeSlip && (
            <div className="space-y-4 pt-1">
              {/* Employee Summary Card */}
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/80 bg-muted/40 p-3.5 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px] uppercase font-semibold">Employee Details</span>
                  <p className="font-bold text-sm text-foreground mt-0.5">{activeSlip.employee.name}</p>
                  <p className="text-muted-foreground">{activeSlip.employee.code} · {activeSlip.employee.designation}</p>
                  <p className="text-muted-foreground">{activeSlip.employee.department} · {activeSlip.employee.location}</p>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px] uppercase font-semibold">Banking & Compliance</span>
                  <p className="font-medium text-foreground mt-0.5">A/C: {activeSlip.employee.bankAccount}</p>
                  <p className="text-muted-foreground">{activeSlip.employee.bankName} · IFSC: {activeSlip.employee.bankIfsc}</p>
                  <p className="text-muted-foreground">PAN: {activeSlip.employee.pan}</p>
                </div>
              </div>

              {/* Attendance Statistics Strip */}
              <div className="grid grid-cols-4 gap-2 rounded-lg bg-slate-100 dark:bg-slate-900/50 p-2.5 text-center text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Working Days</span>
                  <span className="font-bold text-sm">{activeSlip.attendance.workingDays}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Present Days</span>
                  <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">{activeSlip.attendance.presentDays}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Paid Leaves</span>
                  <span className="font-bold text-sm">{activeSlip.attendance.leaveDays}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Absent / LOP</span>
                  <span className="font-bold text-sm text-destructive">{activeSlip.attendance.absentDays}</span>
                </div>
              </div>

              {/* Earnings & Deductions Tables Side-by-Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Earnings Table */}
                <div className="rounded-lg border border-border/80 overflow-hidden">
                  <div className="bg-muted/70 px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground flex justify-between">
                    <span>Earnings Component</span>
                    <span>Amount</span>
                  </div>
                  <div className="p-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Basic Salary</span>
                      <span className="font-medium tabular-nums">{inr(activeSlip.financials.basicSalary)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">House Rent Allowance (HRA)</span>
                      <span className="font-medium tabular-nums">{inr(activeSlip.financials.hra)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Special Allowance</span>
                      <span className="font-medium tabular-nums">{inr(activeSlip.financials.specialAllowance)}</span>
                    </div>
                    {activeSlip.financials.bonus > 0 && (
                      <div className="flex justify-between text-emerald-600 font-medium">
                        <span>Performance Bonus</span>
                        <span className="tabular-nums">{inr(activeSlip.financials.bonus)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t font-bold text-foreground">
                      <span>Total Gross Earnings</span>
                      <span className="tabular-nums">{inr(activeSlip.financials.grossSalary)}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions Table */}
                <div className="rounded-lg border border-border/80 overflow-hidden">
                  <div className="bg-muted/70 px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground flex justify-between">
                    <span>Deductions Component</span>
                    <span>Amount</span>
                  </div>
                  <div className="p-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Provident Fund (PF)</span>
                      <span className="font-medium tabular-nums text-destructive">- {inr(activeSlip.financials.providentFund)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Professional Tax (PT)</span>
                      <span className="font-medium tabular-nums text-destructive">- {inr(activeSlip.financials.professionalTax)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax Deducted at Source (TDS)</span>
                      <span className="font-medium tabular-nums text-destructive">- {inr(activeSlip.financials.incomeTax)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t font-bold text-destructive">
                      <span>Total Deductions</span>
                      <span className="tabular-nums">- {inr(activeSlip.financials.deductionsTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Disbursed Card */}
              <div className="flex items-center justify-between rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 p-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wide text-blue-800 dark:text-blue-300">
                    Net Salary Disbursed (Take-Home)
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Direct Credit to {activeSlip.employee.bankName} A/C {activeSlip.employee.bankAccount}
                  </p>
                </div>
                <div className="text-2xl font-bold font-display text-blue-900 dark:text-blue-200 tabular-nums">
                  {inr(activeSlip.financials.netSalary)}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => printPayslip(toExportData(activeSlip))}
                  className="gap-1.5"
                >
                  <Printer className="size-4" /> Print
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => emailPayslipToEmployee(toExportData(activeSlip), activeSlip.employee.id)}
                  className="gap-1.5"
                >
                  <Mail className="size-4" /> Email Statement
                </Button>
                <Button
                  size="sm"
                  onClick={() => downloadPayslipPDF(toExportData(activeSlip))}
                  className="gap-1.5 font-medium"
                >
                  <Download className="size-4" /> Download Official PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
