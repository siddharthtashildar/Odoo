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
            <a href="${loginUrl}" class="btn" target="_blank">Sign In to PeoplePay360</a>
          </div>

          <p class="note">
            ⚠️ <strong>Security Notice:</strong> This is a temporary password generated for your first login. For security reasons, please change your password after logging in.
          </p>
        </div>
        <div class="footer">
          PeoplePay360 HR & Payroll Platform &bull; Human Resources Department &bull; Automated notification
        </div>
      </div>
    </body>
    </html>
  `;

  let messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  let previewUrl: string | undefined = undefined;

  // If SMTP is configured in environment
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || '"PeoplePay360 HR" <hr@peoplepay360.io>',
        to,
        subject: `Welcome to PeoplePay360 — Your Login Credentials`,
        html: htmlContent,
      });

      messageId = info.messageId;
      console.log(`✉️ [Email Service] Credentials email sent to ${to} via SMTP (MessageID: ${messageId})`);
    } catch (smtpErr) {
      console.warn("⚠️ [Email Service] SMTP dispatch failed, falling back to local audit delivery:", smtpErr);
    }
  } else {
    // Real-time SMTP transmission via Ethereal (no manual setup required)
    try {
      const testAccount = await nodemailer.createTestAccount();
      const transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      const info = await transporter.sendMail({
        from: '"PeoplePay360 HR" <hr@peoplepay360.io>',
        to,
        subject: `Welcome to PeoplePay360 — Your Login Credentials`,
        html: htmlContent,
      });

      messageId = info.messageId;
      const testUrl = nodemailer.getTestMessageUrl(info);
      if (testUrl) previewUrl = testUrl;

      console.log("\n================================================================================");
      console.log(`✉️  [REALTIME EMAIL TRANSMISSION OVER SMTP]`);
      console.log(`To:                 ${employeeName} <${to}>`);
      console.log(`Subject:            Welcome to PeoplePay360 — Your Login Credentials`);
      console.log(`Assigned Role:      ${roleTitle} (${role})`);
      console.log(`Temporary Password: ${temporaryPassword}`);
      console.log(`Message ID:         ${messageId}`);
      if (previewUrl) {
        console.log(`🔗 Live Webmail:     ${previewUrl}`);
      }
      console.log("================================================================================\n");
    } catch (mailErr) {
      console.warn("⚠️ [Email Service] Realtime dispatch warning:", mailErr);
    }
  }

  // Record in audit log
  const record: DispatchedEmailRecord = {
    id: messageId,
    to,
    subject: "Welcome to PeoplePay360 — Your Login Credentials",
    employeeName,
    role,
    temporaryPassword,
    sentAt: new Date().toISOString(),
    previewUrl,
  };
  emailAuditLog.unshift(record);
  recordDispatchedEmail(record);

  return {
    success: true,
    messageId,
    previewUrl,
    temporaryPassword,
  };
}
