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
  Save,
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
import { Checkbox } from "@/components/ui/checkbox";
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
  const {
    offboarding,
    employees,
    assets,
    update,
    log,
    patchEmployee,
    role,
    addOffboardingCase,
    patchOffboardingCase,
    updateOffboardingClearanceTask,
  } = useApp();
  const nameOf = useEmployeeName();
  const ready = useDelayed();

  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [lwd, setLwd] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();

  const [checklistCaseId, setChecklistCaseId] = useState<string | null>(null);
  const showChecklist = offboarding.find((c) => c.id === checklistCaseId) ?? null;
  const [interviewNotesInput, setInterviewNotesInput] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Destructive confirmation states
  const [revokeTarget, setRevokeTarget] = useState<OffboardingCase | null>(null);
  const [completeTarget, setCompleteTarget] = useState<OffboardingCase | null>(null);

  const canManage = role === "hr_manager" || role === "admin" || role === "payroll_manager" || role === "payroll_user";

  const eligible = employees.filter(
    (e) => e.status !== "exited" && !offboarding.some((o) => o.employeeId === e.id),
  );

  const patchCase = async (id: string, patch: Parameters<typeof patchOffboardingCase>[1]) => {
    await patchOffboardingCase(id, patch);
  };

  const openChecklistModal = (c: OffboardingCase) => {
    setChecklistCaseId(c.id);
    setInterviewNotesInput(c.exitInterviewNotes || "");
  };

  const handleSaveInterviewNotes = async () => {
    if (!showChecklist) return;
    setSavingNotes(true);
    try {
      await patchCase(showChecklist.id, {
        exitInterviewNotes: interviewNotesInput.trim(),
        exitInterviewDone: true,
      });
      toast.success("Exit interview notes saved successfully");
    } catch (err: any) {
      toast.error("Failed to save exit interview notes", { description: err?.message });
    } finally {
      setSavingNotes(false);
    }
  };

  const returnAssets = async (caseId: string, empId: string) => {
    await patchCase(caseId, { assetsReturned: true });
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

  const handleRevokeAccess = async () => {
    if (!revokeTarget) return;
    await patchCase(revokeTarget.id, { accessRevoked: true });
    toast.success("Access tokens revoked", {
      description: `Google Workspace, SSO and VPN disabled for ${nameOf(revokeTarget.employeeId)}.`,
    });
    log(`Revoked all corporate access for ${nameOf(revokeTarget.employeeId)}`, "Offboarding");
    setRevokeTarget(null);
  };

  const handleCompleteOffboarding = async () => {
    if (!completeTarget) return;
    await patchCase(completeTarget.id, { completeOffboarding: true });
    toast.success("Offboarding completed", {
      description: `${nameOf(completeTarget.employeeId)} successfully cleared and marked as exited.`,
    });
    log(`Completed final exit clearance for ${nameOf(completeTarget.employeeId)}`, "Offboarding");
    setCompleteTarget(null);
  };

  const handleScheduleExitInterview = async (caseId: string) => {
    await patchCase(caseId, { exitInterviewDone: false, status: "Exit Interview" });
    toast.success("Exit interview scheduled", {
      description: "Calendar invitation sent to departing employee and HR.",
    });
  };

  const handleCreate = async () => {
    if (!employeeId) return setError("Choose the exiting employee.");
    if (!lwd) return setError("Set the last working day.");
    setError(undefined);

    try {
      await addOffboardingCase(employeeId, lwd, reason || "Voluntary resignation");
      log(`Started offboarding for ${nameOf(employeeId)}`, "Lifecycle");
      toast.success("Offboarding initiated", {
        description: `Target Last Working Day: ${lwd}`,
      });
    } catch (err: any) {
      toast.error("Failed to initiate offboarding", { description: err?.message });
    }

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
          <CardTitle>Offboarding Cases ({offboarding.length})</CardTitle>
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
                              onClick={() => openChecklistModal(c)}
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

      {/* Dynamic Clearance Checklist Modal */}
      {showChecklist && (
        <Dialog open={!!showChecklist} onOpenChange={(o) => !o && setChecklistCaseId(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>Exit Clearance Checklist</DialogTitle>
                <StatusBadge status={showChecklist.clearanceStatus || "Pending"} />
              </div>
              <DialogDescription>
                Departmental sign-offs and exit requirements for {nameOf(showChecklist.employeeId)} ({showChecklist.id})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-sm">
              {/* Department Tasks List */}
              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-semibold text-foreground">Departmental Sign-offs</h4>
                  <span className="text-xs text-muted-foreground">
                    {showChecklist.clearance.filter((c) => c.cleared).length} of {showChecklist.clearance.length} cleared
                  </span>
                </div>

                <div className="space-y-2">
                  {showChecklist.clearance.map((task) => (
                    <div
                      key={task.id}
                      className={`flex items-center justify-between p-2.5 rounded-md border text-xs transition-colors ${
                        task.cleared ? "bg-muted/40 border-muted" : "bg-card border-border"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`task-${task.id}`}
                          checked={task.cleared}
                          onCheckedChange={() =>
                            updateOffboardingClearanceTask(showChecklist.id, task.id, !task.cleared)
                          }
                          disabled={!canManage}
                        />
                        <div>
                          <label
                            htmlFor={`task-${task.id}`}
                            className={`font-medium cursor-pointer ${task.cleared ? "line-through text-muted-foreground" : "text-foreground"}`}
                          >
                            {task.item}
                          </label>
                          <div className="flex items-center gap-2 mt-0.5 text-[0.7rem] text-muted-foreground">
                            <span className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">
                              {task.department}
                            </span>
                            {task.cleared && task.clearedAt && (
                              <span>Cleared on {task.clearedAt}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <StatusBadge status={task.cleared ? "Cleared" : "Pending"} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Exit Interview Feedback Section */}
              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-foreground">HR Exit Interview</h4>
                    <p className="text-xs text-muted-foreground">Departing feedback, survey responses and manager debrief</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={showChecklist.exitInterviewStatus || "Pending"} />
                    {showChecklist.exitInterviewStatus !== "Completed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => handleScheduleExitInterview(showChecklist.id)}
                      >
                        Schedule Meeting
                      </Button>
                    )}
                  </div>
                </div>

                <Textarea
                  rows={3}
                  placeholder="Record departing employee feedback, reason details, project handover status, and HR observations..."
                  value={interviewNotesInput}
                  onChange={(e) => setInterviewNotesInput(e.target.value)}
                  disabled={!canManage}
                />

                {canManage && (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSaveInterviewNotes}
                      disabled={savingNotes}
                      className="h-7 text-xs"
                    >
                      <Save className="size-3 mr-1" />
                      {savingNotes ? "Saving..." : "Save Interview Notes & Complete"}
                    </Button>
                  </div>
                )}
              </div>

              {/* Hardware & Systems Access Controls */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-card p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">IT Hardware</span>
                    <StatusBadge status={showChecklist.assetsReturned ? "Returned" : "Pending"} />
                  </div>
                  <p className="text-muted-foreground">Laptop, security keys, and accessories</p>
                  {!showChecklist.assetsReturned && canManage && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-xs"
                      onClick={() => returnAssets(showChecklist.id, showChecklist.employeeId)}
                    >
                      <Laptop className="size-3 mr-1" /> Confirm Assets Returned
                    </Button>
                  )}
                </div>

                <div className="rounded-lg border border-border bg-card p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">Corporate Access</span>
                    <StatusBadge status={showChecklist.accessRevoked ? "Revoked" : "Active"} />
                  </div>
                  <p className="text-muted-foreground">SSO, email box, VPN and repositories</p>
                  {!showChecklist.accessRevoked && canManage && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-xs text-warning-foreground"
                      onClick={() => {
                        setChecklistCaseId(null);
                        setRevokeTarget(showChecklist);
                      }}
                    >
                      <KeyRound className="size-3 mr-1" /> Revoke All Access
                    </Button>
                  )}
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
              <Button onClick={() => setChecklistCaseId(null)}>Close</Button>
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
