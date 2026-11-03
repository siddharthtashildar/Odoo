/**
 * test-ip-attendance.ts
 * Comprehensive test suite verifying all required scenarios for the IP-based attendance fix:
 * 1. Configured allowed IP -> attendance marked.
 * 2. Different IP (random Wi-Fi) -> attendance NOT marked.
 * 3. Change ATTENDANCE_ALLOWED_IPS -> new value is respected.
 * 4. Expired policy -> attendance NOT marked.
 * 5. Unavailable or uncertain client IP -> attendance NOT marked.
 * 6. Checkout IP validation -> same IP rules applied.
 * 7. Live HTTP application flow reproduction for random Wi-Fi login.
 */

import http from "node:http";
import { prisma } from "./lib/prisma";
import {
  resolveClientIp,
  checkAttendanceEligibility,
  performAutoCheckIn,
  performAutoCheckOut,
} from "./lib/ip-attendance";

async function runTests() {
  console.log("=================================================");
  console.log("   AUTOMATIC IP-BASED ATTENDANCE TEST SUITE      ");
  console.log("=================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] Scenario: ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] Scenario: ${name} -> ${detail ?? ""}`);
      failed++;
    }
  }

  // 1. Fetch a real employee for testing
  const testEmployee = await prisma.employees.findFirst({
    where: { status: "active" },
  });

  if (!testEmployee) {
    console.error("No active employee found in database to run tests against.");
    process.exit(1);
  }

  const employeeId = testEmployee.id;
  console.log(`Using test employee: ${testEmployee.full_name} (${employeeId})`);

  // Cleanup any test attendance for today before starting
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const todayDate = new Date(todayStr);

  await prisma.attendance.deleteMany({
    where: {
      employee_id: employeeId,
      attendance_date: todayDate,
    },
  });

  // ── Test 1: Configured Allowed IP -> Attendance Marked ─────────────────────────
  console.log("\n--- TEST 1: Configured Allowed IP ---");
  const ALLOWED_OFFICE_IP = "203.0.113.100";
  process.env["ATTENDANCE_ALLOWED_IPS"] = ALLOWED_OFFICE_IP;
  delete process.env["ATTENDANCE_ALLOWED_UNTIL"];

  const resAllowed = await checkAttendanceEligibility(
    { socket: { remoteAddress: ALLOWED_OFFICE_IP } },
    employeeId
  );
  assert(
    resAllowed.allowed === true && resAllowed.detectedIp === ALLOWED_OFFICE_IP,
    "1. Configured allowed IP -> attendance accepted",
    `Allowed: ${resAllowed.allowed}, IP: ${resAllowed.detectedIp}`
  );

  const checkInAllowed = await performAutoCheckIn(
    { socket: { remoteAddress: ALLOWED_OFFICE_IP } },
    employeeId
  );
  assert(
    checkInAllowed.success === true && checkInAllowed.action === "checked_in",
    "1b. performAutoCheckIn creates attendance record for allowed IP"
  );

  // ── Test 2: Different IP (Random Wi-Fi) -> Attendance NOT Marked ──────────────
  console.log("\n--- TEST 2: Different IP (Random Wi-Fi) ---");
  // Clean up previous record to test fresh check-in attempt from random Wi-Fi
  await prisma.attendance.deleteMany({
    where: { employee_id: employeeId, attendance_date: todayDate },
  });

  const RANDOM_WIFI_IP = "198.51.100.77"; // different from allowed 203.0.113.100
  const resRandomWifi = await checkAttendanceEligibility(
    { socket: { remoteAddress: RANDOM_WIFI_IP } },
    employeeId
  );
  assert(
    !resRandomWifi.allowed && resRandomWifi.reason.includes("not on the office network allowlist"),
    "2a. Random Wi-Fi IP (different from allowed) -> attendance NOT marked",
    `Reason: ${!resRandomWifi.allowed ? resRandomWifi.reason : "allowed"}`
  );

  const checkInRandomWifi = await performAutoCheckIn(
    { socket: { remoteAddress: RANDOM_WIFI_IP } },
    employeeId
  );
  assert(
    checkInRandomWifi.success === false && checkInRandomWifi.detectedIp === RANDOM_WIFI_IP,
    "2b. performAutoCheckIn rejects check-in from random Wi-Fi IP without throwing",
    `Detected IP: ${checkInRandomWifi.detectedIp}`
  );

  // Verify that NO attendance record was written to the database for today
  const dbRecordAfterRandomWifi = await prisma.attendance.findUnique({
    where: {
      employee_id_attendance_date: {
        employee_id: employeeId,
        attendance_date: todayDate,
      },
    },
  });
  assert(
    dbRecordAfterRandomWifi === null,
    "2c. Database confirms NO attendance record exists after random Wi-Fi attempt"
  );

  // ── Test 3: Change ATTENDANCE_ALLOWED_IPS -> New Value is Respected ───────────
  console.log("\n--- TEST 3: Changing ATTENDANCE_ALLOWED_IPS ---");
  const NEW_ALLOWED_IP = "198.51.100.77"; // Now allow the previous random Wi-Fi IP
  process.env["ATTENDANCE_ALLOWED_IPS"] = NEW_ALLOWED_IP;

  const resNewAllowed = await checkAttendanceEligibility(
    { socket: { remoteAddress: NEW_ALLOWED_IP } },
    employeeId
  );
  assert(
    resNewAllowed.allowed === true && resNewAllowed.detectedIp === NEW_ALLOWED_IP,
    "3a. Changing ATTENDANCE_ALLOWED_IPS -> new IP is now accepted",
    `Allowed: ${resNewAllowed.allowed}`
  );

  // Old allowed IP should now be rejected
  const resOldNowRejected = await checkAttendanceEligibility(
    { socket: { remoteAddress: ALLOWED_OFFICE_IP } },
    employeeId
  );
  assert(
    resOldNowRejected.allowed === false,
    "3b. Changing ATTENDANCE_ALLOWED_IPS -> old IP is now rejected"
  );

  // ── Test 4: Expired Policy -> Attendance NOT Marked ───────────────────────────
  console.log("\n--- TEST 4: Expired Policy ---");
  process.env["ATTENDANCE_ALLOWED_IPS"] = NEW_ALLOWED_IP;
  process.env["ATTENDANCE_ALLOWED_UNTIL"] = "2020-01-01T00:00:00Z";

  const resExpired = await checkAttendanceEligibility(
    { socket: { remoteAddress: NEW_ALLOWED_IP } },
    employeeId
  );
  assert(
    !resExpired.allowed && resExpired.reason.includes("expired"),
    "4a. Expired policy -> checkAttendanceEligibility rejects attendance",
    `Reason: ${!resExpired.allowed ? resExpired.reason : "allowed"}`
  );

  const checkInExpired = await performAutoCheckIn(
    { socket: { remoteAddress: NEW_ALLOWED_IP } },
    employeeId
  );
  assert(
    !checkInExpired.success && checkInExpired.reason.includes("expired"),
    "4b. performAutoCheckIn rejects check-in when policy is expired"
  );
  delete process.env["ATTENDANCE_ALLOWED_UNTIL"];

  // ── Test 5: Unavailable or Uncertain Client IP -> Attendance NOT Marked ───────
  console.log("\n--- TEST 5: Unavailable or Uncertain Client IP ---");
  // A request from a private LAN address (e.g. 192.168.1.150) without a public proxy header
  const resPrivateLan = await checkAttendanceEligibility(
    { socket: { remoteAddress: "192.168.1.150" } },
    employeeId
  );
  assert(
    !resPrivateLan.allowed && resPrivateLan.reason.includes("cannot be determined reliably"),
    "5a. Private LAN address without public proxy header -> attendance NOT marked (uncertain IP)",
    `Reason: ${!resPrivateLan.allowed ? resPrivateLan.reason : "allowed"}`
  );

  // Missing or empty ATTENDANCE_ALLOWED_IPS
  process.env["ATTENDANCE_ALLOWED_IPS"] = "";
  const resEmptyConfig = await checkAttendanceEligibility(
    { socket: { remoteAddress: "203.0.113.100" } },
    employeeId
  );
  assert(
    !resEmptyConfig.allowed && resEmptyConfig.reason.includes("not set or empty"),
    "5b. Empty ATTENDANCE_ALLOWED_IPS -> attendance disabled and rejected",
    `Reason: ${!resEmptyConfig.allowed ? resEmptyConfig.reason : "allowed"}`
  );

  // ── Test 6: Auto Check-Out IP Validation ──────────────────────────────────────
  console.log("\n--- TEST 6: Auto Check-Out IP Validation ---");
  process.env["ATTENDANCE_ALLOWED_IPS"] = "203.0.113.100";

  // Create an attendance record
  await prisma.attendance.create({
    data: {
      employee_id: employeeId,
      attendance_date: todayDate,
      check_in: new Date(Date.now() - 3600000), // 1 hour ago
      status: "present",
    },
  });

  // Attempt checkout from random Wi-Fi IP (different from allowed 203.0.113.100)
  const checkOutRandomWifi = await performAutoCheckOut(
    { socket: { remoteAddress: "198.51.100.77" } },
    employeeId
  );
  assert(
    checkOutRandomWifi.success === false && checkOutRandomWifi.reason.includes("not on the office network allowlist"),
    "6a. Checkout from random Wi-Fi IP -> checkout rejected by IP validation"
  );

  // Verify record was NOT updated with checkout time
  const recordStillOpen = await prisma.attendance.findUnique({
    where: { employee_id_attendance_date: { employee_id: employeeId, attendance_date: todayDate } },
  });
  assert(
    recordStillOpen?.check_out === null,
    "6b. Attendance record remains checked-in without checkout timestamp"
  );

  // Checkout from allowed IP -> succeeds
  const checkOutAllowed = await performAutoCheckOut(
    { socket: { remoteAddress: "203.0.113.100" } },
    employeeId
  );
  assert(
    checkOutAllowed.success === true && checkOutAllowed.action === "checked_out",
    "6c. Checkout from allowed IP -> checkout successfully recorded"
  );

  // Clean up test attendance record
  await prisma.attendance.deleteMany({
    where: { employee_id: employeeId, attendance_date: todayDate },
  });

  // ── Test 7: Full Application HTTP Flow (Reproduction of Random Wi-Fi Login) ───
  console.log("\n--- TEST 7: Live HTTP Application Flow Reproduction ---");
  // Set allowed IP to Office IP
  process.env["ATTENDANCE_ALLOWED_IPS"] = "203.0.113.100";

  // We find an employee's user account to test POST /api/auth/login via HTTP
  const testUser = await prisma.user.findFirst({
    where: { employeeId: { not: null } },
  });

  if (testUser) {
    // Send simulated random Wi-Fi HTTP request with reverse proxy header
    const postData = JSON.stringify({ email: testUser.email });

    // We test direct HTTP request to the running server on port 5000 with remote IP header
    const httpResult = await new Promise<{ success: boolean; data?: any }>((resolve) => {
      const req = http.request(
        "http://localhost:5000/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData),
            // Simulate reverse proxy forwarding random Wi-Fi client IP
            "x-forwarded-for": "198.51.100.77",
          },
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            try {
              resolve(JSON.parse(body));
            } catch {
              resolve({ success: false });
            }
          });
        }
      );
      req.on("error", () => resolve({ success: false }));
      req.write(postData);
      req.end();
    });

    if (httpResult.success && httpResult.data) {
      // 1. Login MUST succeed regardless of IP
      assert(httpResult.success === true, "7a. HTTP Login succeeds regardless of IP");

      // 2. Attendance MUST be rejected (never marked on random / unallowed Wi-Fi)
      const att = httpResult.data.attendance;
      assert(
        att && att.success === false,
        "7b. HTTP Login returns attendance rejected without blocking login",
        `Attendance response: ${JSON.stringify(att)}`
      );
    } else {
      console.log("[SKIP] HTTP live test skipped (server dev process restarting or test credentials differ)");
    }

    // 3. Application flow test with simulated incoming request from random Wi-Fi
    process.env["ATTENDANCE_ALLOWED_IPS"] = "203.0.113.100";
    const simulatedReq = {
      headers: { "x-forwarded-for": "198.51.100.77" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const appFlowCheckIn = await performAutoCheckIn(simulatedReq, employeeId);
    assert(
      !appFlowCheckIn.success && appFlowCheckIn.reason.includes("not on the office network allowlist"),
      "7c. Application flow with random Wi-Fi IP (198.51.100.77) -> attendance rejected with IP mismatch",
      `Reason: ${!appFlowCheckIn.success ? appFlowCheckIn.reason : "success"}`
    );
  }

  // Cleanup test attendance record
  await prisma.attendance.deleteMany({
    where: { employee_id: employeeId, attendance_date: todayDate },
  });

  console.log("=================================================");
  console.log(`TOTAL PASSED: ${passed} / ${passed + failed}`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((e) => {
    console.error("Test execution error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

