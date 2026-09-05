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
  KeyRound,
  Mail,
  Copy,
  Check,
  Send,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";
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
import { EmptyState, Field, PageHeader, StatusBadge, TableSkeleton, TablePagination } from "@/components/bits";
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
  role: "employee",
  autoProvision: true,
  customPassword: "",
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
  const [createLoading, setCreateLoading] = useState(false);
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

  const canEdit = role === "hr_manager" || role === "admin" || role === "payroll_manager" || role === "payroll_user";
  const isHR = role === "hr_manager" || role === "admin";

  const [provisionTarget, setProvisionTarget] = useState<Employee | null>(null);
  const [provisionRole, setProvisionRole] = useState<string>("employee");
  const [customPassword, setCustomPassword] = useState<string>("");
  const [provisionLoading, setProvisionLoading] = useState(false);
  const [provisionResult, setProvisionResult] = useState<{
    credentials: { email: string; temporaryPassword: string; loginUrl: string };
    emailDispatched: boolean;
    previewUrl?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const [emailsDialogOpen, setEmailsDialogOpen] = useState(false);
  const [dispatchedEmails, setDispatchedEmails] = useState<
    Array<{
      id: string;
      to: string;
      subject: string;
      employeeName: string;
      role: string;
      temporaryPassword: string;
      sentAt: string;
    }>
  >([]);
  const [loadingEmails, setLoadingEmails] = useState(false);

  const handleOpenProvision = (emp: Employee) => {
    setProvisionTarget(emp);
    setProvisionRole("employee");
    setCustomPassword("");
    setProvisionResult(null);
    setCopied(false);
  };

  const handleExecuteProvision = async () => {
    if (!provisionTarget) return;
    setProvisionLoading(true);
    try {
      const res = await api.auth.provisionUser(
        {
          employeeId: provisionTarget.id,
          email: provisionTarget.email,
          role: provisionRole,
          customPassword: customPassword.trim() || undefined,
        },
        role,
      );
      setProvisionResult(res);
      log(`Provisioned user account for ${provisionTarget.name} (${provisionRole}) and sent credentials email`, "Auth");
      toast.success("User account created and credentials dispatched!", {
        description: `Login details emailed to ${provisionTarget.email}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to provision user";
      toast.error(msg);
    } finally {
      setProvisionLoading(false);
    }
  };

  const handleLoadDispatchedEmails = async () => {
    setEmailsDialogOpen(true);
    setLoadingEmails(true);
    try {
      const emails = await api.auth.getDispatchedEmails(role);
      setDispatchedEmails(emails);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load emails";
      toast.error(msg);
    } finally {
      setLoadingEmails(false);
    }
  };

  const copyPassword = (pwd: string) => {
    navigator.clipboard.writeText(pwd);
    setCopied(true);
    toast.success("Temporary password copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const [page, setPage] = useState(1);

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

  const PAGE_SIZE = 5;
  const totalPages = Math.ceil(rows.length / PAGE_SIZE) || 1;
  const paginatedRows = useMemo(() => {
    return rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [rows, page]);

  const handleCreate = async () => {
    const next: Record<string, string | undefined> = {};
    if (form.name.trim().length < 3) next["name"] = "Enter the full name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next["email"] = "Enter a valid work email.";
    if (!form.designation.trim()) next["designation"] = "Designation is required.";
    if (!form.joinedOn) next["joinedOn"] = "Pick a joining date.";
    if (!form.ctc || Number(form.ctc) <= 0) next["ctc"] = "Annual CTC must be a positive number.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setCreateLoading(true);
    try {
      const res = await api.employees.create({
        name: form.name.trim(),
        email: form.email.trim(),
        department: form.department,
        designation: form.designation.trim(),
        location: form.location,
        manager: form.manager,
        employmentType: form.employmentType,
        joinedOn: form.joinedOn,
        ctc: Number(form.ctc),
        role: form.role,
        autoProvision: form.autoProvision,
        customPassword: form.customPassword.trim() || undefined,
      });

      const emp: Employee = {
        id: res.id,
        code: res.code,
        name: res.name,
        email: res.email,
        phone: res.phone || "+91 98000 12345",
        department: res.department,
        designation: res.designation,
        location: form.location,
        manager: res.manager,
        employmentType: (res.employmentType as Employee["employmentType"]) || form.employmentType,
        status: (res.status as EmployeeStatus) || "active",
        joinedOn: res.joinedOn,
        ctc: res.ctc,
        bankAccount: "Pending",
        pan: "Pending",
        leaveBalance: 12,
      };

      addEmployee(emp);

      // 1. Create Onboarding record linked to real employee ID
      const onCase = {
        id: `ON-${200 + onboarding.length + 5}`,
        employeeId: res.id,
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

      // 2. Add Provisioning tracking
      if (res.provision) {
        const provRecord = {
          id: `PRV-${Date.now().toString().slice(-4)}`,
          employeeId: res.id,
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
      }

      log(`Added employee ${emp.name} (${res.code}) in database & sent credentials`, "People");

      if (res.provision?.previewUrl) {
        toast.success(`${emp.name} added & credentials emailed!`, {
          description: `Temporary password: ${res.provision.credentials.temporaryPassword}`,
          action: {
            label: "Open Email",
            onClick: () => window.open(res.provision!.previewUrl, "_blank"),
          },
        });
      } else if (res.provision) {
        toast.success(`${emp.name} created & credentials dispatched!`, {
          description: `Password: ${res.provision.credentials.temporaryPassword}`,
        });
      } else {
        toast.success(`${emp.name} created in database`);
      }

      setForm(emptyForm);
      setAddOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create employee";
      toast.error(msg);
    } finally {
      setCreateLoading(false);
    }
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

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    try {
      await api.employees.patch(editTarget.id, {
        designation: editForm.designation.trim(),
        department: editForm.department,
        manager: editForm.manager,
        location: editForm.location,
        ctc: Number(editForm.ctc) || editTarget.ctc,
        status: editForm.status,
      });

      patchEmployee(editTarget.id, {
        designation: editForm.designation.trim(),
        department: editForm.department,
        manager: editForm.manager,
        location: editForm.location,
        ctc: Number(editForm.ctc) || editTarget.ctc,
        status: editForm.status,
      });
      log(`Updated employee profile for ${editTarget.name}`, "People");
      toast.success("Employee record updated in database");
      setEditTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update employee";
      toast.error(msg);
    }
  };

  const handleToggleActive = async () => {
    if (!deactivateTarget) return;
    const nextStatus = deactivateTarget.status === "exited" ? "active" : "exited";
    try {
      await api.employees.patch(deactivateTarget.id, { status: nextStatus });
      patchEmployee(deactivateTarget.id, { status: nextStatus });
      log(`Changed status of ${deactivateTarget.name} to ${nextStatus}`, "People");
      toast.success(`${deactivateTarget.name} marked as ${nextStatus}`);
      setDeactivateTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update status";
      toast.error(msg);
    }
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
            {isHR && (
              <Button variant="outline" onClick={handleLoadDispatchedEmails}>
                <Mail className="mr-2 size-4" /> Dispatched Emails
              </Button>
            )}
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
            <>
              {/* Pagination ON TOP of Employees' Staff Records */}
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
                    {paginatedRows.map((e) => (
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
                              <Link to="/app/employees/$id" params={{ id: e.id }}>
                                <Eye className="size-3.5" />
                              </Link>
                            </Button>

                            {isHR && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10"
                                onClick={() => handleOpenProvision(e)}
                                title="Provision Login Account & Email Credentials"
                              >
                                <KeyRound className="size-3.5" />
                              </Button>
                            )}

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
                                  className={`h-8 px-2 ${e.status === "exited" ? "text-success hover:text-success" : "text-destructive hover:text-destructive"}`}
                                  onClick={() => setDeactivateTarget(e)}
                                  title={e.status === "exited" ? "Reactivate" : "Deactivate"}
                                >
                                  {e.status === "exited" ? (
                                    <UserCheck className="size-3.5" />
                                  ) : (
                                    <UserMinus className="size-3.5" />
                                  )}
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
              <Field label="Full Name" error={errors["name"]}>
                <Input
                  placeholder="e.g. Aditi Sharma"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>

              <Field label="Work Email" error={errors["email"]}>
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

              <Field label="Job Title / Designation" error={errors["designation"]}>
                <Input
                  placeholder="e.g. Frontend Developer"
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Joining Date" error={errors["joinedOn"]}>
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

              <Field label="Annual Base CTC (₹)" error={errors["ctc"]}>
                <Input
                  type="number"
                  placeholder="e.g. 1800000"
                  value={form.ctc}
                  onChange={(e) => setForm({ ...form, ctc: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t">
              <Field label="System Role & Permissions">
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm({ ...form, role: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee (Self-Service)</SelectItem>
                    <SelectItem value="hr_manager">HR Manager (Full HR/People)</SelectItem>
                    <SelectItem value="payroll_manager">Payroll Manager (Full Payroll/Salary)</SelectItem>
                    <SelectItem value="payroll_user">Payroll Officer (Read Payroll)</SelectItem>
                    <SelectItem value="admin">System Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Initial Password (Optional)">
                <Input
                  placeholder="Auto-generate secure key"
                  value={form.customPassword}
                  onChange={(e) => setForm({ ...form, customPassword: e.target.value })}
                />
              </Field>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createLoading}>
              {createLoading ? "Creating & Provisioning..." : "Create & Provision Employee"}
            </Button>
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

      {/* Provision Account & Email Credentials Dialog */}
      {provisionTarget && (
        <Dialog open={!!provisionTarget} onOpenChange={(o) => !o && setProvisionTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2 text-primary">
                <ShieldCheck className="size-5" />
                <DialogTitle>Provision Login Account</DialogTitle>
              </div>
              <DialogDescription>
                Create a secure Better Auth account for <strong>{provisionTarget.name}</strong> and email their login credentials.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Work Email:</span>
                  <span className="font-medium">{provisionTarget.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Department:</span>
                  <span>{provisionTarget.department}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Designation:</span>
                  <span>{provisionTarget.designation}</span>
                </div>
              </div>

              {!provisionResult ? (
                <>
                  <Field label="Assigned System Role">
                    <Select value={provisionRole} onValueChange={setProvisionRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Employee (Standard Workspace)</SelectItem>
                        <SelectItem value="hr_manager">HR Manager (Full People Ops)</SelectItem>
                        <SelectItem value="payroll_user">Payroll User (Read-only Payroll)</SelectItem>
                        <SelectItem value="payroll_manager">Payroll Manager (Full Payroll CRUD)</SelectItem>
                        <SelectItem value="it_asset_manager">IT Asset Manager (Assets & Inventory)</SelectItem>
                        <SelectItem value="admin">Administrator (Full System Control)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Temporary Password (optional)">
                    <Input
                      placeholder="Leave blank to auto-generate secure password"
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      If left blank, a secure random key like <code>PP360!ABC123</code> will be created.
                    </p>
                  </Field>

                  <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-primary leading-relaxed">
                    📧 <strong>Automatic Delivery:</strong> As soon as you click provision, an official onboarding email containing the login credentials and workspace link will be sent to <strong>{provisionTarget.email}</strong>.
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg border border-success/30 bg-success/10 p-4">
                    <p className="text-sm font-semibold text-success flex items-center gap-1.5">
                      <Check className="size-4" /> Account Provisioned &amp; Credentials Emailed!
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      An email was dispatched to <strong>{provisionResult.credentials.email}</strong>.
                    </p>

                    <div className="mt-3 rounded-md bg-background/80 p-2.5 border space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Email:</span>
                        <span>{provisionResult.credentials.email}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Temp Password:</span>
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-foreground">{provisionResult.credentials.temporaryPassword}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => copyPassword(provisionResult.credentials.temporaryPassword)}
                          >
                            {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {provisionResult.previewUrl && (
                      <div className="mt-3 text-center">
                        <a
                          href={provisionResult.previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          📬 Open Live Delivered Email in Webmail &rarr;
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              {!provisionResult ? (
                <>
                  <Button variant="outline" onClick={() => setProvisionTarget(null)}>
                    Cancel
                  </Button>
                  <Button onClick={handleExecuteProvision} disabled={provisionLoading}>
                    <Send className="mr-2 size-4" />
                    {provisionLoading ? "Provisioning & Emailing..." : "Provision & Email Credentials"}
                  </Button>
                </>
              ) : (
                <Button onClick={() => setProvisionTarget(null)}>Done</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dispatched Emails Audit Dialog */}
      <Dialog open={emailsDialogOpen} onOpenChange={setEmailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <Mail className="size-5" />
              <DialogTitle>Dispatched Credential Emails Log</DialogTitle>
            </div>
            <DialogDescription>
              Audit trail of employee login credentials dispatched via email.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-96 overflow-y-auto py-2">
            {loadingEmails ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading email log...</div>
            ) : dispatchedEmails.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No credentials emails recorded in this session yet. Provision an employee account to see the log here.
              </div>
            ) : (
              <div className="space-y-2.5">
                {dispatchedEmails.map((em) => (
                  <div key={em.id} className="rounded-lg border p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{em.employeeName}</span>
                      <span className="text-muted-foreground font-mono">{em.sentAt.slice(0, 16).replace("T", " ")}</span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>To: <strong>{em.to}</strong></span>
                      <span className="rounded bg-muted px-1.5 py-0.5 font-medium uppercase text-[10px]">{em.role}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between rounded bg-muted/60 px-2 py-1 font-mono">
                      <span>Temp Password: <strong>{em.temporaryPassword}</strong></span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 px-1 text-[11px]"
                        onClick={() => copyPassword(em.temporaryPassword)}
                      >
                        <Copy className="size-3 mr-1" /> Copy
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
