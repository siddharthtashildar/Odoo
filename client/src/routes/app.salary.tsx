import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BadgeIndianRupee,
  ChevronDown,
  ChevronUp,
  Edit2,
  Lock,
  Search,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { EmptyState, PageHeader, StatCard } from "@/components/bits";
import { useApp, useEmployeeName } from "@/lib/store";
import { inr, salaryStructures, type SalaryRecord } from "@/lib/mock-data";

export const Route = createFileRoute("/app/salary")({
  head: () => ({
    meta: [
      { title: "Salary · PeoplePay360" },
      { name: "description", content: "View and manage employee salary records, CTC breakdowns and structure assignments." },
      { property: "og:title", content: "Salary · PeoplePay360" },
    ],
  }),
  component: SalaryPage,
});

const STATUS_COLORS: Record<SalaryRecord["status"], string> = {
  active: "bg-success/15 text-success border-success/20",
  revised: "bg-accent/15 text-accent-foreground border-accent/20",
  pending: "bg-warning/15 text-warning-foreground border-warning/20",
};

function SalaryPage() {
  const { salaryRecords: records, update, role, employees } = useApp();
  const nameOf = useEmployeeName();
  const [q, setQ] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<"name" | "ctc" | "net">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editTarget, setEditTarget] = useState<SalaryRecord | null>(null);
  const [editForm, setEditForm] = useState({ annualCTC: "", structureId: "" });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Access gate
  const canAccess = role === "payroll_manager" || role === "payroll_user" || role === "admin";
  const canEdit = role === "payroll_manager" || role === "admin";

  const departments = useMemo(
    () => Array.from(new Set(employees.map((e) => e.department))).sort(),
    [employees],
  );

  const enriched = useMemo(() => {
    return records
      .map((r) => {
        const emp = employees.find((e) => e.id === r.employeeId);
        const struct = salaryStructures.find((s) => s.id === r.structureId);
        return { ...r, empName: emp?.name ?? "Unknown", dept: emp?.department ?? "—", struct: struct?.name ?? "—" };
      })
      .filter((r) => {
        const matchQ =
          r.empName.toLowerCase().includes(q.toLowerCase()) || r.id.toLowerCase().includes(q.toLowerCase());
        const matchDept = deptFilter === "all" || r.dept === deptFilter;
        const matchStatus = statusFilter === "all" || r.status === statusFilter;
        return matchQ && matchDept && matchStatus;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === "name") cmp = a.empName.localeCompare(b.empName);
        else if (sortKey === "ctc") cmp = a.annualCTC - b.annualCTC;
        else cmp = a.netMonthly - b.netMonthly;
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [records, employees, q, deptFilter, statusFilter, sortKey, sortDir]);

  const totalCTC = records.reduce((s, r) => s + r.annualCTC, 0);
  const avgCTC = records.length ? totalCTC / records.length : 0;
  const totalNet = records.reduce((s, r) => s + r.netMonthly, 0);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ k }: { k: typeof sortKey }) =>
    sortKey === k ? (
      sortDir === "asc" ? <ChevronUp className="ml-1 inline size-3.5" /> : <ChevronDown className="ml-1 inline size-3.5" />
    ) : null;

  const openEdit = (r: SalaryRecord) => {
    setEditTarget(r);
    setEditForm({ annualCTC: String(r.annualCTC), structureId: r.structureId });
  };

  const handleSave = () => {
    if (!editTarget) return;
    const ctc = Number(editForm.annualCTC);
    if (!ctc || ctc <= 0) { toast.error("Annual CTC must be a positive number"); return; }
    const monthly = Math.round(ctc / 12);
    const struct = salaryStructures.find((s) => s.id === editForm.structureId);
    const basicPct = struct?.components.find((c) => c.name === "Basic Salary")?.value ?? 50;
    const basic = Math.round((monthly * basicPct) / 150); // rough simplified calc
    const hra = Math.round(basic * 0.4);
    const special = Math.round(basic * 0.1);
    const pf = Math.round(basic * 0.12);
    const pt = 200;
    const tds = Math.round(basic * 0.1);
    const net = monthly - pf - pt - tds;

    const updated: SalaryRecord = {
      ...editTarget,
      annualCTC: ctc,
      monthlyCTC: monthly,
      basic,
      hra,
      specialAllowance: special,
      providentFund: pf,
      professionalTax: pt,
      incomeTax: tds,
      netMonthly: net,
      structureId: editForm.structureId,
      status: "revised",
      revisedBy: "Arjun Nair",
      remarks: `Revised on ${new Date().toLocaleDateString("en-IN")}`,
    };
    update("salaryRecords", records.map((r) => (r.id === editTarget.id ? updated : r)));
    toast.success("Salary record updated", { description: `${nameOf(editTarget.employeeId)}'s record saved as Revised.` });
    setEditTarget(null);
  };

  if (!canAccess) {
    return (
      <EmptyState
        icon={<Lock className="size-5" />}
        title="Access restricted"
        description="Salary records are only accessible to Payroll User and Payroll Manager."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Salary"
        description="Employee salary records, CTC breakdowns and structure assignments."
        actions={
          canEdit ? (
            <Badge variant="outline" className="gap-1.5 text-xs">
              <Edit2 className="size-3" /> Edit mode active
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3" /> Read-only
            </Badge>
          )
        }
      />

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Employees on payroll" value={records.length} icon={<Users className="size-5" />} />
        <StatCard label="Total annual CTC" value={inr(totalCTC)} icon={<TrendingUp className="size-5" />} tone="accent" />
        <StatCard label="Total net disbursed / mo" value={inr(totalNet)} icon={<Wallet className="size-5" />} tone="success" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="salary-search"
            placeholder="Search employee or record ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-44" id="salary-dept-filter"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36" id="salary-status-filter"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="revised">Revised</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Salary Records</CardTitle>
          <CardDescription>{enriched.length} of {records.length} records shown</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {enriched.length === 0 ? (
            <EmptyState
              icon={<BadgeIndianRupee className="size-5" />}
              title="No matching records"
              description="Try adjusting your search or filters."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                      Employee <SortIcon k="name" />
                    </TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Structure</TableHead>
                    <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("ctc")}>
                      Annual CTC <SortIcon k="ctc" />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("net")}>
                      Net / mo <SortIcon k="net" />
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enriched.map((r) => (
                    <>
                      <TableRow
                        key={r.id}
                        className="cursor-pointer"
                        onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      >
                        <TableCell className="font-medium">{r.empName}</TableCell>
                        <TableCell className="text-muted-foreground">{r.dept}</TableCell>
                        <TableCell className="text-muted-foreground">{r.struct}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{inr(r.annualCTC)}</TableCell>
                        <TableCell className="text-right tabular-nums">{inr(r.netMonthly)}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[r.status]}`}>
                            {r.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          {canEdit && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8"
                              aria-label="Edit salary record"
                              onClick={(e) => { e.stopPropagation(); openEdit(r); }}
                            >
                              <Edit2 className="size-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {expandedId === r.id && (
                        <TableRow key={`${r.id}-expand`} className="bg-muted/30">
                          <TableCell colSpan={7} className="py-3">
                            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs sm:grid-cols-4">
                              <Detail label="Basic" value={inr(r.basic)} />
                              <Detail label="HRA" value={inr(r.hra)} />
                              <Detail label="Special Allowance" value={inr(r.specialAllowance)} />
                              <Detail label="Monthly CTC" value={inr(r.monthlyCTC)} />
                              <Detail label="PF (Employee)" value={`− ${inr(r.providentFund)}`} />
                              <Detail label="Professional Tax" value={`− ${inr(r.professionalTax)}`} />
                              <Detail label="Income Tax (TDS)" value={`− ${inr(r.incomeTax)}`} />
                              <Detail label="Effective From" value={r.effectiveFrom} />
                              {r.remarks && <Detail label="Remarks" value={r.remarks} span />}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog — payroll_manager only */}
      {canEdit && (
        <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Salary Record</DialogTitle>
              <DialogDescription>
                {editTarget ? nameOf(editTarget.employeeId) : ""} · {editTarget?.id}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-ctc">Annual CTC (₹)</Label>
                <Input
                  id="edit-ctc"
                  type="number"
                  min={0}
                  value={editForm.annualCTC}
                  onChange={(e) => setEditForm((f) => ({ ...f, annualCTC: e.target.value }))}
                  placeholder="e.g. 2400000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-structure">Salary Structure</Label>
                <Select
                  value={editForm.structureId}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, structureId: v }))}
                >
                  <SelectTrigger id="edit-structure"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {salaryStructures
                      .filter((s) => s.status !== "draft")
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button onClick={handleSave}>Save changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function Detail({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
