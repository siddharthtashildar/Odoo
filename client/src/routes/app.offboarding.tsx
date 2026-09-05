import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  KeyRound,
  Laptop,
  MessageSquare,
  Plus,
  ShieldAlert,
  UserCheck,
  UserMinus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { EmptyState, Field, PageHeader, StatCard, StatusBadge, TableSkeleton } from "@/components/bits";
import { useApp, useDelayed, useEmployeeName } from "@/lib/store";
import type { OffboardingCase } from "@/lib/mock-data";

export const Route = createFileRoute("/app/offboarding")({
  head: () => ({
    meta: [
      { title: "Offboarding · PeoplePay360" },
      { name: "description", content: "Coordinate employee exit clearances: exit interview, asset returns, access revocation and final settlement." },
      { property: "og:title", content: "Offboarding · PeoplePay360" },
    ],
  }),
  component: OffboardingPage,
});

function OffboardingPage() {
  const { offboarding, employees, assets, update, log, patchEmployee, role } = useApp();
  const nameOf = useEmployeeName();
  const ready = useDelayed();

  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [lwd, setLwd] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();

  const [activeCase, setActiveCase] = useState<OffboardingCase | null>(null);
  const [showChecklist, setShowChecklist] = useState<OffboardingCase | null>(null);

  // Destructive confirmation states
  const [revokeTarget, setRevokeTarget] = useState<OffboardingCase | null>(null);
  const [completeTarget, setCompleteTarget] = useState<OffboardingCase | null>(null);

  const canManage = role === "hr_manager" || role === "admin" || role === "payroll_manager" || role === "payroll_user";

  const eligible = employees.filter(
    (e) => e.status !== "exited" && !offboarding.some((o) => o.employeeId === e.id),
  );

  const patchCase = (id: string, patch: Partial<OffboardingCase>) => {
    const updated = offboarding.map((c) => (c.id === id ? { ...c, ...patch } : c));
    update("offboarding", updated);
  };

  const returnAssets = (caseId: string, empId: string) => {
    patchCase(caseId, { assetsReturned: true });
    update(
      "assets",
      assets.map((a) =>
        a.assignedTo === empId
          ? { ...a, status: "Available", assignedTo: undefined }
          : a,
      ),
    );
    toast.success("Assets checked into inventory", {
      description: `Hardware returned by ${nameOf(empId)}.`,
    });
    log(`Recovered hardware assets from ${nameOf(empId)}`, "Offboarding");
  };

  const handleRevokeAccess = () => {
    if (!revokeTarget) return;
    patchCase(revokeTarget.id, { accessRevoked: true });
    toast.success("Access tokens revoked", {
      description: `Google Workspace, SSO and VPN disabled for ${nameOf(revokeTarget.employeeId)}.`,
    });
    log(`Revoked all corporate access for ${nameOf(revokeTarget.employeeId)}`, "Offboarding");
    setRevokeTarget(null);
  };

  const handleCompleteOffboarding = () => {
    if (!completeTarget) return;
    patchCase(completeTarget.id, {
      finalSettlement: "settled",
      finalPayrollStatus: "Processed",
      clearanceStatus: "Cleared",
    });
    patchEmployee(completeTarget.employeeId, { status: "exited" });
    toast.success("Offboarding completed", {
      description: `${nameOf(completeTarget.employeeId)} successfully cleared and marked as exited.`,
    });
    log(`Completed final exit clearance for ${nameOf(completeTarget.employeeId)}`, "Offboarding");
    setCompleteTarget(null);
  };

  const handleScheduleExitInterview = (caseId: string) => {
    patchCase(caseId, { exitInterviewStatus: "Scheduled" });
    toast.success("Exit interview scheduled", {
      description: "Calendar invitation sent to departing employee and HR.",
    });
  };

  const handleCreate = () => {
    if (!employeeId) return setError("Choose the exiting employee.");
    if (!lwd) return setError("Set the last working day.");
    setError(undefined);

    const emp = employees.find((e) => e.id === employeeId);

    const newCase: OffboardingCase = {
      id: `OFF-${90 + offboarding.length}`,
      employeeId,
      lastWorkingDay: lwd,
      reason: reason || "Voluntary resignation",
      manager: emp?.manager ?? "Sana Iqbal",
      exitInterviewStatus: "Pending",
      assetsReturned: false,
      accessRevoked: false,
      finalPayrollStatus: "Pending",
      clearanceStatus: "Pending",
      finalSettlement: "pending",
      notes: "Offboarding initiated from HR workspace.",
    };

    update("offboarding", [newCase, ...offboarding]);
    patchEmployee(employeeId, { status: "offboarding", exitOn: lwd });
    log(`Started offboarding for ${nameOf(employeeId)}`, "Lifecycle");
    toast.success("Offboarding initiated", {
      description: `Target Last Working Day: ${lwd}`,
    });

    setOpen(false);
    setEmployeeId("");
    setLwd("");
    setReason("");
  };

  const activeCases = offboarding.filter((c) => c.finalSettlement !== "settled");
  const pendingClearance = offboarding.filter((c) => c.clearanceStatus === "Pending").length;
  const completedCount = offboarding.filter((c) => c.finalSettlement === "settled").length;

  return (
    <>
      <PageHeader
        title="Employee Offboarding"
        description="Structured exit clearances: asset handover, access revocation, exit interviews, and final payroll settlement."
        actions={
          canManage && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 size-4" /> Start offboarding
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active Exit Cases"
          value={activeCases.length}
          hint="Currently in exit runway"
          icon={<UserMinus className="size-5" />}
          tone="warning"
        />
        <StatCard
          label="Pending Clearances"
          value={pendingClearance}
          hint="IT / Finance clearance needed"
          icon={<Clock className="size-5" />}
          tone="default"
        />
        <StatCard
          label="Completed Exits"
          value={completedCount}
          hint="Full & final released"
          icon={<CheckCircle2 className="size-5" />}
          tone="success"
        />
        <StatCard
          label="Pending Asset Returns"
          value={offboarding.filter((c) => !c.assetsReturned && c.finalSettlement !== "settled").length}
          hint="Hardware to be recovered"
          icon={<Laptop className="size-5" />}
          tone="accent"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Offboarding Cases</CardTitle>
          <CardDescription>Departing employee exit checklist progress and department sign-offs</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!ready ? (
            <div className="p-4">
              <TableSkeleton rows={3} />
            </div>
          ) : offboarding.length === 0 ? (
            <EmptyState
              title="No offboarding cases"
              description="Click 'Start offboarding' to register an employee resignation or departure."
              icon={<UserMinus className="size-8" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case ID</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Last Working Day</TableHead>
                    <TableHead>Exit Interview</TableHead>
                    <TableHead>Asset Return</TableHead>
                    <TableHead>Access Revoked</TableHead>
                    <TableHead>Clearance</TableHead>
                    <TableHead>Settlement</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offboarding.map((c) => {
                    const isSettled = c.finalSettlement === "settled";

                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs font-semibold text-primary">
                          {c.id}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{nameOf(c.employeeId)}</div>
                          <div className="text-xs text-muted-foreground">{c.reason}</div>
                        </TableCell>
                        <TableCell className="text-xs font-medium">{c.lastWorkingDay}</TableCell>
                        <TableCell>
                          <StatusBadge status={c.exitInterviewStatus || "Pending"} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={c.assetsReturned ? "Returned" : "Pending"} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={c.accessRevoked ? "Revoked" : "Active"} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={c.clearanceStatus || "Pending"} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={c.finalSettlement} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={() => setShowChecklist(c)}
                              title="Generate clearance checklist"
                            >
                              <FileCheck className="size-3.5 mr-1" /> Checklist
                            </Button>

                            {canManage && !isSettled && (
                              <>
                                {!c.assetsReturned && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-2 text-primary"
                                    onClick={() => returnAssets(c.id, c.employeeId)}
                                    title="Return assets"
                                  >
                                    <Laptop className="size-3.5" />
                                  </Button>
                                )}

                                {!c.accessRevoked && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-2 text-warning-foreground hover:text-warning"
                                    onClick={() => setRevokeTarget(c)}
                                    title="Revoke access"
                                  >
                                    <KeyRound className="size-3.5" />
                                  </Button>
                                )}

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2 text-success hover:text-success"
                                  onClick={() => setCompleteTarget(c)}
                                  title="Complete offboarding"
                                >
                                  <CheckCircle2 className="size-3.5" />
                                </Button>
                              </>
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

      {/* Start Offboarding Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start Employee Offboarding</DialogTitle>
            <DialogDescription>
              Initiate exit protocol for a resigning or transitioning staff member.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Field label="Departing Employee" error={error}>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {eligible.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} — {e.designation} ({e.department})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Last Working Day (LWD)">
              <Input type="date" value={lwd} onChange={(e) => setLwd(e.target.value)} />
            </Field>

            <Field label="Reason for Leaving">
              <Textarea
                rows={2}
                placeholder="e.g. Higher studies, career relocation, personal reasons..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Open Exit Runway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clearance Checklist Modal */}
      {showChecklist && (
        <Dialog open={!!showChecklist} onOpenChange={(o) => !o && setShowChecklist(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>Clearance Checklist</DialogTitle>
                <StatusBadge status={showChecklist.clearanceStatus || "Pending"} />
              </div>
              <DialogDescription>
                Departmental sign-offs for {nameOf(showChecklist.employeeId)} ({showChecklist.id})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-sm">
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">1. HR Exit Interview</p>
                    <p className="text-xs text-muted-foreground">Feedback and exit survey submission</p>
                  </div>
                  {showChecklist.exitInterviewStatus === "Scheduled" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        patchCase(showChecklist.id, { exitInterviewStatus: "Completed" });
                        toast.success("Exit interview marked as completed");
                      }}
                    >
                      Mark Completed
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => handleScheduleExitInterview(showChecklist.id)}
                    >
                      Schedule
                    </Button>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-border/50 pt-2">
                  <div>
                    <p className="font-medium">2. IT Hardware Recovery</p>
                    <p className="text-xs text-muted-foreground">Laptops, monitors and ID cards return</p>
                  </div>
                  <StatusBadge status={showChecklist.assetsReturned ? "Returned" : "Pending"} />
                </div>

                <div className="flex items-center justify-between border-t border-border/50 pt-2">
                  <div>
                    <p className="font-medium">3. Systems Access Revocation</p>
                    <p className="text-xs text-muted-foreground">SSO, Google Workspace and VPN shutdown</p>
                  </div>
                  <StatusBadge status={showChecklist.accessRevoked ? "Revoked" : "Active"} />
                </div>

                <div className="flex items-center justify-between border-t border-border/50 pt-2">
                  <div>
                    <p className="font-medium">4. Full & Final Settlement</p>
                    <p className="text-xs text-muted-foreground">Leave encashment, gratuity & pending payroll</p>
                  </div>
                  <StatusBadge status={showChecklist.finalSettlement} />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() =>
                  toast.success("Exporting clearance checklist certificate as PDF")
                }
              >
                <Download className="size-4 mr-1.5" /> Download Clearance PDF
              </Button>
              <Button onClick={() => setShowChecklist(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirmation Dialog: Revoke Access */}
      {revokeTarget && (
        <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Access Revocation</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to revoke all corporate access for {nameOf(revokeTarget.employeeId)}?
                This will immediately invalidate SSO tokens, Google Workspace mailboxes, and VPN tunnels.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setRevokeTarget(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleRevokeAccess}
              >
                Revoke All Access
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Confirmation Dialog: Complete Offboarding */}
      {completeTarget && (
        <AlertDialog open={!!completeTarget} onOpenChange={(o) => !o && setCompleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Complete Employee Offboarding</AlertDialogTitle>
              <AlertDialogDescription>
                This will release the full & final settlement, mark all clearances as satisfied, and move{" "}
                {nameOf(completeTarget.employeeId)} to Exited status.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setCompleteTarget(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-success text-success-foreground hover:bg-success/90"
                onClick={handleCompleteOffboarding}
              >
                Confirm Final Settlement
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
