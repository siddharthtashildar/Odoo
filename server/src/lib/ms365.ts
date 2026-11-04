import crypto from "node:crypto";
import { prisma } from "./prisma";
import { sendMicrosoftCredentialsEmail } from "./email";

const GRAPH = "https://graph.microsoft.com/v1.0";
const OUTLOOK_URL = "https://outlook.office.com/";

export type MicrosoftProvisionResult = {
  enabled: boolean;
  upn: string | null;
  microsoftUserId: string | null;
  accountStatus: string;
  licenseStatus: string;
  mailboxStatus: string;
  credentialEmailStatus: string;
  lastError: string | null;
  temporaryPassword?: string;
  outlookUrl: string;
};

type TokenCache = { accessToken: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

function isEnabled() {
  return (
    process.env.MS365_ENABLED === "true" &&
    !!process.env.MS365_TENANT_ID &&
    !!process.env.MS365_CLIENT_ID &&
    !!process.env.MS365_CLIENT_SECRET &&
    !!process.env.MS365_DOMAIN &&
    !!process.env.MS365_SKU_ID
  );
}

function graphErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const err = (payload as { error?: { message?: string; code?: string } }).error;
    if (err?.message) return err.message;
    if (err?.code) return err.code;
  }
  return fallback;
}

export function splitPersonName(fullName: string, firstName?: string, lastName?: string) {
  if (firstName?.trim() && lastName?.trim()) {
    return { givenName: firstName.trim(), surname: lastName.trim() };
  }
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const givenName = parts[0] || "Employee";
  const surname = parts.slice(1).join(" ") || givenName;
  return { givenName, surname };
}

export function slugNamePart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 40);
}

export function generateMicrosoftPassword() {
  const raw = crypto.randomBytes(12).toString("base64url");
  return `Pp360!${raw}Aa1`;
}

async function getAccessToken() {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }
  const tenant = process.env.MS365_TENANT_ID!;
  const body = new URLSearchParams({
    client_id: process.env.MS365_CLIENT_ID!,
    client_secret: process.env.MS365_CLIENT_SECRET!,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || "Invalid Microsoft client credentials.");
  }
  tokenCache = {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return tokenCache.accessToken;
}

async function graph<T>(path: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  return { ok: res.ok, status: res.status, json: json as T };
}

export async function findGraphUser(upn: string) {
  const encoded = encodeURIComponent(upn);
  const { ok, status, json } = await graph<{ id?: string; userPrincipalName?: string }>(`/users/${encoded}`);
  if (status === 404) return null;
  if (!ok) throw new Error(graphErrorMessage(json, "Failed to look up Microsoft user."));
  return json.id ? json : null;
}

async function checkMailboxReady(userId: string) {
  const { ok, status } = await graph(`/users/${userId}/mailboxSettings`);
  if (ok) return true;
  if (status === 404 || status === 400) return false;
  return false;
}

async function upsertRecord(employeeId: string, data: Record<string, unknown>) {
  return prisma.employee_microsoft_accounts.upsert({
    where: { employee_id: employeeId },
    create: { employee_id: employeeId, ...data },
    update: { ...data, updated_at: new Date() },
  });
}

function toResult(row: {
  upn: string | null;
  microsoft_user_id: string | null;
  account_status: string;
  license_status: string;
  mailbox_status: string;
  credential_email_status: string;
  last_error: string | null;
}, extra?: Partial<MicrosoftProvisionResult>): MicrosoftProvisionResult {
  return {
    enabled: true,
    upn: row.upn,
    microsoftUserId: row.microsoft_user_id,
    accountStatus: row.account_status,
    licenseStatus: row.license_status,
    mailboxStatus: row.mailbox_status,
    credentialEmailStatus: row.credential_email_status,
    lastError: row.last_error,
    outlookUrl: OUTLOOK_URL,
    ...extra,
  };
}

export async function provisionMicrosoftAccount(params: {
  employeeId: string;
  fullName: string;
  personalEmail?: string | null;
  firstName?: string;
  lastName?: string;
  sendCredentialEmail?: boolean;
}): Promise<MicrosoftProvisionResult> {
  if (!isEnabled()) {
    return {
      enabled: false,
      upn: null,
      microsoftUserId: null,
      accountStatus: "skipped",
      licenseStatus: "skipped",
      mailboxStatus: "skipped",
      credentialEmailStatus: "skipped",
      lastError: "Microsoft 365 provisioning is disabled or incomplete in server/.env.",
      outlookUrl: OUTLOOK_URL,
    };
  }

  const existing = await prisma.employee_microsoft_accounts.findUnique({
    where: { employee_id: params.employeeId },
  });

  const { givenName, surname } = splitPersonName(params.fullName, params.firstName, params.lastName);
  const firstSlug = slugNamePart(givenName) || "employee";
  const lastSlug = slugNamePart(surname) || "user";
  const domain = process.env.MS365_DOMAIN!;
  const usageLocation = process.env.MS365_USAGE_LOCATION || "IN";
  const skuId = process.env.MS365_SKU_ID!;

  let microsoftUserId = existing?.microsoft_user_id ?? null;
  let upn = existing?.upn ?? null;
  let accountStatus = existing?.account_status ?? "pending";
  let licenseStatus = existing?.license_status ?? "pending";
  let mailboxStatus = existing?.mailbox_status ?? "pending";
  let credentialEmailStatus = existing?.credential_email_status ?? "pending";
  let lastError: string | null = null;
  let temporaryPassword: string | undefined;

  try {
    if (!microsoftUserId) {
      let nickname = `${firstSlug}.${lastSlug}`;
      let created = false;
      for (let i = 0; i < 30 && !created; i++) {
        const candidate = i === 0 ? nickname : `${firstSlug}.${lastSlug}${i + 1}`;
        const candidateUpn = `${candidate}@${domain}`;
        const found = await findGraphUser(candidateUpn);
        if (found?.id) {
          if (existing?.upn === candidateUpn) {
            microsoftUserId = found.id;
            upn = candidateUpn;
            accountStatus = "created";
            created = true;
            break;
          }
          continue;
        }
        temporaryPassword = generateMicrosoftPassword();
        const createRes = await graph<{ id?: string }>(`/users`, {
          method: "POST",
          body: JSON.stringify({
            accountEnabled: true,
            displayName: `${givenName} ${surname}`.trim(),
            givenName,
            surname,
            mailNickname: candidate,
            userPrincipalName: candidateUpn,
            usageLocation,
            passwordProfile: {
              forceChangePasswordNextSignIn: true,
              password: temporaryPassword,
            },
          }),
        });
        if (createRes.ok && createRes.json.id) {
          microsoftUserId = createRes.json.id;
          upn = candidateUpn;
          accountStatus = "created";
          created = true;
          break;
        }
        const msg = graphErrorMessage(createRes.json, "Failed to create Microsoft user.");
        if (/already exists|another object with the same value/i.test(msg)) continue;
        throw new Error(msg);
      }
      if (!microsoftUserId || !upn) {
        throw new Error("Could not allocate a unique Microsoft email (UPN).");
      }
      await upsertRecord(params.employeeId, {
        microsoft_user_id: microsoftUserId,
        upn,
        account_status: "created",
        license_status: licenseStatus,
        mailbox_status: mailboxStatus,
        credential_email_status: credentialEmailStatus,
        last_error: null,
        provisioned_at: new Date(),
      });
    }

    if (microsoftUserId && licenseStatus !== "assigned") {
      const lic = await graph(`/users/${microsoftUserId}/assignLicense`, {
        method: "POST",
        body: JSON.stringify({
          addLicenses: [{ skuId }],
          removeLicenses: [],
        }),
      });
      if (!lic.ok) {
        const msg = graphErrorMessage(lic.json, "Failed to assign Microsoft license.");
        licenseStatus = "failed";
        lastError = /license/i.test(msg) ? `No licenses available: ${msg}` : msg;
        await upsertRecord(params.employeeId, {
          microsoft_user_id: microsoftUserId,
          upn,
          account_status: accountStatus,
          license_status: licenseStatus,
          mailbox_status: mailboxStatus,
          credential_email_status: credentialEmailStatus,
          last_error: lastError,
        });
      } else {
        licenseStatus = "assigned";
        mailboxStatus = "provisioning";
        await upsertRecord(params.employeeId, {
          microsoft_user_id: microsoftUserId,
          upn,
          account_status: accountStatus,
          license_status: licenseStatus,
          mailbox_status: mailboxStatus,
          last_error: null,
        });
      }
    }

    if (microsoftUserId && licenseStatus === "assigned" && mailboxStatus !== "ready") {
      const ready = await checkMailboxReady(microsoftUserId);
      mailboxStatus = ready ? "ready" : "provisioning";
      await upsertRecord(params.employeeId, { mailbox_status: mailboxStatus });
    }

    if (accountStatus === "created" && temporaryPassword && params.sendCredentialEmail !== false) {
      const personal = params.personalEmail?.trim();
      if (!personal) {
        credentialEmailStatus = "shown_to_hr";
      } else {
        const mail = await sendMicrosoftCredentialsEmail({
          to: personal,
          employeeName: params.fullName,
          workEmail: upn!,
          temporaryPassword,
          loginUrl: OUTLOOK_URL,
        });
        credentialEmailStatus = mail.success ? "sent" : "failed";
        if (!mail.success) lastError = mail.error || "Credential email delivery failed.";
      }
      await upsertRecord(params.employeeId, {
        credential_email_status: credentialEmailStatus,
        last_error: lastError,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Microsoft Graph request failed.";
    lastError = message;
    if (accountStatus !== "created") accountStatus = "failed";
    await upsertRecord(params.employeeId, {
      microsoft_user_id: microsoftUserId,
      upn,
      account_status: accountStatus,
      license_status: licenseStatus,
      mailbox_status: mailboxStatus,
      credential_email_status: credentialEmailStatus,
      last_error: lastError,
    });
  }

  const row = await prisma.employee_microsoft_accounts.findUnique({ where: { employee_id: params.employeeId } });
  if (!row) {
    return {
      enabled: true,
      upn,
      microsoftUserId,
      accountStatus,
      licenseStatus,
      mailboxStatus,
      credentialEmailStatus,
      lastError,
      temporaryPassword,
      outlookUrl: OUTLOOK_URL,
    };
  }
  return toResult(row, {
    temporaryPassword: credentialEmailStatus === "shown_to_hr" || credentialEmailStatus === "failed" ? temporaryPassword : undefined,
  });
}

export function mapMicrosoftRow(row: {
  upn: string | null;
  microsoft_user_id: string | null;
  account_status: string;
  license_status: string;
  mailbox_status: string;
  credential_email_status: string;
  last_error: string | null;
} | null) {
  if (!row) return null;
  return toResult(row);
}
