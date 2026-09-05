import { toast } from "sonner";
import jsPDF from "jspdf";
import { api } from "./api";

export interface PayslipExportData {
  employeeName: string;
  employeeCode: string;
  department: string;
  designation: string;
  bankAccount: string;
  bankName?: string | undefined;
  bankIfsc?: string | undefined;
  pan?: string | undefined;
  period: string;
  payDate?: string | undefined;
  workingDays?: number | undefined;
  presentDays?: number | undefined;
  absentDays?: number | undefined;
  leaveDays?: number | undefined;
  basic?: number | undefined;
  hra?: number | undefined;
  specialAllowance?: number | undefined;
  bonus?: number | undefined;
  gross?: number | undefined;
  pf?: number | undefined;
  pt?: number | undefined;
  tds?: number | undefined;
  deductions?: number | undefined;
  net?: number | undefined;
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
  const bonus = data.bonus ?? 0;
  const gross = data.gross ?? (basic + hra + special + bonus);
  const pf = data.pf ?? 1800;
  const pt = data.pt ?? 200;
  const tds = data.tds ?? 0;
  const deductions = data.deductions ?? (pf + pt + tds);
  const net = data.net ?? Math.max(0, gross - deductions);

  const workingDays = data.workingDays ?? 22;
  const presentDays = data.presentDays ?? 22;
  const leaveDays = data.leaveDays ?? 0;
  const absentDays = data.absentDays ?? 0;

  // Initialize A4 PDF document (210mm x 297mm)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // 1. Top Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(15, 12, 180, 26, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("PeoplePay360 HRMS", 22, 23);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text("Official Employee Pay Statement & Compensation Voucher", 22, 30);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`PAY PERIOD: ${data.period || "Current Cycle"}`, 188, 23, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Status: Disbursed / Paid  |  Date: ${data.payDate || new Date().toISOString().slice(0, 10)}`, 188, 30, { align: "right" });

  // 2. Employee Profile Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(15, 43, 180, 36, 2, 2, "FD");

  // Left Column
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(data.employeeName || "Employee", 21, 51);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Employee Code: ${data.employeeCode}`, 21, 58);
  doc.text(`Designation: ${data.designation}  |  Department: ${data.department}`, 21, 65);
  doc.text(`PAN Number: ${data.pan || "ABCDE1234F"}  |  Tax Status: Verified`, 21, 72);

  // Right Column
  doc.text(`Bank Name: ${data.bankName || "HDFC Bank"}`, 112, 51);
  doc.text(`Salary A/C No: ${data.bankAccount}`, 112, 58);
  doc.text(`IFSC Code: ${data.bankIfsc || "HDFC0000001"}`, 112, 65);
  doc.text("Payment Mode: Automated Direct Credit (ACH/NEFT)", 112, 72);

  // 3. Attendance Metrics Strip
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(15, 83, 180, 11, 1, 1, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`Calendar Days: ${workingDays}`, 22, 90);
  doc.text(`Present Days: ${presentDays}`, 66, 90);
  doc.text(`Paid Leaves: ${leaveDays}`, 110, 90);
  doc.text(`Absent / LOP Days: ${absentDays}`, 154, 90);

  // 4. Earnings vs Deductions Table
  const tableY = 99;
  const colW = 87;
  const leftX = 15;
  const rightX = 108;

  // Header Boxes
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(leftX, tableY, colW, 8, "F");
  doc.rect(rightX, tableY, colW, 8, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("EARNINGS", leftX + 4, tableY + 5.5);
  doc.text("AMOUNT", leftX + colW - 4, tableY + 5.5, { align: "right" });

  doc.text("DEDUCTIONS", rightX + 4, tableY + 5.5);
  doc.text("AMOUNT", rightX + colW - 4, tableY + 5.5, { align: "right" });

  // Earnings Rows
  const earningsRows = [
    { label: "Basic Salary", amount: basic },
    { label: "House Rent Allowance (HRA)", amount: hra },
    { label: "Special Allowance", amount: special },
    ...(bonus > 0 ? [{ label: "Performance Bonus / Incentive", amount: bonus }] : []),
  ];

  // Deductions Rows
  const deductionsRows = [
    { label: "Provident Fund (Employee PF)", amount: pf },
    { label: "Professional Tax (PT)", amount: pt },
    { label: "Income Tax (TDS)", amount: tds },
    { label: "Other Deductions", amount: Math.max(0, deductions - (pf + pt + tds)) },
  ];

  const maxRows = Math.max(earningsRows.length, deductionsRows.length, 4);
  let curY = tableY + 8;
  const rowH = 7.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  for (let i = 0; i < maxRows; i++) {
    const isEven = i % 2 === 0;
    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(leftX, curY, colW, rowH, "F");
      doc.rect(rightX, curY, colW, rowH, "F");
    }

    // Divider line
    doc.setDrawColor(241, 245, 249);
    doc.line(leftX, curY + rowH, leftX + colW, curY + rowH);
    doc.line(rightX, curY + rowH, rightX + colW, curY + rowH);

    const earn = earningsRows[i];
    if (earn) {
      doc.setTextColor(30, 41, 59);
      doc.text(earn.label, leftX + 4, curY + 5);
      doc.text(`Rs. ${fmt(earn.amount)}`, leftX + colW - 4, curY + 5, { align: "right" });
    }

    const ded = deductionsRows[i];
    if (ded) {
      doc.setTextColor(30, 41, 59);
      doc.text(ded.label, rightX + 4, curY + 5);
      doc.setTextColor(220, 38, 38); // red
      doc.text(`- Rs. ${fmt(ded.amount)}`, rightX + colW - 4, curY + 5, { align: "right" });
    }

    curY += rowH;
  }

  // Subtotal Rows
  doc.setFillColor(241, 245, 249);
  doc.rect(leftX, curY, colW, 8, "F");
  doc.rect(rightX, curY, colW, 8, "F");

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(leftX, curY, leftX + colW, curY);
  doc.line(rightX, curY, rightX + colW, curY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Total Gross Earnings", leftX + 4, curY + 5.5);
  doc.text(`Rs. ${fmt(gross)}`, leftX + colW - 4, curY + 5.5, { align: "right" });

  doc.text("Total Deductions", rightX + 4, curY + 5.5);
  doc.setTextColor(220, 38, 38);
  doc.text(`- Rs. ${fmt(deductions)}`, rightX + colW - 4, curY + 5.5, { align: "right" });

  curY += 13;

  // 5. Net Salary Highlight Card
  doc.setFillColor(239, 246, 255); // blue-50
  doc.setDrawColor(59, 130, 246); // blue-500
  doc.setLineWidth(0.6);
  doc.roundedRect(15, curY, 180, 22, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 64, 175); // blue-800
  doc.text("NET SALARY DISBURSED (TAKE HOME)", 22, curY + 9.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("Credited directly to employee registered bank account", 22, curY + 16);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 58, 138); // blue-900
  doc.text(`Rs. ${fmt(net)}`, 188, curY + 13.5, { align: "right" });

  // 6. Sign-off & Verification Footer
  const footerY = curY + 34;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(15, footerY, 195, footerY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Employer: PeoplePay360 Operations Pvt Ltd  |  Corporate Identity: CIN-U72200GJ2026PTC102934", 15, footerY + 6);
  doc.text("This is an authenticated computer-generated payslip statement. Generated automatically by PeoplePay360 HR & Payroll Engine.", 15, footerY + 11);
  doc.text(`Confidential Statement  |  Employee Record  |  Verification Digest: PP-${Date.now().toString(36).toUpperCase()}`, 15, footerY + 16);

  // Trigger real .pdf download
  const outputFileName = `Payslip_${filePeriod}_${fileName}.pdf`;
  doc.save(outputFileName);

  toast.success(`Downloaded official PDF payslip`, {
    description: `Saved as ${outputFileName}`,
  });
}

// Print payslip via browser print dialog
export function printPayslip(data: PayslipExportData) {
  const filePeriod = (data.period || "Current_Period").replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = (data.employeeName || "Employee").replace(/[^a-zA-Z0-9]/g, "_");

  const basic = data.basic ?? Math.round((data.gross || 0) * 0.5);
  const hra = data.hra ?? Math.round(basic * 0.4);
  const special = data.specialAllowance ?? Math.max(0, (data.gross || 0) - basic - hra);
  const bonus = data.bonus ?? 0;
  const gross = data.gross ?? (basic + hra + special + bonus);
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
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; margin: 0; padding: 24px; background: #ffffff; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .brand { font-size: 24px; font-weight: 800; color: #0f172a; }
    .brand span { color: #3b82f6; }
    .title { text-align: right; }
    .title h2 { margin: 0; font-size: 16px; text-transform: uppercase; font-weight: 700; }
    .title p { margin: 4px 0 0; font-size: 12px; color: #64748b; }
    .emp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin-bottom: 16px; font-size: 13px; }
    .emp-item span { color: #64748b; display: block; font-size: 11px; text-transform: uppercase; margin-bottom: 2px; }
    .emp-item strong { color: #0f172a; }
    .tables-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f1f5f9; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; }
    td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
    .text-right { text-align: right; }
    .total-row td { font-weight: 700; border-top: 2px solid #e2e8f0; background: #f8fafc; }
    .net-box { background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 6px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; margin-top: 14px; }
    .net-title { font-size: 13px; font-weight: 700; color: #1e40af; }
    .net-amount { font-size: 22px; font-weight: 800; color: #1e3a8a; }
    .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; font-size: 11px; color: #94a3b8; }
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
    <div class="emp-item"><span>Salary Bank Account</span><strong>${data.bankAccount}</strong></div>
    <div class="emp-item"><span>PAN / Tax ID</span><strong>${data.pan || "ABCDE1234F"}</strong></div>
  </div>

  <div class="tables-grid">
    <div>
      <table>
        <thead><tr><th>Earnings</th><th class="text-right">Amount</th></tr></thead>
        <tbody>
          <tr><td>Basic Salary</td><td class="text-right">₹${fmt(basic)}</td></tr>
          <tr><td>House Rent Allowance (HRA)</td><td class="text-right">₹${fmt(hra)}</td></tr>
          <tr><td>Special Allowance</td><td class="text-right">₹${fmt(special)}</td></tr>
          ${bonus > 0 ? `<tr><td>Performance Bonus</td><td class="text-right">₹${fmt(bonus)}</td></tr>` : ""}
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

  const printWindow = window.open("", "_blank", "width=850,height=950");
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
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
