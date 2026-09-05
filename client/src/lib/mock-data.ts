export type Role =
  | "employee"
  | "hr_manager"
  | "hr_user"
  | "payroll_user"
  | "payroll_manager"
  | "it_asset_manager"
  | "admin";

export const ROLE_LABELS: Record<Role, string> = {
  employee: "Employee",
  hr_manager: "HR Manager",
  hr_user: "HR User",
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

export interface OffboardingCase {
  id: string;
  employeeId: string;
  lastWorkingDay: string;
  reason: string;
  manager: string;
  exitInterviewStatus: "Scheduled" | "Completed" | "Pending";
  assetsReturned: boolean;
  accessRevoked: boolean;
  finalPayrollStatus: "Pending" | "Processing" | "Processed";
  clearanceStatus: "Pending" | "Partial" | "Cleared";
  finalSettlement: "pending" | "processing" | "settled";
  notes: string;
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
  receiptFileName?: string | undefined;
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
  history?: AssetHistoryItem[];
}

export type RequestStatus = "open" | "in_progress" | "resolved";
export interface AssetRequest {
  id: string;
  employeeId: string;
  item: string;
  justification: string;
  raisedOn: string;
  status: RequestStatus;
  priority: "Low" | "Medium" | "High";
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

export const salaryStructures: SalaryStructure[] = [
  {
    id: "SS-001",
    name: "Standard Full-Time",
    description: "Default structure for permanent full-time employees. Covers all statutory deductions.",
    applicableTo: "All",
    status: "active",
    effectiveFrom: "2026-04-01",
    createdBy: "Devika Rao",
    updatedAt: "2026-04-01",
    components: [
      { name: "Basic Salary", type: "earning", basis: "percent_of_basic", value: 100 },
      { name: "House Rent Allowance (HRA)", type: "earning", basis: "percent_of_basic", value: 40 },
      { name: "Special Allowance", type: "earning", basis: "percent_of_basic", value: 10 },
      { name: "Provident Fund (Employee)", type: "deduction", basis: "percent_of_basic", value: 12 },
      { name: "Professional Tax", type: "deduction", basis: "fixed", value: 200 },
      { name: "Income Tax (TDS)", type: "deduction", basis: "percent_of_basic", value: 10 },
      { name: "Provident Fund (Employer)", type: "employer", basis: "percent_of_basic", value: 12 },
    ],
  },
  {
    id: "SS-002",
    name: "Senior Leadership",
    description: "Applies to Director and VP level employees. Higher HRA and variable component.",
    applicableTo: "Executive",
    status: "active",
    effectiveFrom: "2026-04-01",
    createdBy: "Arjun Nair",
    updatedAt: "2026-06-15",
    components: [
      { name: "Basic Salary", type: "earning", basis: "percent_of_basic", value: 100 },
      { name: "House Rent Allowance (HRA)", type: "earning", basis: "percent_of_basic", value: 50 },
      { name: "Special Allowance", type: "earning", basis: "percent_of_basic", value: 20 },
      { name: "Provident Fund (Employee)", type: "deduction", basis: "percent_of_basic", value: 12 },
      { name: "Professional Tax", type: "deduction", basis: "fixed", value: 200 },
      { name: "Income Tax (TDS)", type: "deduction", basis: "percent_of_basic", value: 20 },
      { name: "Provident Fund (Employer)", type: "employer", basis: "percent_of_basic", value: 12 },
    ],
  },
  {
    id: "SS-003",
    name: "Internship / Stipend",
    description: "Simplified structure for interns receiving fixed monthly stipend. No PF/PT applicable.",
    applicableTo: "Intern",
    status: "active",
    effectiveFrom: "2026-07-01",
    createdBy: "Devika Rao",
    updatedAt: "2026-07-01",
    components: [
      { name: "Monthly Stipend", type: "earning", basis: "fixed", value: 20000 },
      { name: "Meal Allowance", type: "earning", basis: "fixed", value: 2000 },
    ],
  },
  {
    id: "SS-004",
    name: "Contractual Consultant",
    description: "For contract employees paid monthly retainer. TDS deducted at source.",
    applicableTo: "Contract",
    status: "draft",
    effectiveFrom: "2026-10-01",
    createdBy: "Arjun Nair",
    updatedAt: "2026-09-01",
    components: [
      { name: "Retainer Fee", type: "earning", basis: "fixed", value: 80000 },
      { name: "TDS (10%)", type: "deduction", basis: "percent_of_basic", value: 10 },
    ],
  },
];

export const salaryRecords: SalaryRecord[] = [
  {
    id: "SR-1001",
    employeeId: "E1001",
    structureId: "SS-001",
    effectiveFrom: "2026-04-01",
    annualCTC: 2400000,
    monthlyCTC: 200000,
    basic: 133333,
    hra: 53333,
    specialAllowance: 13333,
    providentFund: 16000,
    professionalTax: 200,
    incomeTax: 13333,
    netMonthly: 163800,
    status: "active",
  },
  {
    id: "SR-1002",
    employeeId: "E1002",
    structureId: "SS-001",
    effectiveFrom: "2026-04-01",
    annualCTC: 4100000,
    monthlyCTC: 341667,
    basic: 227778,
    hra: 91111,
    specialAllowance: 22778,
    providentFund: 27333,
    professionalTax: 200,
    incomeTax: 22778,
    netMonthly: 269156,
    status: "active",
  },
  {
    id: "SR-1003",
    employeeId: "E1003",
    structureId: "SS-002",
    effectiveFrom: "2026-04-01",
    annualCTC: 5200000,
    monthlyCTC: 433333,
    basic: 216667,
    hra: 108333,
    specialAllowance: 43333,
    providentFund: 26000,
    professionalTax: 200,
    incomeTax: 43333,
    netMonthly: 334467,
    status: "active",
  },
  {
    id: "SR-1004",
    employeeId: "E1004",
    structureId: "SS-001",
    effectiveFrom: "2026-04-01",
    annualCTC: 3200000,
    monthlyCTC: 266667,
    basic: 177778,
    hra: 71111,
    specialAllowance: 17778,
    providentFund: 21333,
    professionalTax: 200,
    incomeTax: 17778,
    netMonthly: 215156,
    status: "active",
  },
  {
    id: "SR-1005",
    employeeId: "E1005",
    structureId: "SS-002",
    effectiveFrom: "2026-04-01",
    annualCTC: 4800000,
    monthlyCTC: 400000,
    basic: 200000,
    hra: 100000,
    specialAllowance: 40000,
    providentFund: 24000,
    professionalTax: 200,
    incomeTax: 40000,
    netMonthly: 295800,
    status: "active",
  },
  {
    id: "SR-1006",
    employeeId: "E1006",
    structureId: "SS-001",
    effectiveFrom: "2026-04-01",
    annualCTC: 2800000,
    monthlyCTC: 233333,
    basic: 155556,
    hra: 62222,
    specialAllowance: 15556,
    providentFund: 18667,
    professionalTax: 200,
    incomeTax: 15556,
    netMonthly: 176910,
    status: "active",
  },
  {
    id: "SR-1007",
    employeeId: "E1007",
    structureId: "SS-001",
    effectiveFrom: "2026-04-01",
    annualCTC: 1800000,
    monthlyCTC: 150000,
    basic: 100000,
    hra: 40000,
    specialAllowance: 10000,
    providentFund: 12000,
    professionalTax: 200,
    incomeTax: 10000,
    netMonthly: 127800,
    status: "revised",
    revisedBy: "Devika Rao",
    remarks: "Annual increment applied — effective April 2026",
  },
];

const d = (s: string) => s;

export const employees: Employee[] = [
  {
    id: "E1001",
    code: "PP-1001",
    name: "Charmi Patel",
    email: "charmi.patel@peoplepay360.io",
    phone: "+91 98250 11234",
    department: "Engineering",
    designation: "Senior Software Engineer",
    location: "Ahmedabad",
    manager: "Rohan Mehta",
    employmentType: "Full-time",
    status: "active",
    joinedOn: d("2022-04-11"),
    ctc: 2400000,
    bankAccount: "HDFC0001822",
    pan: "AJKPC1029F",
    leaveBalance: 14,
  },
  {
    id: "E1002",
    code: "PP-1002",
    name: "Rohan Mehta",
    email: "rohan.mehta@peoplepay360.io",
    phone: "+91 99786 44120",
    department: "Engineering",
    designation: "Engineering Manager",
    location: "Bengaluru",
    manager: "Sana Iqbal",
    employmentType: "Full-time",
    status: "active",
    joinedOn: d("2019-08-05"),
    ctc: 4100000,
    bankAccount: "ICIC0004921",
    pan: "BFTPM8821L",
    leaveBalance: 9,
  },
  {
    id: "E1003",
    code: "PP-1003",
    name: "Sana Iqbal",
    email: "sana.iqbal@peoplepay360.io",
    phone: "+91 90045 77812",
    department: "People Ops",
    designation: "Head of HR",
    location: "Mumbai",
    manager: "Board",
    employmentType: "Full-time",
    status: "active",
    joinedOn: d("2018-01-22"),
    ctc: 5200000,
    bankAccount: "SBIN0007812",
    pan: "CKQPI4410J",
    leaveBalance: 21,
  },
  {
    id: "E1004",
    code: "PP-1004",
    name: "Devika Rao",
    email: "devika.rao@peoplepay360.io",
    phone: "+91 88670 22190",
    department: "Finance",
    designation: "Payroll Specialist",
    location: "Pune",
    manager: "Arjun Nair",
    employmentType: "Full-time",
    status: "active",
    joinedOn: d("2021-11-15"),
    ctc: 1800000,
    bankAccount: "KKBK0001092",
    pan: "DLMPR2210K",
    leaveBalance: 11,
  },
  {
    id: "E1005",
    code: "PP-1005",
    name: "Arjun Nair",
    email: "arjun.nair@peoplepay360.io",
    phone: "+91 97401 55123",
    department: "Finance",
    designation: "Finance Controller",
    location: "Bengaluru",
    manager: "Board",
    employmentType: "Full-time",
    status: "active",
    joinedOn: d("2017-06-01"),
    ctc: 6100000,
    bankAccount: "UTIB0002109",
    pan: "EPRPN1188M",
    leaveBalance: 18,
  },
  {
    id: "E1006",
    code: "PP-1006",
    name: "Neel Shah",
    email: "neel.shah@peoplepay360.io",
    phone: "+91 93761 09912",
    department: "IT",
    designation: "IT Asset Manager",
    location: "Ahmedabad",
    manager: "Sana Iqbal",
    employmentType: "Full-time",
    status: "active",
    joinedOn: d("2020-02-17"),
    ctc: 2100000,
    bankAccount: "BARB0INDAHM",
    pan: "FTQPS7712N",
    leaveBalance: 7,
  },
  {
    id: "E1007",
    code: "PP-1007",
    name: "Priya Deshmukh",
    email: "priya.deshmukh@peoplepay360.io",
    phone: "+91 91340 66710",
    department: "People Ops",
    designation: "HR Associate",
    location: "Remote",
    manager: "Sana Iqbal",
    employmentType: "Full-time",
    status: "onboarding",
    joinedOn: d("2026-09-01"),
    ctc: 1950000,
    bankAccount: "HDFC0004128",
    pan: "GHXPD9931P",
    leaveBalance: 2,
  },
  {
    id: "E1008",
    code: "PP-1008",
    name: "Kabir Sethi",
    email: "kabir.sethi@peoplepay360.io",
    phone: "+91 98110 33456",
    department: "Sales",
    designation: "Account Executive",
    location: "Delhi",
    manager: "Sana Iqbal",
    employmentType: "Full-time",
    status: "offboarding",
    joinedOn: d("2023-03-06"),
    exitOn: d("2026-09-30"),
    ctc: 1650000,
    bankAccount: "PUNB0182900",
    pan: "HJZPS3312Q",
    leaveBalance: 4,
  },
  {
    id: "E1009",
    code: "PP-1009",
    name: "Meera Krishnan",
    email: "meera.krishnan@peoplepay360.io",
    phone: "+91 90031 78812",
    department: "Engineering",
    designation: "QA Engineer",
    location: "Chennai",
    manager: "Rohan Mehta",
    employmentType: "Contract",
    status: "on_leave",
    joinedOn: d("2024-07-29"),
    ctc: 1250000,
    bankAccount: "IOBA0001923",
    pan: "IKAPK5561R",
    leaveBalance: 0,
  },
  {
    id: "E1010",
    code: "PP-1010",
    name: "Vikram Bose",
    email: "vikram.bose@peoplepay360.io",
    phone: "+91 87990 12234",
    department: "Support",
    designation: "Support Lead",
    location: "Kolkata",
    manager: "Sana Iqbal",
    employmentType: "Full-time",
    status: "active",
    joinedOn: d("2021-05-10"),
    ctc: 1450000,
    bankAccount: "CNRB0002100",
    pan: "JLBPB7743S",
    leaveBalance: 12,
  },
  {
    id: "E1011",
    code: "PP-1011",
    name: "Ishita Verma",
    email: "ishita.verma@peoplepay360.io",
    phone: "+91 96500 44821",
    department: "Marketing",
    designation: "Content Strategist",
    location: "Remote",
    manager: "Sana Iqbal",
    employmentType: "Intern",
    status: "active",
    joinedOn: d("2026-06-15"),
    ctc: 480000,
    bankAccount: "YESB0001098",
    pan: "KMCPV1120T",
    leaveBalance: 3,
  },
  {
    id: "E1012",
    code: "PP-1012",
    name: "Farhan Qureshi",
    email: "farhan.qureshi@peoplepay360.io",
    phone: "+91 99201 55603",
    department: "Engineering",
    designation: "DevOps Engineer",
    location: "Hyderabad",
    manager: "Rohan Mehta",
    employmentType: "Full-time",
    status: "exited",
    joinedOn: d("2020-09-14"),
    exitOn: d("2026-05-31"),
    ctc: 2250000,
    bankAccount: "IDFB0004910",
    pan: "LNDPQ6650U",
    leaveBalance: 0,
  },
];

export const contracts: Contract[] = [
  {
    id: "CT-2022-01",
    employeeId: "E1001",
    contractType: "Full-time",
    startDate: "2022-04-11",
    endDate: "2027-04-10",
    salary: 2400000,
    department: "Engineering",
    status: "Active",
    terms: "Full-time permanent employment agreement with standard IP and confidentiality clauses.",
    noticePeriodDays: 60,
  },
  {
    id: "CT-2019-03",
    employeeId: "E1002",
    contractType: "Executive",
    startDate: "2019-08-05",
    endDate: "2029-08-04",
    salary: 4100000,
    department: "Engineering",
    status: "Active",
    terms: "Leadership agreement with annual stock option grant and managerial bonus schedule.",
    noticePeriodDays: 90,
  },
  {
    id: "CT-2018-01",
    employeeId: "E1003",
    contractType: "Executive",
    startDate: "2018-01-22",
    endDate: "2028-01-21",
    salary: 5200000,
    department: "People Ops",
    status: "Active",
    terms: "Executive employment contract with company-wide people management authority.",
    noticePeriodDays: 90,
  },
  {
    id: "CT-2021-08",
    employeeId: "E1004",
    contractType: "Full-time",
    startDate: "2021-11-15",
    endDate: "2026-11-14",
    salary: 1800000,
    department: "Finance",
    status: "Expiring Soon",
    terms: "Finance and payroll confidentiality obligations with bi-annual performance evaluation.",
    noticePeriodDays: 45,
  },
  {
    id: "CT-2017-02",
    employeeId: "E1005",
    contractType: "Executive",
    startDate: "2017-06-01",
    endDate: "2027-05-31",
    salary: 6100000,
    department: "Finance",
    status: "Active",
    terms: "Senior finance management authority with signatory rights for statutory disbursements.",
    noticePeriodDays: 90,
  },
  {
    id: "CT-2020-04",
    employeeId: "E1006",
    contractType: "Full-time",
    startDate: "2020-02-17",
    endDate: "2026-09-30",
    salary: 2100000,
    department: "IT",
    status: "Expiring Soon",
    terms: "IT infrastructure, asset custodian and software security administrator agreement.",
    noticePeriodDays: 60,
  },
  {
    id: "CT-2026-09",
    employeeId: "E1007",
    contractType: "Full-time",
    startDate: "2026-09-01",
    endDate: "2028-08-31",
    salary: 1950000,
    department: "People Ops",
    status: "Draft",
    terms: "HR associate employment offer awaiting digital acceptance and statutory signatures.",
    noticePeriodDays: 30,
  },
  {
    id: "CT-2023-05",
    employeeId: "E1008",
    contractType: "Full-time",
    startDate: "2023-03-06",
    endDate: "2026-09-30",
    salary: 1650000,
    department: "Sales",
    status: "Terminated",
    terms: "Sales commission structure agreement. Notice served for voluntary separation on 2026-09-30.",
    noticePeriodDays: 30,
  },
  {
    id: "CT-2024-11",
    employeeId: "E1009",
    contractType: "Fixed-term",
    startDate: "2024-07-29",
    endDate: "2025-07-28",
    salary: 1250000,
    department: "Engineering",
    status: "Expired",
    terms: "12-month fixed QA contractor agreement. Extension discussion ongoing.",
    noticePeriodDays: 30,
  },
  {
    id: "CT-2021-05",
    employeeId: "E1010",
    contractType: "Full-time",
    startDate: "2021-05-10",
    endDate: "2026-05-09",
    salary: 1450000,
    department: "Support",
    status: "Active",
    terms: "Tier-2 client support service level agreement and data privacy commitment.",
    noticePeriodDays: 30,
  },
  {
    id: "CT-2026-06",
    employeeId: "E1011",
    contractType: "Internship",
    startDate: "2026-06-15",
    endDate: "2026-12-14",
    salary: 480000,
    department: "Marketing",
    status: "Active",
    terms: "6-month marketing internship agreement with stipend and potential full-time conversion.",
    noticePeriodDays: 15,
  },
];

export const attendanceRecords: AttendanceRecord[] = [
  {
    id: "ATT-1001",
    employeeId: "E1001",
    date: "2026-09-05",
    checkIn: "09:05 AM",
    checkOut: "06:15 PM",
    workingHours: 9.1,
    status: "Present",
    location: "Office - Ahmedabad",
    remarks: "On time, completed sprint review",
  },
  {
    id: "ATT-1002",
    employeeId: "E1002",
    date: "2026-09-05",
    checkIn: "09:28 AM",
    checkOut: "06:45 PM",
    workingHours: 9.2,
    status: "Present",
    location: "Office - Bengaluru",
    remarks: "Interviewing candidates",
  },
  {
    id: "ATT-1003",
    employeeId: "E1003",
    date: "2026-09-05",
    checkIn: "08:50 AM",
    checkOut: "05:55 PM",
    workingHours: 9.0,
    status: "Present",
    location: "Office - Mumbai",
    remarks: "HR leadership review",
  },
  {
    id: "ATT-1004",
    employeeId: "E1004",
    date: "2026-09-05",
    checkIn: "09:48 AM",
    checkOut: "06:30 PM",
    workingHours: 8.7,
    status: "Late",
    location: "Office - Mumbai",
    remarks: "Late entry due to transit delay",
  },
  {
    id: "ATT-1005",
    employeeId: "E1005",
    date: "2026-09-05",
    checkIn: "09:10 AM",
    checkOut: "06:20 PM",
    workingHours: 9.1,
    status: "Present",
    location: "Office - Bengaluru",
    remarks: "Audit review",
  },
  {
    id: "ATT-1006",
    employeeId: "E1006",
    date: "2026-09-05",
    checkIn: "08:55 AM",
    checkOut: "06:00 PM",
    workingHours: 9.0,
    status: "Present",
    location: "Office - Ahmedabad",
    remarks: "Hardware distribution lab",
  },
  {
    id: "ATT-1007",
    employeeId: "E1007",
    date: "2026-09-05",
    checkIn: "09:15 AM",
    checkOut: "06:05 PM",
    workingHours: 8.8,
    status: "Present",
    location: "Remote",
    remarks: "Day 5 onboarding sprint",
  },
  {
    id: "ATT-1008",
    employeeId: "E1008",
    date: "2026-09-05",
    checkIn: "10:15 AM",
    checkOut: "03:30 PM",
    workingHours: 5.2,
    status: "Half Day",
    location: "Office - Ahmedabad",
    remarks: "Client account handover sessions",
  },
  {
    id: "ATT-1009",
    employeeId: "E1009",
    date: "2026-09-05",
    checkIn: "—",
    checkOut: "—",
    workingHours: 0,
    status: "On Leave",
    location: "Remote",
    remarks: "Approved sick leave LV-502",
  },
  {
    id: "ATT-1010",
    employeeId: "E1010",
    date: "2026-09-05",
    checkIn: "08:30 AM",
    checkOut: "05:30 PM",
    workingHours: 9.0,
    status: "Present",
    location: "Office - Bengaluru",
    remarks: "Support morning triage shift",
  },
  {
    id: "ATT-1011",
    employeeId: "E1011",
    date: "2026-09-05",
    checkIn: "09:20 AM",
    checkOut: "06:10 PM",
    workingHours: 8.8,
    status: "Present",
    location: "Remote",
    remarks: "Content release cycle",
  },
  // Previous day sample
  {
    id: "ATT-1000-01",
    employeeId: "E1001",
    date: "2026-09-04",
    checkIn: "09:00 AM",
    checkOut: "06:00 PM",
    workingHours: 9.0,
    status: "Present",
    location: "Office - Ahmedabad",
  },
];

export const onboardingCases: OnboardingCase[] = [
  {
    id: "ON-200",
    employeeId: "E1001",
    startDate: "2026-08-15",
    dueDate: "2026-09-15",
    buddy: "Rohan Mehta",
    assignedHr: "Sana Iqbal",
    status: "In Progress",
    invitationSentDate: "2026-08-10",
    accountCreatedDate: "2026-08-11",
    tasks: [
      { id: "t1", label: "Complete personal profile", owner: "Employee", done: true, category: "Personal" },
      { id: "t2", label: "Add emergency contact", owner: "Employee", done: true, category: "Personal" },
      { id: "t3", label: "Accept company policies & code of conduct", owner: "Employee", done: true, category: "Compliance" },
      { id: "t4", label: "Submit bank salary account details", owner: "Payroll", done: true, category: "Finance" },
      { id: "t5", label: "Declare tax regime & PAN verification", owner: "Payroll", done: true, category: "Finance" },
      { id: "t6", label: "Sign employment contract & NDA", owner: "HR", done: true, category: "Legal" },
      { id: "t7", label: "Attend tech team orientation", owner: "HR", done: true, category: "Orientation" },
      { id: "t8", label: "Acknowledge IT laptop & security token receipt", owner: "IT", done: false, category: "IT" },
    ],
  },
  {
    id: "ON-201",
    employeeId: "E1007",
    startDate: "2026-09-01",
    dueDate: "2026-09-15",
    buddy: "Charmi Patel",
    assignedHr: "Sana Iqbal",
    status: "In Progress",
    invitationSentDate: "2026-08-28",
    accountCreatedDate: "2026-08-29",
    tasks: [
      { id: "t1", label: "Complete personal profile", owner: "Employee", done: true, category: "Personal" },
      { id: "t2", label: "Add emergency contact", owner: "Employee", done: true, category: "Personal" },
      { id: "t3", label: "Accept company policies", owner: "Employee", done: true, category: "Compliance" },
      { id: "t4", label: "Complete bank details", owner: "Payroll", done: true, category: "Finance" },
      { id: "t5", label: "Complete tax information", owner: "Payroll", done: false, category: "Finance" },
      { id: "t6", label: "Review contract", owner: "HR", done: false, category: "Legal" },
      { id: "t7", label: "Attend orientation", owner: "HR", done: false, category: "Orientation" },
      { id: "t8", label: "Receive company assets", owner: "IT", done: false, category: "IT" },
    ],
  },
  {
    id: "ON-202",
    employeeId: "E1011",
    startDate: "2026-06-15",
    dueDate: "2026-06-30",
    buddy: "Vikram Bose",
    assignedHr: "Sana Iqbal",
    status: "Completed",
    invitationSentDate: "2026-06-05",
    accountCreatedDate: "2026-06-06",
    completedDate: "2026-06-25",
    tasks: [
      { id: "t1", label: "Complete personal profile", owner: "Employee", done: true, category: "Personal" },
      { id: "t2", label: "Add emergency contact", owner: "Employee", done: true, category: "Personal" },
      { id: "t3", label: "Accept company policies", owner: "Employee", done: true, category: "Compliance" },
      { id: "t4", label: "Complete bank details", owner: "Payroll", done: true, category: "Finance" },
      { id: "t5", label: "Complete tax information", owner: "Payroll", done: true, category: "Finance" },
      { id: "t6", label: "Review contract", owner: "HR", done: true, category: "Legal" },
      { id: "t7", label: "Attend orientation", owner: "HR", done: true, category: "Orientation" },
      { id: "t8", label: "Receive company assets", owner: "IT", done: true, category: "IT" },
    ],
  },
];

export const provisioningRecords: ProvisioningRecord[] = [
  {
    id: "PRV-101",
    employeeId: "E1007",
    employeeName: "Priya Deshmukh",
    companyEmail: "priya.deshmukh@peoplepay360.io",
    overallStatus: "Completed",
    invitationStatus: "Accepted",
    accountActivated: true,
    defaultPermissions: ["Self-service Workspace", "Leave Application", "Expense Claims", "Profile Access"],
    startedAt: "2026-08-28 10:00 AM",
    completedAt: "2026-08-29 02:30 PM",
    steps: [
      { step: 1, key: "record_created", label: "Employee record created in HRIS", status: "completed", timestamp: "10:01 AM" },
      { step: 2, key: "email_generated", label: "Company Google Workspace email generated", status: "completed", timestamp: "10:02 AM" },
      { step: 3, key: "invite_sent", label: "Activation invitation email dispatched", status: "completed", timestamp: "10:03 AM" },
      { step: 4, key: "account_activated", label: "Employee set password & activated account", status: "completed", timestamp: "02:15 PM" },
      { step: 5, key: "permissions_assigned", label: "Default role-based access rules provisioned", status: "completed", timestamp: "02:16 PM" },
      { step: 6, key: "onboarding_started", label: "Onboarding checklist assigned and triggered", status: "completed", timestamp: "02:18 PM" },
    ],
  },
];

export const offboardingCases: OffboardingCase[] = [
  {
    id: "OFF-88",
    employeeId: "E1008",
    lastWorkingDay: "2026-09-30",
    reason: "Resignation — higher studies",
    manager: "Sana Iqbal",
    exitInterviewStatus: "Scheduled",
    assetsReturned: false,
    accessRevoked: false,
    finalPayrollStatus: "Processing",
    clearanceStatus: "Partial",
    finalSettlement: "pending",
    notes: "Handover of Delhi client accounts to Vikram Bose in progress.",
  },
  {
    id: "OFF-84",
    employeeId: "E1012",
    lastWorkingDay: "2026-05-31",
    reason: "Resignation — relocation",
    manager: "Rohan Mehta",
    exitInterviewStatus: "Completed",
    assetsReturned: true,
    accessRevoked: true,
    finalPayrollStatus: "Processed",
    clearanceStatus: "Cleared",
    finalSettlement: "settled",
    notes: "Full & final released with May payroll.",
  },
];

export const leaveRequests: LeaveRequest[] = [
  {
    id: "LV-501",
    employeeId: "E1001",
    type: "Earned",
    from: "2026-09-14",
    to: "2026-09-18",
    days: 5,
    reason: "Family function in Vadodara",
    status: "pending",
    submittedAt: "2026-09-02",
  },
  {
    id: "LV-502",
    employeeId: "E1009",
    type: "Sick",
    from: "2026-09-02",
    to: "2026-09-06",
    days: 5,
    reason: "Viral fever, doctor advised rest",
    status: "approved",
    submittedAt: "2026-09-01",
  },
  {
    id: "LV-503",
    employeeId: "E1010",
    type: "Casual",
    from: "2026-09-08",
    to: "2026-09-08",
    days: 1,
    reason: "Personal errand at municipal office",
    status: "pending",
    submittedAt: "2026-09-03",
  },
  {
    id: "LV-504",
    employeeId: "E1004",
    type: "Unpaid",
    from: "2026-08-24",
    to: "2026-08-28",
    days: 5,
    reason: "Extended personal travel",
    status: "rejected",
    submittedAt: "2026-08-20",
  },
  {
    id: "LV-505",
    employeeId: "E1002",
    type: "Casual",
    from: "2026-09-21",
    to: "2026-09-22",
    days: 2,
    reason: "Long weekend travel",
    status: "approved",
    submittedAt: "2026-09-04",
  },
];

export const reimbursements: ReimbursementClaim[] = [
  {
    id: "CLM-901",
    employeeId: "E1001",
    category: "Travel",
    amount: 8450,
    submittedDate: "2026-09-02",
    receiptStatus: "Uploaded",
    approvalStatus: "pending",
    paymentStatus: "unpaid",
    description: "Flight tickets for Bangalore client architecture review session",
    receiptFileName: "IndiGo_BLR_Ticket_Charmi.pdf",
    paymentMethod: "Bank Transfer",
  },
  {
    id: "CLM-902",
    employeeId: "E1002",
    category: "Food",
    amount: 3200,
    submittedDate: "2026-09-01",
    receiptStatus: "Uploaded",
    approvalStatus: "approved",
    paymentStatus: "paid",
    description: "Team dinner celebrating Q2 mobile app delivery",
    receiptFileName: "Toit_Brewpub_Receipt.pdf",
    paymentMethod: "Payroll Cycle",
  },
  {
    id: "CLM-903",
    employeeId: "E1006",
    category: "Office Supplies",
    amount: 2400,
    submittedDate: "2026-08-29",
    receiptStatus: "Uploaded",
    approvalStatus: "approved",
    paymentStatus: "unpaid",
    description: "Anti-static wristbands, thermal paste, and tool set for IT bench",
    receiptFileName: "Amazon_IT_Invoice.pdf",
    paymentMethod: "Bank Transfer",
  },
  {
    id: "CLM-904",
    employeeId: "E1007",
    category: "Internet",
    amount: 1500,
    submittedDate: "2026-09-03",
    receiptStatus: "Uploaded",
    approvalStatus: "pending",
    paymentStatus: "unpaid",
    description: "August monthly fiber broadband reimbursement for remote work",
    receiptFileName: "Airtel_Broadband_Aug.pdf",
    paymentMethod: "Payroll Cycle",
  },
  {
    id: "CLM-905",
    employeeId: "E1010",
    category: "Training",
    amount: 12000,
    submittedDate: "2026-08-20",
    receiptStatus: "Uploaded",
    approvalStatus: "approved",
    paymentStatus: "paid",
    description: "ITIL Foundation 4 Certification course voucher",
    receiptFileName: "ITIL_Course_Invoice.pdf",
    paymentMethod: "Bank Transfer",
  },
  {
    id: "CLM-906",
    employeeId: "E1008",
    category: "Travel",
    amount: 4600,
    submittedDate: "2026-08-25",
    receiptStatus: "Missing",
    approvalStatus: "changes_requested",
    paymentStatus: "unpaid",
    description: "Taxi cab vouchers for Delhi customer meetings. Missing receipts.",
    receiptFileName: undefined,
    paymentMethod: "Bank Transfer",
  },
  {
    id: "CLM-907",
    employeeId: "E1001",
    category: "Medical",
    amount: 4500,
    submittedDate: "2026-08-15",
    receiptStatus: "Uploaded",
    approvalStatus: "rejected",
    paymentStatus: "unpaid",
    description: "Annual wellness checkup (out-of-policy non-empanelled clinic)",
    receiptFileName: "HealthCheck_Bill.pdf",
    paymentMethod: "Bank Transfer",
  },
];

export const allowances: AllowanceRecord[] = [
  {
    id: "ALW-101",
    employeeId: "E1001",
    type: "House Rent Allowance",
    amount: 40000,
    effectiveDate: "2022-04-11",
    expiryDate: "2027-03-31",
    status: "approved",
    notes: "Ahmedabad metro rental allowance as per salary annexure",
  },
  {
    id: "ALW-102",
    employeeId: "E1001",
    type: "Internet Allowance",
    amount: 2000,
    effectiveDate: "2023-01-01",
    expiryDate: "2027-12-31",
    status: "approved",
    notes: "High-speed broadband allowance for hybrid engineering",
  },
  {
    id: "ALW-103",
    employeeId: "E1002",
    type: "House Rent Allowance",
    amount: 68000,
    effectiveDate: "2019-08-05",
    expiryDate: "2028-03-31",
    status: "approved",
    notes: "Bengaluru metro tier-1 HRA",
  },
  {
    id: "ALW-104",
    employeeId: "E1002",
    type: "Travel Allowance",
    amount: 15000,
    effectiveDate: "2021-01-01",
    expiryDate: "2027-12-31",
    status: "approved",
    notes: "Inter-office executive travel allowance",
  },
  {
    id: "ALW-105",
    employeeId: "E1004",
    type: "Meal Allowance",
    amount: 3500,
    effectiveDate: "2021-11-15",
    expiryDate: "2026-12-31",
    status: "approved",
    notes: "Corporate food voucher subsidy",
  },
  {
    id: "ALW-106",
    employeeId: "E1007",
    type: "Internet Allowance",
    amount: 2500,
    effectiveDate: "2026-09-01",
    expiryDate: "2027-08-31",
    status: "pending",
    notes: "Remote work connectivity allowance awaiting approval",
  },
  {
    id: "ALW-107",
    employeeId: "E1007",
    type: "Special Allowance",
    amount: 12000,
    effectiveDate: "2026-09-01",
    expiryDate: "2027-08-31",
    status: "approved",
    notes: "New joiner skill differential allowance",
  },
  {
    id: "ALW-108",
    employeeId: "E1010",
    type: "Performance Allowance",
    amount: 8000,
    effectiveDate: "2026-07-01",
    expiryDate: "2026-12-31",
    status: "approved",
    notes: "CSAT score > 98% quarterly reward allowance",
  },
];

export const helpdeskTickets: HelpdeskTicket[] = [
  {
    id: "TKT-301",
    subject: "MacBook Pro external monitor display flicker over USB-C",
    requesterId: "E1001",
    category: "Hardware",
    priority: "Medium",
    assignedTechnician: "Neel Shah",
    createdDate: "2026-09-03",
    updatedDate: "2026-09-04",
    status: "In Progress",
    description:
      "The secondary LG UltraFine monitor flickers intermittently whenever waking from sleep mode. Cable changed with no luck.",
    comments: [
      {
        id: "c1",
        author: "Charmi Patel",
        text: "Tried resetting display preferences in macOS. Issue persists.",
        at: "2026-09-03 11:30 AM",
      },
      {
        id: "c2",
        author: "Neel Shah",
        text: "I have ordered a certified Thunderbolt 4 cable for your desk. Will test it together tomorrow morning.",
        at: "2026-09-04 02:15 PM",
      },
    ],
  },
  {
    id: "TKT-302",
    subject: "VPN access token expired for remote production deployment",
    requesterId: "E1002",
    category: "Network",
    priority: "Critical",
    assignedTechnician: "Neel Shah",
    createdDate: "2026-09-05",
    updatedDate: "2026-09-05",
    status: "Open",
    description:
      "Need MFA hardware token reset or Cisco AnyConnect profile refreshed for cloud infra maintenance tonight.",
    comments: [
      {
        id: "c1",
        author: "Rohan Mehta",
        text: "Please escalate as release window is 9 PM IST tonight.",
        at: "2026-09-05 09:30 AM",
      },
    ],
  },
  {
    id: "TKT-303",
    subject: "Figma Organization enterprise seat license assignment",
    requesterId: "E1007",
    category: "Software",
    priority: "High",
    assignedTechnician: "Neel Shah",
    createdDate: "2026-09-01",
    updatedDate: "2026-09-02",
    status: "Resolved",
    description: "New joiner design access requested for design systems and mockups.",
    comments: [
      {
        id: "c1",
        author: "Priya Deshmukh",
        text: "Need access to PeoplePay360 Design System libraries.",
        at: "2026-09-01 10:15 AM",
      },
      {
        id: "c2",
        author: "Neel Shah",
        text: "License provisioned through SSO Okta group. Invitation sent.",
        at: "2026-09-02 11:00 AM",
      },
      {
        id: "c3",
        author: "Priya Deshmukh",
        text: "Confirmed, I can access the workspace now. Thank you!",
        at: "2026-09-02 11:45 AM",
      },
    ],
  },
  {
    id: "TKT-304",
    subject: "August Form 16 & statutory tax deduction slip question",
    requesterId: "E1010",
    category: "Payroll System",
    priority: "Low",
    assignedTechnician: "Devika Rao",
    createdDate: "2026-09-02",
    updatedDate: "2026-09-03",
    status: "Waiting for User",
    description: "Difference observed in TDS computation between portal payslip and old tax regime declaration.",
    comments: [
      {
        id: "c1",
        author: "Devika Rao",
        text: "Please upload your updated rent agreement to adjust HRA exemption under section 10(13A).",
        at: "2026-09-03 04:00 PM",
      },
    ],
  },
  {
    id: "TKT-305",
    subject: "Wi-Fi roaming dropouts on Ahmedabad 3rd Floor East Wing",
    requesterId: "E1003",
    category: "Network",
    priority: "High",
    assignedTechnician: "Neel Shah",
    createdDate: "2026-09-04",
    updatedDate: "2026-09-04",
    status: "In Progress",
    description: "Several team members reported packet loss during Zoom client calls around Meeting Room B.",
    comments: [
      {
        id: "c1",
        author: "Neel Shah",
        text: "Access Point AP-04 rebooted and firmware patched. Monitoring signal strength today.",
        at: "2026-09-04 05:40 PM",
      },
    ],
  },
  {
    id: "TKT-306",
    subject: "Offboarding laptop and access card return courier",
    requesterId: "E1008",
    category: "Account Access",
    priority: "Medium",
    assignedTechnician: "Neel Shah",
    createdDate: "2026-09-04",
    updatedDate: "2026-09-05",
    status: "Open",
    description: "Requesting return shipping kit and pickup for company assets prior to LWD.",
    comments: [],
  },
];

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

export const payrollRuns: PayrollRun[] = [
  {
    id: "PR-2609",
    period: "September 2026",
    cycle: "Monthly · 1–30 Sep",
    status: "draft",
    createdBy: "Devika Rao",
    lines: [
      calculatePayrollLine("E1001", 2400000),
      calculatePayrollLine("E1002", 4100000),
      calculatePayrollLine("E1004", 1800000),
      calculatePayrollLine("E1007", 1950000),
      calculatePayrollLine("E1010", 1450000, 15000),
    ],
  },
  {
    id: "PR-2608",
    period: "August 2026",
    cycle: "Monthly · 1–31 Aug",
    status: "pending_approval",
    createdBy: "Devika Rao",
    lines: [
      calculatePayrollLine("E1001", 2400000, 25000),
      calculatePayrollLine("E1002", 4100000),
      calculatePayrollLine("E1004", 1800000),
      calculatePayrollLine("E1006", 2100000),
      calculatePayrollLine("E1010", 1450000),
    ],
  },
  {
    id: "PR-2607",
    period: "July 2026",
    cycle: "Monthly · 1–31 Jul",
    status: "paid",
    paymentDate: "2026-07-31",
    createdBy: "Devika Rao",
    approvedBy: "Arjun Nair",
    lines: [
      calculatePayrollLine("E1001", 2400000),
      calculatePayrollLine("E1002", 4100000),
      calculatePayrollLine("E1004", 1800000),
      calculatePayrollLine("E1006", 2100000),
      calculatePayrollLine("E1010", 1450000),
    ],
  },
  {
    id: "PR-2606",
    period: "June 2026",
    cycle: "Monthly · 1–30 Jun",
    status: "paid",
    paymentDate: "2026-06-30",
    createdBy: "Devika Rao",
    approvedBy: "Arjun Nair",
    lines: [
      calculatePayrollLine("E1001", 2400000),
      calculatePayrollLine("E1002", 4100000),
      calculatePayrollLine("E1004", 1800000),
      calculatePayrollLine("E1006", 2100000),
    ],
  },
];

export const assets: Asset[] = [
  {
    id: "A-01",
    tag: "LAP-2291",
    name: 'MacBook Pro 14" M4',
    category: "Laptop",
    serial: "C02XK9LMQ1",
    purchasedOn: "2025-02-11",
    value: 210000,
    condition: "Good",
    status: "Assigned",
    location: "Ahmedabad",
    assignedTo: "E1001",
    history: [
      { date: "2025-02-11", action: "Procured and added to inventory", actor: "Neel Shah" },
      { date: "2025-02-12", action: "Allocated to Charmi Patel", actor: "Neel Shah" },
    ],
  },
  {
    id: "A-02",
    tag: "LAP-2292",
    name: "Dell Latitude 7450",
    category: "Laptop",
    serial: "DL7450X118",
    purchasedOn: "2024-10-02",
    value: 128000,
    condition: "Good",
    status: "Assigned",
    location: "Pune",
    assignedTo: "E1004",
    history: [
      { date: "2024-10-02", action: "Procured", actor: "Neel Shah" },
      { date: "2024-10-05", action: "Allocated to Devika Rao", actor: "Neel Shah" },
    ],
  },
  {
    id: "A-03",
    tag: "LAP-2293",
    name: "ThinkPad X1 Carbon Gen 12",
    category: "Laptop",
    serial: "TPX1C99201",
    purchasedOn: "2023-07-19",
    value: 145000,
    condition: "New",
    status: "Available",
    location: "Ahmedabad IT Vault",
    assignedTo: undefined,
    history: [
      { date: "2023-07-19", action: "Procured and imaged", actor: "Neel Shah" },
      { date: "2026-08-01", action: "Returned from previous intern, sanitised and stored", actor: "Neel Shah" },
    ],
  },
  {
    id: "A-04",
    tag: "MON-1180",
    name: 'LG UltraFine 27" 4K',
    category: "Monitor",
    serial: "LGUF27A882",
    purchasedOn: "2024-04-08",
    value: 42000,
    condition: "Good",
    status: "Assigned",
    location: "Bengaluru",
    assignedTo: "E1002",
    history: [{ date: "2024-04-08", action: "Allocated to Rohan Mehta", actor: "Neel Shah" }],
  },
  {
    id: "A-05",
    tag: "PHN-4410",
    name: "iPhone 15 128GB",
    category: "Mobile phone",
    serial: "IP15X772210",
    purchasedOn: "2025-01-30",
    value: 79000,
    condition: "Good",
    status: "Assigned",
    location: "Delhi",
    assignedTo: "E1008",
    history: [{ date: "2025-01-30", action: "Allocated for sales field operations", actor: "Neel Shah" }],
  },
  {
    id: "A-06",
    tag: "ACC-7712",
    name: "Logitech MX Master 3S + Keys Combo",
    category: "Keyboard",
    serial: "LGMX772103",
    purchasedOn: "2025-06-21",
    value: 14500,
    condition: "New",
    status: "Available",
    location: "Ahmedabad Storage",
    assignedTo: undefined,
  },
  {
    id: "A-07",
    tag: "LIC-0031",
    name: "Figma Organization Enterprise Seat",
    category: "Software license",
    serial: "FIG-ORG-0031",
    purchasedOn: "2026-01-01",
    value: 38000,
    condition: "New",
    status: "Assigned",
    location: "Cloud",
    assignedTo: "E1007",
  },
  {
    id: "A-08",
    tag: "LAP-2280",
    name: 'MacBook Air 13" M3',
    category: "Laptop",
    serial: "MBA3M11290",
    purchasedOn: "2023-03-14",
    value: 118000,
    condition: "Needs Service",
    status: "Under Maintenance",
    location: "Apple Authorized Service Partner",
    assignedTo: undefined,
  },
  {
    id: "A-09",
    tag: "MON-1155",
    name: 'Dell P2422H 24" FHD',
    category: "Monitor",
    serial: "DLP2422H01",
    purchasedOn: "2022-08-09",
    value: 18000,
    condition: "Fair",
    status: "Retired",
    location: "Recycling / E-waste buffer",
    assignedTo: undefined,
  },
  {
    id: "A-10",
    tag: "LAP-2294",
    name: 'MacBook Pro 16" M4 Max',
    category: "Laptop",
    serial: "MBP16M4X77",
    purchasedOn: "2026-03-02",
    value: 320000,
    condition: "New",
    status: "Assigned",
    location: "Bengaluru",
    assignedTo: "E1002",
  },
  {
    id: "A-11",
    tag: "CRD-8821",
    name: "RFID Building Access Card",
    category: "Access card",
    serial: "HID-PROX-8821",
    purchasedOn: "2024-01-10",
    value: 1200,
    condition: "Good",
    status: "Assigned",
    location: "Ahmedabad",
    assignedTo: "E1001",
  },
  {
    id: "A-12",
    tag: "SEC-9002",
    name: "YubiKey 5C NFC Security Key",
    category: "Other",
    serial: "YK5CNFC-9002",
    purchasedOn: "2025-05-15",
    value: 5500,
    condition: "New",
    status: "Available",
    location: "IT Safe",
    assignedTo: undefined,
  },
];

export const assetRequests: AssetRequest[] = [
  {
    id: "AR-77",
    employeeId: "E1007",
    item: "MacBook Pro 14 + external monitor",
    justification: "New joiner workstation setup",
    raisedOn: "2026-08-28",
    status: "open",
    priority: "High",
  },
  {
    id: "AR-78",
    employeeId: "E1001",
    item: "Noise cancelling wireless headset",
    justification: "Frequent customer architectural sync calls from open floor",
    raisedOn: "2026-08-30",
    status: "in_progress",
    priority: "Medium",
  },
  {
    id: "AR-79",
    employeeId: "E1010",
    item: "Second monitor for queue management",
    justification: "Support ticket triage and live call logging across twin screens",
    raisedOn: "2026-07-14",
    status: "resolved",
    priority: "Low",
  },
];

export const orgUsers: OrgUser[] = [
  { id: "U1", name: "Charmi Patel", email: "charmi.patel@peoplepay360.io", role: "employee", active: true },
  { id: "U2", name: "Sana Iqbal", email: "sana.iqbal@peoplepay360.io", role: "hr_manager", active: true },
  { id: "U3", name: "Priya Deshmukh", email: "priya.deshmukh@peoplepay360.io", role: "hr_user", active: true },
  { id: "U4", name: "Devika Rao", email: "devika.rao@peoplepay360.io", role: "payroll_user", active: true },
  { id: "U5", name: "Arjun Nair", email: "arjun.nair@peoplepay360.io", role: "payroll_manager", active: true },
  { id: "U6", name: "Neel Shah", email: "neel.shah@peoplepay360.io", role: "it_asset_manager", active: true },
  { id: "U7", name: "Ops Admin", email: "admin@peoplepay360.io", role: "admin", active: true },
  { id: "U8", name: "Kabir Sethi", email: "kabir.sethi@peoplepay360.io", role: "employee", active: false },
];

export const auditLog: AuditEntry[] = [
  { id: "L1", at: "2026-09-05 10:15", actor: "Devika Rao", action: "Initiated September 2026 draft payroll run PR-2609", module: "Payroll" },
  { id: "L2", at: "2026-09-04 18:22", actor: "Neel Shah", action: "Assigned Figma Organization seat to Priya Deshmukh", module: "Assets" },
  { id: "L3", at: "2026-09-04 16:05", actor: "Sana Iqbal", action: "Approved leave request LV-502 for Meera Krishnan", module: "Time Off" },
  { id: "L4", at: "2026-09-03 11:40", actor: "Arjun Nair", action: "Approved August travel reimbursement CLM-902", module: "Reimbursements" },
  { id: "L5", at: "2026-09-02 09:15", actor: "Sana Iqbal", action: "Scheduled offboarding and exit interview for Kabir Sethi", module: "Lifecycle" },
  { id: "L6", at: "2026-09-01 08:02", actor: "Ops Admin", action: "Provisioned employee account and company email for Priya Deshmukh", module: "Provisioning" },
];

/** Role → who is "signed in" as a person */
export const ROLE_PERSONA: Record<Role, { employeeId: string; name: string }> = {
  employee: { employeeId: "E1001", name: "Charmi Patel" },
  hr_manager: { employeeId: "E1003", name: "Sana Iqbal" },
  hr_user: { employeeId: "E1007", name: "Priya Deshmukh" },
  payroll_user: { employeeId: "E1004", name: "Devika Rao" },
  payroll_manager: { employeeId: "E1005", name: "Arjun Nair" },
  it_asset_manager: { employeeId: "E1006", name: "Neel Shah" },
  admin: { employeeId: "E1003", name: "Ops Admin" },
};

export const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
