import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  Plus,
  Search,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import type { LeaveRequest, LeaveType } from "@/lib/mock-data";

export const Route = createFileRoute("/app/leave")({
  head: () => ({
    meta: [
      { title: "Time Off · PeoplePay360" },
      { name: "description", content: "Apply for leaves, view balances, track approval status, and manage team time off." },
      { property: "og:title", content: "Time Off · PeoplePay360" },
    ],
  }),
  component: LeavePage,
});

const dayCount = (from: string, to: string) => {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
};

function LeavePage() {
  const { leave, update, log, persona, role, employees, patchEmployee } = useApp();
  const nameOf = useEmployeeName();
  const ready = useDelayed();

  const isApprover = role === "hr_manager" || role === "admin" || role === "payroll_manager" || role === "payroll_user";
  const isEmployeeOnly = role === "employee";
  const me = employees.find((e) => e.id === persona.employeeId);

  const [open, setOpen] = useState(false);
  const [viewReq, setViewReq] = useState<LeaveRequest | null>(null);
  const [form, setForm] = useState({
    type: "Casual" as LeaveType,
    from: "",
    to: "",
    reason: "",
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Summary Metrics
  const myAvailableLeave = me ? me.leaveBalance : 14;
  const myLeaves = leave.filter((l) => l.employeeId === persona.employeeId);
  const myUsedLeave = myLeaves
    .filter((l) => l.status === "approved" && l.type !== "Unpaid")
    .reduce((s, l) => s + l.days, 0);

  const pendingRequests = leave.filter((l) => l.status === "pending");
  const approvedRequests = leave.filter((l) => l.status === "approved");
  const rejectedRequests = leave.filter((l) => l.status === "rejected");

  const rows = useMemo(() => {
    return leave.filter((l) => {
      if (isEmployeeOnly && l.employeeId !== persona.employeeId) return false;

      const empName = nameOf(l.employeeId).toLowerCase();
      const matchQ =
        l.id.toLowerCase().includes(q.toLowerCase()) ||
        empName.includes(q.toLowerCase()) ||
        l.reason.toLowerCase().includes(q.toLowerCase());
      const matchType = typeFilter === "all" || l.type === typeFilter;
      const matchStatus = statusFilter === "all" || l.status === statusFilter;
      return matchQ && matchType && matchStatus;
    });
  }, [leave, isEmployeeOnly, persona.employeeId, q, typeFilter, statusFilter, nameOf]);

  const decide = (id: string, status: "approved" | "rejected") => {
    const req = leave.find((l) => l.id === id);
    update(
      "leave",
      leave.map((l) => (l.id === id ? { ...l, status } : l)),
    );

    if (req && status === "approved") {
      const emp = employees.find((e) => e.id === req.employeeId);
      if (emp && req.type !== "Unpaid") {
        patchEmployee(emp.id, { leaveBalance: Math.max(0, emp.leaveBalance - req.days) });
      }
    }

    log(`${status === "approved" ? "Approved" : "Rejected"} leave ${id}`, "Time Off");
    toast[status === "approved" ? "success" : "error"](
      `Leave request ${status}`,
      { description: req ? `${nameOf(req.employeeId)} · ${req.days} day(s)` : undefined },
    );
    if (viewReq?.id === id) setViewReq(null);
  };

  const handleCancelRequest = (id: string) => {
    update(
      "leave",
      leave.map((l) => (l.id === id ? { ...l, status: "cancelled" } : l)),
    );
    log(`Cancelled leave request ${id}`, "Time Off");
    toast.success("Leave request cancelled");
    if (viewReq?.id === id) setViewReq(null);
  };

  const apply = () => {
    const next: Record<string, string | undefined> = {};
    if (!form.from) next["from"] = "Start date is required.";
    if (!form.to) next["to"] = "End date is required.";
    const days = dayCount(form.from, form.to);
    if (form.from && form.to && days === 0) next["to"] = "End date must be on or after start date.";
    if (form.reason.trim().length < 5) next["reason"] = "Give a short reason (5+ characters).";
    if (me && form.type !== "Unpaid" && days > me.leaveBalance) {
      next["type"] = `Only ${me.leaveBalance} paid days available — choose Unpaid Leave if needed.`;
    }
    setErrors(next);
    if (Object.values(next).some(Boolean)) {
      toast.error("Please fix highlighted fields");
      return;
    }

    const req: LeaveRequest = {
      id: `LV-${510 + leave.length}`,
      employeeId: persona.employeeId,
      type: form.type,
      from: form.from,
      to: form.to,
      days,
      reason: form.reason.trim(),
      status: "pending",
      submittedAt: new Date().toISOString().slice(0, 10),
    };

    update("leave", [req, ...leave]);
    log(`Applied for ${days} day(s) of ${form.type} leave`, "Time Off");
    toast.success("Leave request submitted", { description: "Your manager and HR have been notified." });

    setForm({ type: "Casual", from: "", to: "", reason: "" });
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        title="Time Off Management"
        description="Leave request submissions, approval pipelines, balance accrual tracking, and team holiday schedules."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 size-4" /> Request leave
          </Button>
        }
      />

      {/* 5 Required Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Available Leave"
          value={`${myAvailableLeave} Days`}
          hint="Your remaining paid balance"
          icon={<CalendarDays className="size-5" />}
          tone="accent"
        />
        <StatCard
          label="Used Leave"
          value={`${myUsedLeave} Days`}
          hint="Approved leaves this calendar year"
          icon={<Clock className="size-5" />}
          tone="default"
        />
        <StatCard
          label="Pending Requests"
          value={pendingRequests.length}
          hint={isEmployeeOnly ? "Your pending applications" : "Awaiting team approval"}
          icon={<AlertCircle className="size-5" />}
          tone="warning"
        />
        <StatCard
          label="Approved Requests"
          value={approvedRequests.length}
          hint="Sanctioned leave cycles"
          icon={<CheckCircle2 className="size-5" />}
          tone="success"
        />
        <StatCard
          label="Rejected Requests"
          value={rejectedRequests.length}
          hint="Declined by management"
          icon={<XCircle className="size-5" />}
          tone="default"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Leave Requests Log</CardTitle>
              <CardDescription>
                {isEmployeeOnly ? "Your personal leave history" : "All departmental leave applications"}
              </CardDescription>
            </div>
          </div>

          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search employee or reason..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Leave Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leave Types</SelectItem>
                <SelectItem value="Casual">Casual Leave</SelectItem>
                <SelectItem value="Sick">Sick Leave</SelectItem>
                <SelectItem value="Earned">Earned Leave</SelectItem>
                <SelectItem value="Maternity">Maternity Leave</SelectItem>
                <SelectItem value="Paternity">Paternity Leave</SelectItem>
                <SelectItem value="Unpaid">Unpaid Leave</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {!ready ? (
            <div className="p-4">
              <TableSkeleton rows={5} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="No leave requests found"
              description="No applications match your selected filters."
              icon={<CalendarDays className="size-8" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request ID</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead className="text-right">Number of Days</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Submitted Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs font-semibold text-primary">
                        {l.id}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{nameOf(l.employeeId)}</div>
                        <div className="text-xs text-muted-foreground">{l.employeeId}</div>
                      </TableCell>
                      <TableCell>{l.type} Leave</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.from}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.to}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {l.days} {l.days === 1 ? "day" : "days"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {l.reason}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {l.submittedAt ?? l.from}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={l.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => setViewReq(l)}
                            title="View details"
                          >
                            <Eye className="size-3.5" />
                          </Button>

                          {isApprover && l.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-success hover:text-success"
                                onClick={() => decide(l.id, "approved")}
                                title="Approve"
                              >
                                <Check className="size-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-destructive hover:text-destructive"
                                onClick={() => decide(l.id, "rejected")}
                                title="Reject"
                              >
                                <X className="size-3.5" />
                              </Button>
                            </>
                          )}

                          {l.status === "pending" && l.employeeId === persona.employeeId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-destructive"
                              onClick={() => handleCancelRequest(l.id)}
                              title="Cancel request"
                            >
                              Cancel
                            </Button>
                          )}
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

      {/* Request Leave Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Time Off</DialogTitle>
            <DialogDescription>
              Submit dates for managerial review. You have {myAvailableLeave} paid days remaining.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Field label="Leave Type" error={errors["type"]}>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as LeaveType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Casual">Casual Leave</SelectItem>
                  <SelectItem value="Sick">Sick Leave</SelectItem>
                  <SelectItem value="Earned">Earned Leave</SelectItem>
                  <SelectItem value="Maternity">Maternity Leave</SelectItem>
                  <SelectItem value="Paternity">Paternity Leave</SelectItem>
                  <SelectItem value="Unpaid">Unpaid Leave</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="From" error={errors["from"]}>
                <Input
                  type="date"
                  value={form.from}
                  onChange={(e) => setForm({ ...form, from: e.target.value })}
                />
              </Field>
              <Field label="To" error={errors["to"]}>
                <Input
                  type="date"
                  value={form.to}
                  onChange={(e) => setForm({ ...form, to: e.target.value })}
                />
              </Field>
            </div>

            {form.from && form.to && dayCount(form.from, form.to) > 0 && (
              <p className="text-xs text-muted-foreground">
                Total duration: <span className="font-semibold text-foreground">{dayCount(form.from, form.to)} calendar day(s)</span>
              </p>
            )}

            <Field label="Reason" error={errors["reason"]}>
              <Textarea
                rows={3}
                placeholder="Describe reason for leave..."
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={apply}>Submit Application</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Leave Request Modal */}
      {viewReq && (
        <Dialog open={!!viewReq} onOpenChange={(o) => !o && setViewReq(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>{viewReq.type} Leave Application</DialogTitle>
                <StatusBadge status={viewReq.status} />
              </div>
              <DialogDescription>
                Submitted by {nameOf(viewReq.employeeId)} ({viewReq.id})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-sm">
              <div className="rounded-lg border border-border bg-muted/40 p-3.5 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="font-medium">
                    {viewReq.from} → {viewReq.to} ({viewReq.days} days)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Leave Category:</span>
                  <span className="font-medium">{viewReq.type} Leave</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Reason for Absence
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {viewReq.reason}
                </p>
              </div>

              {isApprover && viewReq.status === "pending" && (
                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1 bg-success text-success-foreground hover:bg-success/90"
                    onClick={() => decide(viewReq.id, "approved")}
                  >
                    Approve Request
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => decide(viewReq.id, "rejected")}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setViewReq(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
