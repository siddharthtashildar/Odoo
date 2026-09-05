import { toast } from "sonner";
import { api } from "./api";

export interface PayslipExportData {
  employeeName: string;
  employeeCode: string;
  department: string;
  designation: string;
  bankAccount: string;
  pan?: string;
  period: string;
  basic?: number;
  hra?: number;
  specialAllowance?: number;
  bonus?: number;
  gross?: number;
  pf?: number;
  pt?: number;
  tds?: number;
  deductions?: number;
  net?: number;
}

function fmt(val: number | undefined | null): string {
  const n = Number(val || 0);
  return (isNaN(n) ? 0 : n).toLocaleString("en-IN");
}

export function downloadPayslipPDF(data: PayslipExportData) {
  const filePeriod = (data.period || "Current_Period").replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = (data.employeeName || "Employee").replace(/[^a-zA-Z0-9]/g, "_");

  const basic = data.basic ?? Math.round((data.gross || 0) * 0.5);
  const hra = data.hra ?? Math.round(basic * 0.4);
  const special = data.specialAllowance ?? Math.max(0, (data.gross || 0) - basic - hra);
  const gross = data.gross ?? (basic + hra + special + (data.bonus || 0));
  const pf = data.pf ?? 1800;
  const pt = data.pt ?? 200;
  const tds = data.tds ?? 0;
  const deductions = data.deductions ?? (pf + pt + tds);
  const net = data.net ?? Math.max(0, gross - deductions);

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payslip_${filePeriod}_${fileName}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; background: #ffffff; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .brand { font-size: 26px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
    .brand span { color: #3b82f6; }
    .title { text-align: right; }
    .title h2 { margin: 0; font-size: 18px; color: #1e293b; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
    .title p { margin: 4px 0 0; font-size: 13px; color: #64748b; font-weight: 600; }
    .emp-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px; font-size: 13px; }
    .emp-item span { color: #64748b; display: block; font-size: 11px; text-transform: uppercase; font-weight: 600; margin-bottom: 2px; }
    .emp-item strong { color: #0f172a; font-size: 14px; font-weight: 700; }
    .tables-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f1f5f9; text-align: left; padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; border-bottom: 2px solid #cbd5e1; }
    td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
    .text-right { text-align: right; }
    .total-row td { font-weight: 700; border-top: 2px solid #e2e8f0; background: #f8fafc; color: #0f172a; }
    .net-box { background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 8px; padding: 16px; display: flex; justify-content: space-between; align-items: center; margin-top: 16px; }
    .net-title { font-size: 14px; font-weight: 700; color: #1e40af; text-transform: uppercase; }
    .net-amount { font-size: 24px; font-weight: 800; color: #1e3a8a; }
    .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 14px; text-align: center; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">PeoplePay<span>360</span></div>
    <div class="title">
      <h2>Payslip Statement</h2>
      <p>Pay Period: ${data.period || "Current Cycle"}</p>
    </div>
  </div>

  <div class="emp-grid">
    <div class="emp-item"><span>Employee Name</span><strong>${data.employeeName} (${data.employeeCode})</strong></div>
    <div class="emp-item"><span>Designation / Department</span><strong>${data.designation} · ${data.department}</strong></div>
    <div class="emp-item"><span>Bank Salary Account</span><strong>${data.bankAccount}</strong></div>
    <div class="emp-item"><span>PAN / Tax Identifier</span><strong>${data.pan || "N/A"}</strong></div>
  </div>

  <div class="tables-grid">
    <div>
      <table>
        <thead><tr><th>Earnings</th><th class="text-right">Amount</th></tr></thead>
        <tbody>
          <tr><td>Basic Salary</td><td class="text-right">₹${fmt(basic)}</td></tr>
          <tr><td>House Rent Allowance (HRA)</td><td class="text-right">₹${fmt(hra)}</td></tr>
          <tr><td>Special Allowance</td><td class="text-right">₹${fmt(special)}</td></tr>
          ${data.bonus ? `<tr><td>Performance Bonus</td><td class="text-right">₹${fmt(data.bonus)}</td></tr>` : ""}
          <tr class="total-row"><td>Total Gross Earnings</td><td class="text-right">₹${fmt(gross)}</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <table>
        <thead><tr><th>Deductions</th><th class="text-right">Amount</th></tr></thead>
        <tbody>
          <tr><td>Provident Fund (PF)</td><td class="text-right">₹${fmt(pf)}</td></tr>
          <tr><td>Professional Tax (PT)</td><td class="text-right">₹${fmt(pt)}</td></tr>
          <tr><td>Income Tax (TDS)</td><td class="text-right">₹${fmt(tds)}</td></tr>
          <tr class="total-row"><td>Total Deductions</td><td class="text-right" style="color: #dc2626;">- ₹${fmt(deductions)}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="net-box">
    <div class="net-title">NET SALARY DISBURSED</div>
    <div class="net-amount">₹${fmt(net)}</div>
  </div>

  <div class="footer">
    This is an official computer-generated payslip statement issued by PeoplePay360 HR & Payroll Engine.
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 250);
    };
  </script>
</body>
</html>`;

  // 1. Direct file download as HTML file
  const blob = new Blob([htmlContent], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Payslip_${filePeriod}_${fileName}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // 2. Open printable popup print window
  const printWindow = window.open("", "_blank", "width=850,height=950");
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }

  toast.success(`Downloaded payslip for ${data.employeeName}`, {
    description: `Saved as file & opened PDF print window.`,
  });
}

export async function emailPayslipToEmployee(data: PayslipExportData, employeeId: string) {
  toast.info(`Dispatching payslip email to ${data.employeeName}...`);
  try {
    const res = await api.payroll.sendSingleEmail({
      employeeId,
      period: data.period,
      gross: data.gross ?? 0,
      net: data.net ?? 0,
      basic: data.basic ?? 0,
      allowances: (data.hra ?? 0) + (data.specialAllowance ?? 0),
      deductions: data.deductions ?? 0,
    });
    toast.success(res.message || `Payslip email sent to ${data.employeeName}!`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to email payslip";
    toast.error(msg);
  }
}
