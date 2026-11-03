import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  provisionMicrosoftAccount,
  splitPersonName,
  slugNamePart,
  mapMicrosoftRow,
} from "../lib/ms365";

const router = Router();

// ── GET /api/ms365/users ────────────────────────────────────────────────────
// List all Microsoft 365 accounts stored in the DB
router.get("/users", async (_req, res) => {
  try {
    const rows = await prisma.employee_microsoft_accounts.findMany({
      orderBy: { updated_at: "desc" },
    });
    res.json({ success: true, data: rows.map(mapMicrosoftRow) });
  } catch (err) {
    console.error("[ms365] list error:", err);
    res.status(500).json({ success: false, error: "Failed to list Microsoft accounts" });
  }
});

// ── POST /api/ms365/users ────────────────────────────────────────────────────
// Create a Microsoft 365 user from first + last name only.
// No employee record required — we create a synthetic one in employee_microsoft_accounts.
router.post("/users", async (req, res) => {
  try {
    const { firstName, lastName } = req.body as {
      firstName?: string;
      lastName?: string;
    };

    if (!firstName?.trim() || !lastName?.trim()) {
      return res.status(400).json({ success: false, error: "firstName and lastName are required" });
    }

    const { givenName, surname } = splitPersonName("", firstName.trim(), lastName.trim());
    const firstSlug = slugNamePart(givenName) || "employee";
    const lastSlug = slugNamePart(surname) || "user";
    const domain = process.env.MS365_DOMAIN || "peoplepay360.onmicrosoft.com";

    // Build a deterministic synthetic employee ID for standalone MS365 users
    // We use a UUID-v5-style sha256 slug so re-submitting the same name is idempotent
    const crypto = await import("node:crypto");
    const nameKey = `${firstSlug}.${lastSlug}@${domain}`;
    const syntheticId = crypto
      .createHash("sha256")
      .update(nameKey)
      .digest("hex")
      .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*/, "$1-$2-$3-$4-$5");

    // Idempotency: check if we already have a record for this name combo
    const existing = await prisma.employee_microsoft_accounts.findUnique({
      where: { employee_id: syntheticId },
    });

    if (existing?.account_status === "created") {
      return res.json({
        success: true,
        data: mapMicrosoftRow(existing),
        idempotent: true,
      });
    }

    // Provision via Graph API
    const result = await provisionMicrosoftAccount({
      employeeId: syntheticId,
      fullName: `${givenName} ${surname}`,
      firstName: givenName,
      lastName: surname,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Provisioning failed";
    console.error("[ms365] create error:", err);
    res.status(500).json({ success: false, error: msg });
  }
});

// ── GET /api/ms365/users/:id ─────────────────────────────────────────────────
// Get status for a single Microsoft account by syntheticId (employee_id)
router.get("/users/:id", async (req, res) => {
  try {
    const row = await prisma.employee_microsoft_accounts.findUnique({
      where: { employee_id: req.params.id },
    });
    if (!row) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: mapMicrosoftRow(row) });
  } catch (err) {
    res.status(500).json({ success: false, error: "Lookup failed" });
  }
});

export default router;
