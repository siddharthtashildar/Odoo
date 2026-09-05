import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import * as seed from "./mock-data";
import type {
  AllowanceRecord,
  Asset,
  AssetRequest,
  AttendanceRecord,
  AuditEntry,
  Contract,
  Employee,
  HelpdeskTicket,
  LeaveRequest,
  OffboardingCase,
  OnboardingCase,
  OrgUser,
  PayrollRun,
  ProvisioningRecord,
  ReimbursementClaim,
  Role,
  SalaryRecord,
  SalaryStructure,
  WorkSchedule,
} from "./mock-data";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  employeeId?: string | null;
  employeeCode?: string | null;
}

interface State {
  signedIn: boolean;
  role: Role;
  currentUser: CurrentUser | null;
  employees: Employee[];
  onboarding: OnboardingCase[];
  offboarding: OffboardingCase[];
  contracts: Contract[];
  attendance: AttendanceRecord[];
  leave: LeaveRequest[];
  payroll: PayrollRun[];
  reimbursements: ReimbursementClaim[];
  allowances: AllowanceRecord[];
  helpdesk: HelpdeskTicket[];
  provisioning: ProvisioningRecord[];
  assets: Asset[];
  assetRequests: AssetRequest[];
  users: OrgUser[];
  audit: AuditEntry[];
  salaryRecords: SalaryRecord[];
  salaryStructures: SalaryStructure[];
  schedules: WorkSchedule[];
}

const initial: State = {
  signedIn: false,
  role: "hr_manager",
  currentUser: null,
  employees: seed.employees,
  onboarding: seed.onboardingCases,
  offboarding: seed.offboardingCases,
  contracts: seed.contracts,
  attendance: seed.attendanceRecords,
  leave: seed.leaveRequests,
  payroll: seed.payrollRuns,
  reimbursements: seed.reimbursements,
  allowances: seed.allowances,
  helpdesk: seed.helpdeskTickets,
  provisioning: seed.provisioningRecords,
  assets: seed.assets,
  assetRequests: seed.assetRequests,
  users: seed.orgUsers,
  audit: seed.auditLog,
  salaryRecords: seed.salaryRecords,
  salaryStructures: seed.salaryStructures,
  schedules: seed.defaultSchedules,
};

interface Store extends State {
  hydrated: boolean;
  persona: { employeeId: string; employeeCode: string; name: string; email: string };
  signIn: (role: Role, user?: Partial<CurrentUser>) => void;
  signOut: () => void;
  setRole: (role: Role) => void;
  log: (action: string, module: string) => void;
  update: <K extends keyof State>(key: K, value: State[K]) => void;
  patchEmployee: (id: string, patch: Partial<Employee>) => void;
  addEmployee: (e: Employee) => void;
  addContract: (c: Contract) => void;
  updateContract: (id: string, patch: Partial<Contract>) => void;
  punchAttendance: (employeeId: string, status?: AttendanceRecord["status"]) => Promise<void>;
  correctAttendance: (id: string, patch: Partial<AttendanceRecord>) => void;
  applyLeave: (req: LeaveRequest) => Promise<void>;
  updateLeave: (id: string, patch: Partial<LeaveRequest>) => Promise<void>;
  generatePayslips: (employeeId?: string) => Promise<void>;
  submitReimbursement: (r: ReimbursementClaim) => Promise<void>;
  updateReimbursement: (id: string, patch: Partial<ReimbursementClaim>) => void;
  addAllowance: (a: AllowanceRecord) => Promise<void>;
  updateAllowance: (id: string, patch: Partial<AllowanceRecord>) => void;
  createTicket: (t: HelpdeskTicket) => void;
  updateTicket: (id: string, patch: Partial<HelpdeskTicket>) => void;
  addTicketComment: (ticketId: string, author: string, text: string) => void;
  retryProvisioning: (id: string) => void;
  addSchedule: (s: WorkSchedule) => Promise<void>;
  updateSchedule: (id: string, patch: Partial<WorkSchedule>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  assignSchedule: (scheduleId: string, employeeIds: string[]) => Promise<void>;
}

const Ctx = createContext<Store | null>(null);
const KEY = "pp360-state-v3";

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const [hydrated, setHydrated] = useState(false);

  // Fetch all data from the API on mount, fall back to seed data if server is down
  useEffect(() => {
    const API = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:5000";

    async function fetchAll() {
      try {
        const [empRes, conRes, attRes, leaveRes, payrollRes, structRes, recordsRes, reimRes, allowRes, assetRes, helpdeskRes, schedRes] =
          await Promise.allSettled([
            fetch(`${API}/api/employees`).then((r) => r.json()),
            fetch(`${API}/api/contracts`).then((r) => r.json()),
            fetch(`${API}/api/attendance`).then((r) => r.json()),
            fetch(`${API}/api/leave`).then((r) => r.json()),
            fetch(`${API}/api/payroll`).then((r) => r.json()),
            fetch(`${API}/api/salary/structures`).then((r) => r.json()),
            fetch(`${API}/api/salary/records`).then((r) => r.json()),
            fetch(`${API}/api/reimbursements`).then((r) => r.json()),
            fetch(`${API}/api/allowances`).then((r) => r.json()),
            fetch(`${API}/api/assets`).then((r) => r.json()),
            fetch(`${API}/api/helpdesk`).then((r) => r.json()),
            fetch(`${API}/api/schedules`).then((r) => r.json()),
          ]);

          // Preserve existing state on failed fetches instead of falling back to seed data
          setState((s) => ({
            ...s,
            employees: empRes.status === "fulfilled" && empRes.value?.success ? empRes.value.data : s.employees,
            contracts: conRes.status === "fulfilled" && conRes.value?.success ? conRes.value.data : s.contracts,
            attendance: attRes.status === "fulfilled" && attRes.value?.success ? attRes.value.data : s.attendance,
            leave: leaveRes.status === "fulfilled" && leaveRes.value?.success ? leaveRes.value.data : s.leave,
            payroll: payrollRes.status === "fulfilled" && payrollRes.value?.success ? payrollRes.value.data : s.payroll,
            salaryStructures: structRes.status === "fulfilled" && structRes.value?.success ? structRes.value.data : s.salaryStructures,
            salaryRecords: recordsRes.status === "fulfilled" && recordsRes.value?.success ? recordsRes.value.data : s.salaryRecords,
            reimbursements: reimRes.status === "fulfilled" && reimRes.value?.success ? reimRes.value.data : s.reimbursements,
            allowances: allowRes.status === "fulfilled" && allowRes.value?.success ? allowRes.value.data : s.allowances,
            assets: assetRes.status === "fulfilled" && assetRes.value?.success ? assetRes.value.data : s.assets,
            helpdesk: helpdeskRes.status === "fulfilled" && helpdeskRes.value?.success ? helpdeskRes.value.data : s.helpdesk,
            schedules: schedRes.status === "fulfilled" && schedRes.value?.success ? schedRes.value.data : s.schedules,
          }));
      } catch (err) {
        console.warn("[store] API unreachable — using seed data", err);
      } finally {
        setHydrated(true);
      }
    }

    void fetchAll();
  }, []);

  // Poll all key data slices to keep the UI in sync across all roles
  useEffect(() => {
    if (!hydrated) return;
    const API = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:5000";
    const isManager = state.role === "hr_manager" || state.role === "admin";
    const intervalMs = isManager ? 5000 : 10000;

    const endpoints: Array<{ path: string; key: keyof State }> = [
      { path: "/api/leave", key: "leave" },
      { path: "/api/attendance", key: "attendance" },
      { path: "/api/contracts", key: "contracts" },
      { path: "/api/reimbursements", key: "reimbursements" },
      { path: "/api/allowances", key: "allowances" },
      { path: "/api/helpdesk", key: "helpdesk" },
      { path: "/api/assets", key: "assets" },
    ];

    const poll = async () => {
      const results = await Promise.allSettled(
        endpoints.map((ep) => fetch(`${API}${ep.path}`).then((r) => r.json())),
      );
      setState((s) => {
        const next = { ...s };
        results.forEach((r, i) => {
          const ep = endpoints[i];
          if (ep && r.status === "fulfilled" && r.value?.success) {
            (next as any)[ep.key] = r.value.data;
          }
        });
        return next;
      });
    };
    const interval = setInterval(poll, intervalMs);
    return () => clearInterval(interval);
  }, [hydrated, state.role]);

  // Persist role + signed-in status + currentUser to localStorage
  useEffect(() => {
    if (!hydrated) return;
    try {
      const slim = { role: state.role, signedIn: state.signedIn, currentUser: state.currentUser };
      localStorage.setItem(KEY, JSON.stringify(slim));
    } catch {
      /* ignore */
    }
  }, [state.role, state.signedIn, state.currentUser, hydrated]);

  // Restore role and currentUser from localStorage on boot
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { role?: State["role"]; signedIn?: boolean; currentUser?: CurrentUser | null };
        if (parsed.role) {
          setState((s) => ({
            ...s,
            role: parsed.role!,
            signedIn: parsed.signedIn ?? false,
            currentUser: parsed.currentUser ?? null,
          }));
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const log = useCallback((action: string, module: string) => {
    setState((s) => ({
      ...s,
      audit: [
        {
          id: `L${Math.random().toString(36).slice(2, 8)}`,
          at: new Date().toISOString().slice(0, 16).replace("T", " "),
          actor: seed.ROLE_PERSONA[s.role]?.name ?? "User",
          action,
          module,
        },
        ...s.audit,
      ],
    }));
  }, []);

  const addContract = useCallback(async (c: Contract) => {
    setState((s) => ({ ...s, contracts: [c, ...s.contracts] }));
    try {
      await api.contracts.create({
        employeeId: c.employeeId,
        contractType: c.contractType,
        salary: c.salary,
        startDate: c.startDate,
        endDate: c.endDate || undefined,
      });
      await refreshSlice("contracts");
    } catch (err) {
      console.warn("[store] addContract sync error:", err);
    }
  }, []);

  const updateContract = useCallback(async (id: string, patch: Partial<Contract>) => {
    setState((s) => ({
      ...s,
      contracts: s.contracts.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
    try {
      await api.contracts.patch(id, patch as Record<string, unknown>);
      await refreshSlice("contracts");
    } catch (err) {
      console.warn("[store] updateContract sync error:", err);
    }
  }, []);

  const punchAttendance = useCallback(
    async (employeeId: string, customStatus?: AttendanceRecord["status"]) => {
      const today = new Date().toISOString().slice(0, 10);
      const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      setState((s) => {
        const existing = s.attendance.find((a) => a.employeeId === employeeId && a.date === today);
        if (existing) {
          // Punch out
          return {
            ...s,
            attendance: s.attendance.map((a) =>
              a.id === existing.id ? { ...a, checkOut: now, workingHours: 8.5 } : a,
            ),
          };
        } else {
          // Punch in
          const newPunch: AttendanceRecord = {
            id: `ATT-${Date.now().toString().slice(-4)}`,
            employeeId,
            date: today,
            checkIn: now,
            checkOut: "—",
            workingHours: 0,
            status: customStatus ?? "Present",
            location: "Office - Ahmedabad",
            remarks: "Web punch in",
          };
          return { ...s, attendance: [newPunch, ...s.attendance] };
        }
      });

      try {
        const res = (await api.attendance.create({ employeeId, status: customStatus ?? "Present", date: today })) as {
          id: string;
          employeeId: string;
          employeeName: string;
          date: string;
          checkIn: string;
          checkOut: string;
          workingHours: number;
          status: AttendanceRecord["status"];
          location: "Office - Ahmedabad";
          action: string;
        };
        if (res?.id) {
          setState((s) => {
            const hasExisting = s.attendance.some((a) => a.id === res.id || (a.employeeId === employeeId && a.date === today));
            const syncedRecord: AttendanceRecord = {
              id: res.id,
              employeeId: res.employeeId,
              date: res.date,
              checkIn: res.checkIn,
              checkOut: res.checkOut,
              workingHours: res.workingHours,
              status: res.status,
              location: res.location,
            };
            if (hasExisting) {
              return {
                ...s,
                attendance: s.attendance.map((a) => (a.id === res.id || (a.employeeId === employeeId && a.date === today) ? syncedRecord : a)),
              };
            }
            return { ...s, attendance: [syncedRecord, ...s.attendance] };
          });
        }
      } catch (err) {
        console.warn("[store] punchAttendance sync error:", err);
      }
    },
    [],
  );

  const correctAttendance = useCallback(async (id: string, patch: Partial<AttendanceRecord>) => {
    setState((s) => ({
      ...s,
      attendance: s.attendance.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
    try {
      await api.attendance.patch(id, patch as Record<string, unknown>);
      await refreshSlice("attendance");
    } catch (err) {
      console.warn("[store] correctAttendance sync error:", err);
    }
  }, []);

  const refreshSlice = useCallback(async (key: keyof State) => {
    const API = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:5000";
    const pathMap: Partial<Record<keyof State, string>> = {
      employees: "/api/employees",
      contracts: "/api/contracts",
      attendance: "/api/attendance",
      leave: "/api/leave",
      payroll: "/api/payroll",
      reimbursements: "/api/reimbursements",
      allowances: "/api/allowances",
      assets: "/api/assets",
      helpdesk: "/api/helpdesk",
      schedules: "/api/schedules",
    };
    const path = pathMap[key];
    if (!path) return;
    try {
      const res = await fetch(`${API}${path}`).then((r) => r.json());
      if (res?.success) {
        setState((s) => ({ ...s, [key]: res.data }));
      }
    } catch { /* keep current state */ }
  }, []);

  const applyLeave = useCallback(async (req: LeaveRequest) => {
    setState((s) => ({ ...s, leave: [req, ...s.leave] }));
    try {
      await api.leave.create({
        employeeId: req.employeeId,
        leaveType: req.type,
        startDate: req.from,
        endDate: req.to,
        days: req.days,
        reason: req.reason,
      });
      await refreshSlice("leave");
    } catch (err) {
      console.warn("[store] applyLeave sync error:", err);
    }
  }, [refreshSlice]);

  const updateLeave = useCallback(async (id: string, patch: Partial<LeaveRequest>) => {
    setState((s) => ({
      ...s,
      leave: s.leave.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
    try {
      await api.leave.patch(id, { status: patch.status });
      await refreshSlice("leave");
    } catch (err) {
      console.warn("[store] updateLeave sync error:", err);
    }
  }, [refreshSlice]);

  const generatePayslips = useCallback(async (employeeId?: string) => {
    try {
      await api.payroll.generate({ employeeId });
      const runs = await api.payroll.list();
      if (Array.isArray(runs)) {
        setState((s) => ({ ...s, payroll: runs as PayrollRun[] }));
      }
    } catch (err) {
      console.warn("[store] generatePayslips sync error:", err);
    }
  }, []);

  const submitReimbursement = useCallback(async (r: ReimbursementClaim) => {
    setState((s) => ({ ...s, reimbursements: [r, ...s.reimbursements] }));
    try {
      await api.reimbursements.create({
        employeeId: r.employeeId,
        categoryName: r.category,
        expenseDate: r.submittedDate,
        amount: r.amount,
        description: r.description,
      });
      await refreshSlice("reimbursements");
    } catch (err) {
      console.warn("[store] submitReimbursement sync error:", err);
    }
  }, [refreshSlice]);

  const updateReimbursement = useCallback(async (id: string, patch: Partial<ReimbursementClaim>) => {
    setState((s) => ({
      ...s,
      reimbursements: s.reimbursements.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
    try {
      await api.reimbursements.patch(id, {
        approvalStatus: patch.approvalStatus,
        status: patch.approvalStatus,
      });
      await refreshSlice("reimbursements");
    } catch (err) {
      console.warn("[store] updateReimbursement sync error:", err);
    }
  }, [refreshSlice]);

  const addAllowance = useCallback(async (a: AllowanceRecord) => {
    setState((s) => ({ ...s, allowances: [a, ...s.allowances] }));
    try {
      await api.allowances.create({
        employeeId: a.employeeId,
        allowanceType: a.type,
        amount: a.amount,
        effectiveFrom: a.effectiveDate,
        status: a.status === "approved" ? "active" : a.status || "pending",
      });
      await refreshSlice("allowances");
    } catch (err) {
      console.warn("[store] addAllowance sync error:", err);
    }
  }, [refreshSlice]);

  const updateAllowance = useCallback(async (id: string, patch: Partial<AllowanceRecord>) => {
    setState((s) => ({
      ...s,
      allowances: s.allowances.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
    try {
      await api.allowances.patch(id, {
        status: patch.status,
        amount: patch.amount,
      });
      await refreshSlice("allowances");
    } catch (err) {
      console.warn("[store] updateAllowance sync error:", err);
    }
  }, [refreshSlice]);

  const createTicket = useCallback(async (t: HelpdeskTicket) => {
    setState((s) => ({ ...s, helpdesk: [t, ...s.helpdesk] }));
    try {
      await api.helpdesk.create({
        employeeId: t.requesterId,
        category: t.category,
        priority: t.priority,
        subject: t.subject,
        description: t.description,
      });
      await refreshSlice("helpdesk");
    } catch (err) {
      console.warn("[store] createTicket sync error:", err);
    }
  }, [refreshSlice]);

  const updateTicket = useCallback(async (id: string, patch: Partial<HelpdeskTicket>) => {
    setState((s) => ({
      ...s,
      helpdesk: s.helpdesk.map((t) =>
        t.id === id ? { ...t, ...patch, updatedDate: new Date().toISOString().slice(0, 10) } : t,
      ),
    }));
    try {
      await api.helpdesk.patch(id, patch as Record<string, unknown>);
      await refreshSlice("helpdesk");
    } catch (err) {
      console.warn("[store] updateTicket sync error:", err);
    }
  }, [refreshSlice]);

  const addTicketComment = useCallback(async (ticketId: string, author: string, text: string) => {
    const comment = {
      id: `c-${Date.now()}`,
      author,
      text,
      at: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    };
    setState((s) => ({
      ...s,
      helpdesk: s.helpdesk.map((t) =>
        t.id === ticketId
          ? {
            ...t,
            comments: [...t.comments, comment],
            updatedDate: new Date().toISOString().slice(0, 10),
          }
          : t,
      ),
    }));
    try {
      await api.helpdesk.addComment(ticketId, { userId: author, comment: text });
      await refreshSlice("helpdesk");
    } catch (err) {
      console.warn("[store] addTicketComment sync error:", err);
    }
  }, [refreshSlice]);

  const retryProvisioning = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      provisioning: s.provisioning.map((p) =>
        p.id === id
          ? {
            ...p,
            overallStatus: "Completed",
            invitationStatus: "Sent",
            accountActivated: true,
            steps: p.steps.map((st) => ({ ...st, status: "completed" as const })),
          }
          : p,
      ),
    }));
  }, []);

  const addSchedule = useCallback(async (s: WorkSchedule) => {
    try {
      await api.schedules.create({
        name: s.name,
        description: s.description,
        shiftType: s.shiftType,
        workingDays: s.workingDays,
        startTime: s.startTime,
        endTime: s.endTime,
        breakDurationMinutes: s.breakDurationMinutes,
        breakStartTime: s.breakStartTime,
        breakEndTime: s.breakEndTime,
        color: s.color,
        isDefault: s.isDefault,
        assignedEmployeeIds: s.assignedEmployeeIds,
      });
      const res = await api.schedules.list();
      if (Array.isArray(res)) {
        setState((prev) => ({ ...prev, schedules: res as WorkSchedule[] }));
      }
    } catch (err) {
      console.warn("[store] addSchedule sync error:", err);
    }
  }, []);

  const updateSchedule = useCallback(async (id: string, patch: Partial<WorkSchedule>) => {
    try {
      await api.schedules.patch(id, patch as Record<string, unknown>);
      const res = await api.schedules.list();
      if (Array.isArray(res)) {
        setState((prev) => ({ ...prev, schedules: res as WorkSchedule[] }));
      }
    } catch (err) {
      console.warn("[store] updateSchedule sync error:", err);
    }
  }, []);

  const deleteSchedule = useCallback(async (id: string) => {
    try {
      await api.schedules.delete(id);
      const res = await api.schedules.list();
      if (Array.isArray(res)) {
        setState((prev) => ({ ...prev, schedules: res as WorkSchedule[] }));
      }
    } catch (err) {
      console.warn("[store] deleteSchedule sync error:", err);
    }
  }, []);

  const assignSchedule = useCallback(async (scheduleId: string, employeeIds: string[]) => {
    try {
      await api.schedules.assign(scheduleId, { employeeIds });
      const res = await api.schedules.list();
      if (Array.isArray(res)) {
        setState((prev) => ({ ...prev, schedules: res as WorkSchedule[] }));
      }
    } catch (err) {
      console.warn("[store] assignSchedule sync error:", err);
    }
  }, []);

  const persona = useMemo(() => {
    if (state.currentUser) {
      const match = state.employees.find(
        (e) =>
          (state.currentUser?.employeeId && e.id === state.currentUser.employeeId) ||
          (state.currentUser?.employeeCode && e.code === state.currentUser.employeeCode) ||
          (state.currentUser?.email && e.email.toLowerCase() === state.currentUser.email.toLowerCase()) ||
          (state.currentUser?.name && e.name.toLowerCase() === state.currentUser.name.toLowerCase()),
      );
      return {
        employeeId: match?.id || state.currentUser.employeeId || state.currentUser.id,
        employeeCode: match?.code || state.currentUser.employeeCode || "",
        name: match?.name || state.currentUser.name || state.currentUser.email,
        email: match?.email || state.currentUser.email,
      };
    }
    const staticP = seed.ROLE_PERSONA[state.role];
    const match = state.employees.find(
      (e) =>
        e.id === staticP?.employeeId ||
        e.code === staticP?.employeeId ||
        (Boolean(staticP?.name) && e.name.toLowerCase().includes((staticP?.name ?? "").split(" ")[0]?.toLowerCase() ?? "")) ||
        (state.role === "payroll_manager" && (e.code === "PP-1005" || e.code === "PP-1004" || e.email.includes("arjun"))) ||
        (state.role === "payroll_user" && (e.code === "PP-1004" || e.code === "PP-1005" || e.email.includes("devika"))),
    );
    return {
      employeeId: match?.id || staticP?.employeeId || "E1001",
      employeeCode: match?.code || staticP?.employeeId || "PP-1001",
      name: match?.name || staticP?.name || "User",
      email: match?.email || "",
    };
  }, [state.currentUser, state.role, state.employees]);

  const value = useMemo<Store>(
    () => ({
      ...state,
      hydrated,
      persona,
      signIn: (role, user) => {
        const newUser: CurrentUser = {
          id: user?.id || user?.email || "USR",
          email: user?.email || "",
          name: user?.name || user?.email || "User",
          role,
          employeeId: user?.employeeId ?? null,
          employeeCode: user?.employeeCode ?? null,
        };
        setState((s) => ({ ...s, signedIn: true, role, currentUser: newUser }));
      },
      signOut: () => {
        setState((s) => ({ ...s, signedIn: false, currentUser: null }));
        try {
          localStorage.removeItem(KEY);
        } catch {}
      },
      setRole: (role) => setState((s) => ({ ...s, role })),
      log,
      update: (key, val) => setState((s) => ({ ...s, [key]: val })),
      patchEmployee: (id, patch) => {
        setState((s) => ({
          ...s,
          employees: s.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        }));
        api.employees.patch(id, patch as Record<string, unknown>).catch((err) => console.warn("[store] patchEmployee sync error:", err));
      },
      addEmployee: (e) => setState((s) => ({ ...s, employees: [e, ...s.employees] })),
      addContract,
      updateContract,
      punchAttendance,
      correctAttendance,
      applyLeave,
      updateLeave,
      generatePayslips,
      submitReimbursement,
      updateReimbursement,
      addAllowance,
      updateAllowance,
      createTicket,
      updateTicket,
      addTicketComment,
      retryProvisioning,
      addSchedule,
      updateSchedule,
      deleteSchedule,
      assignSchedule,
    }),
    [
      state,
      hydrated,
      persona,
      log,
      addContract,
      updateContract,
      punchAttendance,
      correctAttendance,
      applyLeave,
      updateLeave,
      generatePayslips,
      submitReimbursement,
      updateReimbursement,
      addAllowance,
      updateAllowance,
      createTicket,
      updateTicket,
      addTicketComment,
      retryProvisioning,
      addSchedule,
      updateSchedule,
      deleteSchedule,
      assignSchedule,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export function useEmployeeName() {
  const { employees } = useApp();
  return useCallback((id: string) => employees.find((e) => e.id === id)?.name ?? "Unknown", [employees]);
}

/** Simulated async delay for loading states */
export function useDelayed(ms = 350) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return ready;
}

export const ROLE_ACCESS: Record<string, Role[]> = {
  "/app/dashboard": ["employee", "hr_manager", "payroll_user", "payroll_manager", "it_asset_manager", "admin"],
  "/app/me": ["employee", "hr_manager", "payroll_user", "payroll_manager", "it_asset_manager", "admin"],
  "/app/employees": ["hr_manager", "payroll_user", "payroll_manager", "it_asset_manager", "admin"],
  "/app/onboarding": ["hr_manager", "payroll_user", "payroll_manager", "admin"],
  "/app/offboarding": ["hr_manager", "payroll_user", "payroll_manager", "admin"],
  "/app/contracts": ["hr_manager", "payroll_user", "payroll_manager", "admin"],
  "/app/attendance": ["employee", "hr_manager", "payroll_user", "payroll_manager", "it_asset_manager", "admin"],
  "/app/schedule": ["employee", "hr_manager", "payroll_user", "payroll_manager", "it_asset_manager", "admin"],
  "/app/leave": ["employee", "hr_manager", "payroll_user", "payroll_manager", "admin"],
  "/app/payroll": ["hr_manager", "payroll_user", "payroll_manager", "admin"],
  "/app/salary": ["payroll_user", "payroll_manager", "admin"],
  "/app/salary-structure": ["payroll_user", "payroll_manager", "admin"],
  "/app/payslips": ["employee", "hr_manager", "payroll_user", "payroll_manager", "it_asset_manager", "admin"],
  "/app/reimbursement": ["employee", "hr_manager", "payroll_user", "payroll_manager", "admin"],
  "/app/allowance": ["employee", "hr_manager", "payroll_user", "payroll_manager", "admin"],
  "/app/assets": ["employee", "it_asset_manager", "admin", "hr_manager", "payroll_user", "payroll_manager"],
  "/app/asset-requests": ["employee", "it_asset_manager", "admin", "hr_manager", "payroll_user", "payroll_manager"],
  "/app/helpdesk": ["employee", "it_asset_manager", "hr_manager", "payroll_user", "payroll_manager", "admin"],
  "/app/reports": ["hr_manager", "payroll_user", "payroll_manager", "admin"],
  "/app/admin": ["admin"],
  "/app/settings": ["employee", "hr_manager", "payroll_user", "payroll_manager", "it_asset_manager", "admin"],
};
