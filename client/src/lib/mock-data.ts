export type Role =
  | "employee"
  | "hr_manager"
  | "payroll_user"
  | "payroll_manager"
  | "it_asset_manager"
  | "admin";

export const ROLE_LABELS: Record<Role, string> = {
  employee: "Employee",
  hr_manager: "HR Manager",
  payroll_user: "Payroll User",
  payroll_manager: "Payroll Manager",
  it_asset_manager: "IT Asset Manager",
  admin: "Administrator",
};

export type EmployeeStatus = "onboarding" | "active" | "on_leave" | "offboarding" | "exited";

export interface Employee {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  location: string;
  manager: string;
  employmentType: "Full-time" | "Contract" | "Intern";
  status: EmployeeStatus;
  joinedOn: string;
  exitOn?: string | undefined;
  ctc: number;
  bankAccount: string;
  pan: string;
  leaveBalance: number;
}

export type OnboardingStatus =
  | "Not Started"
  | "Invitation Sent"
  | "Account Created"
  | "In Progress"
  | "Completed"
  | "Overdue";

export interface OnboardingTask {
  id: string;
  label: string;
  owner: "HR" | "IT" | "Payroll" | "Manager" | "Employee";
  done: boolean;
  category?: string | undefined;
}

export interface OnboardingCase {
  id: string;
  employeeId: string;
  employeeCode?: string;
  employeeName?: string;
  startDate: string;
  dueDate: string;
  buddy: string;
  assignedHr: string;
  status: OnboardingStatus;
  invitationSentDate?: string | undefined;
  accountCreatedDate?: string | undefined;
  completedDate?: string | undefined;
  tasks: OnboardingTask[];
}

export interface OffboardingClearanceItem {
  id: string;
  department: "IT" | "Finance" | "HR" | "Admin";
  item: string;
  cleared: boolean;
  clearedBy?: string;
  clearedAt?: string;
  remarks?: string;
}

export interface OffboardingCase {
  id: string;
  employeeId: string;
  employeeCode?: string;
  employeeName?: string;
  lastWorkingDay: string;
  resignationDate?: string;
  reason: string;
  manager?: string;
  exitInterviewDone?: boolean;
  exitInterviewNotes?: string;
  exitInterviewStatus: "Scheduled" | "Completed" | "Pending";
  assetsReturned: boolean;
  accessRevoked: boolean;
  fnfStatus?: "Pending" | "Computed" | "Approved" | "Disbursed";
  finalPayrollStatus: "Pending" | "Processing" | "Processed";
  clearanceStatus: "Pending" | "Partial" | "Cleared";
  finalSettlement: "pending" | "processing" | "settled";
  notes?: string;
  handoverTo?: string;
  clearance: OffboardingClearanceItem[];
}

export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
export type LeaveType = "Casual" | "Sick" | "Earned" | "Maternity" | "Paternity" | "Unpaid";

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  from: string;
  to: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  submittedAt?: string;
}

export type ContractType = "Full-time" | "Fixed-term" | "Executive" | "Consultancy" | "Internship";
export type ContractStatus = "Active" | "Draft" | "Expiring Soon" | "Expired" | "Terminated";

export interface Contract {
  id: string;
  employeeId: string;
  contractType: ContractType;
  startDate: string;
  endDate: string;
  salary: number; // annual CTC
  department: string;
  status: ContractStatus;
  terms: string;
  noticePeriodDays: number;
}

export type AttendanceStatus = "Present" | "Absent" | "Late" | "Half Day" | "On Leave" | "Holiday";

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  workingHours: number;
  status: AttendanceStatus;
  location: "Office - Ahmedabad" | "Office - Bengaluru" | "Office - Mumbai" | "Remote" | "Client Site";
  remarks?: string;
}

export type ReimbursementCategory =
  | "Travel"
  | "Food"
  | "Medical"
  | "Internet"
  | "Office Supplies"
  | "Training"
  | "Other";

export type ReimbursementApprovalStatus = "pending" | "approved" | "rejected" | "changes_requested";
export type ReimbursementPaymentStatus = "unpaid" | "paid";

export interface ReimbursementClaim {
  id: string;
  employeeId: string;
  category: ReimbursementCategory;
  amount: number;
  submittedDate: string;
  receiptStatus: "Uploaded" | "Verified" | "Missing";
  approvalStatus: ReimbursementApprovalStatus;
  paymentStatus: ReimbursementPaymentStatus;
  description: string;
  /** Raw filename or JSON-encoded array of {name,url,type} attachments */
  receiptFileName?: string | undefined;
  /** Same attachment data as receiptFileName — returned by the backend GET/POST */
  receiptUrl?: string | null | undefined;
  paymentMethod: "Bank Transfer" | "Payroll Cycle" | "UPI";
}

export type AllowanceType =
  | "House Rent Allowance"
  | "Travel Allowance"
  | "Internet Allowance"
  | "Meal Allowance"
  | "Performance Allowance"
  | "Special Allowance";

export type AllowanceStatus = "approved" | "pending" | "rejected";

export interface AllowanceRecord {
  id: string;
  employeeId: string;
  type: AllowanceType;
  amount: number; // monthly
  effectiveDate: string;
  expiryDate: string;
  status: AllowanceStatus;
  notes?: string | undefined;
}

export type AssetCategory =
  | "Laptop"
  | "Desktop"
  | "Monitor"
  | "Keyboard"
  | "Mouse"
  | "Mobile phone"
  | "ID card"
  | "Access card"
  | "Software license"
  | "Phone"
  | "Accessory"
  | "License"
  | "Other";

export type AssetStatus =
  | "in_stock"
  | "assigned"
  | "repair"
  | "retired"
  | "Available"
  | "Assigned"
  | "Under Maintenance"
  | "Lost"
  | "Returned"
  | "Retired";

export interface AssetHistoryItem {
  date: string;
  action: string;
  actor: string;
  notes?: string;
}

export interface Asset {
  id: string;
  tag: string;
  name: string;
  category: AssetCategory;
  serial: string;
  purchasedOn: string;
  value: number;
  condition: "New" | "Good" | "Fair" | "Needs Service";
  status: AssetStatus;
  location: string;
  assignedTo?: string | undefined;
  currentEmployeeId?: string | null | undefined;
  currentEmployeeCode?: string | null | undefined;
  currentEmployeeName?: string | null | undefined;
  history?: AssetHistoryItem[];
}

export type RequestStatus = "open" | "in_progress" | "resolved";
export interface AssetRequest {
  id: string;
  employeeId: string;
  employeeCode?: string | undefined;
  employeeName?: string | undefined;
  item: string;
  justification: string;
  raisedOn: string;
  status: RequestStatus;
  priority: "Low" | "Medium" | "High";
  category?: AssetCategory | undefined;
  assetId?: string | undefined;
  requiredFrom?: string | undefined;
  requiredUntil?: string | undefined;
}

export type TicketCategory =
  | "Hardware"
  | "Software"
  | "Network"
  | "Account Access"
  | "Email"
  | "Payroll System"
  | "Other";

export type TicketPriority = "Low" | "Medium" | "High" | "Critical";
export type TicketStatus = "Open" | "In Progress" | "Waiting for User" | "Resolved" | "Closed";

export interface TicketComment {
  id: string;
  author: string;
  text: string;
  at: string;
  isInternal?: boolean;
}

export interface HelpdeskTicket {
  id: string;
  subject: string;
  requesterId: string;
  category: TicketCategory;
  priority: TicketPriority;
  assignedTechnician: string;
  createdDate: string;
  updatedDate: string;
  status: TicketStatus;
  description: string;
  comments: TicketComment[];
}

export type ProvisioningStatus = "Pending" | "In Progress" | "Completed" | "Failed";

export interface ProvisioningStep {
  step: number;
  key: string;
  label: string;
  status: "completed" | "in_progress" | "pending" | "failed";
  timestamp?: string;
  details?: string;
}

export interface ProvisioningRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  companyEmail: string;
  overallStatus: ProvisioningStatus;
  invitationStatus: "Sent" | "Accepted" | "Pending";
  accountActivated: boolean;
  defaultPermissions: string[];
  steps: ProvisioningStep[];
  startedAt: string;
  completedAt?: string;
}

export type PayrollStatus = "draft" | "pending_approval" | "approved" | "paid" | "processing" | "failed";

export interface PayrollLine {
  employeeId: string;
  gross: number;
  basicSalary: number;
  hra: number;
  specialAllowance: number;
  deductions: number;
  providentFund: number;
  professionalTax: number;
  incomeTax: number;
  bonus: number;
  net: number;
}

export interface PayrollRun {
  id: string;
  period: string;
  cycle: string;
  status: PayrollStatus;
  createdBy: string;
  approvedBy?: string | undefined;
  paymentDate?: string;
  lines: PayrollLine[];
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  module: string;
}

export interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
}

// ─── Salary Structure ─────────────────────────────────────────────────────────

export type SalaryStructureStatus = "active" | "inactive" | "draft";

export interface SalaryComponent {
  name: string;
  type: "earning" | "deduction" | "employer";
  /** Percentage of basic salary, or a fixed monthly amount */
  basis: "percent_of_basic" | "fixed";
  value: number; // percent (0–100) or INR/month
}

export interface SalaryStructure {
  id: string;
  name: string;
  description: string;
  applicableTo: "All" | "Senior" | "Executive" | "Intern" | "Contract";
  status: SalaryStructureStatus;
  effectiveFrom: string;
  components: SalaryComponent[];
  createdBy: string;
  updatedAt: string;
}

export interface SalaryRecord {
  id: string;
  employeeId: string;
  structureId: string;
  effectiveFrom: string;
  annualCTC: number;
  monthlyCTC: number;
  basic: number;
  hra: number;
  specialAllowance: number;
  providentFund: number;
  professionalTax: number;
  incomeTax: number;
  netMonthly: number;
  status: "active" | "revised" | "pending";
  revisedBy?: string | undefined;
  remarks?: string | undefined;
}

export const calculatePayrollLine = (
  employeeId: string,
  grossAnnualCtc: number,
  bonus = 0,
): PayrollLine => {
  const monthlyGross = Math.round(grossAnnualCtc / 12);
  const basicSalary = Math.round(monthlyGross * 0.5); // 50% Basic
  const hra = Math.round(monthlyGross * 0.25); // 25% HRA
  const specialAllowance = Math.max(0, monthlyGross - basicSalary - hra); // 25% Special Allowance

  // Statutory deductions
  const providentFund = Math.min(1800, Math.round(basicSalary * 0.12)); // 12% of basic, capped at 1800 for standard Indian PF
  const professionalTax = 200; // Standard PT ₹200/mo
  const taxableMonthly = monthlyGross + bonus - providentFund - professionalTax;
  const incomeTax = taxableMonthly > 40000 ? Math.round(taxableMonthly * 0.15) : 0; // Mock TDS

  const totalDeductions = providentFund + professionalTax + incomeTax;
  const net = monthlyGross + bonus - totalDeductions;

  return {
    employeeId,
    gross: monthlyGross,
    basicSalary,
    hra,
    specialAllowance,
    providentFund,
    professionalTax,
    incomeTax,
    deductions: totalDeductions,
    bonus,
    net,
  };
};

export const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export type ShiftType = "General" | "Morning" | "Evening" | "Night" | "Flexible" | "Rotational";

export interface WorkSchedule {
  id: string;
  name: string;
  description: string;
  shiftType: ShiftType;
  workingDays: string[];
  startTime: string;
  endTime: string;
  breakDurationMinutes: number;
  breakStartTime?: string | undefined;
  breakEndTime?: string | undefined;
  dailyHours: number;
  weeklyHours: number;
  color: string;
  isDefault: boolean;
  status: "active" | "inactive";
  assignedEmployeeIds: string[];
  assignedEmployees?: { id: string; code: string; name: string }[] | undefined;
  createdAt: string;
  updatedAt: string;
}
