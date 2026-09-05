import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  Clock,
  Edit2,
  LogIn,
  LogOut,
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
import { EmptyState, Field, PageHeader, StatCard, StatusBadge, TableSkeleton } from "@/components/bits";
import { useApp, useDelayed, useEmployeeName } from "@/lib/store";
import type { AttendanceRecord, AttendanceStatus } from "@/lib/mock-data";

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
  const { attendance, employees, punchAttendance, correctAttendance, log, role, persona } = useApp();
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

  // Check if current persona is punched in today
  const myTodayRecord = attendance.find(
    (a) => a.employeeId === persona.employeeId && a.date === today,
  );
  const isPunchedIn = !!myTodayRecord && myTodayRecord.checkOut === "—";

  // Calculate metrics for selected date
  const dateRecords = attendance.filter((a) => a.date === selectedDate);
  const presentCount = dateRecords.filter((a) => a.status === "Present" || a.status === "Late").length;
  const lateCount = dateRecords.filter((a) => a.status === "Late").length;
  const halfDayCount = dateRecords.filter((a) => a.status === "Half Day").length;
  const onLeaveCount = dateRecords.filter((a) => a.status === "On Leave").length;
  const absentCount = employees.filter((e) => e.status === "active").length - presentCount - onLeaveCount;
  const attendanceRate = employees.length > 0 ? Math.round((presentCount / employees.length) * 100) : 0;

  // Filtered rows
  const filteredRows = useMemo(() => {
    return attendance.filter((a) => {
      if (role === "employee" && a.employeeId !== persona.employeeId) return false;
      const emp = employees.find((e) => e.id === a.employeeId);
      const empName = emp ? emp.name.toLowerCase() : "";
      const matchQ = empName.includes(q.toLowerCase()) || a.employeeId.toLowerCase().includes(q.toLowerCase());
      const matchDate = selectedDate === "all" || a.date === selectedDate;
      const matchDept = deptFilter === "all" || emp?.department === deptFilter;
      const matchStatus = statusFilter === "all" || a.status === statusFilter;
      return matchQ && matchDate && matchDept && matchStatus;
    });
  }, [attendance, employees, q, selectedDate, deptFilter, statusFilter, role, persona.employeeId]);

  // Chart data: attendance by status
  const chartData = [
    { name: "Present", count: dateRecords.filter((a) => a.status === "Present").length },
    { name: "Late", count: lateCount },
    { name: "Half Day", count: halfDayCount },
    { name: "On Leave", count: onLeaveCount },
    { name: "Absent", count: Math.max(0, absentCount) },
  ];

  const handlePunchToggle = () => {
    punchAttendance(persona.employeeId);
    if (isPunchedIn) {
      log(`Punched out for the day`, "Attendance");
      toast.success("Punched out successfully", {
        description: `Have a great evening, ${persona.name}!`,
      });
    } else {
      log(`Punched in for work`, "Attendance");
      toast.success("Punched in successfully", {
        description: `Logged at ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`,
      });
    }
  };

  const handleOpenCorrection = (record: AttendanceRecord) => {
    setCorrecting(record);
    setEditCheckIn(record.checkIn);
    setEditCheckOut(record.checkOut);
    setEditStatus(record.status);
    setEditRemarks(record.remarks ?? "");
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

  return (
    <>
      <PageHeader
        title="Attendance Management"
        description="Daily biometric & web punch logging, working hours tracking, status verification and attendance corrections."
        actions={
          <Button
            variant={isPunchedIn ? "destructive" : "default"}
            onClick={handlePunchToggle}
            className="shadow-sm"
          >
            {isPunchedIn ? (
              <>
                <LogOut className="mr-2 size-4" /> Punch Out
              </>
            ) : (
              <>
                <LogIn className="mr-2 size-4" /> Punch In (Now)
              </>
            )}
          </Button>
        }
      />

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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
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
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Bar dataKey="count" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Attendance Punch</CardTitle>
            <CardDescription>Signed in as {persona.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Today's Punch Status</span>
                <StatusBadge status={isPunchedIn ? "Present" : myTodayRecord ? "Completed" : "Absent"} />
              </div>
              <div className="mt-2 text-sm font-medium">
                {myTodayRecord
                  ? `In: ${myTodayRecord.checkIn} · Out: ${myTodayRecord.checkOut}`
                  : "No check-in recorded yet today"}
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Standard shift hours: 09:00 AM – 06:00 PM (9.0 hrs). Geofencing enabled for Ahmedabad, Bengaluru, Mumbai offices.
            </div>

            <Button
              className="w-full"
              variant={isPunchedIn ? "outline" : "default"}
              onClick={handlePunchToggle}
            >
              {isPunchedIn ? "Mark Evening Check-Out" : "Record Morning Punch"}
            </Button>
          </CardContent>
        </Card>
      </div>

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
                  {filteredRows.map((r) => (
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
