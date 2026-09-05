import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
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
  employees: [],
  onboarding: [],
  offboarding: [],
  contracts: [],
  attendance: [],
  leave: [],
  payroll: [],
  reimbursements: [],
  allowances: [],
  helpdesk: [],
  provisioning: [],
  assets: [],
  assetRequests: [],
  users: [],
  audit: [],
  salaryRecords: [],
  salaryStructures: [],
  schedules: [],
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
  addAsset: (a: Asset) => Promise<void>;
  updateAsset: (id: string, patch: Partial<Asset>) => Promise<void>;
  addAssetRequest: (req: AssetRequest) => Promise<void>;
  updateAssetRequest: (id: string, patch: Partial<AssetRequest> & { fulfilledAssetId?: string }) => Promise<void>;
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

  // Fetch all data from the database API on mount
  useEffect(() => {
    const API = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:5001";

    async function fetchAll() {
      try {
        const [
          empRes,
          conRes,
          attRes,
          leaveRes,
          payrollRes,
          structRes,
          recordsRes,
          reimRes,
          allowRes,
          assetRes,
          assetReqRes,
          helpdeskRes,
          schedRes,
          onbRes,
          offRes,
          prvRes,
          usrRes,
          audRes,
        ] = await Promise.allSettled([
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
          fetch(`${API}/api/assets/requests`).then((r) => r.json()),
          fetch(`${API}/api/helpdesk`).then((r) => r.json()),
          fetch(`${API}/api/schedules`).then((r) => r.json()),
          fetch(`${API}/api/onboarding`).then((r) => r.json()),
          fetch(`${API}/api/offboarding`).then((r) => r.json()),
          fetch(`${API}/api/provisioning`).then((r) => r.json()),
          fetch(`${API}/api/users`).then((r) => r.json()),
          fetch(`${API}/api/audit`).then((r) => r.json()),
        ]);

        const ok = <T,>(res: PromiseSettledResult<{ success: boolean; data: T }>, fallback: T): T =>
          res.status === "fulfilled" && res.value?.success && Array.isArray(res.value.data) ? res.value.data : fallback;

        setState((s) => ({
          ...s,
          employees: ok(empRes, []) as State["employees"],
          contracts: ok(conRes, []) as State["contracts"],
          attendance: ok(attRes, []) as State["attendance"],
          leave: ok(leaveRes, []) as State["leave"],
          payroll: ok(payrollRes, []) as State["payroll"],
          salaryStructures: ok(structRes, []) as State["salaryStructures"],
          salaryRecords: ok(recordsRes, []) as State["salaryRecords"],
          reimbursements: ok(reimRes, []) as State["reimbursements"],
          allowances: ok(allowRes, []) as State["allowances"],
          assets: ok(assetRes, []) as State["assets"],
          assetRequests: ok(assetReqRes, []) as State["assetRequests"],
          helpdesk: ok(helpdeskRes, []) as State["helpdesk"],
          schedules: ok(schedRes, []) as State["schedules"],
          onboarding: ok(onbRes, []) as State["onboarding"],
          offboarding: ok(offRes, []) as State["offboarding"],
          provisioning: ok(prvRes, []) as State["provisioning"],
          users: ok(usrRes, []) as State["users"],
          audit: ok(audRes, []) as State["audit"],
        }));
      } catch (err) {
        console.warn("[store] API unreachable", err);
      } finally {
        setHydrated(true);
      }
    }

    void fetchAll();
  }, []);

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
          actor: s.currentUser?.name ?? "User",
          action,
          module,
        },
        ...s.audit,
      ],
    }));
  }, []);

  const addContract = useCallback((c: Contract) => {
    setState((s) => ({ ...s, contracts: [c, ...s.contracts] }));
    api.contracts
      .create({
        employeeId: c.employeeId,
        contractType: c.contractType,
        salary: c.salary,
        startDate: c.startDate,
        endDate: c.endDate || undefined,
      })
      .catch((err) => console.warn("[store] addContract sync error:", err));
  }, []);

  const updateContract = useCallback((id: string, patch: Partial<Contract>) => {
    setState((s) => ({
      ...s,
      contracts: s.contracts.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
    api.contracts
      .patch(id, patch as Record<string, unknown>)
      .catch((err) => console.warn("[store] updateContract sync error:", err));
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

  const correctAttendance = useCallback((id: string, patch: Partial<AttendanceRecord>) => {
    setState((s) => ({
      ...s,
      attendance: s.attendance.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
    api.attendance
      .patch(id, patch as Record<string, unknown>)
      .catch((err) => console.warn("[store] correctAttendance sync error:", err));
  }, []);

  const applyLeave = useCallback(async (req: LeaveRequest) => {
    setState((s) => ({ ...s, leave: [req, ...s.leave] }));
    try {
      const res = (await api.leave.create({
        employeeId: req.employeeId,
        leaveType: req.type,
        startDate: req.from,
        endDate: req.to,
        days: req.days,
        reason: req.reason,
      })) as LeaveRequest;
      if (res?.id) {
        setState((s) => ({
          ...s,
          leave: s.leave.map((l) => (l.id === req.id ? { ...l, ...res } : l)),
        }));
      }
    } catch (err) {
      console.warn("[store] applyLeave sync error:", err);
    }
  }, []);

  const updateLeave = useCallback(async (id: string, patch: Partial<LeaveRequest>) => {
    setState((s) => ({
      ...s,
      leave: s.leave.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
    try {
      await api.leave.patch(id, { status: patch.status });
    } catch (err) {
      console.warn("[store] updateLeave sync error:", err);
    }
  }, []);

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
      const res = (await api.reimbursements.create({
        employeeId: r.employeeId,
        categoryName: r.category,
        expenseDate: r.submittedDate,
        amount: r.amount,
        description: r.description,
      })) as ReimbursementClaim;
      if (res?.id) {
        setState((s) => ({
          ...s,
          reimbursements: s.reimbursements.map((item) => (item.id === r.id ? { ...item, ...res } : item)),
        }));
      }
    } catch (err) {
      console.warn("[store] submitReimbursement sync error:", err);
    }
  }, []);

  const updateReimbursement = useCallback((id: string, patch: Partial<ReimbursementClaim>) => {
    setState((s) => ({
      ...s,
      reimbursements: s.reimbursements.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
    api.reimbursements
      .patch(id, {
        approvalStatus: patch.approvalStatus,
        status: patch.approvalStatus,
      })
      .catch((err) => console.warn("[store] updateReimbursement sync error:", err));
  }, []);

  const addAllowance = useCallback(async (a: AllowanceRecord) => {
    setState((s) => ({ ...s, allowances: [a, ...s.allowances] }));
    try {
      const res = (await api.allowances.create({
        employeeId: a.employeeId,
        allowanceType: a.type,
        amount: a.amount,
        effectiveFrom: a.effectiveDate,
        status: a.status === "approved" ? "active" : a.status || "pending",
      })) as AllowanceRecord;
      if (res?.id) {
        setState((s) => ({
          ...s,
          allowances: s.allowances.map((item) => (item.id === a.id ? { ...item, ...res } : item)),
        }));
      }
    } catch (err) {
      console.warn("[store] addAllowance sync error:", err);
    }
  }, []);

  const updateAllowance = useCallback((id: string, patch: Partial<AllowanceRecord>) => {
    setState((s) => ({
      ...s,
      allowances: s.allowances.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
    api.allowances
      .patch(id, {
        status: patch.status,
        amount: patch.amount,
      })
      .catch((err) => console.warn("[store] updateAllowance sync error:", err));
  }, []);

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
      const res = await api.helpdesk.list();
      if (Array.isArray(res)) {
        setState((prev) => ({ ...prev, helpdesk: res as HelpdeskTicket[] }));
      }
    } catch (err) {
      console.warn("[store] createTicket sync error:", err);
    }
  }, []);

  const updateTicket = useCallback(async (id: string, patch: Partial<HelpdeskTicket>) => {
    setState((s) => ({
      ...s,
      helpdesk: s.helpdesk.map((t) =>
        t.id === id ? { ...t, ...patch, updatedDate: new Date().toISOString().slice(0, 10) } : t,
      ),
    }));
    try {
      await api.helpdesk.patch(id, patch as Record<string, unknown>);
      const res = await api.helpdesk.list();
      if (Array.isArray(res)) {
        setState((prev) => ({ ...prev, helpdesk: res as HelpdeskTicket[] }));
      }
    } catch (err) {
      console.warn("[store] updateTicket sync error:", err);
    }
  }, []);

  const addTicketComment = useCallback(async (ticketId: string, author: string, text: string) => {
    const comment = {
      id: `c-${Date.now()}`,
      author,
      text,
      at: new Date().toISOString().slice(0, 16).replace("T", " "),
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
      const res = await api.helpdesk.list();
      if (Array.isArray(res)) {
        setState((prev) => ({ ...prev, helpdesk: res as HelpdeskTicket[] }));
      }
    } catch (err) {
      console.warn("[store] addTicketComment sync error:", err);
    }
  }, []);

  const addAsset = useCallback(async (a: Asset) => {
    setState((s) => ({ ...s, assets: [a, ...s.assets] }));
    try {
      await api.assets.create({
        name: a.name,
        tag: a.tag,
        category: a.category,
        serial: a.serial,
        value: a.value,
        location: a.location,
        condition: a.condition,
        status: a.status,
        assignedTo: a.assignedTo,
      });
      const res = await api.assets.list();
      if (Array.isArray(res)) {
        setState((prev) => ({ ...prev, assets: res as Asset[] }));
      }
    } catch (err) {
      console.warn("[store] addAsset sync error:", err);
    }
  }, []);

  const updateAsset = useCallback(async (id: string, patch: Partial<Asset>) => {
    setState((s) => ({
      ...s,
      assets: s.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
    try {
      await api.assets.patch(id, patch as Record<string, unknown>);
      const res = await api.assets.list();
      if (Array.isArray(res)) {
        setState((prev) => ({ ...prev, assets: res as Asset[] }));
      }
    } catch (err) {
      console.warn("[store] updateAsset sync error:", err);
    }
  }, []);

  const addAssetRequest = useCallback(async (req: AssetRequest) => {
    setState((s) => ({ ...s, assetRequests: [req, ...s.assetRequests] }));
    try {
      await api.assets.createRequest({
        employeeId: req.employeeId,
        item: req.item,
        category: req.category,
        reason: req.justification,
        requiredFrom: req.requiredFrom,
        requiredUntil: req.requiredUntil,
      });
      const res = await api.assets.requests();
      if (Array.isArray(res)) {
        setState((prev) => ({ ...prev, assetRequests: res as AssetRequest[] }));
      }
    } catch (err) {
      console.warn("[store] addAssetRequest sync error:", err);
    }
  }, []);

  const updateAssetRequest = useCallback(async (id: string, patch: Partial<AssetRequest> & { fulfilledAssetId?: string }) => {
    setState((s) => ({
      ...s,
      assetRequests: s.assetRequests.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
    try {
      await api.assets.patchRequest(id, patch as Record<string, unknown>);
      const [reqRes, astRes] = await Promise.all([api.assets.requests(), api.assets.list()]);
      if (Array.isArray(reqRes)) {
        setState((prev) => ({
          ...prev,
          assetRequests: reqRes as AssetRequest[],
          ...(Array.isArray(astRes) ? { assets: astRes as Asset[] } : {}),
        }));
      }
    } catch (err) {
      console.warn("[store] updateAssetRequest sync error:", err);
    }
  }, []);

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
    const roleMatch = state.employees.find((e) => {
      if (state.role === "hr_manager") return e.department?.toLowerCase().includes("people") || e.designation?.toLowerCase().includes("hr");
      if (state.role === "payroll_manager") return e.designation?.toLowerCase().includes("payroll") || e.email.includes("arjun");
      if (state.role === "payroll_user") return e.email.includes("devika") || e.department?.toLowerCase().includes("finance");
      if (state.role === "it_asset_manager") return e.department?.toLowerCase().includes("it") || e.designation?.toLowerCase().includes("asset");
      if (state.role === "admin") return e.email.includes("admin") || e.email.includes("siddharth");
      return true;
    }) || state.employees[0];

    return {
      employeeId: roleMatch?.id || "EMP-001",
      employeeCode: roleMatch?.code || "PP-1001",
      name: roleMatch?.name || (state.role === "admin" ? "Ops Admin" : "Employee"),
      email: roleMatch?.email || "",
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
      addAsset,
      updateAsset,
      addAssetRequest,
      updateAssetRequest,
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
      addAsset,
      updateAsset,
      addAssetRequest,
      updateAssetRequest,
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
  return useCallback(
    (id: string | undefined | null) => {
      if (!id) return "Unassigned";
      const str = String(id).trim();
      if (!str) return "Unassigned";

      // 1. Dual ID / code match in active store employees
      const mappedCode = str.startsWith("E") ? str.replace(/^E/, "PP-") : str;
      const mappedEId = str.startsWith("PP-") ? str.replace(/^PP-/, "E") : str;

      const found = employees.find(
        (e) =>
          e.id === str ||
          e.code === str ||
          e.code === mappedCode ||
          e.id === mappedEId ||
          (e.id && str && e.id.toLowerCase() === str.toLowerCase()) ||
          (e.email && e.email.toLowerCase() === str.toLowerCase()) ||
          (e.name && e.name.toLowerCase() === str.toLowerCase()),
      );
      if (found?.name) return found.name;

      // 3. If str is already a human name (contains space, not a UUID)
      if (str.includes(" ") && !str.includes("-")) {
        return str;
      }

      return str;
    },
    [employees],
  );
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
  "/app/payroll": ["payroll_user", "payroll_manager", "admin"],
  "/app/salary": ["payroll_user", "payroll_manager", "admin"],
  "/app/salary-structure": ["payroll_user", "payroll_manager", "admin"],
  "/app/payslips": ["payroll_user", "payroll_manager", "admin"],
  "/app/reimbursement": ["employee", "hr_manager", "payroll_user", "payroll_manager", "admin"],
  "/app/allowance": ["employee", "hr_manager", "payroll_user", "payroll_manager", "admin"],
  "/app/assets": ["employee", "it_asset_manager", "admin", "hr_manager", "payroll_user", "payroll_manager"],
  "/app/asset-requests": ["employee", "it_asset_manager", "admin", "hr_manager", "payroll_user", "payroll_manager"],
  "/app/helpdesk": ["employee", "it_asset_manager", "hr_manager", "payroll_user", "payroll_manager", "admin"],
  "/app/reports": ["hr_manager", "payroll_user", "payroll_manager", "admin"],
  "/app/admin": ["admin"],
  "/app/settings": ["employee", "hr_manager", "payroll_user", "payroll_manager", "it_asset_manager", "admin"],
};
