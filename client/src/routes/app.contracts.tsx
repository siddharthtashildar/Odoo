import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileSignature,
  FileText,
  Filter,
  Pencil,
  Plus,
  RefreshCw,
  Search,
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
import { EmptyState, Field, PageHeader, StatCard, StatusBadge, TableSkeleton, TablePagination } from "@/components/bits";
import { useApp, useDelayed, useEmployeeName } from "@/lib/store";
import { inr, type Contract, type ContractStatus, type ContractType } from "@/lib/mock-data";

export const Route = createFileRoute("/app/contracts")({
  head: () => ({
    meta: [
      { title: "Contracts · PeoplePay360" },
      { name: "description", content: "Manage employee agreements, salary annexures, renewals and contract lifecycles." },
      { property: "og:title", content: "Contracts · PeoplePay360" },
    ],
  }),
  component: ContractsPage,
});

const emptyForm = {
  employeeId: "",
  contractType: "Full-time" as ContractType,
  startDate: "",
  endDate: "",
  salary: "",
  department: "Engineering",
  noticePeriodDays: "60",
  terms: "Standard full-time employment agreement with intellectual property assignment and mutual confidentiality covenants.",
};

function ContractsPage() {
  const { contracts, employees, addContract, updateContract, log, role } = useApp();
  const nameOf = useEmployeeName();
  const ready = useDelayed();

  const [q, setQ] = useState("");
  const [empFilter, setEmpFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [addOpen, setAddOpen] = useState(false);
  const [viewContract, setViewContract] = useState<Contract | null>(null);
  const [renewContract, setRenewContract] = useState<Contract | null>(null);
  const [newEndDate, setNewEndDate] = useState("");

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const canEdit = role === "hr_manager" || role === "admin" || role === "payroll_manager" || role === "payroll_user";

  const activeCount = contracts.filter((c) => c.status === "Active").length;
  const expiringCount = contracts.filter((c) => c.status === "Expiring Soon").length;
  const expiredCount = contracts.filter((c) => c.status === "Expired").length;
  const draftCount = contracts.filter((c) => c.status === "Draft").length;

  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    return contracts.filter((c) => {
      const empName = nameOf(c.employeeId).toLowerCase();
      const matchQ =
        c.id.toLowerCase().includes(q.toLowerCase()) ||
        empName.includes(q.toLowerCase()) ||
        c.department.toLowerCase().includes(q.toLowerCase());
      const matchEmp = empFilter === "all" || c.employeeId === empFilter;
      const matchType = typeFilter === "all" || c.contractType === typeFilter;
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      return matchQ && matchEmp && matchType && matchStatus;
    });
  }, [contracts, q, empFilter, typeFilter, statusFilter, nameOf]);

  const PAGE_SIZE = 5;
  const totalPages = Math.ceil(rows.length / PAGE_SIZE) || 1;
  const paginatedRows = useMemo(() => {
    return rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [rows, page]);

  const handleCreate = () => {
    const next: Record<string, string | undefined> = {};
    if (!form.employeeId) next["employeeId"] = "Select an employee.";
    if (!form.startDate) next["startDate"] = "Start date is required.";
    if (!form.endDate) next["endDate"] = "End date is required.";
    if (!form.salary || Number(form.salary) <= 0) next["salary"] = "Enter valid annual salary.";
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      next["endDate"] = "End date must be after start date.";
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    const emp = employees.find((e) => e.id === form.employeeId);
    const newContract: Contract = {
      id: `CT-${new Date().getFullYear()}-${contracts.length + 10}`,
      employeeId: form.employeeId,
      contractType: form.contractType,
      startDate: form.startDate,
      endDate: form.endDate,
      salary: Number(form.salary),
      department: emp?.department ?? form.department,
      status: "Active",
      terms: form.terms,
      noticePeriodDays: Number(form.noticePeriodDays) || 30,
    };

    addContract(newContract);
    log(`Issued new contract ${newContract.id} for ${nameOf(form.employeeId)}`, "Contracts");
    toast.success("Contract created successfully", {
      description: `${newContract.contractType} agreement for ${nameOf(form.employeeId)}`,
    });
    setAddOpen(false);
    setForm(emptyForm);
  };

  const handleRenew = () => {
    if (!renewContract || !newEndDate) {
      toast.error("Please pick a new end date.");
      return;
    }
    updateContract(renewContract.id, {
      endDate: newEndDate,
      status: "Active",
    });
    log(`Renewed contract ${renewContract.id} until ${newEndDate}`, "Contracts");
    toast.success("Contract renewed", {
      description: `New expiry set to ${newEndDate}`,
    });
    setRenewContract(null);
    setNewEndDate("");
  };

  const handleDownload = (c: Contract) => {
    toast.success(`Downloading ${c.id}.pdf`, {
      description: `Official ${c.contractType} for ${nameOf(c.employeeId)}`,
    });
  };

  return (
    <>
      <PageHeader
        title="Contracts"
        description="Comprehensive lifecycle management of employee employment agreements, renewals, and salary schedules."
        actions={
          canEdit ? (
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="mr-2 size-4" /> Add contract
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active Contracts"
          value={activeCount}
          hint={`${contracts.length} total on record`}
          icon={<CheckCircle2 className="size-5" />}
          tone="success"
        />
        <StatCard
          label="Expiring This Month"
          value={expiringCount}
          hint="Requires renewal review"
          icon={<AlertTriangle className="size-5" />}
          tone="warning"
        />
        <StatCard
          label="Expired Contracts"
          value={expiredCount}
          hint="Action or archive required"
          icon={<Clock className="size-5" />}
          tone="default"
        />
        <StatCard
          label="Draft Contracts"
          value={draftCount}
          hint="Pending signature dispatch"
          icon={<FileText className="size-5" />}
          tone="accent"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>All Agreements</CardTitle>
              <CardDescription>Filter by status, employee or agreement category</CardDescription>
            </div>
          </div>

          <div className="mt-2 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search contract ID or name..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={empFilter} onValueChange={setEmpFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} ({e.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Contract Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Full-time">Full-time Permanent</SelectItem>
                <SelectItem value="Executive">Executive Agreement</SelectItem>
                <SelectItem value="Fixed-term">Fixed-term Contract</SelectItem>
                <SelectItem value="Consultancy">Consultancy</SelectItem>
                <SelectItem value="Internship">Internship Agreement</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Expiring Soon">Expiring Soon</SelectItem>
                <SelectItem value="Expired">Expired</SelectItem>
                <SelectItem value="Terminated">Terminated</SelectItem>
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
              title="No contracts found"
              description="Try adjusting your search terms or filters."
              icon={<FileSignature className="size-8" />}
            />
          ) : (
            <>
              {/* Pagination ON TOP of Employees' Staff Contracts */}
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={rows.length}
                pageSize={5}
                onPageChange={setPage}
              />
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contract ID</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Contract Type</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead className="text-right">Annual Salary</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRows.map((c) => {
                      const isExpiring = c.status === "Expiring Soon";
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono text-xs font-semibold text-primary">
                            {c.id}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{nameOf(c.employeeId)}</div>
                            <div className="text-xs text-muted-foreground">{c.employeeId}</div>
                          </TableCell>
                          <TableCell>{c.contractType}</TableCell>
                          <TableCell>{c.department}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.startDate}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-xs">
                              {c.endDate}
                              {isExpiring && (
                                <AlertTriangle className="size-3.5 text-warning" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {inr(c.salary)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={c.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2"
                                onClick={() => setViewContract(c)}
                                title="View details"
                              >
                                <Eye className="size-3.5" />
                              </Button>

                              {canEdit && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2 text-primary"
                                  onClick={() => {
                                    setRenewContract(c);
                                    setNewEndDate(
                                      new Date(new Date(c.endDate).setFullYear(new Date(c.endDate).getFullYear() + 1))
                                        .toISOString()
                                        .slice(0, 10),
                                    );
                                  }}
                                  title="Renew contract"
                                >
                                  <RefreshCw className="size-3.5" />
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2"
                                onClick={() =>
                                  toast.success(`Downloading contract PDF for ${nameOf(c.employeeId)}`)
                                }
                                title="Download contract"
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
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={rows.length}
                pageSize={5}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Add Contract Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Issue New Contract</DialogTitle>
            <DialogDescription>
              Create an employment contract record linked to an employee.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <Field label="Employee" error={errors["employeeId"]}>
              <Select
                value={form.employeeId}
                onValueChange={(v) => {
                  const emp = employees.find((e) => e.id === v);
                  setForm({
                    ...form,
                    employeeId: v,
                    department: emp?.department ?? form.department,
                    salary: emp ? String(emp.ctc) : form.salary,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} — {e.designation} ({e.department})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Contract Type">
                <Select
                  value={form.contractType}
                  onValueChange={(v) => setForm({ ...form, contractType: v as ContractType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full-time">Full-time Permanent</SelectItem>
                    <SelectItem value="Executive">Executive Agreement</SelectItem>
                    <SelectItem value="Fixed-term">Fixed-term Contract</SelectItem>
                    <SelectItem value="Consultancy">Consultancy</SelectItem>
                    <SelectItem value="Internship">Internship Agreement</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Annual Salary (₹ CTC)" error={errors["salary"]}>
                <Input
                  type="number"
                  placeholder="e.g. 2400000"
                  value={form.salary}
                  onChange={(e) => setForm({ ...form, salary: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Date" error={errors["startDate"]}>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </Field>
              <Field label="End Date" error={errors["endDate"]}>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Department">
                <Input
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                />
              </Field>
              <Field label="Notice Period (Days)">
                <Input
                  type="number"
                  value={form.noticePeriodDays}
                  onChange={(e) => setForm({ ...form, noticePeriodDays: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Key Terms & Confidentiality Clauses">
              <Input
                value={form.terms}
                onChange={(e) => setForm({ ...form, terms: e.target.value })}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Save Contract</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Contract Modal */}
      {viewContract && (
        <Dialog open={!!viewContract} onOpenChange={(o) => !o && setViewContract(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>Contract Details · {viewContract.id}</DialogTitle>
                <StatusBadge status={viewContract.status} />
              </div>
              <DialogDescription>
                {viewContract.contractType} for {nameOf(viewContract.employeeId)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/40 p-3.5">
                <div>
                  <p className="text-xs text-muted-foreground">Employee Name</p>
                  <p className="font-medium">{nameOf(viewContract.employeeId)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Department</p>
                  <p className="font-medium">{viewContract.department}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valid Term</p>
                  <p className="font-medium">
                    {viewContract.startDate} → {viewContract.endDate}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Notice Period</p>
                  <p className="font-medium">{viewContract.noticePeriodDays} Days</p>
                </div>
              </div>

              <div className="rounded-lg border border-border p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Compensation Annexure
                </p>
                <div className="mt-2 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Annual Base CTC:</span>
                    <span className="font-medium">{inr(viewContract.salary)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estimated Monthly Gross:</span>
                    <span className="font-medium">{inr(Math.round(viewContract.salary / 12))}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Basic (50%): {inr(Math.round((viewContract.salary / 12) * 0.5))}</span>
                    <span>HRA (25%): {inr(Math.round((viewContract.salary / 12) * 0.25))}</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Terms & Conditions
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {viewContract.terms}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleDownload(viewContract)}>
                <Download className="mr-2 size-4" /> Download PDF
              </Button>
              <Button onClick={() => setViewContract(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Renew Contract Dialog */}
      {renewContract && (
        <Dialog open={!!renewContract} onOpenChange={(o) => !o && setRenewContract(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Renew Contract</DialogTitle>
              <DialogDescription>
                Extend agreement for {nameOf(renewContract.employeeId)} ({renewContract.id}).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="text-sm">
                <p className="text-muted-foreground">Current End Date:</p>
                <p className="font-medium">{renewContract.endDate}</p>
              </div>

              <Field label="New Expiry Date">
                <Input
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                />
              </Field>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setRenewContract(null)}>
                Cancel
              </Button>
              <Button onClick={handleRenew}>Confirm Renewal</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
