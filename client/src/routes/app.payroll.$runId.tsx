import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, SendHorizonal, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState, PageHeader, StatCard, StatusBadge, TablePagination } from "@/components/bits";
import { useApp, useEmployeeName } from "@/lib/store";
import { inr } from "@/lib/mock-data";

export const Route = createFileRoute("/app/payroll/$runId")({
  head: () => ({
    meta: [
      { title: "Payroll run · PeoplePay360" },
      { name: "description", content: "Line-by-line review of a payroll cycle with approval and payout controls." },
      { property: "og:title", content: "Payroll run · PeoplePay360" },
      { property: "og:description", content: "Line-by-line review of a payroll cycle with approval and payout controls." },
    ],
  }),
  component: PayrollDetail,
});

function PayrollDetail() {
  const { runId } = useParams({ from: "/app/payroll/$runId" });
  const { payroll, update, log, role, persona } = useApp();
  const nameOf = useEmployeeName();
  const run = payroll.find((r) => r.id === runId);
  const [confirm, setConfirm] = useState<null | "approve" | "pay">(null);

  if (!run) {
    return (
      <EmptyState
        title="Payroll run not found"
        description="It may have been removed from this demo workspace."
        action={<Button asChild variant="outline"><Link to="/app/payroll">Back to runs</Link></Button>}
      />
    );
  }

  const canEditLines = (role === "payroll_manager" || role === "admin") && run.status === "draft";
  const canApprove = (role === "payroll_manager" || role === "admin") && run.status === "pending_approval";
  const canPay = (role === "payroll_manager" || role === "admin") && run.status === "approved";

  const gross = run.lines.reduce((s, l) => s + l.gross + l.bonus, 0);
  const deductions = run.lines.reduce((s, l) => s + l.deductions, 0);
  const net = run.lines.reduce((s, l) => s + l.net, 0);

  const patchRun = (patch: Partial<typeof run>) =>
    update("payroll", payroll.map((r) => (r.id === run.id ? { ...r, ...patch } : r)));

  const setBonus = (employeeId: string, bonus: number) =>
    patchRun({
      lines: run.lines.map((l) =>
        l.employeeId === employeeId ? { ...l, bonus, net: l.gross + bonus - l.deductions } : l,
      ),
    });

  const submit = () => {
    patchRun({ status: "pending_approval" });
    log(`Submitted ${run.id} for approval`, "Payroll");
    toast.success("Sent for approval", { description: "A payroll manager can now review it." });
  };

  const approve = () => {
    patchRun({ status: "approved", approvedBy: persona.name });
    log(`Approved payroll run ${run.id}`, "Payroll");
    toast.success("Run approved", { description: `${inr(net)} ready for payout.` });
    setConfirm(null);
  };

  const pay = () => {
    patchRun({ status: "paid" });
    log(`Released payout for ${run.id}`, "Payroll");
    toast.success("Payout released", { description: `${run.lines.length} payslips published.` });
    setConfirm(null);
  };

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;
  const totalPages = Math.ceil(run.lines.length / PAGE_SIZE) || 1;
  const paginatedLines = run.lines.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to="/app/payroll"><ArrowLeft className="mr-2 size-4" /> Payroll runs</Link>
      </Button>

      <PageHeader
        title={run.period}
        description={`${run.id} · ${run.cycle} · prepared by ${run.createdBy}${run.approvedBy ? ` · approved by ${run.approvedBy}` : ""}`}
        actions={
          <>
            <StatusBadge status={run.status} />
            {canEditLines && (
              <Button onClick={submit}>
                <SendHorizonal className="mr-2 size-4" /> Submit for approval
              </Button>
            )}
            {canApprove && (
              <Button onClick={() => setConfirm("approve")}>
                <CheckCircle2 className="mr-2 size-4" /> Approve run
              </Button>
            )}
            {canPay && (
              <Button onClick={() => setConfirm("pay")}>
                <Wallet className="mr-2 size-4" /> Release payout
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Employees" value={run.lines.length} />
        <StatCard label="Gross" value={inr(gross)} />
        <StatCard label="Deductions" value={inr(deductions)} tone="warning" />
        <StatCard label="Net payable" value={inr(net)} tone="success" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run lines</CardTitle>
          <CardDescription>
            {canEditLines
              ? "Bonuses can be edited while the run is in draft."
              : "This run is locked — lines are read-only."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Pagination ON TOP of Staff Run Lines */}
          <TablePagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={run.lines.length}
            pageSize={5}
            onPageChange={setPage}
          />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Bonus</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Net pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLines.map((l) => (
                  <TableRow key={l.employeeId}>
                    <TableCell>
                      <Link to="/app/employees/$id" params={{ id: l.employeeId }} className="font-medium hover:underline">
                        {nameOf(l.employeeId)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{inr(l.gross)}</TableCell>
                    <TableCell className="text-right">
                      {canEditLines ? (
                        <Input
                          type="number"
                          value={l.bonus}
                          onChange={(e) => setBonus(l.employeeId, Math.max(0, Number(e.target.value)))}
                          className="ml-auto h-8 w-28 text-right"
                        />
                      ) : (
                        <span className="tabular-nums">{inr(l.bonus)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{inr(l.deductions)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{inr(l.net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <TablePagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={run.lines.length}
            pageSize={5}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "approve" ? "Approve this payroll run?" : "Release the payout?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "approve"
                ? `${run.lines.length} employees, ${inr(net)} net. Lines stay locked after approval.`
                : `${inr(net)} will be marked as disbursed and payslips published to employees.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirm === "approve" ? approve : pay}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
