import { toast } from "sonner";
import { inr } from "./mock-data";

export interface ContractExportData {
  id: string;
  employeeName: string;
  employeeCode?: string;
  department: string;
  designation?: string;
  contractType: string;
  startDate: string;
  endDate: string;
  salary: number;
  noticePeriodDays: number;
  terms?: string;
}

export function downloadContractPDF(data: ContractExportData) {
  const fileId = (data.id || "Contract").replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = (data.employeeName || "Employee").replace(/[^a-zA-Z0-9]/g, "_");

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Employment_Contract_${fileId}_${fileName}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; background: #ffffff; line-height: 1.5; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
    .brand { font-size: 26px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
    .brand span { color: #3b82f6; }
    .title { text-align: right; }
    .title h2 { margin: 0; font-size: 18px; color: #1e293b; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
    .title p { margin: 4px 0 0; font-size: 13px; color: #64748b; font-weight: 600; }
    .info-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 24px; font-size: 13px; }
    .info-item span { color: #64748b; display: block; font-size: 11px; text-transform: uppercase; font-weight: 600; margin-bottom: 2px; }
    .info-item strong { color: #0f172a; font-size: 14px; font-weight: 700; }
    .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #1e293b; margin: 20px 0 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    .terms-box { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; font-size: 13px; color: #334155; margin-bottom: 24px; }
    .salary-highlight { background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 8px; padding: 16px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .salary-title { font-size: 13px; font-weight: 700; color: #1e40af; text-transform: uppercase; }
    .salary-amount { font-size: 22px; font-weight: 800; color: #1e3a8a; }
    .sig-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 40px; margin-top: 48px; padding-top: 24px; border-top: 1px solid #e2e8f0; }
    .sig-box { text-align: center; }
    .sig-line { border-bottom: 1.5px dashed #94a3b8; height: 40px; margin-bottom: 8px; }
    .sig-label { font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; }
    .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">PeoplePay<span>360</span></div>
    <div class="title">
      <h2>Employment Agreement</h2>
      <p>Ref ID: ${data.id}</p>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-item"><span>Employee Name</span><strong>${data.employeeName} ${data.employeeCode ? `(${data.employeeCode})` : ""}</strong></div>
    <div class="info-item"><span>Agreement Type</span><strong>${data.contractType}</strong></div>
    <div class="info-item"><span>Department</span><strong>${data.department}</strong></div>
    <div class="info-item"><span>Notice Period</span><strong>${data.noticePeriodDays} Days</strong></div>
    <div class="info-item"><span>Effective Period</span><strong>${data.startDate} to ${data.endDate}</strong></div>
    <div class="info-item"><span>Status</span><strong>Active Execution</strong></div>
  </div>

  <div class="salary-highlight">
    <div class="salary-title">ANNUAL BASE COST TO COMPANY (CTC)</div>
    <div class="salary-amount">${inr(data.salary)} / year</div>
  </div>

  <div class="section-title">Terms & Covenants</div>
  <div class="terms-box">
    ${data.terms || "Standard employment contract with non-disclosure, intellectual property assignment, and enterprise governance compliance covenants."}
  </div>

  <div class="sig-grid">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Authorized Employer Signature</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Employee Signature & Acceptance</div>
    </div>
  </div>

  <div class="footer">
    PeoplePay360 HRMS · Confidential Employment Contract · Digitally Verified Document
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
  a.download = `Contract_${fileId}_${fileName}.html`;
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

  toast.success(`Downloaded contract for ${data.employeeName}`, {
    description: `Saved as file & opened PDF print window.`,
  });
}
