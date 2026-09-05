/**
 * PeoplePay360 — Typed API Client
 * All requests go through here. Uses VITE_API_URL env variable.
 */

const BASE = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:5000";

type ApiResponse<T> = { success: true; data: T } | { success: false; error: string };

async function request<T>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  customHeaders?: Record<string, string>,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...customHeaders },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) throw new Error(json.error);
  return json.data;
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export const api = {
  auth: {
    login: (email: string, password?: string) =>
      request<{ userId: string; email: string; role: string; employeeId: string | null; employeeCode: string | null; employeeName: string }>(
        "POST",
        "/api/auth/login",
        { email, password },
      ),
    provisionUser: (
      data: { employeeId?: string | undefined; email?: string | undefined; role?: string | undefined; customPassword?: string | undefined },
      callerRole: string,
    ) =>
      request<{
        userId: string;
        email: string;
        name: string;
        role: string;
        employeeId: string;
        credentials: { email: string; temporaryPassword: string; loginUrl: string };
        emailDispatched: boolean;
        previewUrl?: string;
      }>("POST", "/api/auth/provision-user", data, { "x-user-role": callerRole }),
    getDispatchedEmails: (callerRole: string) =>
      request<
        Array<{
          id: string;
          to: string;
          subject: string;
          employeeName: string;
          role: string;
          temporaryPassword: string;
          sentAt: string;
          previewUrl?: string;
        }>
      >("GET", "/api/auth/dispatched-emails", undefined, { "x-user-role": callerRole }),
  },

  // ── Employees ─────────────────────────────────────────────────────────────
  employees: {
    list: () => request<unknown[]>("GET", "/api/employees"),
    get: (id: string) => request<unknown>("GET", `/api/employees/${id}`),
    create: (data: {
      name: string;
      email: string;
      phone?: string | undefined;
      department?: string | undefined;
      designation?: string | undefined;
      manager?: string | undefined;
      employmentType?: string | undefined;
      joinedOn?: string | undefined;
      ctc?: number | undefined;
      location?: string | undefined;
      autoProvision?: boolean | undefined;
      role?: string | undefined;
      customPassword?: string | undefined;
    }) =>
      request<{
        id: string;
        code: string;
        name: string;
        email: string;
        phone: string;
        department: string;
        designation: string;
        manager: string;
        employmentType: string;
        status: string;
        joinedOn: string;
        ctc: number;
        provision?: {
          userId: string;
          credentials: { email: string; temporaryPassword: string; loginUrl: string };
          emailDispatched: boolean;
          previewUrl?: string;
        } | null;
      }>("POST", "/api/employees", data),
    patch: (id: string, data: Record<string, unknown>) =>
      request<{ id: string; status: string }>("PATCH", `/api/employees/${id}`, data),
    delete: (id: string) =>
      request<{ message: string }>("DELETE", `/api/employees/${id}`),
  },

  // ── Contracts ──────────────────────────────────────────────────────────────
  contracts: {
    list: () => request<unknown[]>("GET", "/api/contracts"),
    create: (data: Record<string, unknown>) =>
      request<{ id: string; contractNumber: string }>("POST", "/api/contracts", data),
    patch: (id: string, data: Record<string, unknown>) =>
      request<{ id: string }>("PATCH", `/api/contracts/${id}`, data),
  },

  // ── Attendance ─────────────────────────────────────────────────────────────
  attendance: {
    list: (employeeId?: string) =>
      request<unknown[]>("GET", employeeId ? `/api/attendance?employeeId=${employeeId}` : "/api/attendance"),
    create: (data: Record<string, unknown>) =>
      request<{ id: string; action: string }>("POST", "/api/attendance", data),
    patch: (id: string, data: Record<string, unknown>) =>
      request<{ id: string }>("PATCH", `/api/attendance/${id}`, data),
  },

  // ── Leave ──────────────────────────────────────────────────────────────────
  leave: {
    list: () => request<unknown[]>("GET", "/api/leave"),
    create: (data: Record<string, unknown>) =>
      request<{ id: string }>("POST", "/api/leave", data),
    patch: (id: string, data: Record<string, unknown>) =>
      request<{ id: string }>("PATCH", `/api/leave/${id}`, data),
  },

  // ── Payroll ────────────────────────────────────────────────────────────────
  payroll: {
    list: () => request<unknown[]>("GET", "/api/payroll"),
    get: (id: string) => request<unknown>("GET", `/api/payroll/${id}`),
    getDashboardAnalytics: () => request<any>("GET", "/api/payroll/dashboard-analytics"),
    create: (data: Record<string, unknown>) =>
      request<{ id: string; generatedCount?: number; warnings?: any[] }>("POST", "/api/payroll", data),
    generate: (data?: { employeeId?: string | undefined; periodMonth?: number | undefined; periodYear?: number | undefined }) =>
      request<{ runId: string; period: string; generatedCount: number }>("POST", "/api/payroll/generate", data ?? {}),
    compute: (id: string) => request<{ runId: string; status: string; recomputedCount: number }>("POST", `/api/payroll/${id}/compute`),
    validate: (id: string) => request<{ id: string; status: string; warnings: any[] }>("POST", `/api/payroll/${id}/validate`),
    markPaid: (id: string) => request<{ id: string; status: string }>("POST", `/api/payroll/${id}/mark-paid`),
    patch: (id: string, data: Record<string, unknown>) =>
      request<{ id: string }>("PATCH", `/api/payroll/${id}`, data),
    sendSingleEmail: (data: {
      employeeId: string;
      period: string;
      gross: number;
      net: number;
      basic: number;
      allowances: number;
      deductions: number;
    }) =>
      request<{ message: string; previewUrl?: string }>("POST", "/api/payroll/send-single-email", data),
    sendEmails: (id: string) =>
      request<{ runId: string; sentCount: number; failedCount?: number; message: string }>("POST", `/api/payroll/${id}/send-emails`),
    retryFailedEmails: (id: string) =>
      request<{ retriedCount: number; successfullyResentCount: number }>("POST", `/api/payroll/${id}/retry-failed-emails`),
    getValidationWarnings: () =>
      request<{ warnings: Array<{ employeeId: string; employeeName: string; type: string; message: string }>; count: number }>(
        "GET",
        "/api/payroll/validation/warnings",
      ),
    delete: (id: string) =>
      request<{ message: string }>("DELETE", `/api/payroll/${id}`),
  },

  // ── Salary ────────────────────────────────────────────────────────────────
  salary: {
    structures: () => request<unknown[]>("GET", "/api/salary/structures"),
    records: () => request<unknown[]>("GET", "/api/salary/records"),
    rules: () => request<unknown[]>("GET", "/api/salary/rules"),
    createStructure: (data: Record<string, unknown>) =>
      request<{ id: string }>("POST", "/api/salary/structures", data),
    patchStructure: (id: string, data: Record<string, unknown>) =>
      request<{ id: string }>("PATCH", `/api/salary/structures/${id}`, data),
    deleteStructure: (id: string) =>
      request<void>("DELETE", `/api/salary/structures/${id}`),
    createRule: (data: Record<string, unknown>) =>
      request<{ id: string; code: string }>("POST", "/api/salary/rules", data),
    patchRule: (id: string, data: Record<string, unknown>) =>
      request<{ id: string }>("PATCH", `/api/salary/rules/${id}`, data),
    deleteRule: (id: string) =>
      request<void>("DELETE", `/api/salary/rules/${id}`),
  },

  // ── Reimbursements ────────────────────────────────────────────────────────
  reimbursements: {
    list: () => request<unknown[]>("GET", "/api/reimbursements"),
    create: (data: Record<string, unknown>) =>
      request<{ id: string }>("POST", "/api/reimbursements", data),
    patch: (id: string, data: Record<string, unknown>) =>
      request<{ id: string }>("PATCH", `/api/reimbursements/${id}`, data),
  },

  // ── Allowances ────────────────────────────────────────────────────────────
  allowances: {
    list: () => request<unknown[]>("GET", "/api/allowances"),
    create: (data: Record<string, unknown>) =>
      request<{ id: string }>("POST", "/api/allowances", data),
    patch: (id: string, data: Record<string, unknown>) =>
      request<{ id: string }>("PATCH", `/api/allowances/${id}`, data),
  },

  // ── Assets ────────────────────────────────────────────────────────────────
  assets: {
    list: () => request<unknown[]>("GET", "/api/assets"),
    requests: (employeeId?: string) =>
      request<unknown[]>("GET", employeeId ? `/api/assets/requests?employeeId=${employeeId}` : "/api/assets/requests"),
    createRequest: (data: Record<string, unknown>) =>
      request<{ id: string }>("POST", "/api/assets/requests", data),
    patchRequest: (id: string, data: Record<string, unknown>) =>
      request<{ id: string }>("PATCH", `/api/assets/requests/${id}`, data),
  },

  // ── Helpdesk ──────────────────────────────────────────────────────────────
  helpdesk: {
    list: () => request<unknown[]>("GET", "/api/helpdesk"),
    create: (data: Record<string, unknown>) =>
      request<{ id: string; ticketNumber: string }>("POST", "/api/helpdesk", data),
    patch: (id: string, data: Record<string, unknown>) =>
      request<{ id: string }>("PATCH", `/api/helpdesk/${id}`, data),
    addComment: (id: string, data: { userId: string; comment: string }) =>
      request<{ id: string }>("POST", `/api/helpdesk/${id}/comments`, data),
  },

  // ── Schedules ─────────────────────────────────────────────────────────────
  schedules: {
    list: (employeeId?: string) =>
      request<any[]>("GET", employeeId ? `/api/schedules?employeeId=${employeeId}` : "/api/schedules"),
    mySchedule: (employeeId: string) =>
      request<any>("GET", `/api/schedules/my-schedule?employeeId=${employeeId}`),
    create: (data: Record<string, unknown>) =>
      request<{ id: string; name: string; dailyHours: number; weeklyHours: number }>("POST", "/api/schedules", data),
    patch: (id: string, data: Record<string, unknown>) =>
      request<{ id: string; dailyHours: number; weeklyHours: number }>("PATCH", `/api/schedules/${id}`, data),
    delete: (id: string) =>
      request<{ success: boolean; message: string }>("DELETE", `/api/schedules/${id}`),
    assign: (id: string, data: { employeeIds: string[]; contractIds?: string[] }) =>
      request<{ assignedCount: number }>("POST", `/api/schedules/${id}/assign`, data),
  },

  // ── Health check ──────────────────────────────────────────────────────────
  health: () => request<{ message: string; version: string }>("GET", "/"),
};
