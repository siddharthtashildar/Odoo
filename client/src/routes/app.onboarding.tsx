import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Laptop,
  Layers,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  RotateCcw,
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
import { api } from "@/lib/api";
import type { Employee, OnboardingCase, OnboardingStatus } from "@/lib/mock-data";

export const Route = createFileRoute("/app/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding · PeoplePay360" },
      { name: "description", content: "End-to-end new hire onboarding and activation tracking." },
      { property: "og:title", content: "Onboarding · PeoplePay360" },
    ],
  }),
  component: OnboardingPage,
});

export interface ProvisionServiceItem {
  serviceName: string;
  category: string;
  username: string;
  password: string;
  enabled: boolean;
  showPassword?: boolean;
}

export function generateSecurePassword(prefix: string = "PP360"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let randomPart = "";
  for (let i = 0; i < 6; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}!${randomPart}#`;
}

const emptyHireForm = {
  name: "",
  email: "",
  department: "Engineering",
  designation: "",
  joiningDate: new Date().toISOString().slice(0, 10),
  employmentType: "Full-time" as Employee["employmentType"],
  manager: "",
  ctc: "1800000",
};

export function OnboardingPage() {
  const {
    onboarding,
    employees,
    log,
    patchEmployee,
    role,
    addOnboardingCase,
    updateOnboardingTask,
    updateOnboardingStatus,
    refreshSlice,
  } = useApp();
  const nameOf = useEmployeeName();
  const ready = useDelayed();

  const [pipelineFilter, setPipelineFilter] = useState<"active" | "completed" | "all">("active");

  const [hireOpen, setHireOpen] = useState(false);
  const [hireForm, setHireForm] = useState(emptyHireForm);
  const [hireErrors, setHireErrors] = useState<Record<string, string | undefined>>({});
  const [creatingHire, setCreatingHire] = useState(false);

  const [activeChecklistCaseId, setActiveChecklistCaseId] = useState<string | null>(null);
  const activeChecklistCase = onboarding.find((c) => c.id === activeChecklistCaseId) ?? null;

  const [resendingId, setResendingId] = useState<string | null>(null);

  // ── Hardware Asset Allotment State ──
  const [allotModalCase, setAllotModalCase] = useState<OnboardingCase | null>(null);
  const [allotMode, setAllotMode] = useState<"inventory" | "new">("new");
  const [availableAssets, setAvailableAssets] = useState<any[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [assetForm, setAssetForm] = useState({
    assetType: "MacBook Pro 16\" M3 Max",
    assetCode: `AST-${Math.floor(1000 + Math.random() * 9000)}`,
    serialNumber: "",
    condition: "good",
    location: "HQ Operations",
  });
  const [submittingAsset, setSubmittingAsset] = useState(false);

  // ── Work Accounts Provisioning State ──
  const [provisionModalCase, setProvisionModalCase] = useState<OnboardingCase | null>(null);
  const [provisionServices, setProvisionServices] = useState<ProvisionServiceItem[]>([]);
  const [submittingAccounts, setSubmittingAccounts] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ── Loaded Extras for Active Checklist ──
  const [caseAssets, setCaseAssets] = useState<any[]>([]);
  const [caseAccounts, setCaseAccounts] = useState<any[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(false);

  useEffect(() => {
    if (!activeChecklistCaseId) {
      setCaseAssets([]);
      setCaseAccounts([]);
      return;
    }
    let isSubscribed = true;
    setLoadingExtras(true);
    Promise.all([
      api.onboarding.getAssets(activeChecklistCaseId).catch(() => []),
      api.onboarding.getServiceAccounts(activeChecklistCaseId).catch(() => []),
    ]).then(([assetsData, accountsData]) => {
      if (isSubscribed) {
        setCaseAssets(assetsData || []);
        setCaseAccounts(accountsData || []);
        setLoadingExtras(false);
      }
    });
    return () => {
      isSubscribed = false;
    };
  }, [activeChecklistCaseId]);

  const openAllotModal = async (c: OnboardingCase) => {
    setAllotModalCase(c);
    setAssetForm({
      assetType: "MacBook Pro 16\" M3 Max",
      assetCode: `AST-${Math.floor(1000 + Math.random() * 9000)}`,
      serialNumber: "",
      condition: "good",
      location: "HQ Operations",
    });
    try {
      const list = await api.assets.list();
      if (Array.isArray(list)) {
        const available = (list as any[]).filter((a: any) => String(a.status).toLowerCase() === "available");
        setAvailableAssets(available);
        const first = available[0] as any;
        if (first?.id) {
          setSelectedAssetId(first.id);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch available assets", e);
    }
  };

  const openProvisionModal = (c: OnboardingCase) => {
    const emp = employees.find((e) => e.id === c.employeeId || e.code === c.employeeCode);
    const empName = emp?.name || nameOf(c.employeeId);
    const slug = empName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const dotSlug = empName.toLowerCase().replace(/[^a-z0-9]+/g, ".");
    const email = emp?.email || `${dotSlug}@peoplepay360.io`;

    setProvisionModalCase(c);
    setProvisionServices([
      {
        serviceName: "GitHub Enterprise",
        category: "Source Code & CI/CD",
        username: `${slug}-dev`,
        password: generateSecurePassword("Git"),
        enabled: true,
        showPassword: true,
      },
      {
        serviceName: "Slack Workspace",
        category: "Team Chat & Collaboration",
        username: `@${dotSlug}`,
        password: generateSecurePassword("Slk"),
        enabled: true,
        showPassword: true,
      },
      {
        serviceName: "Google Workspace / Outlook",
        category: "Official Corporate Email & GDrive",
        username: email,
        password: generateSecurePassword("Gwp"),
        enabled: true,
        showPassword: true,
      },
      {
        serviceName: "Notion Knowledgebase",
        category: "Documentation & SOPs",
        username: email,
        password: generateSecurePassword("Not"),
        enabled: true,
        showPassword: true,
      },
      {
        serviceName: "Jira & Confluence",
        category: "Sprint Boards & Product Trackers",
        username: email,
        password: generateSecurePassword("Jira"),
        enabled: true,
        showPassword: true,
      },
      {
        serviceName: "AWS Cloud Console",
        category: "Cloud Infrastructure Sandbox",
        username: `${slug}-iam`,
        password: generateSecurePassword("AWS"),
        enabled: false,
        showPassword: true,
      },
    ]);
  };

  const handleCopyPassword = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Password copied to clipboard");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRegeneratePassword = (idx: number) => {
    setProvisionServices((prev) =>
      prev.map((s, i) =>
        i === idx
          ? {
              ...s,
              password: generateSecurePassword(
                s.serviceName.slice(0, 3).trim().replace(/[^a-zA-Z]/g, "") || "PP"
              ),
            }
          : s
      )
    );
  };

  const handleRegenerateAllPasswords = () => {
    setProvisionServices((prev) =>
      prev.map((s) => ({
        ...s,
        password: generateSecurePassword(
          s.serviceName.slice(0, 3).trim().replace(/[^a-zA-Z]/g, "") || "PP"
        ),
      }))
    );
    toast.info("Generated fresh temporary passwords for all accounts");
  };

  const handleToggleSelectAll = () => {
    const allEnabled = provisionServices.every((s) => s.enabled);
    setProvisionServices((prev) =>
      prev.map((s) => ({ ...s, enabled: !allEnabled }))
    );
  };

  const handleAllotAsset = async () => {
    if (!allotModalCase) return;
    setSubmittingAsset(true);
    try {
      const emp = employees.find((e) => e.id === allotModalCase.employeeId || e.code === allotModalCase.employeeCode);
      let payload: any;
      if (allotMode === "inventory" && selectedAssetId) {
        const picked = availableAssets.find((a) => a.id === selectedAssetId);
        payload = {
          assetId: selectedAssetId,
          assetType: picked?.assetType || picked?.name || "Equipment",
          assetCode: picked?.assetCode || picked?.tag || "AST-INV",
        };
      } else {
        payload = {
          assetType: assetForm.assetType,
          assetCode: assetForm.assetCode,
          serialNumber: assetForm.serialNumber || undefined,
          condition: assetForm.condition,
          location: assetForm.location,
        };
      }

      const assigned: any = await api.onboarding.allotAsset(allotModalCase.id, payload);
      toast.success(`Asset ${assigned.assetCode} allocated!`, {
        description: `Confirmation email dispatched to ${emp?.email || "employee"}.`,
      });
      log(`Allotted asset ${assigned.assetCode} (${assigned.assetType}) to ${emp?.name || nameOf(allotModalCase.employeeId)}`, "Assets");

      if (assigned?.isCompleted) {
        patchEmployee(allotModalCase.employeeId, { status: "active" });
        toast.success(`🎉 Onboarding completed for ${emp?.name || nameOf(allotModalCase.employeeId)}!`, {
          description: "All 3 criteria satisfied (checklist 100%, hardware asset, and work accounts). Employee is now Active.",
        });
        log(`Completed onboarding for ${emp?.name || nameOf(allotModalCase.employeeId)}`, "Onboarding");
      }

      await refreshSlice("onboarding");
      await refreshSlice("employees");

      if (activeChecklistCaseId === allotModalCase.id) {
        const fresh = await api.onboarding.getAssets(allotModalCase.id);
        setCaseAssets(fresh);
      }
      setAllotModalCase(null);
    } catch (err: any) {
      toast.error("Failed to allocate asset", { description: err?.message });
    } finally {
      setSubmittingAsset(false);
    }
  };

  const handleProvisionAccounts = async () => {
    if (!provisionModalCase) return;
    const selected = provisionServices.filter((s) => s.enabled);
    if (selected.length === 0) {
      toast.error("Please select at least one account to provision.");
      return;
    }
    setSubmittingAccounts(true);
    try {
      const emp = employees.find((e) => e.id === provisionModalCase.employeeId || e.code === provisionModalCase.employeeCode);
      const accountsPayload = selected.map((s) => ({
        serviceName: s.serviceName,
        username: s.username,
        password: s.password,
      }));

      const res: any = await api.onboarding.createServiceAccounts(provisionModalCase.id, accountsPayload);
      toast.success(`${selected.length} work accounts provisioned!`, {
        description: `Credentials & access setup email dispatched to ${emp?.email || "employee"}.`,
      });
      log(
        `Provisioned ${selected.length} accounts (${selected.map((s) => s.serviceName).join(", ")}) for ${emp?.name || nameOf(provisionModalCase.employeeId)}`,
        "Onboarding",
      );

      if (res?.isCompleted) {
        patchEmployee(provisionModalCase.employeeId, { status: "active" });
        toast.success(`🎉 Onboarding completed for ${emp?.name || nameOf(provisionModalCase.employeeId)}!`, {
          description: "All 3 criteria satisfied (checklist 100%, hardware asset, and work accounts). Employee is now Active.",
        });
        log(`Completed onboarding for ${emp?.name || nameOf(provisionModalCase.employeeId)}`, "Onboarding");
      }

      await refreshSlice("onboarding");
      await refreshSlice("employees");

      if (activeChecklistCaseId === provisionModalCase.id) {
        const fresh = await api.onboarding.getServiceAccounts(provisionModalCase.id);
        setCaseAccounts(fresh);
      }
      setProvisionModalCase(null);
    } catch (err: any) {
      toast.error("Failed to provision accounts", { description: err?.message });
    } finally {
      setSubmittingAccounts(false);
    }
  };

  const canManage = role === "hr_manager" || role === "admin" || role === "payroll_manager" || role === "payroll_user";

  const totalCases = onboarding.length;
  const inProgressCases = onboarding.filter((c) => c.status === "In Progress").length;
  const invitationSentCases = onboarding.filter((c) => c.status === "Invitation Sent").length;
  const completedCases = onboarding.filter((c) => c.status === "Completed").length;
  const overdueCases = onboarding.filter((c) => c.status === "Overdue").length;
  const activeCases = onboarding.filter((c) => c.status !== "Completed");
  const filteredCases: OnboardingCase[] = onboarding.filter((c) => {
    if (pipelineFilter === "active") return c.status !== "Completed";
    if (pipelineFilter === "completed") return c.status === "Completed";
    return true;
  });

  const handleCreateNewHire = async () => {
    const next: Record<string, string | undefined> = {};
    if (hireForm.name.trim().length < 3) next["name"] = "Full name is required.";
    if (!/^\S+@\S+\.\S+$/.test(hireForm.email)) next["email"] = "Valid work email is required.";
    if (!hireForm.designation.trim()) next["designation"] = "Job title is required.";
    if (!hireForm.joiningDate) next["joiningDate"] = "Joining date is required.";
    setHireErrors(next);
    if (Object.keys(next).length) return;

    setCreatingHire(true);
    try {
      // 1. Create employee in DB with autoProvision: true to send live credentials email!
      const created = await api.employees.create({
        name: hireForm.name.trim(),
        email: hireForm.email.trim(),
        department: hireForm.department,
        designation: hireForm.designation.trim(),
        manager: hireForm.manager || undefined,
        employmentType: hireForm.employmentType,
        joinedOn: hireForm.joiningDate,
        ctc: Number(hireForm.ctc) || 1800000,
        location: "Headquarters",
        autoProvision: true,
        role: "employee",
        status: "onboarding",
      });

      // 2. Create onboarding case in DB & refresh store slices
      await addOnboardingCase(created.id, "HR Operations", hireForm.manager);
      await refreshSlice("employees");
      await refreshSlice("onboarding");

      log(`Created employee account for ${created.name} & dispatched credentials email`, "Onboarding");
      toast.success("Employee created & credentials dispatched", {
        description: `Welcome email with password setup link sent to ${created.email}`,
      });

      setHireOpen(false);
      setHireForm(emptyHireForm);
    } catch (err: any) {
      toast.error("Failed to create employee", { description: err?.message });
    } finally {
      setCreatingHire(false);
    }
  };

  const handleToggleTask = async (caseId: string, taskId: string) => {
    const caseItem = onboarding.find((c) => c.id === caseId);
    if (!caseItem) return;
    const task = caseItem.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newDone = !task.done;

    await updateOnboardingTask(caseId, taskId, newDone);

    // Check if all tasks now done
    const updatedTasks = caseItem.tasks.map((t) => (t.id === taskId ? { ...t, done: newDone } : t));
    const allDone = updatedTasks.every((t) => t.done);
    if (allDone) {
      const hasAsset = Boolean(caseItem.hasAsset);
      const hasAccounts = Boolean(caseItem.hasAccounts);
      if (hasAsset && hasAccounts) {
        patchEmployee(caseItem.employeeId, { status: "active" });
        toast.success(`🎉 ${nameOf(caseItem.employeeId)} completed onboarding!`, {
          description: "All 3 criteria satisfied (checklist 100%, hardware asset, and work accounts). Employee is now Active.",
        });
        log(`Completed onboarding for ${nameOf(caseItem.employeeId)}`, "Onboarding");
      } else {
        const pendingItems = [
          !hasAsset ? "Hardware Asset Allocation" : "",
          !hasAccounts ? "Work Accounts Provisioning" : "",
        ].filter(Boolean);
        toast.info(`Checklist 100% completed for ${nameOf(caseItem.employeeId)}`, {
          description: `To complete onboarding & activate employee, please fulfill: ${pendingItems.join(" and ")}.`,
        });
      }
    }
  };

  const handleResendInvite = async (c: OnboardingCase) => {
    const emp = employees.find((e) => e.id === c.employeeId || e.code === c.employeeCode);
    const targetEmail = emp?.email;
    if (!targetEmail) {
      toast.error("Employee email not found");
      return;
    }

    setResendingId(c.id);
    try {
      await api.auth.provisionUser(
        { employeeId: c.employeeId, email: targetEmail, role: "employee" },
        role,
      );
      toast.success("Credentials email sent", {
        description: `Welcome email with password change link dispatched to ${targetEmail}`,
      });
      log(`Dispatched credentials email to ${targetEmail}`, "Onboarding");
    } catch (err: any) {
      toast.error("Failed to send credentials email", { description: err?.message });
    } finally {
      setResendingId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Employee Onboarding"
        description="Lifecycle tracking from invitation dispatch to Day-1 checklist readiness."
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
          hint="All active processes"
          icon={<Users className="size-5" />}
          tone="default"
        />
        <StatCard
          label="Invitation Sent"
          value={invitationSentCases}
          hint="Awaiting first password change"
          icon={<Mail className="size-5" />}
          tone="default"
        />
        <StatCard
          label="In Progress / Active"
          value={inProgressCases}
          hint="Password set & completing checklist"
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
      </div>

      {/* Main Onboarding Cases Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle>
              {pipelineFilter === "active" ? `Active Onboarding Pipeline (${activeCases.length})` : pipelineFilter === "completed" ? `Completed Onboardings (${completedCases})` : `All Onboarding Cases (${totalCases})`}
            </CardTitle>
            <CardDescription>
              {pipelineFilter === "active" ? "Pending and in-progress new hire activations awaiting checklist completion" : "Archived records of successfully onboarded personnel"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border p-1 bg-muted/30 self-start sm:self-auto">
            <Button
              type="button"
              size="sm"
              variant={pipelineFilter === "active" ? "secondary" : "ghost"}
              className="h-7 text-xs px-2.5 font-medium"
              onClick={() => setPipelineFilter("active")}
            >
              Active ({activeCases.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={pipelineFilter === "completed" ? "secondary" : "ghost"}
              className="h-7 text-xs px-2.5 font-medium"
              onClick={() => setPipelineFilter("completed")}
            >
              Completed ({completedCases})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={pipelineFilter === "all" ? "secondary" : "ghost"}
              className="h-7 text-xs px-2.5 font-medium"
              onClick={() => setPipelineFilter("all")}
            >
              All ({totalCases})
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!ready ? (
            <div className="p-4">
              <TableSkeleton rows={4} />
            </div>
          ) : filteredCases.length === 0 ? (
            <EmptyState
              title={pipelineFilter === "active" ? "No active onboarding cases" : "No cases in this view"}
              description={pipelineFilter === "active" ? "All current new hires have completed onboarding. Click 'Create Employee Account' to register a new hire." : "Switch filters to view active cases."}
              icon={<UserPlus className="size-8" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case ID</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Assigned HR</TableHead>
                    <TableHead>Checklist Progress</TableHead>
                    <TableHead>Prerequisites</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCases.map((c) => {
                    const emp = employees.find((e) => e.id === c.employeeId || e.code === c.employeeCode);
                    const doneCount = c.tasks.filter((t) => t.done).length;
                    const percent = c.tasks.length > 0 ? Math.round((doneCount / c.tasks.length) * 100) : 0;

                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs font-semibold text-primary">
                          {c.id}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{emp ? emp.name : nameOf(c.employeeId)}</div>
                          <div className="text-xs text-muted-foreground">{emp?.email}</div>
                        </TableCell>
                        <TableCell>{c.assignedHr || "HR Operations"}</TableCell>
                        <TableCell className="w-[170px]">
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>{doneCount} of {c.tasks.length} tasks</span>
                              <span className="font-medium">{percent}%</span>
                            </div>
                            <Progress value={percent} className="h-1.5" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 text-[11px]">
                            <span
                              className={`inline-flex items-center gap-1 font-medium ${
                                c.hasAsset
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-amber-600 dark:text-amber-400"
                              }`}
                            >
                              <Laptop className="size-3 shrink-0" />
                              {c.hasAsset ? "Asset Allotted" : "Asset Pending"}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 font-medium ${
                                c.hasAccounts
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-amber-600 dark:text-amber-400"
                              }`}
                            >
                              <Layers className="size-3 shrink-0" />
                              {c.hasAccounts ? "Accounts Ready" : "Creds Pending"}
                            </span>
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
                              onClick={() => setActiveChecklistCaseId(c.id)}
                              title="View checklist tasks"
                            >
                              <Eye className="size-3.5 mr-1" /> Checklist
                            </Button>

                            {/* Direct actions for resource allocation & accounts generation */}
                            {canManage && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={`h-8 px-2 ${
                                    c.hasAsset
                                      ? "border-border text-muted-foreground hover:bg-muted/50"
                                      : "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-medium"
                                  }`}
                                  onClick={() => openAllotModal(c)}
                                  title={c.hasAsset ? "Manage allotted hardware asset" : "Allot hardware asset (Laptop, Monitor, etc.)"}
                                >
                                  <Laptop className="size-3.5 mr-1" /> {c.hasAsset ? "Asset" : "Allot Asset"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={`h-8 px-2 ${
                                    c.hasAccounts
                                      ? "border-border text-muted-foreground hover:bg-muted/50"
                                      : "border-primary/30 text-primary hover:bg-primary/10 font-medium"
                                  }`}
                                  onClick={() => openProvisionModal(c)}
                                  title={c.hasAccounts ? "Manage provisioned work accounts" : "Provision work accounts (GitHub, Slack, etc.)"}
                                >
                                  <Layers className="size-3.5 mr-1" /> {c.hasAccounts ? "Accounts" : "Provision"}
                                </Button>
                              </>
                            )}

                            {canManage && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-primary"
                                disabled={resendingId === c.id}
                                onClick={() => handleResendInvite(c)}
                                title="Send or resend credentials email with password link"
                              >
                                <Send className="size-3.5 mr-1" />
                                {resendingId === c.id ? "Sending..." : "Send Email"}
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

      {/* HR New Hire Creation Modal */}
      <Dialog open={hireOpen} onOpenChange={setHireOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Employee &amp; Dispatch Credentials</DialogTitle>
            <DialogDescription>
              Register employee record, auto-provision user account, and dispatch temporary credentials with a password reset redirect.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full Name" error={hireErrors["name"]}>
                <Input
                  placeholder="e.g. Tanvi Joshi"
                  value={hireForm.name}
                  onChange={(e) => setHireForm({ ...hireForm, name: e.target.value })}
                />
              </Field>

              <Field label="Work Email" error={hireErrors["email"]}>
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
                    {["Engineering", "Product", "HR", "Sales", "Marketing", "Finance", "Design", "Operations"].map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Job Title" error={hireErrors["designation"]}>
                <Input
                  placeholder="e.g. Senior Backend Engineer"
                  value={hireForm.designation}
                  onChange={(e) => setHireForm({ ...hireForm, designation: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Joining Date" error={hireErrors["joiningDate"]}>
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
                    <SelectItem value="Part-time">Part-time</SelectItem>
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
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.name}>
                        {e.name} ({e.designation})
                      </SelectItem>
                    ))}
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
            <Button variant="outline" onClick={() => setHireOpen(false)} disabled={creatingHire}>
              Cancel
            </Button>
            <Button onClick={handleCreateNewHire} disabled={creatingHire}>
              {creatingHire ? "Provisioning..." : "Create Account & Dispatch Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dynamic Checklist Drawer Modal */}
      {activeChecklistCase && (
        <Dialog open={!!activeChecklistCase} onOpenChange={(o) => !o && setActiveChecklistCaseId(null)}>
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
                Mandatory onboarding checklist tasks. Changes sync immediately to PostgreSQL:
              </p>

              <div className="space-y-2 rounded-lg border border-border p-3">
                {activeChecklistCase.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-md p-2 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={`task-${task.id}`}
                        checked={task.done}
                        onCheckedChange={() => handleToggleTask(activeChecklistCase.id, task.id)}
                      />
                      <label
                        htmlFor={`task-${task.id}`}
                        className={`text-sm cursor-pointer ${
                          task.done ? "line-through text-muted-foreground" : "font-medium text-foreground"
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

              {/* 3 Prerequisites Tracker: Tasks, Hardware Asset, Work Accounts */}
              {(() => {
                const doneCount = activeChecklistCase.tasks.filter((t) => t.done).length;
                const isChecklistDone =
                  activeChecklistCase.tasks.length > 0 && doneCount === activeChecklistCase.tasks.length;
                const hasAsset = Boolean(activeChecklistCase.hasAsset) || caseAssets.length > 0;
                const hasAccounts = Boolean(activeChecklistCase.hasAccounts) || caseAccounts.length > 0;
                const isAllComplete = isChecklistDone && hasAsset && hasAccounts;

                return (
                  <div
                    className={`mt-4 rounded-xl border p-4 space-y-3.5 transition-all ${
                      isAllComplete
                        ? "bg-gradient-to-br from-emerald-500/10 via-primary/5 to-transparent border-emerald-500/30"
                        : isChecklistDone
                        ? "bg-amber-500/5 border-amber-500/30"
                        : "bg-muted/30 border-border"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <ShieldCheck className="size-4 text-primary" /> Onboarding Completion Prerequisites
                        </span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            isAllComplete
                              ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                              : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                          }`}
                        >
                          {isAllComplete ? (
                            <>
                              <CheckCircle2 className="size-3 text-emerald-600" />
                              All 3 Complete · Active
                            </>
                          ) : (
                            <>
                              <Clock className="size-3" />
                              Prerequisites In Progress
                            </>
                          )}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {isAllComplete
                          ? "All 3 prerequisites are fully met! Employee is marked Completed and Active across the system."
                          : "New employees are only marked Completed and Active after 100% checklist tasks, hardware resource allocation, and work accounts credentials generation."}
                      </p>
                    </div>

                    {/* 3 Prerequisite Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* 1. Checklist */}
                      <div className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between gap-1.5 ${
                        isChecklistDone ? "bg-emerald-500/10 border-emerald-500/30" : "bg-card border-border"
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground flex items-center gap-1">
                            <CheckCircle2 className={`size-3.5 ${isChecklistDone ? "text-emerald-600" : "text-muted-foreground"}`} />
                            1. Checklist
                          </span>
                          <span className="text-[10px] font-mono font-medium">
                            {doneCount}/{activeChecklistCase.tasks.length}
                          </span>
                        </div>
                        <span className={`text-[11px] ${isChecklistDone ? "text-emerald-600 font-medium" : "text-muted-foreground"}`}>
                          {isChecklistDone ? "✓ 100% Completed" : `${activeChecklistCase.tasks.length - doneCount} remaining`}
                        </span>
                      </div>

                      {/* 2. Hardware Asset */}
                      <div className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between gap-1.5 ${
                        hasAsset ? "bg-emerald-500/10 border-emerald-500/30" : "bg-card border-border"
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground flex items-center gap-1">
                            <Laptop className={`size-3.5 ${hasAsset ? "text-emerald-600" : "text-muted-foreground"}`} />
                            2. IT Asset
                          </span>
                          {canManage && !hasAsset && (
                            <button
                              type="button"
                              onClick={() => openAllotModal(activeChecklistCase)}
                              className="text-[10px] text-primary hover:underline font-medium"
                            >
                              + Allot
                            </button>
                          )}
                        </div>
                        <span className={`text-[11px] ${hasAsset ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}`}>
                          {hasAsset ? `✓ ${caseAssets.length || 1} Asset(s) Allocated` : "⏳ Allocation Pending"}
                        </span>
                      </div>

                      {/* 3. Work Accounts */}
                      <div className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between gap-1.5 ${
                        hasAccounts ? "bg-emerald-500/10 border-emerald-500/30" : "bg-card border-border"
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground flex items-center gap-1">
                            <Layers className={`size-3.5 ${hasAccounts ? "text-emerald-600" : "text-muted-foreground"}`} />
                            3. Accounts
                          </span>
                          {canManage && !hasAccounts && (
                            <button
                              type="button"
                              onClick={() => openProvisionModal(activeChecklistCase)}
                              className="text-[10px] text-primary hover:underline font-medium"
                            >
                              + Provision
                            </button>
                          )}
                        </div>
                        <span className={`text-[11px] ${hasAccounts ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}`}>
                          {hasAccounts ? `✓ ${caseAccounts.length || 1} Accounts Ready` : "⏳ Creds Pending"}
                        </span>
                      </div>
                    </div>

                    {/* Quick action buttons if anything pending */}
                    {canManage && (!hasAsset || !hasAccounts) && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {!hasAsset && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium"
                            onClick={() => openAllotModal(activeChecklistCase)}
                          >
                            <Laptop className="size-3 mr-1" /> Allot Hardware Asset
                          </Button>
                        )}
                        {!hasAccounts && (
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-primary text-primary-foreground font-medium shadow-xs"
                            onClick={() => openProvisionModal(activeChecklistCase)}
                          >
                            <Layers className="size-3 mr-1" /> Provision Work Accounts
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Display Currently Allotted Assets */}
                    {caseAssets.length > 0 && (
                      <div className="pt-2 border-t border-border/50">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                          <Laptop className="size-3 text-primary" /> Allotted Hardware Assets ({caseAssets.length})
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {caseAssets.map((asset) => (
                            <div
                              key={asset.id}
                              className="text-xs bg-background/80 border rounded-lg p-2 flex items-center justify-between"
                            >
                              <div>
                                <div className="font-semibold text-foreground">{asset.assetType}</div>
                                <div className="font-mono text-[11px] text-muted-foreground">
                                  {asset.assetCode} {asset.serialNumber ? `• S/N: ${asset.serialNumber}` : ""}
                                </div>
                              </div>
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-medium capitalize">
                                {asset.condition || "Assigned"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Display Currently Provisioned Accounts */}
                    {caseAccounts.length > 0 && (
                      <div className="pt-2 border-t border-border/50">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                          <Layers className="size-3 text-primary" /> Provisioned Work Accounts ({caseAccounts.length})
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {caseAccounts.map((acc) => (
                            <div
                              key={acc.id}
                              className="text-xs bg-background/80 border rounded-lg p-2.5 flex items-center justify-between"
                            >
                              <div className="min-w-0 pr-2">
                                <span className="font-semibold text-foreground block truncate">{acc.serviceName}</span>
                                {acc.username && (
                                  <span className="text-[11px] text-muted-foreground truncate block">
                                    Login: <code className="bg-muted px-1 py-0.5 rounded text-foreground font-mono">{acc.username}</code>
                                  </span>
                                )}
                              </div>
                              <span className="size-2 rounded-full bg-emerald-500 shrink-0" title="Active"></span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <DialogFooter>
              <Button onClick={() => setActiveChecklistCaseId(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Allot Hardware Asset Modal */}
      <Dialog open={!!allotModalCase} onOpenChange={(o) => !o && setAllotModalCase(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Laptop className="size-5 text-primary" /> Allot Company Asset
            </DialogTitle>
            <DialogDescription>
              Assign hardware equipment to {allotModalCase ? nameOf(allotModalCase.employeeId) : "employee"}. Triggers an official assignment email alert.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex rounded-lg bg-muted p-1 gap-1">
              <button
                type="button"
                className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${
                  allotMode === "new"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setAllotMode("new")}
              >
                Register &amp; Allot New Asset
              </button>
              <button
                type="button"
                className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${
                  allotMode === "inventory"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setAllotMode("inventory")}
              >
                Pick Available Inventory ({availableAssets.length})
              </button>
            </div>

            {allotMode === "inventory" ? (
              availableAssets.length > 0 ? (
                <Field label="Select Available Asset">
                  <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select asset from inventory" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAssets.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name || a.assetType} — {a.tag || a.assetCode} ({a.condition || "Good"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : (
                <div className="text-center py-6 border border-dashed rounded-lg text-xs text-muted-foreground">
                  No unassigned assets currently in inventory. Switch to "Register &amp; Allot New Asset" to catalog one.
                </div>
              )
            ) : (
              <>
                <Field label="Asset Type / Model">
                  <Select
                    value={assetForm.assetType}
                    onValueChange={(v) => setAssetForm({ ...assetForm, assetType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select asset model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MacBook Pro 16&quot; M3 Max">MacBook Pro 16" M3 Max</SelectItem>
                      <SelectItem value="MacBook Air 15&quot; M3">MacBook Air 15" M3</SelectItem>
                      <SelectItem value="Dell XPS 15 (i9 / 32GB)">Dell XPS 15 (i9 / 32GB)</SelectItem>
                      <SelectItem value="ThinkPad X1 Carbon Gen 11">ThinkPad X1 Carbon Gen 11</SelectItem>
                      <SelectItem value="Dell UltraSharp 27&quot; 4K Monitor">Dell UltraSharp 27" 4K Monitor</SelectItem>
                      <SelectItem value="Apple Studio Display 27&quot;">Apple Studio Display 27"</SelectItem>
                      <SelectItem value="Apple Magic Keyboard &amp; Mouse">Apple Magic Keyboard &amp; Mouse</SelectItem>
                      <SelectItem value="Logitech MX Master 3S">Logitech MX Master 3S</SelectItem>
                      <SelectItem value="YubiKey 5C NFC Security Key">YubiKey 5C NFC Security Key</SelectItem>
                      <SelectItem value="Herman Miller Aeron Chair">Herman Miller Aeron Chair</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Asset Code / Tag">
                    <Input
                      value={assetForm.assetCode}
                      onChange={(e) => setAssetForm({ ...assetForm, assetCode: e.target.value })}
                      placeholder="e.g. AST-1049"
                    />
                  </Field>

                  <Field label="Serial Number">
                    <Input
                      value={assetForm.serialNumber}
                      onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })}
                      placeholder="e.g. C02XG184MD6R"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Initial Condition">
                    <Select
                      value={assetForm.condition}
                      onValueChange={(v) => setAssetForm({ ...assetForm, condition: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="good">Good (Standard)</SelectItem>
                        <SelectItem value="new">Brand New</SelectItem>
                        <SelectItem value="fair">Fair</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Deployment Location">
                    <Input
                      value={assetForm.location}
                      onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
                      placeholder="HQ Operations / Remote"
                    />
                  </Field>
                </div>
              </>
            )}

            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-2.5 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
              <Mail className="size-4 shrink-0 mt-0.5 text-blue-600" />
              <span>
                Employee will receive an immediate assignment confirmation email specifying equipment specs, tag ID, and custody security guidelines.
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAllotModalCase(null)} disabled={submittingAsset}>
              Cancel
            </Button>
            <Button
              onClick={handleAllotAsset}
              disabled={submittingAsset || (allotMode === "inventory" && !selectedAssetId)}
              className="bg-primary text-primary-foreground font-medium"
            >
              {submittingAsset ? "Allotting & Sending Email..." : "Allot Asset & Send Alert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Provision Work Accounts Modal */}
      <Dialog open={!!provisionModalCase} onOpenChange={(o) => !o && setProvisionModalCase(null)}>
        <DialogContent className="max-w-3xl sm:max-w-4xl max-h-[92vh] flex flex-col p-6 sm:p-7">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Layers className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  Provision Work Accounts &amp; Access Credentials
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Configure workspace tools, developer access, and secure initial passwords for{" "}
                  <span className="font-semibold text-foreground">
                    {provisionModalCase ? nameOf(provisionModalCase.employeeId) : "employee"}
                  </span>{" "}
                  ({employees.find((e) => e.id === provisionModalCase?.employeeId)?.email || "work email"}).
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3.5 py-1">
            {/* Quick Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/50 border text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  {provisionServices.filter((s) => s.enabled).length} of {provisionServices.length} tools selected
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">
                  Credentials are automatically emailed to the employee upon confirmation
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs px-2.5"
                  onClick={handleToggleSelectAll}
                >
                  {provisionServices.every((s) => s.enabled) ? "Deselect All" : "Select All"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-2.5 gap-1.5"
                  onClick={handleRegenerateAllPasswords}
                >
                  <RotateCcw className="size-3" /> Regenerate Passwords
                </Button>
              </div>
            </div>

            {/* List of Accounts */}
            <div className="space-y-3 max-h-[48vh] overflow-y-auto pr-1">
              {provisionServices.map((svc, idx) => (
                <div
                  key={svc.serviceName}
                  className={`rounded-xl border p-4 transition-all ${
                    svc.enabled
                      ? "bg-card border-primary/30 shadow-xs ring-1 ring-primary/10"
                      : "bg-muted/20 border-border/50 opacity-60 hover:opacity-80"
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={`svc-${idx}`}
                        checked={svc.enabled}
                        onCheckedChange={(checked) => {
                          setProvisionServices((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, enabled: Boolean(checked) } : item))
                          );
                        }}
                      />
                      <div>
                        <label
                          htmlFor={`svc-${idx}`}
                          className="text-sm font-semibold cursor-pointer text-foreground flex items-center gap-2"
                        >
                          {svc.serviceName}
                          <span className="text-[11px] font-normal text-muted-foreground">
                            ({svc.category})
                          </span>
                        </label>
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                        svc.enabled
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {svc.enabled ? "Provisioning Active" : "Disabled"}
                    </span>
                  </div>

                  {/* 2-Column Inputs: Username / Email and Password */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                        Username / Work Email
                      </label>
                      <Input
                        className="h-9 text-xs font-mono bg-background"
                        value={svc.username}
                        disabled={!svc.enabled}
                        placeholder="e.g. username@company.com"
                        onChange={(e) => {
                          const val = e.target.value;
                          setProvisionServices((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, username: val } : item))
                          );
                        }}
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block flex items-center justify-between">
                        <span>Initial Temporary Password</span>
                        <span className="text-[10px] text-muted-foreground">Prompted to change upon 1st login</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <div className="relative flex-1">
                          <Input
                            className="h-9 text-xs font-mono pr-8 bg-background"
                            type={svc.showPassword ? "text" : "password"}
                            value={svc.password}
                            disabled={!svc.enabled}
                            placeholder="Temporary Password"
                            onChange={(e) => {
                              const val = e.target.value;
                              setProvisionServices((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, password: val } : item))
                              );
                            }}
                          />
                          <button
                            type="button"
                            disabled={!svc.enabled}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-30"
                            onClick={() => {
                              setProvisionServices((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, showPassword: !item.showPassword } : item))
                              );
                            }}
                            title={svc.showPassword ? "Hide password" : "Show password"}
                          >
                            {svc.showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                          </button>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 px-2.5 shrink-0"
                          disabled={!svc.enabled}
                          onClick={() => handleRegeneratePassword(idx)}
                          title="Regenerate password for this service"
                        >
                          <RotateCcw className="size-3.5" />
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 px-2.5 shrink-0"
                          disabled={!svc.enabled}
                          onClick={() => handleCopyPassword(`svc-${idx}`, svc.password)}
                          title="Copy password to clipboard"
                        >
                          {copiedKey === `svc-${idx}` ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Email Dispatch Notice */}
            <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2.5">
              <Mail className="size-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
              <div className="space-y-0.5">
                <div className="font-semibold">Automatic Dispatch to Employee Work Inbox</div>
                <p className="text-[11px] leading-relaxed text-blue-600/90 dark:text-blue-300/90">
                  When submitted, PeoplePay360 delivers an encrypted notification to the employee containing both their usernames, temporary access passwords, direct login URLs, and corporate security guidelines.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t mt-1">
            <Button variant="outline" onClick={() => setProvisionModalCase(null)} disabled={submittingAccounts}>
              Cancel
            </Button>
            <Button
              onClick={handleProvisionAccounts}
              disabled={submittingAccounts || provisionServices.filter((s) => s.enabled).length === 0}
              className="bg-primary text-primary-foreground font-semibold px-5"
            >
              {submittingAccounts
                ? "Provisioning Accounts & Alerting..."
                : `Provision ${provisionServices.filter((s) => s.enabled).length} Accounts & Send Email Alert`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
