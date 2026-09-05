import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  KeyRound,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
import type { Employee, OnboardingCase, OnboardingStatus, ProvisioningRecord } from "@/lib/mock-data";

export const Route = createFileRoute("/app/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding & Account Provisioning · PeoplePay360" },
      { name: "description", content: "End-to-end new hire onboarding, automated IT account provisioning and activation tracking." },
      { property: "og:title", content: "Onboarding · PeoplePay360" },
    ],
  }),
  component: OnboardingPage,
});

const emptyHireForm = {
  name: "",
  email: "",
  department: "Engineering",
  designation: "",
  joiningDate: new Date().toISOString().slice(0, 10),
  employmentType: "Full-time" as Employee["employmentType"],
  manager: "Sana Iqbal",
  ctc: "1800000",
};

export function OnboardingPage() {
  const {
    onboarding,
    employees,
    provisioning,
    addEmployee,
    update,
    log,
    patchEmployee,
    retryProvisioning,
    role,
  } = useApp();
  const nameOf = useEmployeeName();
  const ready = useDelayed();

  const [hireOpen, setHireOpen] = useState(false);
  const [hireForm, setHireForm] = useState(emptyHireForm);
  const [hireErrors, setHireErrors] = useState<Record<string, string | undefined>>({});

  const [activeChecklistCase, setActiveChecklistCase] = useState<OnboardingCase | null>(null);
  const [inviteSimCase, setInviteSimCase] = useState<OnboardingCase | null>(null);
  const [simPassword, setSimPassword] = useState("");
  const [simPasswordError, setSimPasswordError] = useState("");
  const [simStep, setSimStep] = useState<"email" | "password" | "done">("email");

  const [showProvisioningDetails, setShowProvisioningDetails] = useState<ProvisioningRecord | null>(null);

  const canManage = role === "hr_manager" || role === "admin" || role === "hr_user";

  const totalCases = onboarding.length;
  const inProgressCases = onboarding.filter((c) => c.status === "In Progress" || c.status === "Account Created").length;
  const completedCases = onboarding.filter((c) => c.status === "Completed").length;
  const overdueCases = onboarding.filter((c) => c.status === "Overdue").length;

  const handleCreateNewHire = () => {
    const next: Record<string, string | undefined> = {};
    if (hireForm.name.trim().length < 3) next["name"] = "Full name is required.";
    if (!/^\S+@\S+\.\S+$/.test(hireForm.email)) next["email"] = "Valid work email is required.";
    if (!hireForm.designation.trim()) next["designation"] = "Job title is required.";
    if (!hireForm.joiningDate) next["joiningDate"] = "Joining date is required.";
    setHireErrors(next);
    if (Object.keys(next).length) return;

    const empId = `E${1013 + employees.length}`;
    const empCode = `PP-${1013 + employees.length}`;

    // 1. Create employee record
    const emp: Employee = {
      id: empId,
      code: empCode,
      name: hireForm.name.trim(),
      email: hireForm.email.trim(),
      phone: "+91 98000 12345",
      department: hireForm.department,
      designation: hireForm.designation.trim(),
      location: "Ahmedabad",
      manager: hireForm.manager,
      employmentType: hireForm.employmentType,
      status: "onboarding",
      joinedOn: hireForm.joiningDate,
      ctc: Number(hireForm.ctc) || 1800000,
      bankAccount: "Pending",
      pan: "Pending",
      leaveBalance: 12,
    };
    addEmployee(emp);

    // 2. Create simulated provisioning record
    const prov: ProvisioningRecord = {
      id: `PRV-${Date.now().toString().slice(-4)}`,
      employeeId: empId,
      employeeName: emp.name,
      companyEmail: emp.email,
      overallStatus: "In Progress",
      invitationStatus: "Sent",
      accountActivated: false,
      defaultPermissions: ["Self-service Workspace", "Leave Application", "Expense Claims", "Profile Access"],
      startedAt: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      steps: [
        { step: 1, key: "record_created", label: "Employee record created in HRIS", status: "completed" },
        { step: 2, key: "email_generated", label: `Company email generated (${emp.email})`, status: "completed" },
        { step: 3, key: "invite_sent", label: "Invitation email dispatched to employee inbox", status: "completed" },
        { step: 4, key: "account_activated", label: "Employee password creation & activation", status: "in_progress" },
        { step: 5, key: "permissions_assigned", label: "Default workspace permissions mapping", status: "pending" },
        { step: 6, key: "onboarding_started", label: "Day-1 onboarding checklist assignment", status: "pending" },
      ],
    };
    update("provisioning", [prov, ...provisioning]);

    // 3. Create onboarding case with exact 8 checklist items
    const onCase: OnboardingCase = {
      id: `ON-${200 + onboarding.length + 5}`,
      employeeId: empId,
      startDate: hireForm.joiningDate,
      dueDate: new Date(new Date(hireForm.joiningDate).setDate(new Date(hireForm.joiningDate).getDate() + 14))
        .toISOString()
        .slice(0, 10),
      buddy: hireForm.manager,
      assignedHr: "Sana Iqbal",
      status: "Invitation Sent",
      invitationSentDate: new Date().toISOString().slice(0, 10),
      tasks: [
        { id: "t1", label: "Complete personal profile", owner: "Employee", done: false, category: "Personal" },
        { id: "t2", label: "Add emergency contact", owner: "Employee", done: false, category: "Personal" },
        { id: "t3", label: "Accept company policies", owner: "Employee", done: false, category: "Compliance" },
        { id: "t4", label: "Complete bank details", owner: "Payroll", done: false, category: "Finance" },
        { id: "t5", label: "Complete tax information", owner: "Payroll", done: false, category: "Finance" },
        { id: "t6", label: "Review contract", owner: "HR", done: false, category: "Legal" },
        { id: "t7", label: "Attend orientation", owner: "HR", done: false, category: "Orientation" },
        { id: "t8", label: "Receive company assets", owner: "IT", done: false, category: "IT" },
      ],
    };
    update("onboarding", [onCase, ...onboarding]);

    log(`Created employee account for ${emp.name} & initiated auto-provisioning`, "Provisioning");
    toast.success("Employee account created & invite sent", {
      description: `Automatic provisioning initiated for ${emp.email}`,
    });

    setHireOpen(false);
    setHireForm(emptyHireForm);
  };

  const handleToggleTask = (caseId: string, taskId: string) => {
    const updated = onboarding.map((c) => {
      if (c.id !== caseId) return c;
      const tasks = c.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t));
      const doneCount = tasks.filter((t) => t.done).length;
      const allDone = doneCount === tasks.length;
      const nextStatus: OnboardingStatus = allDone ? "Completed" : "In Progress";

      if (allDone) {
        patchEmployee(c.employeeId, { status: "active" });
        toast.success(`${nameOf(c.employeeId)} completed all onboarding tasks!`, {
          description: "Status moved to Active across all modules.",
        });
        log(`Completed onboarding for ${nameOf(c.employeeId)}`, "Onboarding");
      }

      return {
        ...c,
        tasks,
        status: nextStatus,
        completedDate: allDone ? new Date().toISOString().slice(0, 10) : undefined,
      };
    });

    update("onboarding", updated);
    if (activeChecklistCase?.id === caseId) {
      setActiveChecklistCase(updated.find((c) => c.id === caseId) ?? null);
    }
  };

  const handleResendInvite = (c: OnboardingCase) => {
    const nextDate = new Date().toISOString().slice(0, 10);
    update(
      "onboarding",
      onboarding.map((item) =>
        item.id === c.id
          ? { ...item, status: "Invitation Sent", invitationSentDate: nextDate }
          : item,
      ),
    );
    log(`Resent onboarding invitation email to ${nameOf(c.employeeId)}`, "Onboarding");
    toast.success("Invitation email re-dispatched", {
      description: `Sent to ${employees.find((e) => e.id === c.employeeId)?.email}`,
    });
  };

  const openSimulatedEmail = (c: OnboardingCase) => {
    setInviteSimCase(c);
    setSimStep("email");
    setSimPassword("");
    setSimPasswordError("");
  };

  const handleSimulateActivatePassword = () => {
    if (simPassword.length < 6) {
      setSimPasswordError("Password must be at least 6 characters.");
      return;
    }
    if (!inviteSimCase) return;

    // Update onboarding to Account Created / In Progress
    update(
      "onboarding",
      onboarding.map((item) =>
        item.id === inviteSimCase.id
          ? {
              ...item,
              status: "Account Created",
              accountCreatedDate: new Date().toISOString().slice(0, 10),
            }
          : item,
      ),
    );

    // Update provisioning status to completed
    update(
      "provisioning",
      provisioning.map((p) =>
        p.employeeId === inviteSimCase.employeeId
          ? {
              ...p,
              overallStatus: "Completed",
              accountActivated: true,
              steps: p.steps.map((st) => ({ ...st, status: "completed" as const })),
            }
          : p,
      ),
    );

    log(`Employee ${nameOf(inviteSimCase.employeeId)} activated account & set password`, "Provisioning");
    toast.success("Account successfully activated!", {
      description: "You may now begin your Day-1 onboarding checklist.",
    });

    setSimStep("done");
  };

  return (
    <>
      <PageHeader
        title="Employee Onboarding"
        description="Lifecycle tracking from invitation dispatch to Day-1 checklist readiness, accompanied by automated IT provisioning."
        actions={
          canManage && (
            <Button onClick={() => setHireOpen(true)}>
              <UserPlus className="mr-2 size-4" /> Create Employee Account
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Onboarding Cases"
          value={totalCases}
          hint="All time logged"
          icon={<Users className="size-5" />}
          tone="default"
        />
        <StatCard
          label="In Progress / Active"
          value={inProgressCases}
          hint="Working through checklists"
          icon={<Clock className="size-5" />}
          tone="warning"
        />
        <StatCard
          label="Completed Onboarding"
          value={completedCases}
          hint="Successfully cleared to active"
          icon={<CheckCircle2 className="size-5" />}
          tone="success"
        />
        <StatCard
          label="Overdue Checklists"
          value={overdueCases}
          hint="Pending past target due date"
          icon={<XCircle className="size-5" />}
          tone="default"
        />
      </div>

      {/* Account Provisioning Live Simulation Banner */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <CardTitle className="text-base">Automatic Employee Account Provisioning</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">Connected to HRIS Onboarding</span>
          </div>
          <CardDescription>
            When HR registers an employee, PeoplePay360 automatically provisions company Google Workspace email,
            dispatches invite tokens, and assigns default zero-trust permissions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {provisioning.slice(0, 3).map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-border bg-card p-3 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">{p.employeeName}</span>
                  <StatusBadge status={p.overallStatus} />
                </div>
                <p className="text-muted-foreground truncate">{p.companyEmail}</p>
                <div className="flex items-center justify-between pt-1 text-[0.7rem] text-muted-foreground">
                  <span>{p.steps.filter((s) => s.status === "completed").length}/6 steps completed</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5 text-xs text-primary"
                    onClick={() => setShowProvisioningDetails(p)}
                  >
                    View Pipeline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Onboarding Cases Table */}
      <Card>
        <CardHeader>
          <CardTitle>Onboarding Pipeline ({onboarding.length})</CardTitle>
          <CardDescription>
            Monitor employee invitation status, checklist progress, and completion deadlines
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!ready ? (
            <div className="p-4">
              <TableSkeleton rows={4} />
            </div>
          ) : onboarding.length === 0 ? (
            <EmptyState
              title="No onboarding cases"
              description="Click 'Create Employee Account' to start a new onboarding flow."
              icon={<UserPlus className="size-8" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case ID</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Assigned HR Manager</TableHead>
                    <TableHead>Checklist Progress</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {onboarding.map((c) => {
                    const emp = employees.find((e) => e.id === c.employeeId);
                    const doneCount = c.tasks.filter((t) => t.done).length;
                    const percent = Math.round((doneCount / c.tasks.length) * 100);

                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs font-semibold text-primary">
                          {c.id}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{emp ? emp.name : nameOf(c.employeeId)}</div>
                          <div className="text-xs text-muted-foreground">{emp?.email}</div>
                        </TableCell>
                        <TableCell>{c.assignedHr || "Sana Iqbal"}</TableCell>
                        <TableCell className="w-[180px]">
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>{doneCount} of {c.tasks.length} tasks</span>
                              <span className="font-medium">{percent}%</span>
                            </div>
                            <Progress value={percent} className="h-1.5" />
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.dueDate}
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
                              onClick={() => setActiveChecklistCase(c)}
                              title="View checklist tasks"
                            >
                              <Eye className="size-3.5 mr-1" /> Checklist
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-primary"
                              onClick={() => openSimulatedEmail(c)}
                              title="Simulate Employee Invitation Email"
                            >
                              <Mail className="size-3.5 mr-1" /> Simulated Invite
                            </Button>

                            {canManage && c.status !== "Completed" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-muted-foreground hover:text-foreground"
                                onClick={() => handleResendInvite(c)}
                                title="Resend invitation"
                              >
                                <Send className="size-3.5" />
                              </Button>
                            )}
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

      {/* HR New Hire Creation Modal (Exact Section 9 Flow) */}
      <Dialog open={hireOpen} onOpenChange={setHireOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>HR Employee Account Creation</DialogTitle>
            <DialogDescription>
              Enter new hire details to register employee record and dispatch simulated email invitation.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full Name" error={hireErrors.name}>
                <Input
                  placeholder="e.g. Tanvi Joshi"
                  value={hireForm.name}
                  onChange={(e) => setHireForm({ ...hireForm, name: e.target.value })}
                />
              </Field>

              <Field label="Work Email" error={hireErrors.email}>
                <Input
                  type="email"
                  placeholder="tanvi.joshi@peoplepay360.io"
                  value={hireForm.email}
                  onChange={(e) => setHireForm({ ...hireForm, email: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Department">
                <Select
                  value={hireForm.department}
                  onValueChange={(v) => setHireForm({ ...hireForm, department: v })}
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

              <Field label="Job Title" error={hireErrors.designation}>
                <Input
                  placeholder="e.g. Cloud Architect"
                  value={hireForm.designation}
                  onChange={(e) => setHireForm({ ...hireForm, designation: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Joining Date" error={hireErrors.joiningDate}>
                <Input
                  type="date"
                  value={hireForm.joiningDate}
                  onChange={(e) => setHireForm({ ...hireForm, joiningDate: e.target.value })}
                />
              </Field>

              <Field label="Employment Type">
                <Select
                  value={hireForm.employmentType}
                  onValueChange={(v) =>
                    setHireForm({ ...hireForm, employmentType: v as Employee["employmentType"] })
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
                  value={hireForm.manager}
                  onValueChange={(v) => setHireForm({ ...hireForm, manager: v })}
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

              <Field label="Annual Base CTC (₹)">
                <Input
                  type="number"
                  placeholder="e.g. 2100000"
                  value={hireForm.ctc}
                  onChange={(e) => setHireForm({ ...hireForm, ctc: e.target.value })}
                />
              </Field>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setHireOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateNewHire}>Create Account & Dispatch Invitation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checklist Drawer Modal */}
      {activeChecklistCase && (
        <Dialog open={!!activeChecklistCase} onOpenChange={(o) => !o && setActiveChecklistCase(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>Onboarding Checklist</DialogTitle>
                <StatusBadge status={activeChecklistCase.status} />
              </div>
              <DialogDescription>
                {nameOf(activeChecklistCase.employeeId)} · Target Due: {activeChecklistCase.dueDate}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <p className="text-xs text-muted-foreground">
                Mandatory day-one checklist items for new employees. Toggle items as they are completed:
              </p>

              <div className="space-y-2 rounded-lg border border-border p-3">
                {activeChecklistCase.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-md p-2 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={task.id}
                        checked={task.done}
                        onCheckedChange={() => handleToggleTask(activeChecklistCase.id, task.id)}
                      />
                      <label
                        htmlFor={task.id}
                        className={`text-sm cursor-pointer ${
                          task.done ? "line-through text-muted-foreground" : "font-medium"
                        }`}
                      >
                        {task.label}
                      </label>
                    </div>
                    <span className="text-[0.7rem] uppercase font-semibold text-muted-foreground border rounded px-1.5 py-0.5">
                      {task.owner}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setActiveChecklistCase(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Simulated Email & Account Activation Experience (Section 9 & 19) */}
      {inviteSimCase && (
        <Dialog open={!!inviteSimCase} onOpenChange={(o) => !o && setInviteSimCase(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="size-5 text-primary" /> Simulated Employee Invitation
              </DialogTitle>
              <DialogDescription>
                Simulates what the new hire receives in their personal email inbox.
              </DialogDescription>
            </DialogHeader>

            {simStep === "email" && (
              <div className="space-y-4 py-2 text-sm">
                <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1 text-xs">
                  <p><span className="font-semibold">To:</span> {employees.find((e) => e.id === inviteSimCase.employeeId)?.email}</p>
                  <p><span className="font-semibold">From:</span> hr-noreply@peoplepay360.io</p>
                  <p><span className="font-semibold">Subject:</span> Welcome to PeoplePay360 — Set up your corporate account</p>
                </div>

                <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
                  <p className="font-medium text-foreground">
                    Dear {nameOf(inviteSimCase.employeeId)},
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Welcome to the team! Your employee profile has been created. Click the link below to set your account password and begin your onboarding checklist:
                  </p>

                  <Button className="w-full mt-2" onClick={() => setSimStep("password")}>
                    Set Password & Activate Account <ArrowRight className="size-4 ml-1.5" />
                  </Button>
                </div>
              </div>
            )}

            {simStep === "password" && (
              <div className="space-y-4 py-2">
                <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <KeyRound className="size-5 text-primary" />
                    <p className="font-medium text-sm">Set Your Workspace Password</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Create a secure password to unlock your PeoplePay360 self-service workspace:
                  </p>

                  <Field label="New Password" error={simPasswordError}>
                    <Input
                      type="password"
                      placeholder="Minimum 6 characters"
                      value={simPassword}
                      onChange={(e) => {
                        setSimPassword(e.target.value);
                        setSimPasswordError("");
                      }}
                    />
                  </Field>

                  <Button className="w-full" onClick={handleSimulateActivatePassword}>
                    Activate & Begin Onboarding
                  </Button>
                </div>
              </div>
            )}

            {simStep === "done" && (
              <div className="space-y-4 py-4 text-center">
                <div className="rounded-full bg-success/15 p-3 text-success inline-flex">
                  <CheckCircle2 className="size-8" />
                </div>
                <h3 className="font-bold text-lg">Account Activated!</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Account status updated to Activated. Default zero-trust permissions and day-one onboarding checklist have been provisioned.
                </p>
                <Button
                  className="w-full"
                  onClick={() => {
                    const c = inviteSimCase;
                    setInviteSimCase(null);
                    if (c) setActiveChecklistCase(c);
                  }}
                >
                  Open Onboarding Checklist
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Provisioning Pipeline Details Modal (Section 19) */}
      {showProvisioningDetails && (
        <Dialog
          open={!!showProvisioningDetails}
          onOpenChange={(o) => !o && setShowProvisioningDetails(null)}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>Account Provisioning Pipeline</DialogTitle>
                <StatusBadge status={showProvisioningDetails.overallStatus} />
              </div>
              <DialogDescription>
                Automated account creation telemetry for {showProvisioningDetails.employeeName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs space-y-1">
                <p><span className="text-muted-foreground">Corporate Email:</span> {showProvisioningDetails.companyEmail}</p>
                <p><span className="text-muted-foreground">Account Status:</span> {showProvisioningDetails.accountActivated ? "Activated" : "Pending Password"}</p>
                <p><span className="text-muted-foreground">Assigned Roles:</span> {showProvisioningDetails.defaultPermissions.join(", ")}</p>
              </div>

              <div className="space-y-2 border rounded-lg p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Telemetry Checklist Steps
                </p>
                {showProvisioningDetails.steps.map((st) => (
                  <div key={st.key} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                    <span className="font-medium">
                      {st.step}. {st.label}
                    </span>
                    <StatusBadge status={st.status} />
                  </div>
                ))}
              </div>

              {showProvisioningDetails.overallStatus === "Failed" && (
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => {
                    retryProvisioning(showProvisioningDetails.id);
                    toast.success("Retried provisioning pipeline successfully");
                  }}
                >
                  <RefreshCw className="size-4 mr-2" /> Retry Failed Provisioning
                </Button>
              )}
            </div>

            <DialogFooter>
              <Button onClick={() => setShowProvisioningDetails(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
