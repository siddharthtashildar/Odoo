/**
 * ip-attendance.ts
 * Utilities for automatic IP-based attendance tracking.
 * All IP detection is server-side — never trust client-provided IPs.
 */

import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "./prisma";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RequestLike =
  | {
    headers?: Record<string, string | string[] | undefined>;
    socket?: { remoteAddress?: string };
  }
  | string;

export interface ResolvedClientIp {
  ip: string | null;
  source: string;
  isReliable: boolean;
  uncertainReason?: string;
}

export type AttendanceCheckResult =
  | {
    allowed: true;
    status: "present" | "late";
    shiftStart: string;
    gracePeriod: number;
    detectedIp: string;
    source: string;
  }
  | {
    allowed: false;
    reason: string;
    detectedIp: string;
    source: string;
  };

export type CheckInResult =
  | {
    success: true;
    action: "checked_in" | "already_checked_in";
    status: "present" | "late";
    detectedIp: string;
    recordId: string;
  }
  | { success: false; reason: string; detectedIp: string };

export type CheckOutResult =
  | {
    success: true;
    action: "checked_out" | "already_checked_out" | "no_record";
    workingHours: number;
    overtimeHours: number;
    detectedIp: string;
  }
  | { success: false; reason: string; detectedIp: string };

// ── Debug Logger ──────────────────────────────────────────────────────────────

function logAttendanceDecision(info: {
  action: "CHECK-IN" | "CHECK-OUT" | "ELIGIBILITY";
  detectedIp: string | null;
  source: string;
  configuredAllowedIps: string;
  comparisonResult: string;
  decision: "ACCEPTED" | "REJECTED";
  reason: string;
}) {
  console.log("─────────────────────────────────────────────────────────────────");
  console.log(`[IP-Attendance] ${info.action} Verification`);
  console.log(`  • Actual Detected Client IP : ${info.detectedIp ?? "(unavailable / uncertain)"}`);
  console.log(`  • IP Detection Source       : ${info.source}`);
  console.log(`  • Configured Allowed IPs    : ${info.configuredAllowedIps || "(none configured)"}`);
  console.log(`  • IP Comparison Result      : ${info.comparisonResult}`);
  console.log(`  • Decision                  : ${info.decision}`);
  console.log(`  • Reason                    : ${info.reason}`);
  console.log("─────────────────────────────────────────────────────────────────");
}

// ── Env & Configuration Helpers ───────────────────────────────────────────────

function isValidIpv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d+$/.test(p)) return false;
    const n = Number(p);
    return n >= 0 && n <= 255 && (p === "0" || !p.startsWith("0"));
  });
}

function isValidIpv6(ip: string): boolean {
  return ip.includes(":") && /^[0-9a-fA-F:]+$/.test(ip);
}

function isValidIpOrCidr(item: string): boolean {
  if (item.includes("/")) {
    const [network = "", bits = ""] = item.split("/");
    if (!network || !bits || !/^\d+$/.test(bits)) return false;
    const prefix = parseInt(bits, 10);
    if (isValidIpv4(network)) return prefix >= 0 && prefix <= 32;
    if (isValidIpv6(network)) return prefix >= 0 && prefix <= 128;
    return false;
  }
  return isValidIpv4(item) || isValidIpv6(item);
}

export function getAllowedCidrs(): { cidrs: string[]; raw: string; error?: string } {
  let raw: string | undefined = process.env["ATTENDANCE_ALLOWED_IPS"];

  if (raw === undefined) {
    try {
      const envPath = path.resolve(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        const match = content.match(/^ATTENDANCE_ALLOWED_IPS\s*=\s*([^\r\n]*)/m);
        if (match && match[1]) {
          raw = match[1].split("#")[0]?.trim().replace(/^["']|["']$/g, "").trim();
        }
      }
    } catch {
      // ignore read error
    }
  }

  const cleanRaw = (raw ?? "").split("#")[0]?.trim().replace(/^["']|["']$/g, "").trim() ?? "";

  if (!cleanRaw) {
    return {
      cidrs: [],
      raw: "",
      error: "ATTENDANCE_ALLOWED_IPS is not set or empty in environment",
    };
  }

  const parts = cleanRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const validCidrs: string[] = [];
  for (const part of parts) {
    if (isValidIpOrCidr(part)) {
      validCidrs.push(part);
    }
  }

  if (validCidrs.length === 0) {
    return {
      cidrs: [],
      raw: cleanRaw,
      error: `ATTENDANCE_ALLOWED_IPS ("${cleanRaw}") contains no valid IPv4/IPv6 addresses or CIDR blocks`,
    };
  }

  return { cidrs: validCidrs, raw: cleanRaw };
}

function getAllowedUntil(): { date: Date | null; raw: string; isExpired: boolean } {
  let raw: string | undefined = process.env["ATTENDANCE_ALLOWED_UNTIL"];
  if (raw === undefined) {
    try {
      const envPath = path.resolve(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        const match = content.match(/^ATTENDANCE_ALLOWED_UNTIL\s*=\s*([^\r\n]*)/m);
        if (match && match[1]) {
          raw = match[1].split("#")[0]?.trim().replace(/^["']|["']$/g, "").trim();
        }
      }
    } catch {
      // ignore
    }
  }

  const cleanRaw = (raw ?? "").split("#")[0]?.trim().replace(/^["']|["']$/g, "").trim() ?? "";
  if (!cleanRaw) return { date: null, raw: "", isExpired: false };
  const d = new Date(cleanRaw);
  if (isNaN(d.getTime())) return { date: null, raw: cleanRaw, isExpired: false };
  return { date: d, raw: cleanRaw, isExpired: new Date() > d };
}

function getTimezone(): string {
  return process.env["ATTENDANCE_TIMEZONE"] ?? "Asia/Kolkata";
}

function getLateGraceMinutes(): number {
  const raw = process.env["ATTENDANCE_LATE_GRACE_MINUTES"] ?? "15";
  const n = parseInt(raw, 10);
  return isNaN(n) ? 15 : n;
}

// ── IP Extraction & Distinction ───────────────────────────────────────────────

const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^::1$/,
  /^fc00:/i,
  /^fd/i,
  /^fe80:/i,
  /^0\.0\.0\.0$/,
];

export function isPrivateOrLoopback(ip: string): boolean {
  const stripped = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  return PRIVATE_RANGES.some((r) => r.test(stripped));
}

// Short cache for localhost ipify lookup (2 seconds only) so switching Wi-Fi is detected immediately
let _cachedLocalhostPublicIp: string | null = null;
let _cachedAt = 0;
const LOCALHOST_CACHE_TTL_MS = 2000;

function fetchPublicIp(): Promise<string> {
  return new Promise((resolve, reject) => {
    const makeRequest = (useHttps: boolean) => {
      const mod = useHttps ? https : http;
      const url = useHttps ? "https://api.ipify.org" : "http://api.ipify.org";
      const req = mod.get(url, { timeout: 3000 }, (res) => {
        let data = "";
        res.on("data", (c: Buffer) => (data += c.toString()));
        res.on("end", () => resolve(data.trim()));
      });
      req.on("error", (e) => {
        if (useHttps) {
          makeRequest(false);
        } else {
          reject(e);
        }
      });
      req.on("timeout", () => {
        req.destroy();
        if (useHttps) {
          makeRequest(false);
        } else {
          reject(new Error("ipify timeout"));
        }
      });
    };
    makeRequest(true);
  });
}

/**
 * Resolves the genuine client IP from the request.
 * - Genuine localhost requests query the laptop's public IP (ipify).
 * - Reverse-proxied requests extract the client's public IP from trusted headers (cf-connecting-ip, x-real-ip, x-forwarded-for).
 * - Direct public socket connections use socket.remoteAddress directly.
 * - Never uses the hosting server's outbound public IP for remote/private requests.
 * - Rejects uncertain or unverifiable client IPs.
 */
export async function resolveClientIp(reqLike: RequestLike): Promise<ResolvedClientIp> {
  // 1. Direct IP string passed (e.g. from tests or mock)
  if (typeof reqLike === "string") {
    const stripped = reqLike.trim().replace(/^::ffff:/, "");

    // If explicit public IP passed
    if (!isPrivateOrLoopback(stripped) && (isValidIpv4(stripped) || isValidIpv6(stripped))) {
      return {
        ip: stripped,
        source: "explicit IP input",
        isReliable: true,
      };
    }

    // Localhost loopback string -> lookup laptop public IP
    if (stripped === "127.0.0.1" || stripped === "::1" || stripped === "localhost") {
      const now = Date.now();
      if (_cachedLocalhostPublicIp && now - _cachedAt < LOCALHOST_CACHE_TTL_MS) {
        return {
          ip: _cachedLocalhostPublicIp,
          source: "localhost loopback (cached laptop public IP)",
          isReliable: true,
        };
      }
      try {
        const pub = await fetchPublicIp();
        if (pub && (isValidIpv4(pub) || isValidIpv6(pub))) {
          _cachedLocalhostPublicIp = pub;
          _cachedAt = now;
          return {
            ip: pub,
            source: "localhost loopback (resolved laptop public IP via ipify)",
            isReliable: true,
          };
        }
      } catch {
        // failed
      }
      return {
        ip: null,
        source: "localhost loopback",
        isReliable: false,
        uncertainReason: "Unable to detect public IP of local machine (ipify lookup failed or offline)",
      };
    }

    // Private IP string without context
    return {
      ip: null,
      source: `private IP string (${stripped})`,
      isReliable: false,
      uncertainReason: `Cannot reliably determine public client IP from private LAN address (${stripped})`,
    };
  }

  // 2. Express Request object
  const peerRaw = reqLike.socket?.remoteAddress ?? "";
  const peer = peerRaw.trim().replace(/^::ffff:/, "");

  // If the direct connection came from an external public IP:
  // Client connected directly to our server over the internet.
  // Do NOT blindly trust arbitrary client-sent X-Forwarded-For headers!
  if (peer && !isPrivateOrLoopback(peer) && (isValidIpv4(peer) || isValidIpv6(peer))) {
    return {
      ip: peer,
      source: `direct socket connection (remoteAddress: ${peer})`,
      isReliable: true,
    };
  }

  // Peer is loopback or private (e.g. 127.0.0.1, ::1, 10.x, 172.x, 192.168.x)
  // Check if there is a reverse proxy header (Cloudflare, Nginx, ALB)
  const headers = reqLike.headers || {};
  let proxyCandidate: string | null = null;
  let proxyHeaderName = "";

  const cf = headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf.trim()) {
    proxyCandidate = cf.trim().replace(/^::ffff:/, "");
    proxyHeaderName = "cf-connecting-ip";
  } else {
    const xReal = headers["x-real-ip"];
    if (typeof xReal === "string" && xReal.trim()) {
      proxyCandidate = xReal.trim().replace(/^::ffff:/, "");
      proxyHeaderName = "x-real-ip";
    } else {
      const xff = headers["x-forwarded-for"];
      if (typeof xff === "string" && xff.trim()) {
        const first = xff.split(",")[0]?.trim().replace(/^::ffff:/, "");
        if (first) {
          proxyCandidate = first;
          proxyHeaderName = "x-forwarded-for";
        }
      }
    }
  }

  // If a reverse proxy header is present:
  if (proxyCandidate && (isValidIpv4(proxyCandidate) || isValidIpv6(proxyCandidate))) {
    if (!isPrivateOrLoopback(proxyCandidate)) {
      // Valid public client IP passed by trusted proxy
      return {
        ip: proxyCandidate,
        source: `reverse proxy header (${proxyHeaderName}: ${proxyCandidate} via peer ${peer || "loopback"})`,
        isReliable: true,
      };
    }
  }

  // If peer is loopback (127.0.0.1, ::1, empty) and no external proxy header:
  // This is genuine local development on localhost
  const isLoopback = peer === "127.0.0.1" || peer === "::1" || peer === "" || peer === "localhost";
  if (isLoopback) {
    const now = Date.now();
    if (_cachedLocalhostPublicIp && now - _cachedAt < LOCALHOST_CACHE_TTL_MS) {
      return {
        ip: _cachedLocalhostPublicIp,
        source: "genuine localhost (cached laptop public IP)",
        isReliable: true,
      };
    }
    try {
      const pub = await fetchPublicIp();
      if (pub && (isValidIpv4(pub) || isValidIpv6(pub))) {
        _cachedLocalhostPublicIp = pub;
        _cachedAt = now;
        return {
          ip: pub,
          source: "genuine localhost (laptop public IP resolved via ipify)",
          isReliable: true,
        };
      }
    } catch {
      // ipify failed
    }
    return {
      ip: null,
      source: `genuine localhost (${peer || "127.0.0.1"})`,
      isReliable: false,
      uncertainReason: "Unable to detect public IP of local machine (ipify lookup failed or offline)",
    };
  }

  // Peer is a private LAN address (e.g. 192.168.x.x, 10.x.x.x) and no public proxy header exists.
  // NEVER use the hosting server's outbound public IP!
  return {
    ip: null,
    source: `private network connection (${peer}) without public proxy header`,
    isReliable: false,
    uncertainReason: `Request arrived from private LAN address (${peer}). Client public IP cannot be determined reliably without a trusted reverse proxy.`,
  };
}

// ── CIDR Matching ─────────────────────────────────────────────────────────────

function ipToInt(ip: string): number {
  return ip
    .split(".")
    .reduce((acc, octet) => (acc << 8) | parseInt(octet, 10), 0) >>> 0;
}

export function matchesCidr(ip: string, cidr: string): boolean {
  const cleanIp = ip.trim();
  const cleanCidr = cidr.trim();

  // Exact IP match (handles plain IPv4 or IPv6)
  if (cleanIp.toLowerCase() === cleanCidr.toLowerCase()) {
    return true;
  }

  // CIDR mask matching
  if (cleanCidr.includes("/")) {
    const [network = "", bits = ""] = cleanCidr.split("/");
    const prefixLen = parseInt(bits, 10);
    if (isNaN(prefixLen)) return false;

    // IPv4 CIDR matching
    if (isValidIpv4(cleanIp) && isValidIpv4(network)) {
      if (prefixLen < 0 || prefixLen > 32) return false;
      const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
      return (ipToInt(cleanIp) & mask) === (ipToInt(network) & mask);
    }

    // IPv6 CIDR matching
    if (isValidIpv6(cleanIp) && isValidIpv6(network)) {
      if (prefixLen < 0 || prefixLen > 128) return false;
      return cleanIp.toLowerCase().startsWith(network.toLowerCase());
    }
  }

  return false;
}

// ── Shift & Late Logic ────────────────────────────────────────────────────────

async function getEmployeeSchedule(
  employeeId: string
): Promise<{ startTime: string; dailyHours: number }> {
  try {
    const assignedRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT s.start_time, s.daily_hours FROM work_schedules s
       JOIN employee_schedules es ON s.id = es.schedule_id
       WHERE es.employee_id = $1::uuid LIMIT 1;`,
      employeeId
    );
    if (assignedRows && assignedRows[0]) {
      return {
        startTime: assignedRows[0].start_time || "09:00",
        dailyHours: Number(assignedRows[0].daily_hours || 8),
      };
    }
    const defaultRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT start_time, daily_hours FROM work_schedules WHERE is_default = true LIMIT 1;`
    );
    if (defaultRows && defaultRows[0]) {
      return {
        startTime: defaultRows[0].start_time || "09:00",
        dailyHours: Number(defaultRows[0].daily_hours || 8),
      };
    }
  } catch {
    // default
  }
  return { startTime: "09:00", dailyHours: 8 };
}

function shiftTimeToday(timeStr: string, tz: string): Date {
  const nowInTz = new Date(
    new Date().toLocaleString("en-US", { timeZone: tz })
  );
  const [hStr = "09", mStr = "00"] = timeStr.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const result = new Date(nowInTz);
  result.setHours(h, m, 0, 0);
  return result;
}

// ── Main Eligibility Check ────────────────────────────────────────────────────

export async function checkAttendanceEligibility(
  reqLike: RequestLike,
  employeeId: string,
  options?: { isCheckout?: boolean }
): Promise<AttendanceCheckResult> {
  const isCheckout = options?.isCheckout ?? false;
  const actionLabel = isCheckout ? "CHECK-OUT" : "CHECK-IN";

  // 1. Check ATTENDANCE_ALLOWED_IPS configuration
  const config = getAllowedCidrs();
  if (config.error || config.cidrs.length === 0) {
    const reason = config.error || "ATTENDANCE_ALLOWED_IPS is not set or empty in environment";
    logAttendanceDecision({
      action: actionLabel,
      detectedIp: null,
      source: "N/A",
      configuredAllowedIps: config.raw,
      comparisonResult: "CONFIG_ERROR",
      decision: "REJECTED",
      reason,
    });
    return {
      allowed: false,
      reason,
      detectedIp: "unknown",
      source: "N/A",
    };
  }

  // 2. Check ATTENDANCE_ALLOWED_UNTIL expiration
  const until = getAllowedUntil();
  if (until.isExpired) {
    const reason = `Attendance IP policy has expired (expired at ${until.date?.toISOString()})`;
    logAttendanceDecision({
      action: actionLabel,
      detectedIp: null,
      source: "N/A",
      configuredAllowedIps: config.raw,
      comparisonResult: "POLICY_EXPIRED",
      decision: "REJECTED",
      reason,
    });
    return {
      allowed: false,
      reason,
      detectedIp: "unknown",
      source: "N/A",
    };
  }

  // 3. Detect actual client IP
  const detection = await resolveClientIp(reqLike);
  const detectedIp = detection.ip;
  const source = detection.source;

  if (!detection.isReliable || !detectedIp) {
    const reason = detection.uncertainReason || "Client IP could not be determined reliably";
    logAttendanceDecision({
      action: actionLabel,
      detectedIp: null,
      source,
      configuredAllowedIps: config.raw,
      comparisonResult: "UNCERTAIN_IP",
      decision: "REJECTED",
      reason,
    });
    return {
      allowed: false,
      reason: `Automatic attendance skipped: ${reason}`,
      detectedIp: "uncertain",
      source,
    };
  }

  // 4. Compare detected IP against configured allowlist
  const isMatched = config.cidrs.some((cidr) => matchesCidr(detectedIp, cidr));

  if (!isMatched) {
    const reason = `Detected client IP (${detectedIp}) does not match allowed IP(s): ${config.raw}`;
    logAttendanceDecision({
      action: actionLabel,
      detectedIp,
      source,
      configuredAllowedIps: config.raw,
      comparisonResult: "MISMATCH",
      decision: "REJECTED",
      reason,
    });
    return {
      allowed: false,
      reason: `Your IP address (${detectedIp}) is not on the office network allowlist`,
      detectedIp,
      source,
    };
  }

  // If this check is for checkout, skip leave & late calculations
  if (isCheckout) {
    logAttendanceDecision({
      action: "CHECK-OUT",
      detectedIp,
      source,
      configuredAllowedIps: config.raw,
      comparisonResult: "MATCH",
      decision: "ACCEPTED",
      reason: `IP ${detectedIp} matched allowed policy. Eligible for auto check-out.`,
    });
    return {
      allowed: true,
      status: "present",
      shiftStart: "09:00",
      gracePeriod: 0,
      detectedIp,
      source,
    };
  }

  // 5. Check approved leave today
  const tz = getTimezone();
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const todayDate = new Date(todayStr);

  const approvedLeave = await prisma.leave_requests.findFirst({
    where: {
      employee_id: employeeId,
      status: "approved",
      start_date: { lte: todayDate },
      end_date: { gte: todayDate },
    },
  });

  if (approvedLeave) {
    const reason = "Employee is on approved leave today";
    logAttendanceDecision({
      action: "CHECK-IN",
      detectedIp,
      source,
      configuredAllowedIps: config.raw,
      comparisonResult: "MATCH (LEAVE CONFLICT)",
      decision: "REJECTED",
      reason,
    });
    return {
      allowed: false,
      reason,
      detectedIp,
      source,
    };
  }

  // 6. Shift start & Late calculation
  const grace = getLateGraceMinutes();
  const schedule = await getEmployeeSchedule(employeeId);
  const shiftStartStr = schedule.startTime;

  const shiftStart = shiftTimeToday(shiftStartStr, tz);
  const graceEnd = new Date(shiftStart.getTime() + grace * 60 * 1000);
  const nowLocal = new Date(
    new Date().toLocaleString("en-US", { timeZone: tz })
  );

  const attendanceStatus: "present" | "late" =
    nowLocal <= graceEnd ? "present" : "late";

  logAttendanceDecision({
    action: "CHECK-IN",
    detectedIp,
    source,
    configuredAllowedIps: config.raw,
    comparisonResult: "MATCH",
    decision: "ACCEPTED",
    reason: `IP matched allowed policy. Status marked as ${attendanceStatus.toUpperCase()} (shift: ${shiftStartStr}, grace: ${grace}m).`,
  });

  return {
    allowed: true,
    status: attendanceStatus,
    shiftStart: shiftStartStr,
    gracePeriod: grace,
    detectedIp,
    source,
  };
}

// ── Auto Check-In (idempotent) ────────────────────────────────────────────────

export async function performAutoCheckIn(
  reqLike: RequestLike,
  employeeId: string
): Promise<CheckInResult> {
  const eligibility = await checkAttendanceEligibility(reqLike, employeeId);
  const { detectedIp } = eligibility;

  if (!eligibility.allowed) {
    return { success: false, reason: eligibility.reason, detectedIp };
  }

  const tz = getTimezone();
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const attendanceDate = new Date(todayStr);

  // Idempotency guard: if already checked in today, do not overwrite
  const existing = await prisma.attendance.findUnique({
    where: {
      employee_id_attendance_date: {
        employee_id: employeeId,
        attendance_date: attendanceDate,
      },
    },
  });

  if (existing) {
    return {
      success: true,
      action: "already_checked_in",
      status: existing.status as "present" | "late",
      detectedIp,
      recordId: existing.id,
    };
  }

  const now = new Date();
  const record = await prisma.attendance.create({
    data: {
      employee_id: employeeId,
      attendance_date: attendanceDate,
      check_in: now,
      status: eligibility.status,
    },
  });

  return {
    success: true,
    action: "checked_in",
    status: eligibility.status,
    detectedIp,
    recordId: record.id,
  };
}

// ── Auto Check-Out (idempotent + IP validated) ────────────────────────────────

export async function performAutoCheckOut(
  reqLike: RequestLike,
  employeeId: string
): Promise<CheckOutResult> {
  // Validate IP on checkout as well
  const eligibility = await checkAttendanceEligibility(reqLike, employeeId, { isCheckout: true });
  const detectedIp = eligibility.detectedIp;

  if (!eligibility.allowed) {
    return {
      success: false,
      reason: eligibility.reason,
      detectedIp,
    };
  }

  const tz = getTimezone();
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const attendanceDate = new Date(todayStr);

  const existing = await prisma.attendance.findUnique({
    where: {
      employee_id_attendance_date: {
        employee_id: employeeId,
        attendance_date: attendanceDate,
      },
    },
  });

  if (!existing) {
    return {
      success: true,
      action: "no_record",
      workingHours: 0,
      overtimeHours: 0,
      detectedIp,
    };
  }

  if (existing.check_out) {
    return {
      success: true,
      action: "already_checked_out",
      workingHours: Number(existing.working_hours ?? 0),
      overtimeHours: Number(existing.overtime_hours ?? 0),
      detectedIp,
    };
  }

  const now = new Date();
  const checkInTime = existing.check_in ?? now;
  const diffMs = Math.max(0, now.getTime() - checkInTime.getTime());
  const workingHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

  const schedule = await getEmployeeSchedule(employeeId);
  const standardHours = schedule.dailyHours || 8;
  const overtimeHours = Math.max(
    0,
    Math.round((workingHours - standardHours) * 100) / 100
  );

  // PostgreSQL attendance table has a generated column for working_hours;
  // updating check_out automatically computes working_hours.
  await prisma.attendance.update({
    where: { id: existing.id },
    data: {
      check_out: now,
      overtime_hours: overtimeHours,
      updated_at: now,
    },
  });

  return {
    success: true,
    action: "checked_out",
    workingHours,
    overtimeHours,
    detectedIp,
  };
}
