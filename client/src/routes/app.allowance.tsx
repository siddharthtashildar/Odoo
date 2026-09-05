import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  Download,
  Edit,
  Eye,
  HandCoins,
  Plus,
  Search,
  Wallet,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Field, PageHeader, StatCard, StatusBadge, TableSkeleton } from "@/components/bits";
import { useApp, useDelayed, useEmployeeName } from "@/lib/store";
import { inr, type AllowanceRecord, type AllowanceType } from "@/lib/mock-data";

export const Route = createFileRoute("/app/allowance")({
  head: () => ({
    meta: [
      { title: "Allowances · PeoplePay360" },
      { name: "description", content: "Monthly recurring allowances, subsidies, approvals and tax deductions." },
      { property: "og:title", content: "Allowances · PeoplePay360" },
    ],
  }),
  component: AllowancePage,
});

const emptyAllowance = {
  employeeId: "",
  type: "House Rent Allowance" as AllowanceType,
  amount: "",
  effectiveDate: new Date().toISOString().slice(0, 10),
  expiryDate: "2027-12-31",
  notes: "",
};

function AllowancePage() {
  const { allowances, employees, addAllowance, updateAllowance, log, role, persona } = useApp();
  const nameOf = useEmployeeName();
  const ready = useDelayed();

  const [q, setQ] = useState("");
  const [empFilter, setEmpFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [addOpen, setAddOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState<AllowanceRecord | null>(null);

  const [form, setForm] = useState(emptyAllowance);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const canManage = role === "hr_manager" || role === "payroll_manager" || role === "payroll_user" || role === "admin" || role === "hr_user";
  const isEmployeeOnly = role === "employee";

  const me = employees.find(
    (e) =>
      e.id === persona.employeeId ||
      e.code === persona.employeeCode ||
      (persona.email && e.email.toLowerCase() === persona.email.toLowerCase()),
  );
  const myId = me?.id || persona.employeeId;
  const myCode = me?.code || persona.employeeCode;

  // Summaries
  const myAllowances = allowances.filter((a) => a.employeeId === myId || (myCode && a.employeeId === myCode));
  const activeAllowances = isEmployeeOnly
    ? myAllowances.filter((a) => a.status === "approved")
    : allowances.filter((a) => a.status === "approved");
  const totalMonthlySpend = activeAllowances.reduce((s, a) => s + a.amount, 0);
  const pendingCount = isEmployeeOnly
    ? myAllowances.filter((a) => a.status === "pending").length
    : allowances.filter((a) => a.status === "pending").length;

  const rows = useMemo(() => {
    return allowances.filter((a) => {
      if (isEmployeeOnly) {
        const isMine = a.employeeId === myId || (myCode && a.employeeId === myCode);
        if (!isMine) return false;
      }

      const emp = employees.find((e) => e.id === a.employeeId || e.code === a.employeeId);
      const empName = emp ? emp.name.toLowerCase() : "";
      const matchQ =
        a.id.toLowerCase().includes(q.toLowerCase()) ||
        empName.includes(q.toLowerCase()) ||
        a.type.toLowerCase().includes(q.toLowerCase());
      const matchEmp = empFilter === "all" || a.employeeId === empFilter;
      const matchType = typeFilter === "all" || a.type === typeFilter;
      const matchStatus = statusFilter === "all" || a.status === statusFilter;
      return matchQ && matchEmp && matchType && matchStatus;
    });
  }, [allowances, isEmployeeOnly, myId, myCode, q, empFilter, typeFilter, statusFilter, employees]);

  const handleSave = () => {
    const next: Record<string, string | undefined> = {};
    if (!form.employeeId) next["employeeId"] = "Select an employee.";
    if (!form.amount || Number(form.amount) <= 0) next["amount"] = "Enter monthly amount.";
    if (!form.effectiveDate) next["effectiveDate"] = "Effective date is required.";
    setErrors(next);
    if (Object.keys(next).length) return;

    const newRecord: AllowanceRecord = {
      id: `ALW-${Date.now().toString().slice(-4)}`,
      employeeId: form.employeeId,
      type: form.type,
      amount: Number(form.amount),
      effectiveDate: form.effectiveDate,
      expiryDate: form.expiryDate || "2027-12-31",
      status: canManage ? "approved" : "pending",
      notes: form.notes || undefined,
    };

    addAllowance(newRecord);
    log(`Configured ${newRecord.type} for ${nameOf(form.employeeId)}: ${inr(newRecord.amount)}/mo`, "Allowances");
    toast.success("Allowance record added", {
      description: `${newRecord.type} · ${inr(newRecord.amount)}/month`,
    });
    setAddOpen(false);
    setForm(emptyAllowance);
  };

  const handleStatusChange = (id: string, status: AllowanceRecord["status"]) => {
    updateAllowance(id, { status });
    log(`Updated allowance ${id} status to ${status}`, "Allowances");
    toast.success(`Allowance ${status}`);
    if (viewRecord?.id === id) {
      setViewRecord({ ...viewRecord, status });
    }
  };

  const handleExport = () => {
    toast.success("Exporting Allowance Registry as CSV", {
      description: `${rows.length} records exported for payroll run.`,
    });
  };

  return (
    <>
      <PageHeader
        title={isEmployeeOnly ? "My Allowances" : "Allowances"}
        description={
          isEmployeeOnly
            ? `Recurring monthly components, subsidies, and perks allocated to ${me?.name || persona.name}`
            : "Structured recurring allowances: House Rent Allowance, travel perks, connectivity subsidies, and performance components."
        }
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 size-4" /> Export
            </Button>
            <Button
              onClick={() => {
                if (isEmployeeOnly) setForm({ ...emptyAllowance, employeeId: myId });
                setAddOpen(true);
              }}
            >
              <Plus className="mr-2 size-4" /> Add allowance
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={isEmployeeOnly ? "My Active Components" : "Total Active Allowances"}
          value={activeAllowances.length}
          hint={isEmployeeOnly ? "Active recurring benefits" : `${allowances.length} registered on file`}
          icon={<HandCoins className="size-5" />}
          tone="default"
        />
        <StatCard
          label={isEmployeeOnly ? "My Monthly Allowance" : "Monthly Disbursal"}
          value={inr(totalMonthlySpend)}
          hint={isEmployeeOnly ? "Combined recurring credit" : "Disbursed across all active components"}
          icon={<Wallet className="size-5" />}
          tone="accent"
        />
        <StatCard
          label="Pending Approvals"
          value={pendingCount}
          hint={isEmployeeOnly ? "Your claims awaiting review" : "Awaiting HR / Payroll verification"}
          icon={<Clock className="size-5" />}
          tone="warning"
        />
        <StatCard
          label="Primary Component"
          value={activeAllowances[0]?.type ? activeAllowances[0].type.split(" ")[0] : "HRA"}
          hint={activeAllowances[0] ? inr(activeAllowances[0].amount) : "Standard benefit"}
          icon={<CheckCircle2 className="size-5" />}
          tone="success"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Employee Allowance Directory</CardTitle>
              <CardDescription>
                {isEmployeeOnly ? "Your active monthly allowances" : "Recurring departmental benefits"}
              </CardDescription>
            </div>
          </div>

          <div className="mt-2 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search allowance..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>

            {!isEmployeeOnly && (
              <Select value={empFilter} onValueChange={setEmpFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Allowance Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="House Rent Allowance">House Rent Allowance</SelectItem>
                <SelectItem value="Travel Allowance">Travel Allowance</SelectItem>
                <SelectItem value="Internet Allowance">Internet Allowance</SelectItem>
                <SelectItem value="Meal Allowance">Meal Allowance</SelectItem>
                <SelectItem value="Performance Allowance">Performance Allowance</SelectItem>
                <SelectItem value="Special Allowance">Special Allowance</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
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
              title="No allowances found"
              description="No records match your selected filters."
              icon={<HandCoins className="size-8" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Allowance ID</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Allowance Type</TableHead>
                    <TableHead className="text-right">Monthly Amount</TableHead>
                    <TableHead>Effective Date</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs font-semibold text-primary">
                        {a.id}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{nameOf(a.employeeId)}</div>
                        <div className="text-xs text-muted-foreground">{a.employeeId}</div>
                      </TableCell>
                      <TableCell>{a.type}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {inr(a.amount)}/mo
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.effectiveDate}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.expiryDate}</TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => setViewRecord(a)}
                            title="View details"
                          >
                            <Eye className="size-3.5" />
                          </Button>

                          {canManage && a.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-success hover:text-success"
                                onClick={() => handleStatusChange(a.id, "approved")}
                                title="Approve"
                              >
                                <CheckCircle2 className="size-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-destructive hover:text-destructive"
                                onClick={() => handleStatusChange(a.id, "rejected")}
                                title="Reject"
                              >
                                <XCircle className="size-3.5" />
                              </Button>
                            </>
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

      {/* Add Allowance Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Employee Allowance</DialogTitle>
            <DialogDescription>
              Assign a monthly benefit or reimbursement allowance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Field label="Employee" error={errors["employeeId"]}>
              <Select
                value={form.employeeId}
                onValueChange={(v) => setForm({ ...form, employeeId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} ({e.department})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Allowance Type">
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as AllowanceType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="House Rent Allowance">House Rent Allowance</SelectItem>
                  <SelectItem value="Travel Allowance">Travel Allowance</SelectItem>
                  <SelectItem value="Internet Allowance">Internet Allowance</SelectItem>
                  <SelectItem value="Meal Allowance">Meal Allowance</SelectItem>
                  <SelectItem value="Performance Allowance">Performance Allowance</SelectItem>
                  <SelectItem value="Special Allowance">Special Allowance</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Monthly Amount (₹)" error={errors["amount"]}>
              <Input
                type="number"
                placeholder="e.g. 15000"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Effective From" error={errors["effectiveDate"]}>
                <Input
                  type="date"
                  value={form.effectiveDate}
                  onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
                />
              </Field>
              <Field label="Expires On">
                <Input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Notes / Policy Reference">
              <Input
                placeholder="e.g. Remote work tier-1 stipend"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Assign Allowance</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Allowance Modal */}
      {viewRecord && (
        <Dialog open={!!viewRecord} onOpenChange={(o) => !o && setViewRecord(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>{viewRecord.type}</DialogTitle>
                <StatusBadge status={viewRecord.status} />
              </div>
              <DialogDescription>
                Allocated to {nameOf(viewRecord.employeeId)} ({viewRecord.id})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-sm">
              <div className="rounded-lg border border-border bg-muted/40 p-3.5 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly Amount:</span>
                  <span className="font-semibold text-primary">{inr(viewRecord.amount)}/month</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Annual Equivalent:</span>
                  <span className="font-medium">{inr(viewRecord.amount * 12)}/year</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Effective: {viewRecord.effectiveDate}</span>
                  <span>Expires: {viewRecord.expiryDate}</span>
                </div>
              </div>

              {viewRecord.notes && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Notes & Statutory Tags
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{viewRecord.notes}</p>
                </div>
              )}

              {canManage && viewRecord.status === "pending" && (
                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1 bg-success text-success-foreground hover:bg-success/90"
                    onClick={() => handleStatusChange(viewRecord.id, "approved")}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => handleStatusChange(viewRecord.id, "rejected")}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setViewRecord(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
