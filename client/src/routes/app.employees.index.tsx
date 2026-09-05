import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  Edit2,
  Eye,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState, Field, PageHeader, StatusBadge, TableSkeleton } from "@/components/bits";
import { useApp, useDelayed } from "@/lib/store";
import { inr, type Employee, type EmployeeStatus } from "@/lib/mock-data";

export const Route = createFileRoute("/app/employees/")({
  head: () => ({
    meta: [
      { title: "Employee Directory · PeoplePay360" },
      { name: "description", content: "Search, filter and manage every employee record across the enterprise." },
      { property: "og:title", content: "Employee Directory · PeoplePay360" },
    ],
  }),
  component: EmployeesPage,
});

const emptyForm = {
  name: "",
  email: "",
  department: "Engineering",
  designation: "",
  location: "Ahmedabad",
  manager: "Sana Iqbal",
  employmentType: "Full-time" as Employee["employmentType"],
  ctc: "",
  joinedOn: new Date().toISOString().slice(0, 10),
};

function EmployeesPage() {
  const { employees, addEmployee, patchEmployee, onboarding, provisioning, update, log, role } = useApp();
  const ready = useDelayed();
  const navigate = useNavigate();

  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState({
    designation: "",
    department: "",
    manager: "",
    location: "",
    ctc: "",
    status: "active" as EmployeeStatus,
  });

  const [deactivateTarget, setDeactivateTarget] = useState<Employee | null>(null);

  const canEdit = role === "hr_manager" || role === "admin" || role === "hr_user";

  const departments = useMemo(() => Array.from(new Set(employees.map((e) => e.department))).sort(), [employees]);

  const rows = useMemo(() => {
    return employees.filter(
      (e) =>
        (dept === "all" || e.department === dept) &&
        (status === "all" || e.status === status) &&
        (typeFilter === "all" || e.employmentType === typeFilter) &&
        (e.name.toLowerCase().includes(q.toLowerCase()) ||
          e.code.toLowerCase().includes(q.toLowerCase()) ||
          e.email.toLowerCase().includes(q.toLowerCase()) ||
          e.designation.toLowerCase().includes(q.toLowerCase())),
    );
  }, [employees, dept, status, typeFilter, q]);

  const handleCreate = () => {
    const next: Record<string, string | undefined> = {};
    if (form.name.trim().length < 3) next["name"] = "Enter the full name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next["email"] = "Enter a valid work email.";
    if (!form.designation.trim()) next["designation"] = "Designation is required.";
    if (!form.joinedOn) next["joinedOn"] = "Pick a joining date.";
    if (!form.ctc || Number(form.ctc) <= 0) next["ctc"] = "Annual CTC must be a positive number.";
    setErrors(next);
    if (Object.keys(next).length) return;

    const id = `E${1013 + employees.length}`;
    const code = `PP-${1013 + employees.length}`;

    const emp: Employee = {
      id,
      code,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: "+91 98000 12345",
      department: form.department,
      designation: form.designation.trim(),
      location: form.location,
      manager: form.manager,
      employmentType: form.employmentType,
      status: "onboarding",
      joinedOn: form.joinedOn,
      ctc: Number(form.ctc),
      bankAccount: "Pending",
      pan: "Pending",
      leaveBalance: 12,
    };

    addEmployee(emp);

    // 1. Create Onboarding record with 8 checklist items
    const onCase = {
      id: `ON-${200 + onboarding.length + 5}`,
      employeeId: id,
      startDate: form.joinedOn,
      dueDate: new Date(new Date(form.joinedOn).setDate(new Date(form.joinedOn).getDate() + 14))
        .toISOString()
        .slice(0, 10),
      buddy: form.manager,
      assignedHr: "Sana Iqbal",
      status: "Account Created" as const,
      invitationSentDate: new Date().toISOString().slice(0, 10),
      accountCreatedDate: new Date().toISOString().slice(0, 10),
      tasks: [
        { id: "t1", label: "Complete personal profile", owner: "Employee" as const, done: false, category: "Personal" },
        { id: "t2", label: "Add emergency contact", owner: "Employee" as const, done: false, category: "Personal" },
        { id: "t3", label: "Accept company policies", owner: "Employee" as const, done: false, category: "Compliance" },
        { id: "t4", label: "Complete bank details", owner: "Payroll" as const, done: false, category: "Finance" },
        { id: "t5", label: "Complete tax information", owner: "Payroll" as const, done: false, category: "Finance" },
        { id: "t6", label: "Review contract", owner: "HR" as const, done: false, category: "Legal" },
        { id: "t7", label: "Attend orientation", owner: "HR" as const, done: false, category: "Orientation" },
        { id: "t8", label: "Receive company assets", owner: "IT" as const, done: false, category: "IT" },
      ],
    };
    update("onboarding", [onCase, ...onboarding]);

    // 2. Trigger automatic simulated account provisioning
    const provRecord = {
      id: `PRV-${Date.now().toString().slice(-4)}`,
      employeeId: id,
      employeeName: emp.name,
      companyEmail: emp.email,
      overallStatus: "Completed" as const,
      invitationStatus: "Sent" as const,
      accountActivated: false,
      defaultPermissions: ["Self-service Workspace", "Leave Application", "Expense Claims", "Profile Access"],
      startedAt: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      completedAt: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      steps: [
        { step: 1, key: "record_created", label: "Employee record created in HRIS", status: "completed" as const },
        { step: 2, key: "email_generated", label: `Company email generated (${emp.email})`, status: "completed" as const },
        { step: 3, key: "invite_sent", label: "Activation email dispatched with secure invitation token", status: "completed" as const },
        { step: 4, key: "account_activated", label: "Waiting for password setup", status: "in_progress" as const },
        { step: 5, key: "permissions_assigned", label: "Standard Employee permissions assigned", status: "completed" as const },
        { step: 6, key: "onboarding_started", label: "Onboarding checklist assigned", status: "completed" as const },
      ],
    };
    update("provisioning", [provRecord, ...provisioning]);

    log(`Added employee ${emp.name} (${code}) & initiated account provisioning`, "People");
    toast.success(`${emp.name} added to directory`, {
      description: "Company account provisioned & onboarding checklist initialized.",
    });

    setForm(emptyForm);
    setAddOpen(false);
  };

  const openEdit = (emp: Employee) => {
    setEditTarget(emp);
    setEditForm({
      designation: emp.designation,
      department: emp.department,
      manager: emp.manager,
      location: emp.location,
      ctc: String(emp.ctc),
      status: emp.status,
    });
  };

  const handleSaveEdit = () => {
    if (!editTarget) return;
    patchEmployee(editTarget.id, {
      designation: editForm.designation.trim(),
      department: editForm.department,
      manager: editForm.manager,
      location: editForm.location,
      ctc: Number(editForm.ctc) || editTarget.ctc,
      status: editForm.status,
    });
    log(`Updated employee profile for ${editTarget.name}`, "People");
    toast.success("Employee record updated");
    setEditTarget(null);
  };

  const handleToggleActive = () => {
    if (!deactivateTarget) return;
    const nextStatus = deactivateTarget.status === "exited" ? "active" : "exited";
    patchEmployee(deactivateTarget.id, { status: nextStatus });
    log(`Changed status of ${deactivateTarget.name} to ${nextStatus}`, "People");
    toast.success(`${deactivateTarget.name} marked as ${nextStatus}`);
    setDeactivateTarget(null);
  };

  return (
    <>
      <PageHeader
        title="Employee Directory"
        description="Comprehensive enterprise workforce directory with lifecycle tracking, department filters, and role governance."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                toast.success("Exporting employee directory as CSV", {
                  description: `${rows.length} employee records included.`,
                })
              }
            >
              <Download className="mr-2 size-4" /> Export
            </Button>
            {canEdit && (
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="mr-2 size-4" /> Add employee
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Staff Records ({rows.length})</CardTitle>
              <CardDescription>Filter by department, status or employment type</CardDescription>
            </div>
          </div>

          <div className="mt-2 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search name, ID, email..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={dept} onValueChange={setDept}>
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

            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="onboarding">Onboarding</SelectItem>
                <SelectItem value="on_leave">On Leave</SelectItem>
                <SelectItem value="offboarding">Offboarding</SelectItem>
                <SelectItem value="exited">Exited</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Full-time">Full-time</SelectItem>
                <SelectItem value="Contract">Contract</SelectItem>
                <SelectItem value="Intern">Intern</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {!ready ? (
            <div className="p-4">
              <TableSkeleton rows={8} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="No employees found"
              description="Try adjusting your search criteria."
              icon={<Users className="size-8" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Job Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Joining Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs font-semibold text-primary">
                        {e.code}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-8 shrink-0">
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                              {e.name
                                .split(" ")
                                .map((p) => p[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium leading-none">{e.name}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{e.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{e.department}</TableCell>
                      <TableCell>{e.designation}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.employmentType}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.joinedOn}</TableCell>
                      <TableCell>
                        <StatusBadge status={e.status} />
                      </TableCell>
                      <TableCell className="text-sm">{e.manager}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            asChild
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            title="View employee profile"
                          >
                            <Link to={`/app/employees/${e.id}`}>
                              <Eye className="size-3.5" />
                            </Link>
                          </Button>

                          {canEdit && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2"
                                onClick={() => openEdit(e)}
                                title="Edit employee"
                              >
                                <Edit2 className="size-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-destructive hover:text-destructive"
                                onClick={() => setDeactivateTarget(e)}
                                title={e.status === "exited" ? "Reactivate" : "Deactivate"}
                              >
                                <UserMinus className="size-3.5" />
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

      {/* Add Employee Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription>
              Create employee record with automatic email generation, invite link & provisioning.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full Name" error={errors.name}>
                <Input
                  placeholder="e.g. Aditi Sharma"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>

              <Field label="Work Email" error={errors.email}>
                <Input
                  type="email"
                  placeholder="aditi.sharma@peoplepay360.io"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Department">
                <Select
                  value={form.department}
                  onValueChange={(v) => setForm({ ...form, department: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Engineering">Engineering</SelectItem>
                    <SelectItem value="People Ops">People Ops</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="IT">IT</SelectItem>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Support">Support</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Job Title / Designation" error={errors.designation}>
                <Input
                  placeholder="e.g. Frontend Developer"
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Joining Date" error={errors.joinedOn}>
                <Input
                  type="date"
                  value={form.joinedOn}
                  onChange={(e) => setForm({ ...form, joinedOn: e.target.value })}
                />
              </Field>

              <Field label="Employment Type">
                <Select
                  value={form.employmentType}
                  onValueChange={(v) =>
                    setForm({ ...form, employmentType: v as Employee["employmentType"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full-time">Full-time</SelectItem>
                    <SelectItem value="Contract">Contract</SelectItem>
                    <SelectItem value="Intern">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Reporting Manager">
                <Select
                  value={form.manager}
                  onValueChange={(v) => setForm({ ...form, manager: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sana Iqbal">Sana Iqbal (Head of HR)</SelectItem>
                    <SelectItem value="Rohan Mehta">Rohan Mehta (Engineering Lead)</SelectItem>
                    <SelectItem value="Arjun Nair">Arjun Nair (Finance Controller)</SelectItem>
                    <SelectItem value="Neel Shah">Neel Shah (IT Manager)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Annual Base CTC (₹)" error={errors.ctc}>
                <Input
                  type="number"
                  placeholder="e.g. 1800000"
                  value={form.ctc}
                  onChange={(e) => setForm({ ...form, ctc: e.target.value })}
                />
              </Field>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Provision Employee</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Modal */}
      {editTarget && (
        <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Profile · {editTarget.name}</DialogTitle>
              <DialogDescription>
                Update employee designation, department and reporting manager.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <Field label="Designation">
                <Input
                  value={editForm.designation}
                  onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Department">
                  <Select
                    value={editForm.department}
                    onValueChange={(v) => setEditForm({ ...editForm, department: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Status">
                  <Select
                    value={editForm.status}
                    onValueChange={(v) =>
                      setEditForm({ ...editForm, status: v as EmployeeStatus })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="onboarding">Onboarding</SelectItem>
                      <SelectItem value="on_leave">On Leave</SelectItem>
                      <SelectItem value="offboarding">Offboarding</SelectItem>
                      <SelectItem value="exited">Exited</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Reporting Manager">
                <Input
                  value={editForm.manager}
                  onChange={(e) => setEditForm({ ...editForm, manager: e.target.value })}
                />
              </Field>

              <Field label="Annual CTC (₹)">
                <Input
                  type="number"
                  value={editForm.ctc}
                  onChange={(e) => setEditForm({ ...editForm, ctc: e.target.value })}
                />
              </Field>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Deactivate Confirmation Dialog */}
      {deactivateTarget && (
        <AlertDialog open={!!deactivateTarget} onOpenChange={(o) => !o && setDeactivateTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {deactivateTarget.status === "exited" ? "Reactivate Employee" : "Deactivate Employee"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deactivateTarget.status === "exited"
                  ? `Are you sure you want to restore ${deactivateTarget.name} to active status?`
                  : `Are you sure you want to mark ${deactivateTarget.name} as exited? This will revoke active system access.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeactivateTarget(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className={deactivateTarget.status === "exited" ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
                onClick={handleToggleActive}
              >
                {deactivateTarget.status === "exited" ? "Reactivate" : "Deactivate"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
