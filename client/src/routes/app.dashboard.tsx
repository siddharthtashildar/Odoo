import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  BadgeIndianRupee,
  CalendarDays,
  CheckCircle2,
  Clock,
  Laptop,
  LifeBuoy,
  Receipt,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard, StatusBadge, TableSkeleton, EmptyState } from "@/components/bits";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApp, useDelayed, useEmployeeName } from "@/lib/store";
import {
  inr,
  ROLE_LABELS,
  type Employee,
  type AttendanceRecord,
  type LeaveRequest,
  type PayrollRun,
  type ReimbursementClaim,
  type Asset,
  type HelpdeskTicket,
} from "@/lib/mock-data";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · PeoplePay360" },
      { name: "description", content: "Executive overview of headcount, attendance, payroll, reimbursements, and IT operations." },
      { property: "og:title", content: "Dashboard · PeoplePay360" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const {
    employees,
    attendance,
    leave,
    payroll,
    reimbursements,
    helpdesk,
    assets,
    contracts,
    role,
    persona,
    audit,
  } = useApp();
  const nameOf = useEmployeeName();
  const ready = useDelayed();
  const navigate = useNavigate();


  const today = new Date().toISOString().slice(0, 10);

  // If role is employee, display personal employee-only self-service dashboard
  if (role === "employee") {
    const me = employees.find(
      (e) =>
        e.id === persona.employeeId ||
        e.code === persona.employeeCode ||
        (persona.email && e.email.toLowerCase() === persona.email.toLowerCase()) ||
        (persona.name && e.name.toLowerCase() === persona.name.toLowerCase()),
    );

    return (
      <EmployeeDashboard
        me={me}
        persona={persona}
        attendance={attendance}
        leave={leave}
        payroll={payroll}
        reimbursements={reimbursements}
        assets={assets}
        helpdesk={helpdesk}
        navigate={navigate}
      />
    );
  }

  // HR / Admin / Management View
  // Required 6 KPI Cards:
  // 1. Total Employees
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => e.status !== "exited").length;

  // 2. Present Today
  const todayAttendance = attendance.filter((a) => a.date === today);
  const presentToday = todayAttendance.filter((a) => a.status === "Present" || a.status === "Late").length;
  const attendancePercent = activeEmployees > 0 ? Math.round((presentToday / activeEmployees) * 100) : 92;

  // 3. Pending Leave Requests
  const pendingLeave = leave.filter((l) => l.status === "pending");

  // 4. Payroll This Month
  const latestRun = payroll[0] ?? {
    id: "PR-2609",
    period: "September 2026",
    status: "draft" as const,
    lines: [],
  };
  const monthCost = latestRun.lines.reduce((s, l) => s + l.net, 0);

  // 5. Pending Reimbursements
  const pendingReimbursements = reimbursements.filter((r) => r.approvalStatus === "pending");
  const pendingReimbursementAmount = pendingReimbursements.reduce((s, r) => s + r.amount, 0);

  // 6. Open IT Tickets
  const openTickets = helpdesk.filter((t) => t.status === "Open" || t.status === "In Progress");

  const isPayrollRole = role === "payroll_manager" || role === "payroll_user";

  return (
    <>
      <PageHeader
        title={`Good day, ${persona.name.split(" ")[0]}`}
        description={`PeoplePay360 Operations Overview · Logged in as ${ROLE_LABELS[role]}`}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/app/reports">Executive Reports</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/app/me">My Workspace</Link>
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className={`grid gap-4 sm:grid-cols-2 ${isPayrollRole ? "lg:grid-cols-3" : "lg:grid-cols-3 xl:grid-cols-6"}`}>
        <Link
          to="/app/employees"
          className="group block rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Employees
            </span>
            <div className="rounded-lg bg-primary/10 p-2 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <Users className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-display">{totalEmployees}</div>
          <div className="mt-1 flex items-center text-xs text-muted-foreground">
            <span className="text-success font-medium mr-1 flex items-center">
              <TrendingUp className="size-3 mr-0.5" /> +2
            </span>
            this quarter
          </div>
        </Link>

        {!isPayrollRole && (
          <>
            <Link
              to="/app/attendance"
              className="group block rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Present Today
                </span>
                <div className="rounded-lg bg-success/15 p-2 text-success group-hover:bg-success group-hover:text-success-foreground transition-colors">
                  <UserCheck className="size-4" />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold font-display">{presentToday}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {attendancePercent}% attendance rate
              </div>
            </Link>

            <Link
              to="/app/leave"
              className="group block rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Pending Leaves
                </span>
                <div className="rounded-lg bg-warning/20 p-2 text-warning-foreground group-hover:bg-warning group-hover:text-white transition-colors">
                  <CalendarDays className="size-4" />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold font-display">{pendingLeave.length}</div>
              <div className="mt-1 text-xs text-warning-foreground font-medium">
                Requires approval
              </div>
            </Link>

            <Link
              to="/app/payroll"
              className="group block rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Payroll (Sep)
                </span>
                <div className="rounded-lg bg-accent/20 p-2 text-accent-foreground group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                  <BadgeIndianRupee className="size-4" />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold font-display tabular-nums">
                {inr(monthCost)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {latestRun.lines.length} employees · {latestRun.status}
              </div>
            </Link>
          </>
        )}

        <Link
          to="/app/reimbursement"
          className="group block rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pending Claims
            </span>
            <div className="rounded-lg bg-info/15 p-2 text-info group-hover:bg-info group-hover:text-white transition-colors">
              <Receipt className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-display">{pendingReimbursements.length}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {inr(pendingReimbursementAmount)} awaiting
          </div>
        </Link>

        <Link
          to="/app/helpdesk"
          className="group block rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Open IT Tickets
            </span>
            <div className="rounded-lg bg-primary/10 p-2 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <LifeBuoy className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-display">{openTickets.length}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {openTickets.filter((t) => t.priority === "Critical").length} critical incident(s)
          </div>
        </Link>
      </div>



      {/* Recent Enterprise Activity */}
      {!isPayrollRole && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Enterprise Activity</CardTitle>
            <CardDescription>Real-time audit events and lifecycle operations</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {audit.slice(0, 8).map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                  <span className="font-semibold text-foreground">{a.actor}</span>
                  <span className="text-muted-foreground">{a.action}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{a.at}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function EmployeeDashboard({
  me,
  persona,
  attendance,
  leave,
  payroll,
  reimbursements,
  assets,
  helpdesk,
  navigate,
}: {
  me: Employee | undefined;
  persona: { employeeId: string; employeeCode: string; name: string; email: string };
  attendance: AttendanceRecord[];
  leave: LeaveRequest[];
  payroll: PayrollRun[];
  reimbursements: ReimbursementClaim[];
  assets: Asset[];
  helpdesk: HelpdeskTicket[];
  navigate: ReturnType<typeof useNavigate>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const myId = me?.id || persona.employeeId;
  const myCode = me?.code || persona.employeeCode;
  const myName = me?.name || persona.name;

  // Personal data filters
  const myAttendance = attendance.filter((a) => a.employeeId === myId || (myCode && a.employeeId === myCode));
  const myToday = myAttendance.find((a) => a.date === today);
  const isPunchedIn = !!myToday && myToday.checkOut === "—";

  const myLeaves = leave.filter((l) => l.employeeId === myId || (myCode && l.employeeId === myCode));
  const myPendingLeaves = myLeaves.filter((l) => l.status === "pending");
  const myApprovedLeaves = myLeaves.filter((l) => l.status === "approved");
  const usedDays = myApprovedLeaves.reduce((s, l) => s + l.days, 0);
  const leaveBalance = me?.leaveBalance ?? Math.max(0, 18 - usedDays);

  const myReimbursements = reimbursements.filter((r) => r.employeeId === myId || (myCode && r.employeeId === myCode));
  const myPendingClaims = myReimbursements.filter((r) => r.approvalStatus === "pending");
  const myPendingAmount = myPendingClaims.reduce((s, r) => s + r.amount, 0);

  const myPaidSlips = payroll.filter((r) => r.status === "paid" && r.lines.some((l) => l.employeeId === myId || (myCode && l.employeeId === myCode)));
  const lastSlip = myPaidSlips[0];
  const lastLine = lastSlip?.lines.find((l) => l.employeeId === myId || (myCode && l.employeeId === myCode));
  const estimatedMonthlyNet = lastLine?.net ?? (me?.ctc ? Math.round((me.ctc / 12) * 0.85) : 85000);

  const myAssets = assets.filter((a) => a.assignedTo === myId || (myCode && a.assignedTo === myCode));
  const myTickets = helpdesk.filter((t) => t.requesterId === myId || (myCode && t.requesterId === myCode));
  const myOpenTickets = myTickets.filter((t) => t.status === "Open" || t.status === "In Progress");

  // Attendance percentage (present days / total working days)
  const attendanceRecords = myAttendance.filter((a) => a.status !== "Holiday");
  const presentDays = myAttendance.filter((a) => a.status === "Present" || a.status === "Late").length;
  const attendancePercent = attendanceRecords.length > 0 ? Math.round((presentDays / attendanceRecords.length) * 100) : 0;

  // Recent attendance (last 5 records)
  const recentAttendance = myAttendance.slice(0, 5);

  return (
    <>
      <PageHeader
        title={`Welcome back, ${myName}`}
        description={`${me?.designation ?? "Employee"} · ${me?.department ?? "Engineering"} · ID: ${myCode || myId.slice(0, 8)}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/app/me">My Workspace</Link>
          </Button>
        }
      />

      {/* 6 Employee Self-Service KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* 1. Today's Attendance */}
        <Link
          to="/app/attendance"
          className="group block rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Today's Status
            </span>
            <div className={`rounded-lg p-2 transition-colors ${isPunchedIn ? "bg-success/15 text-success" : "bg-primary/10 text-primary"}`}>
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold font-display">
            {isPunchedIn ? "Clocked In" : myToday ? myToday.status : "Not Clocked In"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground truncate">
            {myToday?.checkIn ? `In at ${myToday.checkIn}` : "View today's attendance"}
          </div>
        </Link>

        {/* 2. Leave Balance */}
        <Link
          to="/app/leave"
          className="group block rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Leave Balance
            </span>
            <div className="rounded-lg bg-warning/20 p-2 text-warning-foreground transition-colors">
              <CalendarDays className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-display">
            {leaveBalance} <span className="text-sm font-normal text-muted-foreground">Days</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {myPendingLeaves.length > 0 ? `${myPendingLeaves.length} pending approval` : `${usedDays} days used`}
          </div>
        </Link>

        {/* 3. Latest Payslip */}
        <Link
          to="/app/payslips"
          className="group block rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              My Net Pay
            </span>
            <div className="rounded-lg bg-accent/20 p-2 text-accent-foreground transition-colors">
              <BadgeIndianRupee className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold font-display tabular-nums">
            {inr(estimatedMonthlyNet)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground truncate">
            {lastSlip?.period ?? "Latest cycle"}
          </div>
        </Link>

        {/* 4. Expense Claims */}
        <Link
          to="/app/reimbursement"
          className="group block rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              My Claims
            </span>
            <div className="rounded-lg bg-info/15 p-2 text-info transition-colors">
              <Receipt className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold font-display tabular-nums">
            {inr(myPendingAmount)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {myPendingClaims.length} pending review
          </div>
        </Link>

        {/* 5. Assigned Hardware */}
        <Link
          to="/app/assets"
          className="group block rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              My Hardware
            </span>
            <div className="rounded-lg bg-indigo-500/15 p-2 text-indigo-500 transition-colors">
              <Laptop className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-display">
            {myAssets.length} <span className="text-sm font-normal text-muted-foreground">Items</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground truncate">
            {myAssets[0]?.name ?? "No assets assigned"}
          </div>
        </Link>

        {/* 6. Attendance Percentage */}
        <Link
          to="/app/attendance"
          className="group block rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Attendance %
            </span>
            <div className="rounded-lg bg-success/15 p-2 text-success transition-colors">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-display tabular-nums">
            {attendancePercent}<span className="text-sm font-normal text-muted-foreground">%</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {presentDays} of {attendanceRecords.length} days
          </div>
        </Link>
      </div>

      {/* Two Column Layout: Recent Attendance & Leave Applications */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* My Recent Attendance */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>My Recent Attendance</CardTitle>
              <CardDescription>Your clock-in records and daily hours</CardDescription>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link to="/app/attendance">All logs</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentAttendance.length === 0 ? (
              <EmptyState title="No punches yet" description="Punch in to record your attendance today." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>In</TableHead>
                      <TableHead>Out</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentAttendance.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.date}</TableCell>
                        <TableCell className="text-xs">{a.checkIn || "—"}</TableCell>
                        <TableCell className="text-xs">{a.checkOut || "—"}</TableCell>
                        <TableCell className="tabular-nums text-xs">{a.workingHours > 0 ? `${a.workingHours}h` : "—"}</TableCell>
                        <TableCell>
                          <StatusBadge status={a.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Leave Requests */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>My Leave Requests</CardTitle>
              <CardDescription>Recent time-off applications and status</CardDescription>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link to="/app/leave">Request leave</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {myLeaves.length === 0 ? (
              <EmptyState title="No leave applications" description="You have not submitted any leave requests." />
            ) : (
              <div className="divide-y divide-border">
                {myLeaves.slice(0, 5).map((l) => (
                  <div key={l.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium">{l.type} Leave</p>
                      <p className="text-xs text-muted-foreground">
                        {l.from} to {l.to} · {l.days} day(s)
                      </p>
                      {l.reason && <p className="text-xs text-muted-foreground/80 italic mt-0.5">"{l.reason}"</p>}
                    </div>
                    <StatusBadge status={l.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* My Assigned Hardware */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>My Assigned Equipment</CardTitle>
            <CardDescription>Company laptops, monitors, and accessories</CardDescription>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link to="/app/assets">View assets</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {myAssets.length === 0 ? (
            <EmptyState title="No equipment assigned" description="You currently have no hardware items checked out." />
          ) : (
            <div className="space-y-3">
              {myAssets.map((asset) => (
                <div key={asset.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-muted p-2">
                      <Laptop className="size-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{asset.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Tag: {asset.tag} · S/N: {asset.serial || "N/A"}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={asset.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
