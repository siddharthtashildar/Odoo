import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  BadgeIndianRupee,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
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
    allowances,
    assets,
    helpdesk,
    onboarding,
    patchEmployee,
    log,
  } = useApp();

  const staticP = ROLE_PERSONA[role];
  const me =
    employees.find((e) => e.id === persona.employeeId) ??
    employees.find((e) => e.code === persona.employeeId) ??
    employees.find(
      (e) =>
        staticP &&
        (e.code === staticP.employeeId ||
          (Boolean(staticP?.name) && e.name.toLowerCase().includes((staticP?.name ?? "").split(" ")[0]?.toLowerCase() ?? ""))),
    ) ??
    (role === "payroll_manager" ? employees.find((e) => e.email.includes("arjun") || e.code === "PP-1005" || e.code === "PP-1004") : undefined) ??
    (role === "payroll_user" ? employees.find((e) => e.email.includes("devika") || e.code === "PP-1004" || e.code === "PP-1005") : undefined) ??
    employees[0];

  const [phone, setPhone] = useState(me?.phone ?? "");
  const [error, setError] = useState<string | undefined>();

  if (!me) {
    return <EmptyState title="Profile unavailable" description="This demo persona has no employee record." />;
  }

  // Personal private filtered slices
  const myContract = contracts.find((c) => c.employeeId === me.id || c.employeeId === me.code);
  const myAttendance = attendance.filter((a) => a.employeeId === me.id || a.employeeId === me.code);
  const myLeave = leave.filter((l) => l.employeeId === me.id || l.employeeId === me.code);
  const myPaidSlips = payroll.filter((r) => r.status === "paid" && r.lines.some((l) => l.employeeId === me.id || l.employeeId === me.code));
  const lastSlip = myPaidSlips[0];
  const lastLine = lastSlip?.lines.find((l) => l.employeeId === me.id || l.employeeId === me.code);
  const myReimbursements = reimbursements.filter((r) => r.employeeId === me.id || r.employeeId === me.code);
  const myAllowances = allowances.filter((a) => a.employeeId === me.id || a.employeeId === me.code);
  const myAssets = assets.filter((a) => a.assignedTo === me.id || a.assignedTo === me.code);
  const myTickets = helpdesk.filter((t) => t.requesterId === me.id || t.requesterId === me.code);
  const onCase = onboarding.find((o) => o.employeeId === me.id || o.employeeId === me.code);

  const saveContact = () => {
    if (!/^[+0-9 ()-]{8,}$/.test(phone)) {
      setError("Enter a valid contact number.");
      return;
    }
    setError(undefined);
    patchEmployee(me.id, { phone });
    log("Updated personal phone number", "Profile");
    toast.success("Contact details updated");
  };

  return (
    <>
      <PageHeader
        title="My Self-Service Workspace"
        description={`Personal employee hub for ${me.name} (${me.code}) · Logged in as ${ROLE_LABELS[role]}`}
        actions={
          <div className="flex gap-2">
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
            {me.name
              .split(" ")
              .map((p) => p[0])
              .join("")}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold font-display">{me.name}</h1>
            <StatusBadge status={me.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {me.designation} · {me.department} · {me.location}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Emp Code: <span className="font-mono font-medium text-foreground">{me.code}</span> · Work Email: {me.email}
          </p>
        </div>
      </div>

      {/* Quick Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Leave Balance"
          value={`${me.leaveBalance} Days`}
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
          value={lastLine ? inr(lastLine.net) : "—"}
          hint={lastSlip?.period ?? "No paid runs yet"}
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
          <TabsTrigger value="allowances">My Allowances</TabsTrigger>
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
                  <span className="font-mono font-medium">{me.pan}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Bank Salary Account:</span>
                  <span className="font-mono font-medium">{me.bankAccount}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Joined On:</span>
                  <span>{me.joinedOn}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Annual CTC:</span>
                  <span className="font-semibold text-primary">{inr(me.ctc)}</span>
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
              <Button asChild size="sm">
                <Link to="/app/attendance">Open Punch Clock</Link>
              </Button>
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
                <CardDescription>Paid balance: {me.leaveBalance} days remaining</CardDescription>
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
            <CardHeader>
              <CardTitle>My Payslips</CardTitle>
              <CardDescription>Processed monthly compensation receipts and TDS statements</CardDescription>
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
                      const line = r.lines.find((l) => l.employeeId === me.id)!;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.period}</TableCell>
                          <TableCell className="text-right tabular-nums">{inr(line.gross + line.bonus)}</TableCell>
                          <TableCell className="text-right tabular-nums text-destructive">-{inr(line.deductions)}</TableCell>
                          <TableCell className="text-right font-bold tabular-nums text-primary">{inr(line.net)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => toast.success(`Downloading PDF Payslip for ${r.period}`)}
                            >
                              <Download className="size-3.5 mr-1" /> PDF
                            </Button>
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

        {/* 7. Allowances Tab */}
        <TabsContent value="allowances" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>My Active Allowances</CardTitle>
              <CardDescription>Monthly recurring perks and benefits</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {myAllowances.length === 0 ? (
                <EmptyState title="No allowances configured" description="No monthly recurring allowances assigned." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Allowance</TableHead>
                      <TableHead className="text-right">Monthly Amount</TableHead>
                      <TableHead>Effective Term</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myAllowances.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.type}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{inr(a.amount)}/mo</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{a.effectiveDate} → {a.expiryDate}</TableCell>
                        <TableCell><StatusBadge status={a.status} /></TableCell>
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
    </>
  );
}
