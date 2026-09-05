import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, PageHeader, StatCard, TableSkeleton } from "@/components/bits";
import { useApp, useDelayed } from "@/lib/store";
import { inr } from "@/lib/mock-data";

export const Route = createFileRoute("/app/payslips")({
  head: () => ({
    meta: [
      { title: "Payslips · PeoplePay360" },
      { name: "description", content: "View and download published payslips for every paid cycle." },
      { property: "og:title", content: "Payslips · PeoplePay360" },
      { property: "og:description", content: "View and download published payslips for every paid cycle." },
    ],
  }),
  component: Payslips,
});

function Payslips() {
  const { payroll, persona, employees, role } = useApp();
  const ready = useDelayed();
  const [who, setWho] = useState(persona.employeeId);
  const [openSlip, setOpenSlip] = useState<string | null>(null);
  const canSwitch = role === "hr_user" || role === "payroll_manager" || role === "payroll_user" || role === "admin";
  const target = canSwitch ? who : persona.employeeId;
  const employee = employees.find((e) => e.id === target);

  const slips = payroll
    .filter((r) => r.status === "paid")
    .map((r) => ({ run: r, line: r.lines.find((l) => l.employeeId === target) }))
    .filter((s) => s.line);

  const ytd = slips.reduce((s, x) => s + (x.line?.net ?? 0), 0);
  const active = slips.find((s) => s.run.id === openSlip);

  return (
    <>
      <PageHeader
        title="Payslips"
        description="Published slips from completed payroll cycles."
        actions={
          canSwitch ? (
            <Select value={who} onValueChange={setWho}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Net paid (in workspace)" value={inr(ytd)} tone="success" />
        <StatCard label="Monthly gross" value={inr(Math.round((employee?.ctc ?? 0) / 12))} hint={employee?.name} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{employee?.name ?? "Employee"}</CardTitle>
          <CardDescription>{employee?.designation} · {employee?.department}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!ready ? (
            <div className="p-4"><TableSkeleton rows={3} /></div>
          ) : slips.length === 0 ? (
            <EmptyState
              icon={<Receipt className="size-5" />}
              title="No payslips yet"
              description="Slips appear here once a payroll run is released."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Slip</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slips.map(({ run, line }) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium">{run.period}</TableCell>
                      <TableCell className="text-right tabular-nums">{inr(line!.gross + line!.bonus)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{inr(line!.deductions)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{inr(line!.net)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setOpenSlip(run.id)}>View</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!active} onOpenChange={(o) => !o && setOpenSlip(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Payslip · {active?.run.period}</DialogTitle>
          </DialogHeader>
          {active?.line && employee ? (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg bg-muted p-4">
                <p className="font-medium">{employee.name}</p>
                <p className="text-xs text-muted-foreground">
                  {employee.code} · {employee.designation} · {employee.department}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Credited to {employee.bankAccount}</p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5 rounded border border-border/50 p-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Earnings</p>
                  {active.line.basicSalary ? (
                    <>
                      <Line k="Basic Salary" v={inr(active.line.basicSalary)} />
                      <Line k="House Rent Allowance (HRA)" v={inr(active.line.hra ?? 0)} />
                      <Line k="Special Allowance" v={inr(active.line.specialAllowance ?? 0)} />
                    </>
                  ) : (
                    <Line k="Base Gross Salary" v={inr(active.line.gross)} />
                  )}
                  {active.line.bonus > 0 && <Line k="Performance Bonus / Incentive" v={inr(active.line.bonus)} />}
                  <div className="flex justify-between border-t border-border/40 pt-1 text-xs font-medium">
                    <span>Total Gross Earnings</span>
                    <span>{inr(active.line.gross + active.line.bonus)}</span>
                  </div>
                </div>

                <div className="space-y-1.5 rounded border border-border/50 p-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deductions</p>
                  {active.line.providentFund ? (
                    <>
                      <Line k="Provident Fund (Employee PF)" v={`- ${inr(active.line.providentFund)}`} />
                      <Line k="Professional Tax (PT)" v={`- ${inr(active.line.professionalTax ?? 0)}`} />
                      <Line k="Income Tax (TDS)" v={`- ${inr(active.line.incomeTax ?? 0)}`} />
                    </>
                  ) : (
                    <Line k="Tax & Statutory Deductions" v={`- ${inr(active.line.deductions)}`} />
                  )}
                  <div className="flex justify-between border-t border-border/40 pt-1 text-xs font-medium text-destructive">
                    <span>Total Deductions</span>
                    <span>- {inr(active.line.deductions)}</span>
                  </div>
                </div>

                <div className="flex justify-between rounded-lg bg-primary/10 p-3 font-semibold text-primary">
                  <span>Net Disbursed Amount</span>
                  <span className="text-base tabular-nums">{inr(active.line.net)}</span>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => toast.success("Payslip downloaded", { description: `${active.run.period} · demo PDF` })}
              >
                <Download className="mr-2 size-4" /> Download PDF
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}
