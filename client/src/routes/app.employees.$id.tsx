import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeIndianRupee,
  Building2,
  Calendar,
  CalendarDays,
  Clock,
  Download,
  FileCheck,
  FileSignature,
  FileText,
  History,
  Laptop,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  User,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Field, PageHeader, StatCard, StatusBadge } from "@/components/bits";
import { useApp } from "@/lib/store";
import { inr, type Employee, type EmployeeStatus } from "@/lib/mock-data";

export const Route = createFileRoute("/app/employees/$id")({
  head: () => ({
    meta: [
      { title: "Employee Profile · PeoplePay360" },
      { name: "description", content: "Comprehensive employee dossier with 360-degree lifecycle records." },
      { property: "og:title", content: "Employee Profile · PeoplePay360" },
    ],
  }),
  component: EmployeeProfile,
});

function EmployeeProfile() {
  const { id } = useParams({ from: "/app/employees/$id" });
  const {
    employees,
    assets,
    leave,
    payroll,
    attendance,
    contracts,
    onboarding,
    offboarding,
    audit,
    patchEmployee,
    log,
    role,
  } = useApp();

  const employee = employees.find((e) => e.id === id);
  const [open, setOpen] = useState(false);
  const canEdit = role === "hr_manager" || role === "admin" || role === "payroll_manager" || role === "payroll_user";

  const [draft, setDraft] = useState<Partial<Employee>>({});
  const [error, setError] = useState<string | undefined>();

  if (!employee) {
    return (
      <EmptyState
        title="Employee not found"
        description="This record does not exist or may have been removed."
        action={
          <Button asChild variant="outline">
            <Link to="/app/employees">Back to directory</Link>
          </Button>
        }
      />
    );
  }

  const empAssets = assets.filter((a) => a.assignedTo === employee.id);
  const empLeave = leave.filter((l) => l.employeeId === employee.id);
  const empAttendance = attendance.filter((a) => a.employeeId === employee.id);
  const empContract = contracts.find((c) => c.employeeId === employee.id);
  const empPay = payroll
    .map((r) => ({ run: r, line: r.lines.find((l) => l.employeeId === employee.id) }))
    .filter((x) => x.line);
  const onCase = onboarding.find((o) => o.employeeId === employee.id);
  const offCase = offboarding.find((o) => o.employeeId === employee.id);
  const onProgress = onCase
    ? Math.round((onCase.tasks.filter((t) => t.done).length / onCase.tasks.length) * 100)
    : 100;

  const empActivity = audit.filter(
    (a) =>
      a.action.toLowerCase().includes(employee.name.toLowerCase()) ||
      a.actor.toLowerCase() === employee.name.toLowerCase(),
  );

  const openEdit = () => {
    setDraft({
      designation: employee.designation,
      department: employee.department,
      manager: employee.manager,
      location: employee.location,
      ctc: employee.ctc,
      status: employee.status,
    });
    setError(undefined);
    setOpen(true);
  };

  const save = () => {
    if (!draft.designation?.trim()) {
      setError("Designation cannot be empty.");
      return;
    }
    if (!draft.ctc || draft.ctc <= 0) {
      setError("Annual CTC must be greater than zero.");
      return;
    }
    patchEmployee(employee.id, draft);
    log(`Updated profile for ${employee.name}`, "People");
    toast.success("Profile updated");
    setOpen(false);
  };

  const Row = ({ k, v }: { k: string; v: string | number | React.ReactNode }) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/50 py-2 text-sm last:border-0">
      <span className="text-muted-foreground text-xs">{k}</span>
      <span className="font-medium text-foreground text-right">{v}</span>
    </div>
  );

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to="/app/employees">
          <ArrowLeft className="mr-2 size-4" /> Back to directory
        </Link>
      </Button>

      {/* Header Profile Banner */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center">
        <Avatar className="size-20 shrink-0 border-2 border-primary/20">
          <AvatarFallback className="bg-primary text-xl font-bold text-primary-foreground">
            {employee.name
              .split(" ")
              .map((p) => p[0])
              .join("")}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold font-display">{employee.name}</h1>
            <StatusBadge status={employee.status} />
          </div>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {employee.designation} · {employee.department}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="size-3.5" /> ID: {employee.code}
            </span>
            <span className="flex items-center gap-1">
              <Mail className="size-3.5" /> {employee.email}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" /> {employee.location}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5" /> Joined {employee.joinedOn}
            </span>
          </div>
        </div>

        {canEdit && (
          <Button onClick={openEdit} className="self-start sm:self-center">
            <Pencil className="mr-2 size-4" /> Edit Profile
          </Button>
        )}
      </div>

      {/* 9 Required Employee Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap h-11 bg-muted/60 p-1">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
          <TabsTrigger value="personal" className="text-xs sm:text-sm">Personal Information</TabsTrigger>
          <TabsTrigger value="employment" className="text-xs sm:text-sm">Employment</TabsTrigger>
          <TabsTrigger value="documents" className="text-xs sm:text-sm">Documents</TabsTrigger>
          <TabsTrigger value="attendance" className="text-xs sm:text-sm">Attendance</TabsTrigger>
          <TabsTrigger value="leave" className="text-xs sm:text-sm">Time Off</TabsTrigger>
          <TabsTrigger value="payroll" className="text-xs sm:text-sm">Payroll</TabsTrigger>
          <TabsTrigger value="assets" className="text-xs sm:text-sm">Assets ({empAssets.length})</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs sm:text-sm">Activity</TabsTrigger>
        </TabsList>

        {/* 1. Overview Tab */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Annual Base CTC"
              value={inr(employee.ctc)}
              hint={`~${inr(Math.round(employee.ctc / 12))}/month`}
              icon={<BadgeIndianRupee className="size-5" />}
              tone="accent"
            />
            <StatCard
              label="Paid Leave Balance"
              value={`${employee.leaveBalance} Days`}
              hint="Current year accrual"
              icon={<CalendarDays className="size-5" />}
              tone="success"
            />
            <StatCard
              label="Hardware Allocated"
              value={empAssets.length}
              hint="Corporate equipment"
              icon={<Laptop className="size-5" />}
              tone="default"
            />
            <StatCard
              label="Reporting To"
              value={employee.manager}
              hint="Direct manager"
              icon={<UserCheck className="size-5" />}
              tone="default"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Role Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <Row k="Department" v={employee.department} />
                <Row k="Designation" v={employee.designation} />
                <Row k="Employment Type" v={employee.employmentType} />
                <Row k="Work Location" v={employee.location} />
                <Row k="Joined Date" v={employee.joinedOn} />
                {employee.exitOn && <Row k="Exit Date" v={employee.exitOn} />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Statutory & Bank Registry</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <Row k="PAN Card" v={employee.pan} />
                <Row k="Salary Account" v={employee.bankAccount} />
                <Row k="Contract Status" v={empContract ? <StatusBadge status={empContract.status} /> : "Draft"} />
                <Row k="Probation / Confirmation" v="Confirmed Regular" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 2. Personal Information Tab */}
        <TabsContent value="personal" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Personal & Emergency Information</CardTitle>
              <CardDescription>Confidential employee personal details</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Row k="Full Legal Name" v={employee.name} />
                <Row k="Corporate Email" v={employee.email} />
                <Row k="Personal Mobile" v={employee.phone} />
                <Row k="PAN" v={employee.pan} />
                <Row k="Nationality" v="Indian" />
              </div>
              <div className="space-y-1">
                <Row k="Current Address" v={`${employee.location}, India`} />
                <Row k="Emergency Contact" v="Sameer (Spouse/Family) · +91 99000 55432" />
                <Row k="Blood Group" v="B+ Positive" />
                <Row k="Bank Branch" v={`HDFC Bank, ${employee.location} Branch`} />
                <Row k="Salary Account Number" v={employee.bankAccount} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. Employment Tab */}
        <TabsContent value="employment" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Employment & Hierarchy Details</CardTitle>
              <CardDescription>Organizational hierarchy, reporting line, and tenure</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Row k="Employee ID Code" v={employee.code} />
                <Row k="Designation" v={employee.designation} />
                <Row k="Department" v={employee.department} />
                <Row k="Employment Type" v={employee.employmentType} />
                <Row k="Reporting Manager" v={employee.manager} />
              </div>
              <div className="space-y-1">
                <Row k="Work Location" v={employee.location} />
                <Row k="Joined Date" v={employee.joinedOn} />
                <Row k="Notice Period" v={`${empContract?.noticePeriodDays ?? 60} Days`} />
                <Row k="Employment Status" v={<StatusBadge status={employee.status} />} />
                {empContract && (
                  <Row
                    k="Agreement Term"
                    v={`${empContract.startDate} → ${empContract.endDate}`}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. Documents Tab */}
        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Employee Documents</CardTitle>
              <CardDescription>Statutory agreements, offer letters and identification documents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                {[
                  { name: `Signed Employment Contract (${employee.code}).pdf`, date: employee.joinedOn, size: "1.4 MB" },
                  { name: `Signed Offer Letter & Annexure.pdf`, date: employee.joinedOn, size: "820 KB" },
                  { name: `PAN & Identity Verification.pdf`, date: employee.joinedOn, size: "540 KB" },
                  { name: `Form 16 Tax Certificate (FY 2025-26).pdf`, date: "2026-06-10", size: "1.1 MB" },
                  { name: `Company Non-Disclosure Agreement (NDA).pdf`, date: employee.joinedOn, size: "680 KB" },
                ].map((doc, i) => (
                  <div key={i} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        <FileText className="size-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.size} · Uploaded {doc.date}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toast.success(`Downloading ${doc.name}`)}
                    >
                      <Download className="mr-1.5 size-3.5" /> Download
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. Attendance Tab */}
        <TabsContent value="attendance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Attendance & Punch History</CardTitle>
              <CardDescription>Recent check-in, check-out and working hours</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {empAttendance.length === 0 ? (
                <EmptyState title="No attendance logs" description="No punches recorded yet for this employee." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Check-In</TableHead>
                      <TableHead>Check-Out</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {empAttendance.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium text-xs">{a.date}</TableCell>
                        <TableCell className="font-mono text-xs">{a.checkIn}</TableCell>
                        <TableCell className="font-mono text-xs">{a.checkOut}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{a.workingHours} hrs</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{a.location}</TableCell>
                        <TableCell><StatusBadge status={a.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 6. Time Off Tab */}
        <TabsContent value="leave" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Leave Requests & Balances</CardTitle>
              <CardDescription>Paid leave balance: {employee.leaveBalance} days remaining</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {empLeave.length === 0 ? (
                <EmptyState title="No leave requests" description="No time off applied for by this employee." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Days</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {empLeave.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.type}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {l.from} → {l.to}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{l.days}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{l.reason}</TableCell>
                        <TableCell><StatusBadge status={l.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 7. Payroll Tab */}
        <TabsContent value="payroll" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Payroll History & Payslips</CardTitle>
              <CardDescription>Processed monthly cycles and statutory deductions</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {empPay.length === 0 ? (
                <EmptyState title="No payroll history" description="This employee has not been processed in any run yet." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pay Period</TableHead>
                      <TableHead>Cycle Status</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Deductions</TableHead>
                      <TableHead className="text-right">Net Salary</TableHead>
                      <TableHead className="text-right">Payslip</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {empPay.map(({ run, line }) => (
                      <TableRow key={run.id}>
                        <TableCell className="font-medium">{run.period}</TableCell>
                        <TableCell><StatusBadge status={run.status} /></TableCell>
                        <TableCell className="text-right tabular-nums">{inr(line!.gross + line!.bonus)}</TableCell>
                        <TableCell className="text-right tabular-nums text-destructive">
                          -{inr(line!.deductions)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-primary">
                          {inr(line!.net)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs"
                            onClick={() =>
                              toast.success(`Downloading payslip for ${run.period}`)
                            }
                          >
                            <Download className="mr-1 size-3.5" /> PDF
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 8. Assets Tab */}
        <TabsContent value="assets" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Assigned Hardware & Licenses</CardTitle>
              <CardDescription>Equipment custodian records</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {empAssets.length === 0 ? (
                <EmptyState title="No assets allocated" description="No equipment currently checked out to this employee." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset Tag</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Serial Number</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {empAssets.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs font-semibold text-primary">{a.tag}</TableCell>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell>{a.category}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{a.serial}</TableCell>
                        <TableCell><StatusBadge status={a.condition} /></TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{inr(a.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 9. Activity Tab */}
        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit & Lifecycle History</CardTitle>
              <CardDescription>Logged operational changes and milestone events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex gap-3 text-sm">
                  <div className="rounded-full bg-primary/10 p-1.5 text-primary self-start">
                    <UserCheck className="size-3.5" />
                  </div>
                  <div>
                    <p className="font-medium">Employee Joined</p>
                    <p className="text-xs text-muted-foreground">Joined as {employee.designation} in {employee.department} on {employee.joinedOn}</p>
                  </div>
                </div>

                {onCase && (
                  <div className="flex gap-3 text-sm">
                    <div className="rounded-full bg-success/15 p-1.5 text-success self-start">
                      <FileCheck className="size-3.5" />
                    </div>
                    <div>
                      <p className="font-medium">Onboarding Case Initialized</p>
                      <p className="text-xs text-muted-foreground">Assigned to buddy {onCase.buddy} (Progress: {onProgress}%)</p>
                    </div>
                  </div>
                )}

                {empActivity.map((a) => (
                  <div key={a.id} className="flex gap-3 text-sm">
                    <div className="rounded-full bg-muted p-1.5 text-muted-foreground self-start">
                      <History className="size-3.5" />
                    </div>
                    <div>
                      <p className="font-medium">{a.action}</p>
                      <p className="text-xs text-muted-foreground">By {a.actor} · {a.at}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Profile Modal */}
      {open && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Profile · {employee.name}</DialogTitle>
              <DialogDescription>Update employee designation, department, and salary.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <Field label="Designation" error={error}>
                <Input
                  value={draft.designation ?? ""}
                  onChange={(e) => setDraft({ ...draft, designation: e.target.value })}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Department">
                  <Input
                    value={draft.department ?? ""}
                    onChange={(e) => setDraft({ ...draft, department: e.target.value })}
                  />
                </Field>
                <Field label="Location">
                  <Input
                    value={draft.location ?? ""}
                    onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Annual CTC (₹)">
                  <Input
                    type="number"
                    value={draft.ctc ? String(draft.ctc) : ""}
                    onChange={(e) => setDraft({ ...draft, ctc: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Status">
                  <Select
                    value={draft.status ?? "active"}
                    onValueChange={(v) => setDraft({ ...draft, status: v as EmployeeStatus })}
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
                  value={draft.manager ?? ""}
                  onChange={(e) => setDraft({ ...draft, manager: e.target.value })}
                />
              </Field>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={save}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
