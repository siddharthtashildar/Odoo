import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Briefcase,
  CalendarDays,
  CalendarRange,
  Check,
  Clock,
  Coffee,
  Edit3,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Sun,
  Sunrise,
  Sunset,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageHeader, StatCard } from "@/components/bits";
import { useApp } from "@/lib/store";
import type { ShiftType, WorkSchedule } from "@/lib/mock-data";

export const Route = createFileRoute("/app/schedule")({
  head: () => ({
    meta: [
      { title: "Work Schedule · PeoplePay360" },
      { name: "description", content: "Manage shift timings, working days, break policies, and employee schedule assignments." },
      { property: "og:title", content: "Work Schedule · PeoplePay360" },
    ],
  }),
  component: SchedulePage,
});

const DAYS_OF_WEEK = [
  { name: "Monday", short: "Mon" },
  { name: "Tuesday", short: "Tue" },
  { name: "Wednesday", short: "Wed" },
  { name: "Thursday", short: "Thu" },
  { name: "Friday", short: "Fri" },
  { name: "Saturday", short: "Sat" },
  { name: "Sunday", short: "Sun" },
];

const SHIFT_TYPE_CONFIG: Record<ShiftType, { label: string; icon: typeof Sun; badgeColor: string; hex: string }> = {
  General: { label: "General Shift", icon: Briefcase, badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800", hex: "#3b82f6" },
  Morning: { label: "Morning Shift", icon: Sunrise, badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800", hex: "#f59e0b" },
  Evening: { label: "Evening Shift", icon: Sunset, badgeColor: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800", hex: "#f97316" },
  Night: { label: "Night Shift", icon: Moon, badgeColor: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800", hex: "#6366f1" },
  Flexible: { label: "Flexible Hours", icon: Zap, badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800", hex: "#10b981" },
  Rotational: { label: "Rotational Shift", icon: RotateCcw, badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800", hex: "#a855f7" },
};

// Helper: Calculate daily and weekly hours reactive formula
function calculateReactiveHours(startTime: string, endTime: string, breakMinutes: number, workingDaysCount: number) {
  if (!startTime || !endTime) return { dailyNetHours: 0, weeklyHours: 0, isOvernight: false };
  const [sh = 9, sm = 0] = startTime.split(":").map(Number);
  const [eh = 18, em = 0] = endTime.split(":").map(Number);

  let startMinutes = sh * 60 + sm;
  let endMinutes = eh * 60 + em;
  const isOvernight = endMinutes <= startMinutes;

  if (isOvernight) {
    endMinutes += 24 * 60;
  }

  const grossDailyMinutes = Math.max(0, endMinutes - startMinutes);
  const netDailyMinutes = Math.max(0, grossDailyMinutes - (breakMinutes || 0));
  const dailyNetHours = Math.round((netDailyMinutes / 60) * 100) / 100;
  const weeklyHours = Math.round(((netDailyMinutes * workingDaysCount) / 60) * 100) / 100;

  return { dailyNetHours, weeklyHours, isOvernight, grossDailyMinutes, netDailyMinutes };
}

function SchedulePage() {
  const { schedules, addSchedule, updateSchedule, deleteSchedule, assignSchedule, employees, persona, role } = useApp();

  const isEmployee = role === "employee";

  // Find logged in employee's assigned schedule
  const myEmployee = useMemo(() => {
    return employees.find(
      (e) =>
        e.id === persona.employeeId ||
        (persona.employeeCode && e.code === persona.employeeCode) ||
        e.email.toLowerCase() === persona.email.toLowerCase()
    );
  }, [employees, persona]);

  const mySchedule = useMemo(() => {
    if (!schedules.length) return undefined;
    const targetId = myEmployee?.id || persona.employeeId;
    const targetCode = myEmployee?.code || persona.employeeCode;

    // Search by employee assignment
    const assigned = schedules.find((s) => {
      const ids = s.assignedEmployeeIds || [];
      return ids.includes(targetId) || (targetCode && ids.includes(targetCode));
    });

    if (assigned) return assigned;
    // Fallback to default schedule
    return schedules.find((s) => s.isDefault) || schedules[0];
  }, [schedules, myEmployee, persona]);

  // Modals state for HR
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedScheduleForAssign, setSelectedScheduleForAssign] = useState<WorkSchedule | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Search & Filter state for HR
  const [searchEmployee, setSearchEmployee] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"schedules" | "matrix">("schedules");

  // Schedule Form State
  const [formName, setFormName] = useState("");
  const [formShiftType, setFormShiftType] = useState<ShiftType>("General");
  const [formDescription, setFormDescription] = useState("");
  const [formWorkingDays, setFormWorkingDays] = useState<string[]>([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ]);
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("18:00");
  const [formBreakMinutes, setFormBreakMinutes] = useState(60);
  const [formBreakStart, setFormBreakStart] = useState("13:00");
  const [formBreakEnd, setFormBreakEnd] = useState("14:00");
  const [formIsDefault, setFormIsDefault] = useState(false);

  // Assign modal state
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [assignSearch, setAssignSearch] = useState("");

  // Live Reactive Calculation for the form
  const liveCalculation = useMemo(() => {
    return calculateReactiveHours(formStartTime, formEndTime, formBreakMinutes, formWorkingDays.length);
  }, [formStartTime, formEndTime, formBreakMinutes, formWorkingDays.length]);

  const openCreateDialog = () => {
    setEditingSchedule(null);
    setFormName("");
    setFormShiftType("General");
    setFormDescription("");
    setFormWorkingDays(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
    setFormStartTime("09:00");
    setFormEndTime("18:00");
    setFormBreakMinutes(60);
    setFormBreakStart("13:00");
    setFormBreakEnd("14:00");
    setFormIsDefault(false);
    setCreateDialogOpen(true);
  };

  const openEditDialog = (sch: WorkSchedule) => {
    setEditingSchedule(sch);
    setFormName(sch.name);
    setFormShiftType(sch.shiftType);
    setFormDescription(sch.description || "");
    setFormWorkingDays(sch.workingDays || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
    setFormStartTime(sch.startTime);
    setFormEndTime(sch.endTime);
    setFormBreakMinutes(sch.breakDurationMinutes);
    setFormBreakStart(sch.breakStartTime || "13:00");
    setFormBreakEnd(sch.breakEndTime || "14:00");
    setFormIsDefault(sch.isDefault || false);
    setCreateDialogOpen(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Please enter a schedule name");
      return;
    }
    if (formWorkingDays.length === 0) {
      toast.error("Please select at least one working day");
      return;
    }

    const shiftCfg = SHIFT_TYPE_CONFIG[formShiftType] || SHIFT_TYPE_CONFIG.General;

    if (editingSchedule) {
      await updateSchedule(editingSchedule.id, {
        name: formName.trim(),
        shiftType: formShiftType,
        description: formDescription.trim(),
        workingDays: formWorkingDays,
        startTime: formStartTime,
        endTime: formEndTime,
        breakDurationMinutes: Number(formBreakMinutes),
        breakStartTime: formBreakStart,
        breakEndTime: formBreakEnd,
        isDefault: formIsDefault,
        dailyHours: liveCalculation.dailyNetHours,
        weeklyHours: liveCalculation.weeklyHours,
        color: shiftCfg.hex,
      });
      toast.success(`Updated schedule "${formName}"`);
    } else {
      const newSchedule: WorkSchedule = {
        id: `SCH-${Date.now().toString().slice(-4)}`,
        name: formName.trim(),
        shiftType: formShiftType,
        description: formDescription.trim(),
        workingDays: formWorkingDays,
        startTime: formStartTime,
        endTime: formEndTime,
        breakDurationMinutes: Number(formBreakMinutes),
        breakStartTime: formBreakStart,
        breakEndTime: formBreakEnd,
        isDefault: formIsDefault,
        status: "active",
        dailyHours: liveCalculation.dailyNetHours,
        weeklyHours: liveCalculation.weeklyHours,
        color: shiftCfg.hex,
        assignedEmployeeIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await addSchedule(newSchedule);
      toast.success(`Created schedule "${formName}" (${liveCalculation.weeklyHours} hrs/wk)`);
    }
    setCreateDialogOpen(false);
  };

  const openAssignModal = (sch: WorkSchedule) => {
    setSelectedScheduleForAssign(sch);
    // Pre-populate with currently assigned employees
    setSelectedEmpIds([...(sch.assignedEmployeeIds || [])]);
    setAssignSearch("");
    setAssignDialogOpen(true);
  };

  const handleSaveAssignment = async () => {
    if (!selectedScheduleForAssign) return;
    await assignSchedule(selectedScheduleForAssign.id, selectedEmpIds);
    toast.success(`Assigned ${selectedEmpIds.length} employee(s) to ${selectedScheduleForAssign.name}`);
    setAssignDialogOpen(false);
  };

  const handleDeleteSchedule = async (id: string) => {
    const sch = schedules.find((s) => s.id === id);
    if (sch?.isDefault) {
      toast.error("Cannot delete the default organization schedule");
      return;
    }
    await deleteSchedule(id);
    toast.success("Schedule deleted");
    setDeleteConfirmId(null);
  };

  const toggleWorkingDay = (dayName: string) => {
    setFormWorkingDays((prev) =>
      prev.includes(dayName) ? prev.filter((d) => d !== dayName) : [...prev, dayName]
    );
  };

  // Filtered employees for matrix view
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set);
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const q = searchEmployee.toLowerCase();
      const matchSearch =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q) ||
        (e.department && e.department.toLowerCase().includes(q));
      const matchDept = deptFilter === "all" || e.department === deptFilter;
      return matchSearch && matchDept;
    });
  }, [employees, searchEmployee, deptFilter]);

  // Overall HR Stats
  const totalEmployees = employees.length;
  const assignedEmployeesCount = useMemo(() => {
    const allAssigned = new Set<string>();
    schedules.forEach((s) => s.assignedEmployeeIds?.forEach((id) => allAssigned.add(id)));
    return allAssigned.size;
  }, [schedules]);

  const avgWeeklyHours = useMemo(() => {
    if (!schedules.length) return 40;
    const total = schedules.reduce((acc, s) => acc + (s.weeklyHours || 40), 0);
    return Math.round((total / schedules.length) * 10) / 10;
  }, [schedules]);

  // Render Employee Self-Service View
  if (isEmployee) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My Work Schedule"
          description="View your committed weekly hours, shift timing, working days, and designated rest breaks."
        />

        {/* Top Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Weekly Hours"
            value={`${mySchedule?.weeklyHours ?? 40} hrs`}
            hint="Total committed hours / week"
            icon={<Clock className="size-5" />}
            tone="accent"
          />
          <StatCard
            label="Shift Type"
            value={mySchedule ? SHIFT_TYPE_CONFIG[mySchedule.shiftType]?.label : "General Shift"}
            hint="Designated roster template"
            icon={<Briefcase className="size-5" />}
            tone="default"
          />
          <StatCard
            label="Daily Shift"
            value={`${mySchedule?.dailyHours ?? 8} hrs`}
            hint={`${mySchedule?.startTime || "09:00"} to ${mySchedule?.endTime || "18:00"}`}
            icon={<Sun className="size-5" />}
            tone="success"
          />
          <StatCard
            label="Lunch Break"
            value={`${mySchedule?.breakDurationMinutes ?? 60} mins`}
            hint={
              mySchedule?.breakStartTime && mySchedule?.breakEndTime
                ? `${mySchedule.breakStartTime} – ${mySchedule.breakEndTime}`
                : "Designated midday break"
            }
            icon={<Coffee className="size-5" />}
            tone="warning"
          />
        </div>

        {/* 7-Day Visual Calendar View */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarDays className="size-5 text-accent" />
                  Weekly Shift Schedule
                </CardTitle>
                <CardDescription>
                  Active working days and shift windows for schedule:{" "}
                  <strong className="text-foreground">{mySchedule?.name || "General Shift"}</strong>
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {mySchedule?.id || "SCH-001"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
              {DAYS_OF_WEEK.map((day) => {
                const isWorkDay = mySchedule?.workingDays?.includes(day.name);
                return (
                  <div
                    key={day.name}
                    className={`rounded-xl border p-4 transition-all ${
                      isWorkDay
                        ? "border-accent/40 bg-accent/5 dark:bg-accent/10 shadow-xs ring-1 ring-accent/20"
                        : "border-border/60 bg-muted/30 text-muted-foreground opacity-70"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-foreground">{day.short}</span>
                      <span className="text-[11px] font-mono text-muted-foreground">{day.name}</span>
                    </div>

                    <div className="mt-4 space-y-2">
                      {isWorkDay ? (
                        <>
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 text-[10px] font-medium">
                            Working Day
                          </Badge>
                          <div className="text-sm font-semibold text-foreground">
                            {mySchedule?.startTime} – {mySchedule?.endTime}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {mySchedule?.dailyHours} hrs net work
                          </div>
                          <div className="text-[11px] text-muted-foreground/80 flex items-center gap-1 pt-1 border-t border-border/40">
                            <Coffee className="size-3" />
                            {mySchedule?.breakDurationMinutes}m break
                          </div>
                        </>
                      ) : (
                        <>
                          <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                            Weekly Off
                          </Badge>
                          <p className="text-xs text-muted-foreground italic pt-2">No shift scheduled</p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Policy & Helpdesk Info */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="size-4 text-accent" />
                Shift & Attendance Guidelines
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3 text-muted-foreground">
              <div className="flex items-start gap-2">
                <div className="size-1.5 rounded-full bg-accent mt-2 shrink-0" />
                <span>
                  <strong>Grace Period:</strong> You have a 15-minute grace window past shift start (
                  {mySchedule?.startTime || "09:00"}) before a late arrival is flagged.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="size-1.5 rounded-full bg-accent mt-2 shrink-0" />
                <span>
                  <strong>Half-Day Threshold:</strong> Minimum 4 hours of recorded check-in is required to count as a half-day.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="size-1.5 rounded-full bg-accent mt-2 shrink-0" />
                <span>
                  <strong>Full-Day Commitment:</strong> Complete at least {mySchedule?.dailyHours ?? 8} hours to fulfill daily work hours.
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarRange className="size-4 text-primary" />
                Need a Shift Change or Roster Swap?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <p className="text-muted-foreground">
                Work schedules are managed centrally by HR & People Operations according to organizational shift rosters and employment contracts.
              </p>
              <p className="text-muted-foreground">
                If you need to change your working hours, transfer shifts, or request flexible timing, please raise a ticket with HR Helpdesk or coordinate with your reporting manager.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Render HR / Admin Management View
  return (
    <div className="space-y-6">
      <PageHeader
        title="Work Schedules & Shifts"
        description="Configure shift rosters, working days, break allowances, and automatic weekly hours. Assign schedules to employees and synchronize contract hours."
        actions={
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="size-4" />
            Create Schedule
          </Button>
        }
      />

      {/* HR Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Schedules"
          value={schedules.length}
          hint="Configured shift rosters"
          icon={<CalendarRange className="size-5" />}
          tone="default"
        />
        <StatCard
          label="Assigned Employees"
          value={`${assignedEmployeesCount} / ${totalEmployees}`}
          hint={`${Math.round((assignedEmployeesCount / Math.max(1, totalEmployees)) * 100)}% roster coverage`}
          icon={<UserCheck className="size-5" />}
          tone="accent"
        />
        <StatCard
          label="Avg Weekly Commitment"
          value={`${avgWeeklyHours} hrs`}
          hint="Calculated organization-wide"
          icon={<Clock className="size-5" />}
          tone="success"
        />
        <StatCard
          label="Flexible/Night Shifts"
          value={schedules.filter((s) => s.shiftType === "Flexible" || s.shiftType === "Night").length}
          hint="Specialized work hours"
          icon={<Zap className="size-5" />}
          tone="warning"
        />
      </div>

      {/* Tabs: Schedules vs Employee Assignment Matrix */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="schedules" className="gap-2">
            <CalendarRange className="size-4" />
            Shift Rosters ({schedules.length})
          </TabsTrigger>
          <TabsTrigger value="matrix" className="gap-2">
            <Users className="size-4" />
            Employee Matrix ({employees.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Schedules Roster */}
        <TabsContent value="schedules" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {schedules.map((sch) => {
              const shiftConfig = SHIFT_TYPE_CONFIG[sch.shiftType] || SHIFT_TYPE_CONFIG.General;
              const ShiftIcon = shiftConfig.icon;
              const assignedCount = sch.assignedEmployeeIds?.length || 0;

              return (
                <Card key={sch.id} className="flex flex-col justify-between overflow-hidden hover:border-accent/50 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-base">{sch.name}</span>
                          {sch.isDefault && (
                            <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                              Default
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">{sch.id}</span>
                      </div>
                      <Badge className={`text-xs capitalize font-medium flex items-center gap-1 border ${shiftConfig.badgeColor}`}>
                        <ShiftIcon className="size-3" />
                        {shiftConfig.label}
                      </Badge>
                    </div>
                    {sch.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{sch.description}</p>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-4 text-sm pb-4">
                    {/* Shift timings & Net Hours */}
                    <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-3 text-xs">
                      <div>
                        <span className="text-muted-foreground block">Shift Hours</span>
                        <span className="font-semibold text-foreground text-sm">
                          {sch.startTime} – {sch.endTime}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Weekly Hours</span>
                        <span className="font-semibold text-foreground text-sm">
                          {sch.weeklyHours} hrs / wk
                        </span>
                      </div>
                    </div>

                    {/* Working Days Badges */}
                    <div>
                      <span className="text-xs font-medium text-muted-foreground block mb-1.5">
                        Working Days ({sch.workingDays?.length || 0} days)
                      </span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {DAYS_OF_WEEK.map((day) => {
                          const active = sch.workingDays?.includes(day.name);
                          return (
                            <span
                              key={day.name}
                              className={`text-[11px] font-mono px-2 py-0.5 rounded-md ${
                                active
                                  ? "bg-accent/20 text-accent-foreground font-semibold border border-accent/40"
                                  : "bg-muted/30 text-muted-foreground/50"
                              }`}
                            >
                              {day.short}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Break & Assigned info */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                      <div className="flex items-center gap-1">
                        <Coffee className="size-3.5 text-muted-foreground" />
                        <span>
                          {sch.breakDurationMinutes}m Break ({sch.breakStartTime || "13:00"}–{sch.breakEndTime || "14:00"})
                        </span>
                      </div>
                      <div className="flex items-center gap-1 font-medium text-foreground">
                        <Users className="size-3.5 text-accent" />
                        <span>{assignedCount} Assigned</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs gap-1.5"
                        onClick={() => openAssignModal(sch)}
                      >
                        <UserPlus className="size-3.5" />
                        Assign ({assignedCount})
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-8 p-0"
                        onClick={() => openEditDialog(sch)}
                      >
                        <Edit3 className="size-3.5" />
                      </Button>
                      {!sch.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmId(sch.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Tab 2: Employee Assignment Matrix */}
        <TabsContent value="matrix" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Employee Shift Assignments</CardTitle>
                  <CardDescription>
                    Assign shift schedules to employees and keep contract weekly committed hours in sync.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-56">
                    <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search employee..."
                      value={searchEmployee}
                      onChange={(e) => setSearchEmployee(e.target.value)}
                      className="pl-8 h-9 text-xs"
                    />
                  </div>
                  <Select value={deptFilter} onValueChange={setDeptFilter}>
                    <SelectTrigger className="w-40 h-9 text-xs">
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
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department & Designation</TableHead>
                      <TableHead>Assigned Schedule</TableHead>
                      <TableHead>Shift Timing</TableHead>
                      <TableHead>Committed Hours</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                          No employees found matching criteria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEmployees.map((emp) => {
                        // Find current schedule
                        const currentSch =
                          schedules.find((s) => {
                            const ids = s.assignedEmployeeIds || [];
                            return ids.includes(emp.id) || (emp.code && ids.includes(emp.code));
                          }) || schedules.find((s) => s.isDefault);

                        const shiftConfig = currentSch
                          ? SHIFT_TYPE_CONFIG[currentSch.shiftType] || SHIFT_TYPE_CONFIG.General
                          : SHIFT_TYPE_CONFIG.General;

                        return (
                          <TableRow key={emp.id}>
                            <TableCell>
                              <div>
                                <span className="font-medium text-foreground block">{emp.name}</span>
                                <span className="text-xs font-mono text-muted-foreground">{emp.code}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <span className="text-sm block">{emp.department || "General"}</span>
                                <span className="text-xs text-muted-foreground">{emp.designation || "Staff"}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {currentSch ? (
                                <div className="space-y-1">
                                  <span className="font-semibold text-xs block">{currentSch.name}</span>
                                  <Badge className={`text-[10px] capitalize border ${shiftConfig.badgeColor}`}>
                                    {shiftConfig.label}
                                  </Badge>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Unassigned</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-xs space-y-0.5">
                                <span className="font-medium">
                                  {currentSch?.startTime} – {currentSch?.endTime}
                                </span>
                                <span className="text-muted-foreground block">
                                  {currentSch?.workingDays?.length || 5} days/week
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold text-sm tabular-nums">
                                {currentSch?.weeklyHours ?? 40} hrs/wk
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Select
                                value={currentSch?.id || ""}
                                onValueChange={async (newSchId) => {
                                  if (!newSchId || newSchId === currentSch?.id) return;
                                  const targetSch = schedules.find((s) => s.id === newSchId);
                                  if (!targetSch) return;
                                  // Update assignment
                                  const updatedAssigned = Array.from(
                                    new Set([...(targetSch.assignedEmployeeIds || []), emp.id])
                                  );
                                  await assignSchedule(newSchId, updatedAssigned);
                                  toast.success(`Assigned ${emp.name} to ${targetSch.name}`);
                                }}
                              >
                                <SelectTrigger className="w-36 h-8 text-xs ml-auto">
                                  <SelectValue placeholder="Change Shift" />
                                </SelectTrigger>
                                <SelectContent>
                                  {schedules.map((s) => (
                                    <SelectItem key={s.id} value={s.id} className="text-xs">
                                      {s.name} ({s.weeklyHours}h)
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* CREATE / EDIT SCHEDULE DIALOG */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarRange className="size-5 text-accent" />
              {editingSchedule ? "Edit Work Schedule" : "Create Work Schedule"}
            </DialogTitle>
            <DialogDescription>
              Define the shift schedule, working days, daily time boundaries, and lunch break. Weekly hours are computed automatically.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSchedule} className="space-y-5 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sch-name">Schedule Name *</Label>
                <Input
                  id="sch-name"
                  placeholder="e.g. Standard Corporate Shift"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sch-type">Shift Type</Label>
                <Select value={formShiftType} onValueChange={(v) => setFormShiftType(v as ShiftType)}>
                  <SelectTrigger id="sch-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="General">General Shift (Day)</SelectItem>
                    <SelectItem value="Morning">Morning Shift</SelectItem>
                    <SelectItem value="Evening">Evening Shift</SelectItem>
                    <SelectItem value="Night">Night Shift (Overnight)</SelectItem>
                    <SelectItem value="Flexible">Flexible Hours</SelectItem>
                    <SelectItem value="Rotational">Rotational Shift</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sch-desc">Description & Policies</Label>
              <Textarea
                id="sch-desc"
                placeholder="Optional notes regarding shift grace periods, coverage, or department applicability..."
                rows={2}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>

            {/* WORKING DAYS PICKER */}
            <div className="space-y-2 rounded-lg border border-border p-3.5 bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-sm">Working Days ({formWorkingDays.length} Days Selected)</Label>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[11px] px-2"
                    onClick={() =>
                      setFormWorkingDays(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
                    }
                  >
                    Mon–Fri (5D)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[11px] px-2"
                    onClick={() =>
                      setFormWorkingDays(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"])
                    }
                  >
                    Mon–Sat (6D)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[11px] px-2"
                    onClick={() => setFormWorkingDays(["Saturday", "Sunday"])}
                  >
                    Weekend (2D)
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1.5 pt-1">
                {DAYS_OF_WEEK.map((day) => {
                  const isSelected = formWorkingDays.includes(day.name);
                  return (
                    <button
                      type="button"
                      key={day.name}
                      onClick={() => toggleWorkingDay(day.name)}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs transition-all ${
                        isSelected
                          ? "border-accent bg-accent text-accent-foreground font-semibold shadow-xs"
                          : "border-border bg-card text-muted-foreground hover:bg-muted/60"
                      }`}
                    >
                      <span>{day.short}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TIMINGS & BREAK */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sch-start">Shift Start Time *</Label>
                <Input
                  id="sch-start"
                  type="time"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sch-end">Shift End Time *</Label>
                <Input
                  id="sch-end"
                  type="time"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="sch-break">Break Duration (Minutes)</Label>
                <Input
                  id="sch-break"
                  type="number"
                  min={0}
                  max={180}
                  step={5}
                  value={formBreakMinutes}
                  onChange={(e) => setFormBreakMinutes(Number(e.target.value))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sch-break-start">Break Window Start</Label>
                <Input
                  id="sch-break-start"
                  type="time"
                  value={formBreakStart}
                  onChange={(e) => setFormBreakStart(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sch-break-end">Break Window End</Label>
                <Input
                  id="sch-break-end"
                  type="time"
                  value={formBreakEnd}
                  onChange={(e) => setFormBreakEnd(e.target.value)}
                />
              </div>
            </div>

            {/* AUTOMATIC WEEKLY HOURS CALCULATION DISPLAY */}
            <div className="rounded-xl border border-accent/40 bg-accent/5 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="size-3.5" />
                  Automatic Reactive Calculation
                </span>
                {liveCalculation.isOvernight && (
                  <Badge variant="outline" className="border-indigo-400 text-indigo-500 text-[10px]">
                    Overnight Shift (Crosses Midnight)
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="rounded-lg bg-card/80 p-2 border border-border/40">
                  <span className="text-[11px] text-muted-foreground block">Active Days</span>
                  <span className="text-lg font-bold text-foreground tabular-nums">
                    {formWorkingDays.length} days
                  </span>
                </div>
                <div className="rounded-lg bg-card/80 p-2 border border-border/40">
                  <span className="text-[11px] text-muted-foreground block">Daily Net Work</span>
                  <span className="text-lg font-bold text-foreground tabular-nums">
                    {liveCalculation.dailyNetHours} hrs
                  </span>
                </div>
                <div className="rounded-lg bg-accent/15 p-2 border border-accent/30">
                  <span className="text-[11px] text-accent font-medium block">Weekly Commitment</span>
                  <span className="text-lg font-bold text-accent-foreground tabular-nums">
                    {liveCalculation.weeklyHours} hrs/wk
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground text-center">
                Formula: ({formStartTime} to {formEndTime} - {formBreakMinutes}m break) × {formWorkingDays.length} working days
              </p>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <Switch
                id="sch-default"
                checked={formIsDefault}
                onCheckedChange={setFormIsDefault}
              />
              <Label htmlFor="sch-default" className="text-xs text-muted-foreground cursor-pointer">
                Set as Default Organization Schedule (Assigned to new employees unless specified)
              </Label>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingSchedule ? "Save Changes" : "Create Schedule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ASSIGN SCHEDULE DIALOG */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-5 text-accent" />
              Assign Employees to {selectedScheduleForAssign?.name}
            </DialogTitle>
            <DialogDescription>
              Employees assigned will have their working schedule updated and contract hours synchronized to{" "}
              <strong>{selectedScheduleForAssign?.weeklyHours} hrs/week</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  className="pl-8 h-9 text-xs"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-9"
                onClick={() => {
                  if (selectedEmpIds.length === employees.length) {
                    setSelectedEmpIds([]);
                  } else {
                    setSelectedEmpIds(employees.map((e) => e.id));
                  }
                }}
              >
                {selectedEmpIds.length === employees.length ? "Deselect All" : "Select All"}
              </Button>
            </div>

            <div className="border border-border rounded-lg overflow-y-auto max-h-64 divide-y divide-border">
              {employees
                .filter((e) => {
                  const q = assignSearch.toLowerCase();
                  return !q || e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q) || (e.department && e.department.toLowerCase().includes(q));
                })
                .map((emp) => {
                  const isChecked = selectedEmpIds.includes(emp.id);
                  return (
                    <div
                      key={emp.id}
                      onClick={() => {
                        setSelectedEmpIds((prev) =>
                          isChecked ? prev.filter((id) => id !== emp.id) : [...prev, emp.id]
                        );
                      }}
                      className={`flex items-center justify-between p-2.5 cursor-pointer hover:bg-muted/40 transition-colors ${
                        isChecked ? "bg-accent/10" : ""
                      }`}
                    >
                      <div>
                        <span className="text-sm font-medium text-foreground block">{emp.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {emp.code} • {emp.department || "General"}
                        </span>
                      </div>
                      <div
                        className={`size-5 rounded border flex items-center justify-center transition-colors ${
                          isChecked
                            ? "bg-accent border-accent text-accent-foreground"
                            : "border-border bg-card"
                        }`}
                      >
                        {isChecked && <Check className="size-3.5" />}
                      </div>
                    </div>
                  );
                })}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedEmpIds.length} employee(s) selected.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAssignment}>
              Save Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(o) => !o && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="size-5" />
              Delete Work Schedule
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this schedule? Any assigned employees will automatically revert to the default corporate shift roster.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDeleteSchedule(deleteConfirmId)}
            >
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
