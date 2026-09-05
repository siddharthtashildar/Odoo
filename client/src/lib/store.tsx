import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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
} from "./mock-data";

interface State {
  signedIn: boolean;
  role: Role;
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
}

const initial: State = {
  signedIn: false,
  role: "hr_manager",
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
};

interface Store extends State {
  hydrated: boolean;
  persona: { employeeId: string; name: string };
  signIn: (role: Role) => void;
  signOut: () => void;
  setRole: (role: Role) => void;
  log: (action: string, module: string) => void;
  update: <K extends keyof State>(key: K, value: State[K]) => void;
  patchEmployee: (id: string, patch: Partial<Employee>) => void;
  addEmployee: (e: Employee) => void;
  addContract: (c: Contract) => void;
  updateContract: (id: string, patch: Partial<Contract>) => void;
  punchAttendance: (employeeId: string, status?: AttendanceRecord["status"]) => void;
  correctAttendance: (id: string, patch: Partial<AttendanceRecord>) => void;
  submitReimbursement: (r: ReimbursementClaim) => void;
  updateReimbursement: (id: string, patch: Partial<ReimbursementClaim>) => void;
  addAllowance: (a: AllowanceRecord) => void;
  updateAllowance: (id: string, patch: Partial<AllowanceRecord>) => void;
  createTicket: (t: HelpdeskTicket) => void;
  updateTicket: (id: string, patch: Partial<HelpdeskTicket>) => void;
  addTicketComment: (ticketId: string, author: string, text: string) => void;
  retryProvisioning: (id: string) => void;
}

const Ctx = createContext<Store | null>(null);
const KEY = "pp360-state-v3";

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setState({
          ...initial,
          ...parsed,
          // Ensure new arrays exist even if stored state was from an older version
          contracts: parsed.contracts?.length ? parsed.contracts : seed.contracts,
          attendance: parsed.attendance?.length ? parsed.attendance : seed.attendanceRecords,
          reimbursements: parsed.reimbursements?.length ? parsed.reimbursements : seed.reimbursements,
          allowances: parsed.allowances?.length ? parsed.allowances : seed.allowances,
          helpdesk: parsed.helpdesk?.length ? parsed.helpdesk : seed.helpdeskTickets,
          provisioning: parsed.provisioning?.length ? parsed.provisioning : seed.provisioningRecords,
        });
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, hydrated]);

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

  const addContract = useCallback((c: Contract) => {
    setState((s) => ({ ...s, contracts: [c, ...s.contracts] }));
  }, []);

  const updateContract = useCallback((id: string, patch: Partial<Contract>) => {
    setState((s) => ({
      ...s,
      contracts: s.contracts.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }, []);

  const punchAttendance = useCallback(
    (employeeId: string, customStatus?: AttendanceRecord["status"]) => {
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
    },
    [],
  );

  const correctAttendance = useCallback((id: string, patch: Partial<AttendanceRecord>) => {
    setState((s) => ({
      ...s,
      attendance: s.attendance.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  }, []);

  const submitReimbursement = useCallback((r: ReimbursementClaim) => {
    setState((s) => ({ ...s, reimbursements: [r, ...s.reimbursements] }));
  }, []);

  const updateReimbursement = useCallback((id: string, patch: Partial<ReimbursementClaim>) => {
    setState((s) => ({
      ...s,
      reimbursements: s.reimbursements.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  }, []);

  const addAllowance = useCallback((a: AllowanceRecord) => {
    setState((s) => ({ ...s, allowances: [a, ...s.allowances] }));
  }, []);

  const updateAllowance = useCallback((id: string, patch: Partial<AllowanceRecord>) => {
    setState((s) => ({
      ...s,
      allowances: s.allowances.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  }, []);

  const createTicket = useCallback((t: HelpdeskTicket) => {
    setState((s) => ({ ...s, helpdesk: [t, ...s.helpdesk] }));
  }, []);

  const updateTicket = useCallback((id: string, patch: Partial<HelpdeskTicket>) => {
    setState((s) => ({
      ...s,
      helpdesk: s.helpdesk.map((t) =>
        t.id === id ? { ...t, ...patch, updatedDate: new Date().toISOString().slice(0, 10) } : t,
      ),
    }));
  }, []);

  const addTicketComment = useCallback((ticketId: string, author: string, text: string) => {
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

  const value = useMemo<Store>(
    () => ({
      ...state,
      hydrated,
      persona: seed.ROLE_PERSONA[state.role] ?? { employeeId: "E1001", name: "Charmi Patel" },
      signIn: (role) => setState((s) => ({ ...s, signedIn: true, role })),
      signOut: () => setState((s) => ({ ...s, signedIn: false })),
      setRole: (role) => setState((s) => ({ ...s, role })),
      log,
      update: (key, val) => setState((s) => ({ ...s, [key]: val })),
      patchEmployee: (id, patch) =>
        setState((s) => ({
          ...s,
          employees: s.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),
      addEmployee: (e) => setState((s) => ({ ...s, employees: [e, ...s.employees] })),
      addContract,
      updateContract,
      punchAttendance,
      correctAttendance,
      submitReimbursement,
      updateReimbursement,
      addAllowance,
      updateAllowance,
      createTicket,
      updateTicket,
      addTicketComment,
      retryProvisioning,
    }),
    [
      state,
      hydrated,
      log,
      addContract,
      updateContract,
      punchAttendance,
      correctAttendance,
      submitReimbursement,
      updateReimbursement,
      addAllowance,
      updateAllowance,
      createTicket,
      updateTicket,
      addTicketComment,
      retryProvisioning,
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
  "/app/dashboard": ["employee", "hr_manager", "hr_user", "payroll_user", "payroll_manager", "it_asset_manager", "admin"],
  "/app/me": ["employee", "hr_manager", "hr_user", "payroll_user", "payroll_manager", "it_asset_manager", "admin"],
  "/app/employees": ["hr_manager", "hr_user", "payroll_user", "payroll_manager", "it_asset_manager", "admin"],
  "/app/onboarding": ["hr_manager", "hr_user", "admin"],
  "/app/offboarding": ["hr_manager", "hr_user", "admin"],
  "/app/contracts": ["hr_manager", "hr_user", "payroll_manager", "admin"],
  "/app/attendance": ["employee", "hr_manager", "hr_user", "payroll_user", "payroll_manager", "it_asset_manager", "admin"],
  "/app/leave": ["employee", "hr_manager", "hr_user", "admin"],
  "/app/payroll": ["hr_manager", "hr_user", "payroll_user", "payroll_manager", "admin"],
  "/app/payslips": ["employee", "hr_manager", "hr_user", "payroll_user", "payroll_manager", "it_asset_manager", "admin"],
  "/app/reimbursement": ["employee", "hr_manager", "hr_user", "payroll_manager", "admin"],
  "/app/allowance": ["employee", "hr_manager", "hr_user", "payroll_manager", "admin"],
  "/app/assets": ["employee", "it_asset_manager", "admin", "hr_manager", "hr_user"],
  "/app/asset-requests": ["employee", "it_asset_manager", "admin", "hr_manager", "hr_user"],
  "/app/helpdesk": ["employee", "it_asset_manager", "hr_manager", "hr_user", "payroll_user", "payroll_manager", "admin"],
  "/app/reports": ["hr_manager", "hr_user", "payroll_manager", "admin"],
  "/app/admin": ["admin"],
  "/app/settings": ["employee", "hr_manager", "hr_user", "payroll_user", "payroll_manager", "it_asset_manager", "admin"],
};
