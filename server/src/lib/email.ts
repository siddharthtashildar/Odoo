import dotenv from "dotenv";
dotenv.config();
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import nodemailer from "nodemailer";
import fs from "node:fs";
import path from "node:path";

export interface CredentialsEmailPayload {
  to: string;
  employeeName: string;
  role: string;
  temporaryPassword: string;
  loginUrl: string;
}

// In-memory + persistent log of dispatched emails for audit & testing inspection
export interface DispatchedEmailRecord {
  id: string;
  to: string;
  subject: string;
  employeeName: string;
  role: string;
  temporaryPassword: string;
  sentAt: string;
  previewUrl?: string;
}

const AUDIT_FILE = path.join(__dirname, "../../dispatched-emails.json");

export function getDispatchedEmails(): DispatchedEmailRecord[] {
  try {
    if (fs.existsSync(AUDIT_FILE)) {
      const data = fs.readFileSync(AUDIT_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn("Failed to read dispatched-emails.json:", err);
  }
  return [];
}

export function recordDispatchedEmail(record: DispatchedEmailRecord) {
  try {
    const list = getDispatchedEmails();
    list.unshift(record);
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(list.slice(0, 100), null, 2), "utf-8");
  } catch (err) {
    console.warn("Failed to write to dispatched-emails.json:", err);
  }
}

export const emailAuditLog: DispatchedEmailRecord[] = getDispatchedEmails();

// ── Robust Unified Email Transport Helper ────────────────────────────────────
interface DeliverOptions {
  to: string;
  subject: string;
  html: string;
  defaultSender: string;
  employeeName?: string;
  idPrefix?: string;
}

async function deliverEmailCore(params: DeliverOptions): Promise<{
  delivered: boolean;
  messageId: string;
  previewUrl?: string;
  via: "smtp" | "ethereal";
}> {
  const { to, subject, html, defaultSender, employeeName = "Recipient", idPrefix = "msg" } = params;
  let messageId = `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  let previewUrl: string | undefined;
  let delivered = false;
  let via: "smtp" | "ethereal" = "smtp";

  // Dynamically re-read .env so any modifications by the user are immediately effective without needing a process restart
  try {
    const envPath = path.resolve(__dirname, "../../.env");
    if (fs.existsSync(envPath)) {
      const parsed = dotenv.parse(fs.readFileSync(envPath, "utf-8"));
      for (const k in parsed) {
        process.env[k] = parsed[k];
      }
    }
  } catch (envReadErr) {
    // Non-blocking fallback
  }

  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  const smtpPort = Number(process.env.SMTP_PORT || 465);

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const isGmail = smtpHost.includes("gmail") || smtpUser.includes("@gmail.com");
      const cleanPass = smtpPass.replace(/\s+/g, "");
      const transporter = isGmail
        ? nodemailer.createTransport({
            service: "gmail",
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
            auth: { user: smtpUser, pass: cleanPass },
          })
        : nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: process.env.SMTP_SECURE === "true" || smtpPort === 465,
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
            auth: { user: smtpUser, pass: smtpPass },
          });

      let fromAddress = process.env.EMAIL_FROM?.trim() || `"${defaultSender}" <${smtpUser}>`;
      // In Gmail, sender header must be authorized for smtpUser
      if (isGmail && !fromAddress.includes(smtpUser)) {
        fromAddress = `"${defaultSender}" <${smtpUser}>`;
      }

      const info = await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        html,
      });

      messageId = info.messageId;
      delivered = true;
      via = "smtp";
      console.log(`\n================================================================================`);
      console.log(`✉️  [REAL LIVE INBOX DELIVERY VIA GMAIL/SMTP]`);
      console.log(`To:                 ${employeeName} <${to}>`);
      console.log(`From:               ${fromAddress}`);
      console.log(`Subject:            ${subject}`);
      console.log(`Message ID:         ${messageId}`);
      console.log(`================================================================================\n`);
    } catch (smtpErr: any) {
      console.warn(`⚠️ [Email Service] Primary SMTP failed (${smtpErr?.message || smtpErr}). Switching to Ethereal live mailer fallback...`);
    }
  }

  // Automatic Fallback to Ethereal if primary SMTP not configured OR if primary SMTP failed (rate limits, bad pass, etc.)
  if (!delivered) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      const transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });

      const info = await transporter.sendMail({
        from: `"${defaultSender}" <notifications@peoplepay360.io>`,
        to,
        subject,
        html,
      });

      messageId = info.messageId;
      const testUrl = nodemailer.getTestMessageUrl(info);
      if (testUrl) previewUrl = testUrl;
      delivered = true;
      via = "ethereal";

      console.log(`\n================================================================================`);
      console.log(`✉️  [REALTIME EMAIL TRANSMISSION VIA ETHEREAL LIVE FALLBACK]`);
      console.log(`To:                 ${employeeName} <${to}>`);
      console.log(`Subject:            ${subject}`);
      console.log(`Message ID:         ${messageId}`);
      if (previewUrl) console.log(`🔗 Live Webmail:     ${previewUrl}`);
      console.log(`================================================================================\n`);
    } catch (mailErr) {
      console.error("⚠️ [Email Service] Ethereal fallback dispatch failed:", mailErr);
    }
  }

  return { delivered, messageId, previewUrl, via };
}

export async function sendCredentialsEmail(payload: CredentialsEmailPayload): Promise<{
  success: boolean;
  messageId: string;
  previewUrl?: string;
  temporaryPassword: string;
}> {
  const { to, employeeName, role, temporaryPassword, loginUrl } = payload;

  const roleLabels: Record<string, string> = {
    admin: "System Administrator",
    hr_manager: "HR Manager",
    payroll_manager: "Payroll Manager",
    payroll_user: "Payroll Specialist",
    it_asset_manager: "IT Asset Manager",
    employee: "Team Member / Employee",
  };

  const roleTitle = roleLabels[role] || role;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
        .header p { margin: 6px 0 0 0; opacity: 0.9; font-size: 14px; }
        .content { padding: 32px 24px; }
        .credential-box { background: #f1f5f9; border-left: 4px solid #4f46e5; border-radius: 6px; padding: 18px; margin: 24px 0; }
        .credential-item { margin: 8px 0; font-size: 15px; }
        .credential-label { font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; margin-bottom: 2px; }
        .credential-value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 16px; font-weight: 700; color: #0f172a; }
        .btn-wrapper { text-align: center; margin: 32px 0 16px; }
        .btn { display: inline-block; background: #4f46e5; color: #ffffff !important; padding: 12px 28px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.3); }
        .footer { padding: 20px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
        .note { font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>PeoplePay360</h1>
          <p>Welcome to your employee workspace</p>
        </div>
        <div class="content">
          <p style="font-size: 16px; margin-top: 0;">Hi <strong>${employeeName}</strong>,</p>
          <p style="color: #475569; line-height: 1.6;">Your official PeoplePay360 account has been provisioned by the HR department. You have been assigned the <strong>${roleTitle}</strong> role.</p>
          
          <div class="credential-box">
            <div class="credential-item">
              <span class="credential-label">Login Email</span>
              <span class="credential-value">${to}</span>
            </div>
            <div class="credential-item" style="margin-top: 14px;">
              <span class="credential-label">Temporary Password</span>
              <span class="credential-value">${temporaryPassword}</span>
            </div>
          </div>

          <div class="btn-wrapper">
            <a href="${loginUrl}" class="btn" target="_blank">Activate Account &amp; Set Password</a>
          </div>

          <p class="note">
            ⚠️ <strong>Security Notice:</strong> Please use your temporary password above to activate your account and establish your secure permanent password.
          </p>
        </div>
        <div class="footer">
          PeoplePay360 HR & Payroll Platform &bull; Human Resources Department &bull; Automated notification
        </div>
      </div>
    </body>
    </html>
  `;

  const delivery = await deliverEmailCore({
    to,
    subject: "Welcome to PeoplePay360 — Your Login Credentials",
    html: htmlContent,
    defaultSender: "PeoplePay360 HR",
    employeeName,
    idPrefix: "cred",
  });

  // Record in audit log
  const record: DispatchedEmailRecord = {
    id: delivery.messageId,
    to,
    subject: "Welcome to PeoplePay360 — Your Login Credentials",
    employeeName,
    role,
    temporaryPassword,
    sentAt: new Date().toISOString(),
    previewUrl: delivery.previewUrl,
  };
  emailAuditLog.unshift(record);
  recordDispatchedEmail(record);

  return {
    success: true,
    messageId: delivery.messageId,
    previewUrl: delivery.previewUrl,
    temporaryPassword,
  };
}

export interface PayslipEmailPayload {
  to: string;
  employeeName: string;
  period: string;
  gross: number;
  net: number;
  basic: number;
  allowances: number;
  deductions: number;
}

export async function sendPayslipEmail(payload: PayslipEmailPayload): Promise<{
  success: boolean;
  messageId: string;
  previewUrl?: string;
}> {
  const { to, employeeName, period, gross, net, basic, allowances, deductions } = payload;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
        .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px 24px; color: #ffffff; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 700; }
        .header p { margin: 4px 0 0; opacity: 0.8; font-size: 13px; }
        .content { padding: 24px; }
        .summary-card { background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0; }
        .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
        .total-net { border-top: 2px dashed #cbd5e1; padding-top: 10px; margin-top: 10px; font-weight: 700; color: #16a34a; font-size: 16px; }
        .footer { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>PeoplePay360 Payslip</h1>
          <p>Official Pay Statement for ${period}</p>
        </div>
        <div class="content">
          <p>Dear <strong>${employeeName}</strong>,</p>
          <p>Your payslip for the pay period <strong>${period}</strong> has been generated and approved for disbursement.</p>

          <div class="summary-card">
            <div class="row"><span>Gross Earnings:</span> <strong>₹${gross.toLocaleString("en-IN")}</strong></div>
            <div class="row"><span>Basic Salary:</span> <span>₹${basic.toLocaleString("en-IN")}</span></div>
            <div class="row"><span>Allowances:</span> <span>₹${allowances.toLocaleString("en-IN")}</span></div>
            <div class="row"><span>Total Deductions:</span> <span style="color: #dc2626;">- ₹${deductions.toLocaleString("en-IN")}</span></div>
            <div class="row total-net"><span>Net Salary Disbursed:</span> <span>₹${net.toLocaleString("en-IN")}</span></div>
          </div>

          <p style="font-size: 13px; color: #64748b;">You can view and download your full itemized payslip breakdown by signing into your PeoplePay360 workspace.</p>
        </div>
        <div class="footer">
          PeoplePay360 Finance & Payroll Team &bull; Confidential
        </div>
      </div>
    </body>
    </html>
  `;

  const delivery = await deliverEmailCore({
    to,
    subject: `Payslip Statement for ${period} — ${employeeName}`,
    html: htmlContent,
    defaultSender: "PeoplePay360 Payroll",
    employeeName,
    idPrefix: "slip",
  });

  const record: DispatchedEmailRecord = {
    id: delivery.messageId,
    to,
    subject: `Payslip Statement for ${period} — ${employeeName}`,
    employeeName,
    role: "employee",
    temporaryPassword: "N/A",
    sentAt: new Date().toISOString(),
    previewUrl: delivery.previewUrl,
  };
  emailAuditLog.unshift(record);
  recordDispatchedEmail(record);

  return { success: true, messageId: delivery.messageId, previewUrl: delivery.previewUrl };
}

// ── Generic Dispatch Helper ──────────────────────────────────────────────────
async function dispatchGenericEmail(params: {
  to: string;
  subject: string;
  html: string;
  employeeName: string;
  defaultSender?: string;
}): Promise<{ success: boolean; messageId: string; previewUrl?: string }> {
  const { to, subject, html, employeeName, defaultSender = "PeoplePay360 Operations" } = params;

  const delivery = await deliverEmailCore({
    to,
    subject,
    html,
    defaultSender,
    employeeName,
    idPrefix: "notif",
  });

  const record: DispatchedEmailRecord = {
    id: delivery.messageId,
    to,
    subject,
    employeeName,
    role: "employee",
    temporaryPassword: "N/A",
    sentAt: new Date().toISOString(),
    previewUrl: delivery.previewUrl,
  };
  emailAuditLog.unshift(record);
  recordDispatchedEmail(record);

  return { success: true, messageId: delivery.messageId, previewUrl: delivery.previewUrl };
}

// ── Asset Allotment Email Alert ──────────────────────────────────────────────
export interface AssetAllotmentPayload {
  to: string;
  employeeName: string;
  assetCode: string;
  assetType: string;
  serialNumber?: string;
  condition?: string;
  location?: string;
}

export async function sendAssetAllotmentEmail(payload: AssetAllotmentPayload) {
  const { to, employeeName, assetCode, assetType, serialNumber, condition, location } = payload;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
        .header { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 28px 24px; color: #ffffff; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 700; }
        .header p { margin: 4px 0 0; opacity: 0.9; font-size: 13px; }
        .content { padding: 24px; }
        .asset-card { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 18px; margin: 18px 0; }
        .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
        .footer { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
        .notice { font-size: 12px; color: #64748b; line-height: 1.5; margin-top: 16px; border-top: 1px dashed #cbd5e1; padding-top: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Company Asset Allotment</h1>
          <p>Official IT Hardware & Equipment Assignment</p>
        </div>
        <div class="content">
          <p>Hi <strong>${employeeName}</strong>,</p>
          <p>The following company asset has been officially allocated and registered under your custody in PeoplePay360:</p>

          <div class="asset-card">
            <div class="row"><span>Asset Description:</span> <strong>${assetType}</strong></div>
            <div class="row"><span>Asset Tag / Code:</span> <strong style="color: #0369a1; font-family: monospace;">${assetCode}</strong></div>
            ${serialNumber ? `<div class="row"><span>Serial Number:</span> <span style="font-family: monospace;">${serialNumber}</span></div>` : ""}
            <div class="row"><span>Condition:</span> <span style="text-transform: capitalize;">${condition || "Good"}</span></div>
            <div class="row"><span>Registered Location:</span> <span>${location || "HQ Operations"}</span></div>
          </div>

          <p class="notice">
            📌 <strong>Policy Notice:</strong> Please ensure the equipment is maintained securely and utilized strictly in accordance with company IT and security guidelines. In the event of damage or technical issues, raise an IT support ticket through your portal.
          </p>
        </div>
        <div class="footer">
          PeoplePay360 IT Asset Management &bull; Automated notification
        </div>
      </div>
    </body>
    </html>
  `;

  return dispatchGenericEmail({
    to,
    subject: `Company Asset Allocated — ${assetType} (${assetCode})`,
    html,
    employeeName,
  });
}

// ── Service Accounts Provisioned Email Alert ─────────────────────────────────
export interface ServiceAccountsPayload {
  to: string;
  employeeName: string;
  accounts: Array<{ serviceName: string; username?: string; password?: string }>;
}

export async function sendServiceAccountsEmail(payload: ServiceAccountsPayload) {
  const { to, employeeName, accounts } = payload;
  const listItems = accounts
    .map(
      (a) => `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <strong style="font-size: 15px; color: #0f172a;">${a.serviceName}</strong>
          <span style="background: #dcfce7; color: #15803d; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 9999px; text-transform: uppercase;">Active</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 4px 0; color: #64748b; width: 140px;">Username / Email:</td>
            <td style="padding: 4px 0;"><code style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px; color: #0f172a; font-family: monospace;">${a.username || to}</code></td>
          </tr>
          ${a.password ? `
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Temporary Password:</td>
            <td style="padding: 4px 0;"><code style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; padding: 2px 8px; border-radius: 4px; font-family: monospace; font-weight: 600;">${a.password}</code></td>
          </tr>
          ` : ""}
        </table>
      </div>
    `,
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
        .header { background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); padding: 28px 24px; color: #ffffff; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 700; }
        .header p { margin: 4px 0 0; opacity: 0.9; font-size: 13px; }
        .content { padding: 24px; }
        .footer { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Work Accounts &amp; Access Provisioned</h1>
          <p>Your Developer &amp; Collaboration Tool Access is Ready</p>
        </div>
        <div class="content">
          <p>Hi <strong>${employeeName}</strong>,</p>
          <p>Your checklist has cleared and HR has provisioned your official workspace tools and developer accounts:</p>

          <div style="margin: 20px 0;">
            ${listItems}
          </div>

          <p style="font-size: 13px; color: #475569; line-height: 1.6;">
            Invitations have been dispatched to your work email (<code style="background: #f1f5f9; padding: 2px 5px; border-radius: 4px;">${to}</code>). Please check your inbox to accept organization invites and configure Two-Factor Authentication (2FA).
          </p>
        </div>
        <div class="footer">
          PeoplePay360 IT Operations &bull; Automated notification
        </div>
      </div>
    </body>
    </html>
  `;

  return dispatchGenericEmail({
    to,
    subject: `Your Work Accounts are Ready (GitHub, Slack, etc.) — PeoplePay360`,
    html,
    employeeName,
  });
}

// ── Leave Status Email Alert ──────────────────────────────────────────────────
export interface LeaveStatusPayload {
  to: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: "approved" | "rejected";
  reason?: string;
}

export async function sendLeaveStatusEmail(payload: LeaveStatusPayload) {
  const { to, employeeName, leaveType, startDate, endDate, days, status, reason } = payload;
  const isApproved = status === "approved";
  const badgeColor = isApproved ? "#15803d" : "#b91c1c";
  const badgeBg = isApproved ? "#dcfce7" : "#fee2e2";
  const headerGradient = isApproved
    ? "linear-gradient(135deg, #15803d 0%, #16a34a 100%)"
    : "linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
        .header { background: ${headerGradient}; padding: 24px; color: #ffffff; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
        .content { padding: 24px; }
        .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; }
        .row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px; }
        .footer { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Leave Request ${isApproved ? "Approved" : "Rejected"}</h1>
        </div>
        <div class="content">
          <p>Hi <strong>${employeeName}</strong>,</p>
          <p>Your time-off request has been reviewed by your reporting manager:</p>

          <div class="box">
            <div class="row"><span>Leave Category:</span> <strong>${leaveType}</strong></div>
            <div class="row"><span>Dates:</span> <span>${startDate} to ${endDate}</span></div>
            <div class="row"><span>Duration:</span> <span>${days} day(s)</span></div>
            <div class="row"><span>Status:</span> <span style="background: ${badgeBg}; color: ${badgeColor}; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: capitalize;">${status}</span></div>
            ${reason ? `<div class="row" style="margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 8px;"><span>Reason / Note:</span> <span>${reason}</span></div>` : ""}
          </div>
        </div>
        <div class="footer">
          PeoplePay360 Time &amp; Attendance &bull; Automated notification
        </div>
      </div>
    </body>
    </html>
  `;

  return dispatchGenericEmail({
    to,
    subject: `Time-Off Request ${isApproved ? "Approved" : "Rejected"} — ${leaveType}`,
    html,
    employeeName,
  });
}

// ── Offboarding Completion Email Alert ────────────────────────────────────────
export interface OffboardingCompletionPayload {
  to: string;
  employeeName: string;
  lastWorkingDay: string;
}

export async function sendOffboardingCompletionEmail(payload: OffboardingCompletionPayload) {
  const { to, employeeName, lastWorkingDay } = payload;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
        .header { background: linear-gradient(135deg, #334155 0%, #1e293b 100%); padding: 28px 24px; color: #ffffff; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 700; }
        .content { padding: 24px; }
        .box { background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0; }
        .footer { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Exit Clearance &amp; Settlement Confirmation</h1>
          <p>Official Offboarding Completion Notice</p>
        </div>
        <div class="content">
          <p>Dear <strong>${employeeName}</strong>,</p>
          <p>All exit clearance requirements, asset returns, and full &amp; final settlement protocols have been completed as of your last working date (<strong>${lastWorkingDay}</strong>).</p>

          <div class="box">
            <p style="margin: 0; font-size: 14px; color: #334155;">
              ✓ Departmental sign-offs verified (IT, HR, Finance, Admin)<br>
              ✓ Corporate access revoked and hardware inventory accounted for<br>
              ✓ Full &amp; final payroll release queued
            </p>
          </div>

          <p style="font-size: 14px; color: #475569;">
            We thank you for your contributions to PeoplePay360 and wish you the best in your future endeavors.
          </p>
        </div>
        <div class="footer">
          PeoplePay360 Human Resources &bull; Official Record
        </div>
      </div>
    </body>
    </html>
  `;

  return dispatchGenericEmail({
    to,
    subject: `Exit Clearance & Settlement Confirmation — PeoplePay360`,
    html,
    employeeName,
  });
}

// ── Reimbursement Status Email Alert ──────────────────────────────────────────
export interface ReimbursementStatusPayload {
  to: string;
  employeeName: string;
  category: string;
  amount: number;
  approvedAmount?: number | null;
  status: "approved" | "rejected" | "paid";
  note?: string;
}

export async function sendReimbursementStatusEmail(payload: ReimbursementStatusPayload) {
  const { to, employeeName, category, amount, approvedAmount, status, note } = payload;
  const isPaid = status === "paid";
  const isApproved = status === "approved";
  const statusLabel = isPaid ? "Paid & Reimbursed" : isApproved ? "Approved" : "Rejected";
  const badgeBg = isPaid ? "#dbeafe" : isApproved ? "#dcfce7" : "#fee2e2";
  const badgeColor = isPaid ? "#1e40af" : isApproved ? "#15803d" : "#b91c1c";
  const headerGradient = isPaid
    ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
    : isApproved
    ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
    : "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
        .header { background: ${headerGradient}; padding: 24px; color: #ffffff; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
        .content { padding: 24px; }
        .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; }
        .row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px; }
        .footer { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Expense Claim ${statusLabel}</h1>
        </div>
        <div class="content">
          <p>Hi <strong>${employeeName}</strong>,</p>
          <p>Your reimbursement claim has been updated:</p>

          <div class="box">
            <div class="row"><span>Category:</span> <strong>${category}</strong></div>
            <div class="row"><span>Claimed Amount:</span> <span>₹${amount.toLocaleString("en-IN")}</span></div>
            ${approvedAmount !== null && approvedAmount !== undefined ? `<div class="row"><span>Approved Amount:</span> <strong>₹${approvedAmount.toLocaleString("en-IN")}</strong></div>` : ""}
            <div class="row"><span>Decision:</span> <span style="background: ${badgeBg}; color: ${badgeColor}; font-weight: 600; padding: 2px 8px; border-radius: 4px;">${statusLabel}</span></div>
            ${note ? `<div class="row" style="margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 8px;"><span>Reviewer Note:</span> <span>${note}</span></div>` : ""}
          </div>
        </div>
        <div class="footer">
          PeoplePay360 Finance &amp; Expense Processing &bull; Automated notification
        </div>
      </div>
    </body>
    </html>
  `;

  return dispatchGenericEmail({
    to,
    subject: `Expense Claim ${statusLabel} — ${category}`,
    html,
    employeeName,
    defaultSender: "PeoplePay360 Finance & Payroll",
  });
}

// ── Work Schedule Update Email Alert ─────────────────────────────────────────
export interface ScheduleUpdatePayload {
  to: string;
  employeeName: string;
  scheduleName: string;
  shiftType: string;
  startTime: string;
  endTime: string;
  workingDays: string[];
  dailyHours: number;
  weeklyHours: number;
  effectiveDate?: string;
}

export async function sendScheduleUpdateEmail(payload: ScheduleUpdatePayload) {
  const {
    to,
    employeeName,
    scheduleName,
    shiftType,
    startTime,
    endTime,
    workingDays,
    dailyHours,
    weeklyHours,
    effectiveDate,
  } = payload;

  const daysFormatted = workingDays.map((d) => d.slice(0, 3)).join(", ");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, #0d9488 0%, #0891b2 100%); padding: 28px 24px; color: #ffffff; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 700; }
        .header p { margin: 4px 0 0; opacity: 0.9; font-size: 13px; }
        .content { padding: 24px; }
        .schedule-card { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 18px; margin: 18px 0; }
        .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
        .footer { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
        .notice { font-size: 12px; color: #64748b; line-height: 1.5; margin-top: 16px; border-top: 1px dashed #cbd5e1; padding-top: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Work Schedule Updated</h1>
          <p>Official Shift &amp; Working Hours Notification</p>
        </div>
        <div class="content">
          <p>Hi <strong>${employeeName}</strong>,</p>
          <p>Your work shift schedule in PeoplePay360 has been updated by Operations &amp; HR${effectiveDate ? ` effective <strong>${effectiveDate}</strong>` : ""}:</p>

          <div class="schedule-card">
            <div class="row"><span>Schedule Plan:</span> <strong style="color: #0f766e;">${scheduleName}</strong></div>
            <div class="row"><span>Shift Type:</span> <span style="text-transform: capitalize; font-weight: 600;">${shiftType}</span></div>
            <div class="row"><span>Working Hours:</span> <strong style="font-family: monospace;">${startTime} — ${endTime}</strong></div>
            <div class="row"><span>Working Days:</span> <span>${daysFormatted || "Monday to Friday"}</span></div>
            <div class="row"><span>Daily Committed Hours:</span> <span>${dailyHours} hrs / day</span></div>
            <div class="row"><span>Weekly Committed Hours:</span> <strong>${weeklyHours} hrs / week</strong></div>
          </div>

          <p class="notice">
            ⏰ <strong>Attendance Note:</strong> Please ensure check-in and check-out punches align with your assigned shift schedule. Check your workspace portal for real-time calendar rosters.
          </p>
        </div>
        <div class="footer">
          PeoplePay360 Workforce Management &bull; Automated notification
        </div>
      </div>
    </body>
    </html>
  `;

  return dispatchGenericEmail({
    to,
    subject: `Work Schedule Updated — ${scheduleName} (${startTime} - ${endTime})`,
    html,
    employeeName,
    defaultSender: "PeoplePay360 Operations",
  });
}

// ── IT Helpdesk Email Alert ──────────────────────────────────────────────────
export interface HelpdeskUpdatePayload {
  to: string;
  employeeName: string;
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string;
  updateType: "created" | "status_updated" | "comment_added";
  status?: string;
  comment?: string;
  author?: string;
}

export async function sendHelpdeskUpdateEmail(payload: HelpdeskUpdatePayload) {
  const {
    to,
    employeeName,
    ticketNumber,
    subject,
    category,
    priority,
    updateType,
    status,
    comment,
    author,
  } = payload;

  const isCreated = updateType === "created";
  const isComment = updateType === "comment_added";
  const isStatus = updateType === "status_updated";

  const headerTitle = isCreated
    ? `Support Ticket Logged: ${ticketNumber}`
    : isComment
    ? `New Comment on ${ticketNumber}`
    : `Ticket Status Updated: ${ticketNumber}`;

  const headerSubtitle = isCreated
    ? "Your IT helpdesk request has been received"
    : isComment
    ? `Response added by ${author || "Support Engineer"}`
    : `Status marked as ${status || "Updated"}`;

  const headerGradient = isCreated
    ? "linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)"
    : isComment
    ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)"
    : "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { background: ${headerGradient}; padding: 24px; color: #ffffff; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
        .header p { margin: 4px 0 0; opacity: 0.9; font-size: 13px; }
        .content { padding: 24px; }
        .ticket-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; }
        .comment-box { background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 14px 18px; margin: 16px 0; }
        .row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px; }
        .footer { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${headerTitle}</h1>
          <p>${headerSubtitle}</p>
        </div>
        <div class="content">
          <p>Hi <strong>${employeeName}</strong>,</p>
          
          ${isCreated ? `<p>Your IT support ticket has been received and queued with our infrastructure &amp; technical services team.</p>` : ""}
          ${isStatus ? `<p>The status of your ticket has been updated to <strong>${status}</strong>.</p>` : ""}
          ${isComment ? `<p>A new comment was posted on your support ticket:</p>` : ""}

          <div class="ticket-box">
            <div class="row"><span>Ticket #:</span> <strong style="font-family: monospace; color: #2563eb;">${ticketNumber}</strong></div>
            <div class="row"><span>Subject:</span> <strong>${subject}</strong></div>
            <div class="row"><span>Category:</span> <span style="text-transform: capitalize;">${category}</span></div>
            <div class="row"><span>Priority:</span> <span style="text-transform: capitalize;">${priority}</span></div>
            ${status ? `<div class="row"><span>Current Status:</span> <strong style="text-transform: capitalize;">${status}</strong></div>` : ""}
          </div>

          ${comment ? `
            <div class="comment-box">
              <div style="font-size: 12px; font-weight: 700; color: #1e40af; margin-bottom: 4px;">Comment from ${author || "Support"}:</div>
              <div style="font-size: 14px; color: #1e293b; line-height: 1.5; white-space: pre-wrap;">${comment}</div>
            </div>
          ` : ""}

          <p style="font-size: 13px; color: #64748b; margin-top: 18px;">
            You can view details and reply directly inside your PeoplePay360 Helpdesk portal.
          </p>
        </div>
        <div class="footer">
          PeoplePay360 IT Helpdesk &bull; Automated notification
        </div>
      </div>
    </body>
    </html>
  `;

  return dispatchGenericEmail({
    to,
    subject: `[${ticketNumber}] ${headerTitle}: ${subject}`,
    html,
    employeeName,
    defaultSender: "PeoplePay360 IT Helpdesk",
  });
}

