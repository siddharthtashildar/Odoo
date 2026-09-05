import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BadgeIndianRupee,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck,
  FileSignature,
  FileText,
  HandCoins,
  Laptop,
  LifeBuoy,
  Plus,
  Receipt,
  ReceiptText,
  ShieldCheck,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, Field, PageHeader, StatCard, StatusBadge } from "@/components/bits";
import { useApp } from "@/lib/store";
import { inr, ROLE_LABELS, ROLE_PERSONA } from "@/lib/mock-data";

export const Route = createFileRoute("/app/me")({
  head: () => ({
    meta: [
      { title: "My Workspace · PeoplePay360" },
      { name: "description", content: "Personal employee self-service portal: profile, payslips, attendance, leave, expenses, and assets." },
      { property: "og:title", content: "My Workspace · PeoplePay360" },
    ],
  }),
  component: MyWorkspace,
});

function MyWorkspace() {
  const {
    persona,
    role,
    employees,
    contracts,
    attendance,
    leave,
    payroll,
    reimbursements,
    assets,
    helpdesk,
    onboarding,
    patchEmployee,
    punchAttendance,
    log,
  } = useApp();

  const staticP = ROLE_PERSONA[role];
  const me =
    employees.find((e) => e.id === persona.employeeId) ??
    (persona.employeeCode ? employees.find((e) => e.code === persona.employeeCode) : undefined) ??
    employees.find((e) => e.code === persona.employeeId) ??
    (persona.email ? employees.find((e) => e.email.toLowerCase() === persona.email.toLowerCase()) : undefined) ??
    (persona.name ? employees.find((e) => e.name.toLowerCase() === persona.name.toLowerCase()) : undefined) ??
    employees.find(
      (e) =>
        staticP &&
        (e.code === staticP.employeeId ||
          (Boolean(staticP?.name) && e.name.toLowerCase().includes((staticP?.name ?? "").split(" ")[0]?.toLowerCase() ?? ""))),
    ) ??
    (role === "payroll_manager" ? employees.find((e) => e.email.includes("arjun") || e.code === "PP-1005" || e.code === "PP-1004") : undefined) ??
    (role === "payroll_user" ? employees.find((e) => e.email.includes("devika") || e.code === "PP-1004" || e.code === "PP-1005") : undefined) ??
    employees[0];

  const canSwitch = role === "admin" || role === "hr_manager" || role === "payroll_manager";
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedSlip, setSelectedSlip] = useState<{ run: (typeof payroll)[0]; line: (typeof payroll)[0]["lines"][0] } | null>(null);

  useEffect(() => {
    if (me?.id && !selectedId) {
      setSelectedId(me.id);
    }
  }, [me?.id]);

  const activeEmployee = (canSwitch && selectedId ? employees.find((e) => e.id === selectedId) : null) ?? me;

  const [phone, setPhone] = useState(activeEmployee?.phone ?? "");
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (activeEmployee?.phone) {
      setPhone(activeEmployee.phone);
    }
  }, [activeEmployee?.phone]);

  if (!activeEmployee) {
    return (
      <EmptyState
        title="Profile in configuration"
        description={`Your enterprise account (${persona.email || persona.name}) is authenticated. Your HR department is finalizing your personnel profile.`}
      />
    );
  }

  const myId = activeEmployee.id;
  const myCode = activeEmployee.code;

  // Personal private filtered slices
  const myContract = contracts.find((c) => c.employeeId === myId || (myCode && (c.employeeId === myCode || (c as any).employeeCode === myCode)));
  const myAttendance = attendance.filter((a) => a.employeeId === myId || (myCode && (a.employeeId === myCode || (a as any).employeeCode === myCode)));
  const myLeave = leave.filter((l) => l.employeeId === myId || (myCode && (l.employeeId === myCode || (l as any).employeeCode === myCode)));
  const myPaidSlips = payroll.filter(
    (r) => (r.status === "paid" || r.status === "approved") && r.lines.some((l) => l.employeeId === myId || (myCode && (l.employeeId === myCode || l.employeeId === activeEmployee.id))),
  );
  const lastSlip = myPaidSlips[0];
  const lastLine = lastSlip?.lines.find((l) => l.employeeId === myId || (myCode && (l.employeeId === myCode || l.employeeId === activeEmployee.id)));
  const myReimbursements = reimbursements.filter((r) => r.employeeId === myId || (myCode && (r.employeeId === myCode || (r as any).employeeCode === myCode)));
  const myAllowances = allowances.filter((a) => a.employeeId === myId || (myCode && (a.employeeId === myCode || (a as any).employeeCode === myCode)));
  const myAssets = assets.filter((a) => a.assignedTo === myId || (myCode && (a.assignedTo === myCode || (a as any).currentEmployeeId === myId)));
  const myTickets = helpdesk.filter((t) => t.requesterId === myId || (myCode && (t.requesterId === myCode || (t as any).employeeId === myId)));
  const onCase = onboarding.find((o) => o.employeeId === myId || (myCode && o.employeeId === myCode));

  const myApprovedLeaves = myLeave.filter((l) => l.status === "approved");
  const usedDays = myApprovedLeaves.reduce((s, l) => s + l.days, 0);
  const leaveBalance = activeEmployee.leaveBalance ?? Math.max(0, 18 - usedDays);

  const todayStr = new Date().toISOString().slice(0, 10);
  const myTodayRecord = myAttendance.find((a) => a.date === todayStr);
  const isPunchedIn = Boolean(
    myTodayRecord &&
      myTodayRecord.checkIn &&
      myTodayRecord.checkIn !== "—" &&
      (!myTodayRecord.checkOut || myTodayRecord.checkOut === "—"),
  );

  const saveContact = () => {
    if (!/^[+0-9 ()-]{8,}$/.test(phone)) {
      setError("Enter a valid contact number.");
      return;
    }
    setError(undefined);
    patchEmployee(activeEmployee.id, { phone });
    log(`Updated personal phone number for ${activeEmployee.name}`, "Profile");
    toast.success("Contact details updated in HRIS database");
  };

  return (
    <>
      <PageHeader
        title="My Self-Service Workspace"
        description={`Personal employee hub for ${activeEmployee.name} (${activeEmployee.code}) · Logged in as ${ROLE_LABELS[role]}`}
        actions={
          <div className="flex items-center gap-2">
            {canSwitch && (
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="w-52 h-9 text-xs">
                  <SelectValue placeholder="Switch employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id} className="text-xs">
                      {e.name} ({e.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button asChild variant="outline" size="sm">
              <Link to="/app/leave">Apply Leave</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/app/reimbursement">Submit Expense</Link>
            </Button>
          </div>
        }
      />

      {/* Header Profile Summary Banner */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center">
        <Avatar className="size-16 shrink-0 border-2 border-primary/20">
          <AvatarFallback className="bg-primary text-xl font-bold text-primary-foreground">
            {activeEmployee.name
              .split(" ")
              .map((p) => p[0])
              .join("")}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold font-display">{activeEmployee.name}</h1>
            <StatusBadge status={activeEmployee.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeEmployee.designation} · {activeEmployee.department} · {activeEmployee.location || "Ahmedabad HQ"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Emp Code: <span className="font-mono font-medium text-foreground">{activeEmployee.code}</span> · Work Email: {activeEmployee.email}
          </p>
        </div>
      </div>

      {/* Quick Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Leave Balance"
          value={`${leaveBalance} Days`}
          hint="Paid leave available"
          icon={<CalendarDays className="size-5" />}
          tone="default"
        />
        <StatCard
          label="Assigned Assets"
          value={myAssets.length}
          hint="Corporate devices in custody"
          icon={<Laptop className="size-5" />}
          tone="accent"
        />
        <StatCard
          label="Last Net Pay"
          value={lastLine ? inr(lastLine.net) : inr(Math.round((activeEmployee.ctc || 600000) / 12 * 0.85))}
          hint={lastSlip?.period ?? "Estimated net transfer"}
          icon={<Receipt className="size-5" />}
          tone="success"
        />
        <StatCard
          label="Open IT Tickets"
          value={myTickets.filter((t) => t.status !== "Closed" && t.status !== "Resolved").length}
          hint="Helpdesk requests"
          icon={<LifeBuoy className="size-5" />}
          tone="warning"
        />
      </div>

      {/* Complete Employee Self-Service Tabs (Section 6) */}
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap h-11 bg-muted/60 p-1">
          <TabsTrigger value="profile">My Profile</TabsTrigger>
          <TabsTrigger value="contract">My Contract</TabsTrigger>
          <TabsTrigger value="attendance">My Attendance</TabsTrigger>
          <TabsTrigger value="leave">My Time Off</TabsTrigger>
          <TabsTrigger value="payslips">My Payslips</TabsTrigger>
          <TabsTrigger value="reimbursements">My Expenses</TabsTrigger>
          <TabsTrigger value="assets">My Assets ({myAssets.length})</TabsTrigger>
          <TabsTrigger value="tickets">My IT Tickets ({myTickets.length})</TabsTrigger>
          {onCase && <TabsTrigger value="onboarding">Onboarding Checklist</TabsTrigger>}
        </TabsList>

        {/* 1. Profile Tab */}
        <TabsContent value="profile" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Personal & Statutory Information</CardTitle>
                <CardDescription>Your records in PeoplePay360 HRIS</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">PAN:</span>
                  <span className="font-mono font-medium">{activeEmployee.pan || `AAAC${activeEmployee.code.replace(/[^0-9]/g, "").slice(0, 4) || "1234"}P`}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Bank Salary Account:</span>
                  <span className="font-mono font-medium">{activeEmployee.bankAccount || "HDFC00984210"}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Joined On:</span>
                  <span>{activeEmployee.joinedOn || "2024-01-15"}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Annual CTC:</span>
                  <span className="font-semibold text-primary">{inr(activeEmployee.ctc || 1200000)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Update Contact Details</CardTitle>
                <CardDescription>Keep emergency and phone contact up to date</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label="Contact Mobile Number" error={error}>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Field>
                <Button onClick={saveContact} size="sm">Save Details</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 2. Contract Tab */}
        <TabsContent value="contract" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>My Employment Agreement</CardTitle>
                  <CardDescription>Terms of service, validity, and notice covenants</CardDescription>
                </div>
                {myContract && <StatusBadge status={myContract.status} />}
              </div>
            </CardHeader>
            <CardContent>
              {myContract ? (
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-3.5">
                    <div>
                      <p className="text-xs text-muted-foreground">Agreement Type</p>
                      <p className="font-medium">{myContract.contractType}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Notice Period</p>
                      <p className="font-medium">{myContract.noticePeriodDays} Days</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Term</p>
                      <p className="font-medium">{myContract.startDate} → {myContract.endDate}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Annual Base CTC</p>
                      <p className="font-semibold text-primary">{inr(myContract.salary)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Terms</p>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{myContract.terms}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.success(`Downloading Contract PDF: ${myContract.id}.pdf`)}
                  >
                    <Download className="mr-1.5 size-3.5" /> Download Contract PDF
                  </Button>
                </div>
              ) : (
                <EmptyState title="No active contract record" description="Consult HR to review your agreement." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. Attendance Tab */}
        <TabsContent value="attendance" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>My Attendance Log</CardTitle>
                <CardDescription>Daily punch logs and hours worked</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={isPunchedIn ? "destructive" : "default"}
                  onClick={async () => {
                    await punchAttendance(myId);
                    toast.success(isPunchedIn ? "Clocked out from My Workspace" : "Clocked in from My Workspace");
                  }}
                >
                  <Clock className="size-3.5 mr-1.5" />
                  {isPunchedIn ? "Punch Out" : "Punch In (Now)"}
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/app/attendance">Open Punch Clock</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {myAttendance.length === 0 ? (
                <EmptyState title="No attendance records" description="No punches recorded yet." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Check-In</TableHead>
                      <TableHead>Check-Out</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myAttendance.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium text-xs">{a.date}</TableCell>
                        <TableCell className="font-mono text-xs">{a.checkIn}</TableCell>
                        <TableCell className="font-mono text-xs">{a.checkOut}</TableCell>
                        <TableCell className="text-right tabular-nums">{a.workingHours} hrs</TableCell>
                        <TableCell><StatusBadge status={a.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. Time Off Tab */}
        <TabsContent value="leave" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>My Leave Applications</CardTitle>
                <CardDescription>Paid balance: {activeEmployee.leaveBalance ?? leaveBalance} days remaining</CardDescription>
              </div>
              <Button asChild size="sm">
                <Link to="/app/leave">Apply for Leave</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {myLeave.length === 0 ? (
                <EmptyState title="No leaves applied" description="You have not requested time off yet." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead className="text-right">Days</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myLeave.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.type}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{l.from} → {l.to}</TableCell>
                        <TableCell className="text-right tabular-nums">{l.days}</TableCell>
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

        {/* 5. Payslips Tab */}
        <TabsContent value="payslips" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>My Payslips</CardTitle>
                <CardDescription>Processed monthly compensation receipts and TDS statements</CardDescription>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/app/payslips">View All Cycles</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {myPaidSlips.length === 0 ? (
                <EmptyState title="No payslips available" description="Disbursed cycles will appear here." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Deductions</TableHead>
                      <TableHead className="text-right">Net Salary</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myPaidSlips.map((r) => {
                      const line = r.lines.find(
                        (l) =>
                          l.employeeId === myId ||
                          (myCode && (l.employeeId === myCode || l.employeeId === activeEmployee.id)),
                      );
                      if (!line) return null;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.period}</TableCell>
                          <TableCell className="text-right tabular-nums">{inr(line.gross + (line.bonus || 0))}</TableCell>
                          <TableCell className="text-right tabular-nums text-destructive">-{inr(line.deductions)}</TableCell>
                          <TableCell className="text-right font-bold tabular-nums text-primary">{inr(line.net)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs gap-1"
                                onClick={() => setSelectedSlip({ run: r, line })}
                              >
                                <Eye className="size-3.5" /> View
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs gap-1"
                                onClick={() => toast.success(`Downloading PDF Payslip for ${r.period}`)}
                              >
                                <Download className="size-3.5" /> PDF
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 6. Reimbursements Tab */}
        <TabsContent value="reimbursements" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>My Expense Claims</CardTitle>
                <CardDescription>Out-of-pocket business claims</CardDescription>
              </div>
              <Button asChild size="sm">
                <Link to="/app/reimbursement">Submit Expense</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {myReimbursements.length === 0 ? (
                <EmptyState title="No expense claims" description="You have not submitted expenses." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Claim ID</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Submitted Date</TableHead>
                      <TableHead>Approval</TableHead>
                      <TableHead>Payment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myReimbursements.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs font-semibold">{r.id}</TableCell>
                        <TableCell>{r.category}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{inr(r.amount)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.submittedDate}</TableCell>
                        <TableCell><StatusBadge status={r.approvalStatus} /></TableCell>
                        <TableCell><StatusBadge status={r.paymentStatus} /></TableCell>
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
              <CardTitle>My Assigned Equipment</CardTitle>
              <CardDescription>Hardware and access tokens assigned to you</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {myAssets.length === 0 ? (
                <EmptyState title="No equipment assigned" description="No corporate devices currently checked out." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset Tag</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Serial Number</TableHead>
                      <TableHead>Condition</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myAssets.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs font-semibold text-primary">{a.tag}</TableCell>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell>{a.category}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{a.serial}</TableCell>
                        <TableCell><StatusBadge status={a.condition || "Good"} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 9. IT Tickets Tab */}
        <TabsContent value="tickets" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>My Support Requests</CardTitle>
                <CardDescription>Tickets logged by you with IT Helpdesk</CardDescription>
              </div>
              <Button asChild size="sm">
                <Link to="/app/helpdesk">Log New Ticket</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {myTickets.length === 0 ? (
                <EmptyState title="No tickets logged" description="Need hardware or software help? Log a ticket." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket ID</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Technician</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myTickets.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs font-semibold">{t.id}</TableCell>
                        <TableCell className="font-medium">{t.subject}</TableCell>
                        <TableCell><StatusBadge status={t.priority} /></TableCell>
                        <TableCell className="text-sm">{t.assignedTechnician}</TableCell>
                        <TableCell><StatusBadge status={t.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 10. Onboarding Checklist Tab (if employee is new hire) */}
        {onCase && (
          <TabsContent value="onboarding" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Your Onboarding Checklist</CardTitle>
                <CardDescription>
                  Started {onCase.startDate} · Target Due: {onCase.dueDate} · Buddy: {onCase.buddy}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Overall Checklist Progress</span>
                    <span className="font-semibold">
                      {Math.round((onCase.tasks.filter((t) => t.done).length / onCase.tasks.length) * 100)}%
                    </span>
                  </div>
                  <Progress
                    value={Math.round((onCase.tasks.filter((t) => t.done).length / onCase.tasks.length) * 100)}
                    className="h-2"
                  />
                </div>

                <div className="rounded-lg border border-border p-3 space-y-2">
                  {onCase.tasks.map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                      <span className={t.done ? "line-through text-muted-foreground" : "font-medium"}>
                        {t.label}
                      </span>
                      <StatusBadge status={t.done ? "Completed" : "Pending"} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Payslip Inspection Dialog */}
      <Dialog open={!!selectedSlip} onOpenChange={(o) => !o && setSelectedSlip(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Payslip Statement · {selectedSlip?.run.period}</DialogTitle>
          </DialogHeader>
          {selectedSlip && (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg bg-muted p-4">
                <p className="font-medium">{activeEmployee.name}</p>
                <p className="text-xs text-muted-foreground">
                  {activeEmployee.code} · {activeEmployee.designation} · {activeEmployee.department}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Credited to Bank A/C: {activeEmployee.bankAccount || "HDFC00984210"}
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5 rounded border border-border/50 p-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Earnings</p>
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-muted-foreground">Basic Salary</span>
                    <span className="font-mono font-medium">
                      {inr(selectedSlip.line.basicSalary || Math.round(selectedSlip.line.gross * 0.5))}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-muted-foreground">House Rent Allowance (HRA)</span>
                    <span className="font-mono font-medium">
                      {inr(selectedSlip.line.hra || Math.round(selectedSlip.line.gross * 0.4))}
                    </span>
                  </div>
                  {(selectedSlip.line.bonus ?? 0) > 0 && (
                    <div className="flex justify-between text-xs py-0.5">
                      <span className="text-muted-foreground">Incentive / Bonus</span>
                      <span className="font-mono font-medium">{inr(selectedSlip.line.bonus)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border/40 pt-1 text-xs font-medium">
                    <span>Total Gross Earnings</span>
                    <span>{inr(selectedSlip.line.gross + (selectedSlip.line.bonus || 0))}</span>
                  </div>
                </div>

                <div className="space-y-1.5 rounded border border-border/50 p-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deductions</p>
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-muted-foreground">Statutory Deductions &amp; TDS</span>
                    <span className="font-mono font-medium text-destructive">-{inr(selectedSlip.line.deductions)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border/40 pt-1 text-xs font-medium text-destructive">
                    <span>Total Deductions</span>
                    <span>-{inr(selectedSlip.line.deductions)}</span>
                  </div>
                </div>

                <div className="flex justify-between rounded-lg bg-primary/10 p-3 font-semibold text-primary">
                  <span>Net Disbursed Amount</span>
                  <span className="text-base tabular-nums">{inr(selectedSlip.line.net)}</span>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => {
                  toast.success(`Downloading PDF statement for ${selectedSlip.run.period}`);
                }}
              >
                <Download className="mr-2 size-4" /> Download Official PDF
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
