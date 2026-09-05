import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import Holidays from "date-holidays";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit2,
  Search,
  UserCheck,
  UserX,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Field, PageHeader, StatCard, StatusBadge, TableSkeleton, TablePagination } from "@/components/bits";
import { useApp, useDelayed, useEmployeeName } from "@/lib/store";
import type { AttendanceRecord, AttendanceStatus } from "@/lib/mock-data";

const indiaGujaratHolidays = new Holidays("IN", "GJ");

function toLocalDate(iso: string) {
  const parts = iso.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(y, m - 1, d);
}

function holidaysForMonth(year: number, monthIndex: number) {
  const hList = (indiaGujaratHolidays.getHolidays(year) || []) as Array<{
    date: string | Date;
    type?: string;
    name?: string | Record<string, string>;
  }>;
  return hList.flatMap((h) => {
    const date = String(h.date).slice(0, 10);
    const parts = date.split("-").map(Number);
    const y = parts[0] ?? 0;
    const m = parts[1] ?? 0;
    if (y !== year || m !== monthIndex + 1) return [];
    if (h.type !== "public" && h.type !== "bank") return [];
    const nameStr =
      typeof h.name === "string"
        ? h.name
        : typeof h.name === "object" && h.name
          ? (Object.values(h.name)[0] ?? "")
          : "";
    return [{ date, name: String(nameStr || "Holiday") }];
  });
}

function attendancePercentForMonth(records: AttendanceRecord[], year: number, monthIndex: number) {
  const prefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  const inMonth = records.filter((r) => r.date.startsWith(prefix));
  const countable = inMonth.filter((r) => r.status !== "Holiday");
  const attended = countable.filter(
    (r) => r.status === "Present" || r.status === "Late" || r.status === "Half Day",
  ).length;
  return {
    pct: countable.length ? Math.round((attended / countable.length) * 100) : null,
    attended,
    countable: countable.length,
  };
}

export const Route = createFileRoute("/app/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance · PeoplePay360" },
      { name: "description", content: "Daily attendance monitoring, punch logs, check-in tracking, and manual adjustments." },
      { property: "og:title", content: "Attendance · PeoplePay360" },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const { role } = useApp();
  if (role === "employee") return <EmployeeAttendance />;
  return <StaffAttendance />;
}

function EmployeeAttendance() {
  const { attendance, persona } = useApp();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const myRecords = useMemo(
    () =>
      attendance.filter(
        (a) =>
          a.employeeId === persona.employeeId ||
          (persona.employeeCode && a.employeeId === persona.employeeCode),
      ),
    [attendance, persona.employeeId, persona.employeeCode],
  );

  const year = month.getFullYear();
  const monthHolidays = useMemo(
    () => holidaysForMonth(year, month.getMonth()),
    [year, month],
  );

  const holidayDates = useMemo(() => {
    const fromLib = monthHolidays.map((h) => toLocalDate(h.date));
    const fromRecords = myRecords.filter((r) => r.status === "Holiday").map((r) => toLocalDate(r.date));
    return [...fromLib, ...fromRecords];
  }, [monthHolidays, myRecords]);

  const holidayKeys = useMemo(() => new Set(holidayDates.map((d) => format(d, "yyyy-MM-dd"))), [holidayDates]);
  const holidayNameByDate = useMemo(
    () => new Map(monthHolidays.map((h) => [h.date, h.name])),
    [monthHolidays],
  );

  const presentKeys = useMemo(
    () =>
      new Set(
        myRecords
          .filter(
            (r) =>
              (r.status === "Present" || r.status === "Late" || r.status === "Half Day") &&
              !holidayKeys.has(r.date),
          )
          .map((r) => r.date),
      ),
    [myRecords, holidayKeys],
  );

  const leaveKeys = useMemo(
    () =>
      new Set(
        myRecords.filter((r) => r.status === "On Leave" && !holidayKeys.has(r.date)).map((r) => r.date),
      ),
    [myRecords, holidayKeys],
  );

  const monthStats = attendancePercentForMonth(myRecords, year, month.getMonth());

  const previousMonths = Array.from({ length: 5 }, (_, i) => {
    const d = startOfMonth(subMonths(startOfMonth(new Date()), i + 1));
    const stats = attendancePercentForMonth(myRecords, d.getFullYear(), d.getMonth());
    return { label: format(d, "MMM yyyy"), pct: stats.pct };
  });

  const leadingBlanks = month.getDay();
  const daysInMonth = endOfMonth(month).getDate();
  const trailingBlanks = (7 - ((leadingBlanks + daysInMonth) % 7)) % 7;

  const dayStatus = (iso: string) => {
    if (holidayKeys.has(iso)) return "holiday" as const;
    if (leaveKeys.has(iso)) return "leave" as const;
    if (presentKeys.has(iso)) return "present" as const;
    return "working" as const;
  };

  return (
    <>
      <Card className="shadow-none">
        <CardHeader className="space-y-4 pb-3">
          <CardTitle className="text-xl font-semibold">Attendance</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center justify-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setMonth(startOfMonth(addMonths(month, -1)))}
                aria-label="Previous month"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <p className="min-w-[10rem] text-center text-sm font-semibold">{format(month, "MMMM yyyy")}</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setMonth(startOfMonth(addMonths(month, 1)))}
                aria-label="Next month"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
              Today
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-7 gap-1.5">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
            {Array.from({ length: leadingBlanks }, (_, i) => (
              <div key={`lead-${i}`} className="min-h-[4.25rem] rounded-md border border-border bg-muted/30 sm:min-h-[5rem]" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const iso = format(new Date(year, month.getMonth(), day), "yyyy-MM-dd");
              const status = dayStatus(iso);
              const holidayName = holidayNameByDate.get(iso);
              return (
                <div
                  key={iso}
                  className={
                    status === "present"
                      ? "relative min-h-[4.25rem] rounded-md border border-border bg-success/20 sm:min-h-[5rem]"
                      : status === "leave"
                        ? "relative min-h-[4.25rem] rounded-md border border-border bg-destructive/15 sm:min-h-[5rem]"
                        : status === "holiday"
                          ? "relative min-h-[4.25rem] rounded-md border border-border bg-warning/45 sm:min-h-[5rem]"
                          : "relative min-h-[4.25rem] rounded-md border border-border bg-card sm:min-h-[5rem]"
                  }
                >
                  <span className="absolute left-1.5 top-1 text-[11px] font-medium tabular-nums">{day}</span>
                  {status === "holiday" && holidayName ? (
                    <span className="absolute inset-x-1 top-1/2 -translate-y-1/2 px-0.5 text-center text-[10px] leading-tight break-words text-foreground">
                      {holidayName}
                    </span>
                  ) : null}
                </div>
              );
            })}
            {Array.from({ length: trailingBlanks }, (_, i) => (
              <div key={`trail-${i}`} className="min-h-[4.25rem] rounded-md border border-border bg-muted/30 sm:min-h-[5rem]" />
            ))}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-success/70" /> Present
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-destructive/70" /> Leave
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-warning" /> Holiday
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm border border-border bg-card" /> Working day
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Attendance This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-semibold tabular-nums text-success">
              {monthStats.pct == null ? "—" : `${monthStats.pct}%`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {monthStats.countable
                ? `${monthStats.attended} / ${monthStats.countable} working days`
                : "No attendance records this month"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Last 5 Months</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-40 overflow-y-auto divide-y divide-border">
              {previousMonths.map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="tabular-nums font-medium text-success">
                    {row.pct == null ? "—" : `${row.pct}%`}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function StaffAttendance() {
  const { attendance, employees, correctAttendance, log, role, persona } = useApp();
  const nameOf = useEmployeeName();
  const ready = useDelayed();

  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [q, setQ] = useState("");

  const [correcting, setCorrecting] = useState<AttendanceRecord | null>(null);
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editStatus, setEditStatus] = useState<AttendanceStatus>("Present");
  const [editRemarks, setEditRemarks] = useState("");

  const canManage = role === "hr_manager" || role === "admin" || role === "payroll_manager" || role === "payroll_user";
  const me = employees.find(
    (e) =>
      e.id === persona.employeeId ||
      e.code === persona.employeeCode ||
      (persona.email && e.email.toLowerCase() === persona.email.toLowerCase()),
  );
  const myId = me?.id || persona.employeeId;
  const myCode = me?.code || persona.employeeCode;
  const isEmployeeOnly = role === "employee";

  // Check if current persona is punched in today
  const myTodayRecord = attendance.find(
    (a) => (a.employeeId === myId || (myCode && a.employeeId === myCode)) && a.date === today,
  );
  const isPunchedIn = !!myTodayRecord && myTodayRecord.checkOut === "—";

  // Calculate metrics for selected date (company-wide for HR)
  const dateRecords = attendance.filter((a) => a.date === selectedDate);
  const presentCount = dateRecords.filter((a) => a.status === "Present" || a.status === "Late").length;
  const lateCount = dateRecords.filter((a) => a.status === "Late").length;
const halfDayCount = dateRecords.filter((a) => a.status === "Half Day").length;
  const onLeaveCount = dateRecords.filter((a) => a.status === "On Leave").length;
  const absentCount = employees.filter((e) => e.status === "active").length - presentCount - onLeaveCount;
  const attendanceRate = employees.length > 0 ? Math.round((presentCount / employees.length) * 100) : 0;

  const [page, setPage] = useState(1);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return attendance.filter((a) => {
      if (isEmployeeOnly) {
        const isMine = a.employeeId === myId || (myCode && a.employeeId === myCode);
        if (!isMine) return false;
      }
      const emp = employees.find((e) => e.id === a.employeeId || e.code === a.employeeId);
      const empName = emp ? emp.name.toLowerCase() : "";
      const matchQ =
        a.employeeId.toLowerCase().includes(q.toLowerCase()) ||
        empName.includes(q.toLowerCase()) ||
        (a.location && a.location.toLowerCase().includes(q.toLowerCase()));
      const matchDate = !selectedDate || a.date === selectedDate;
      const matchDept = deptFilter === "all" || emp?.department === deptFilter;
      const matchStatus = statusFilter === "all" || a.status === statusFilter;
      return matchQ && matchDate && matchDept && matchStatus;
    });
  }, [attendance, employees, q, selectedDate, deptFilter, statusFilter, isEmployeeOnly, myId, myCode]);

  const PAGE_SIZE = 5;
  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE) || 1;
  const paginatedAttendance = useMemo(() => {
    return filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filteredRows, page]);

  // Chart data: attendance by status
  const chartData = [
    { name: "Present", count: dateRecords.filter((a) => a.status === "Present").length },
    { name: "Late", count: lateCount },
    { name: "Half Day", count: halfDayCount },
    { name: "On Leave", count: onLeaveCount },
    { name: "Absent", count: Math.max(0, absentCount) },
  ];

  const handleOpenCorrection = (r: AttendanceRecord) => {
    setCorrecting(r);
    setEditCheckIn(r.checkIn);
    setEditCheckOut(r.checkOut);
    setEditStatus(r.status);
    setEditRemarks(r.remarks ?? "");
  };

  const handleSaveCorrection = () => {
    if (!correcting) return;
    correctAttendance(correcting.id, {
      checkIn: editCheckIn,
      checkOut: editCheckOut,
      status: editStatus,
      remarks: editRemarks,
    });
    log(`Corrected attendance entry ${correcting.id} for ${nameOf(correcting.employeeId)}`, "Attendance");
    toast.success("Attendance record updated");
    setCorrecting(null);
  };

  const departments = useMemo(() => Array.from(new Set(employees.map((e) => e.department))).sort(), [employees]);

  // Employee-only metrics
  const myTotalRecords = attendance.filter((a) => a.employeeId === myId || (myCode && a.employeeId === myCode));
  const myPresentDays = myTotalRecords.filter((a) => a.status === "Present" || a.status === "Late").length;
  const myTotalHours = myTotalRecords.reduce((s, a) => s + (a.workingHours || 0), 0);
  const myAvgHours = myPresentDays > 0 ? (myTotalHours / myPresentDays).toFixed(1) : "0";

  return (
    <>
      <PageHeader
        title={isEmployeeOnly ? "My Attendance" : "Attendance Management"}
        description={
          isEmployeeOnly
            ? `Daily clock records, punch timings, and work hours for ${me?.name || persona.name}`
            : "Daily biometric & web punch logging, working hours tracking, status verification and attendance corrections."
        }
      />

      {isEmployeeOnly ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Today's Status"
            value={isPunchedIn ? "Clocked In" : myTodayRecord ? myTodayRecord.status : "Not Clocked In"}
            hint={myTodayRecord?.checkIn ? `In at ${myTodayRecord.checkIn}` : "Tap button to punch"}
            icon={<UserCheck className="size-5" />}
            tone={isPunchedIn ? "success" : "default"}
          />
          <StatCard
            label="Days Present"
            value={`${myPresentDays} Days`}
            hint="Sanctioned work days"
            icon={<Clock className="size-5" />}
            tone="accent"
          />
          <StatCard
            label="Total Logged Hours"
            value={`${myTotalHours.toFixed(1)} hrs`}
            hint="Cumulative working hours"
            icon={<Clock className="size-5" />}
            tone="default"
          />
          <StatCard
            label="Daily Average"
            value={`${myAvgHours} hrs/day`}
            hint="Standard target: 8.5 hrs"
            icon={<Clock className="size-5" />}
            tone="warning"
          />
          <StatCard
            label="Assigned Office"
            value={myTodayRecord?.location || "Ahmedabad"}
            hint="Geofenced desk"
            icon={<CheckCircle2 className="size-5" />}
            tone="success"
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Present Today"
            value={presentCount}
            hint={`${attendanceRate}% attendance rate`}
            icon={<UserCheck className="size-5" />}
            tone="success"
          />
          <StatCard
            label="Absent Today"
            value={Math.max(0, absentCount)}
            hint="Unplanned absences"
            icon={<UserX className="size-5" />}
            tone="default"
          />
          <StatCard
            label="Late Arrivals"
            value={lateCount}
            hint="Punched in after 09:30 AM"
            icon={<Clock className="size-5" />}
            tone="warning"
          />
          <StatCard
            label="Half Day / Early"
            value={halfDayCount}
            hint="Partial working hours"
            icon={<Clock className="size-5" />}
            tone="accent"
          />
          <StatCard
            label="On Leave"
            value={onLeaveCount}
            hint="Approved leaves active"
            icon={<CalendarIcon className="size-5" />}
            tone="default"
          />
        </div>
      )}

      {!isEmployeeOnly && (
        <Card>
          <CardHeader>
            <CardTitle>Attendance Distribution</CardTitle>
            <CardDescription>Daily status breakdown for {selectedDate}</CardDescription>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" tick={{ fontSize: 12 }} />
                <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }} />
                <Bar dataKey="count" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Attendance Punch Log</CardTitle>
              <CardDescription>Biometric clock records and manual entries</CardDescription>
            </div>
          </div>

          <div className="mt-2 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search employee..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>

            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />

            <Select value={deptFilter} onValueChange={setDeptFilter}>
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

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Present">Present</SelectItem>
                <SelectItem value="Absent">Absent</SelectItem>
                <SelectItem value="Late">Late</SelectItem>
                <SelectItem value="Half Day">Half Day</SelectItem>
                <SelectItem value="On Leave">On Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {!ready ? (
            <div className="p-4">
              <TableSkeleton rows={6} />
            </div>
          ) : filteredRows.length === 0 ? (
            <EmptyState
              title="No attendance entries found"
              description="No punch logs match the selected filters."
              icon={<Clock className="size-8" />}
            />
          ) : (
            <>
              {/* Pagination ON TOP of Attendance Punch Logs */}
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={filteredRows.length}
                pageSize={5}
                onPageChange={setPage}
              />
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead className="text-right">Working Hours</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedAttendance.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{nameOf(r.employeeId)}</div>
                          <div className="text-xs text-muted-foreground">{r.employeeId}</div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.date}</TableCell>
                        <TableCell className="font-mono text-xs">{r.checkIn}</TableCell>
                        <TableCell className="font-mono text-xs">{r.checkOut}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {r.workingHours > 0 ? `${r.workingHours} hrs` : "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={r.status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.location}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {r.remarks ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {canManage && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={() => handleOpenCorrection(r)}
                              title="Manual attendance correction"
                            >
                              <Edit2 className="size-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={filteredRows.length}
                pageSize={5}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Correction Dialog */}
      {correcting && (
        <Dialog open={!!correcting} onOpenChange={(o) => !o && setCorrecting(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Manual Attendance Correction</DialogTitle>
              <DialogDescription>
                Adjust recorded punches for {nameOf(correcting.employeeId)} on {correcting.date}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Check-In Time">
                  <Input value={editCheckIn} onChange={(e) => setEditCheckIn(e.target.value)} />
                </Field>
                <Field label="Check-Out Time">
                  <Input value={editCheckOut} onChange={(e) => setEditCheckOut(e.target.value)} />
                </Field>
              </div>

              <Field label="Status">
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as AttendanceStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Present">Present</SelectItem>
                    <SelectItem value="Late">Late</SelectItem>
                    <SelectItem value="Half Day">Half Day</SelectItem>
                    <SelectItem value="On Leave">On Leave</SelectItem>
                    <SelectItem value="Absent">Absent</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Correction Reason / Remarks">
                <Input
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  placeholder="e.g. Biometric scanner offline, verified by manager"
                />
              </Field>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCorrecting(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveCorrection}>Save Correction</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
