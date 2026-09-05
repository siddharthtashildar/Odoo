import { Router } from "express";
import { prisma } from "../lib/prisma";
import { resolveEmployee } from "../lib/resolve-employee";

const router = Router();

// GET /api/assets
router.get("/", async (_req, res) => {
  try {
    const assets = await prisma.assets.findMany({
      orderBy: { created_at: "desc" },
      include: {
        employees: { select: { full_name: true } },
      },
    });

    const mapped = assets.map((a) => {
      const conditionMap = {
        new: "New",
        good: "Good",
        fair: "Fair",
        damaged: "Needs Service",
      } as const;

      return {
        id: a.id,
        tag: a.asset_code,
        assetCode: a.asset_code,
        name: a.asset_type,
        assetType: a.asset_type,
        category: (a.asset_type || "Laptop") as any,
        serial: a.serial_number ?? "",
        serialNumber: a.serial_number ?? "",
        condition: conditionMap[a.condition as keyof typeof conditionMap] ?? "Good",
        status: (String(a.status) === "assigned" ? "Assigned" : String(a.status) === "available" ? "Available" : String(a.status) === "under_repair" || String(a.status) === "repair" ? "Under Maintenance" : a.status) as any,
        location: a.location ?? "Ahmedabad IT Vault",
        assignedTo: a.current_employee_id ?? undefined,
        currentEmployeeId: a.current_employee_id ?? null,
        currentEmployeeName: a.employees?.full_name ?? null,
        purchasedOn: a.purchase_date?.toISOString().slice(0, 10) ?? "2025-01-15",
        purchaseDate: a.purchase_date?.toISOString().slice(0, 10) ?? null,
        value: Number(a.purchase_cost ?? 0),
        purchaseCost: Number(a.purchase_cost ?? 0),
        warrantyExpiry: a.warranty_expiry?.toISOString().slice(0, 10) ?? null,
      };
    });

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch assets" });
  }
});

// POST /api/assets
router.post("/", async (req, res) => {
  try {
    const {
      name,
      assetType,
      tag,
      assetCode,
      category,
      serial,
      serialNumber,
      condition,
      status,
      location,
      assignedTo,
      currentEmployeeId,
      value,
      purchaseCost,
      purchaseDate,
      purchasedOn,
    } = req.body as any;

    let employeeId = assignedTo || currentEmployeeId;
    if (employeeId) {
      const emp = await resolveEmployee(employeeId);
      if (emp) employeeId = emp.id;
    }

    const code = tag || assetCode || `AST-${Date.now().toString().slice(-4)}`;
    const condNorm =
      condition?.toLowerCase() === "new"
        ? "new"
        : condition?.toLowerCase() === "fair"
          ? "fair"
          : condition?.toLowerCase()?.includes("damage") || condition?.toLowerCase()?.includes("service")
            ? "damaged"
            : "good";

    const statusNorm =
      status?.toLowerCase() === "assigned" || employeeId
        ? "assigned"
        : status?.toLowerCase() === "retired"
          ? "retired"
          : status?.toLowerCase()?.includes("repair") || status?.toLowerCase()?.includes("maint")
            ? "under_repair"
            : "available";

    const created = await prisma.assets.create({
      data: {
        asset_code: code,
        asset_type: name || assetType || category || "Equipment",
        serial_number: serial || serialNumber || null,
        condition: condNorm as any,
        status: statusNorm as any,
        location: location || "Ahmedabad IT Vault",
        current_employee_id: employeeId || null,
        purchase_cost: value || purchaseCost ? Number(value || purchaseCost) : null,
        purchase_date: purchaseDate || purchasedOn ? new Date(purchaseDate || purchasedOn) : null,
      },
      include: { employees: { select: { full_name: true } } },
    });

    res.status(201).json({ success: true, data: { id: created.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create asset" });
  }
});

// PATCH /api/assets/:id
router.patch("/:id", async (req, res) => {
  try {
    const { condition, status, location, assignedTo, currentEmployeeId, serial, serialNumber } = req.body as any;

    let employeeId = assignedTo !== undefined ? assignedTo : currentEmployeeId;
    if (employeeId) {
      const emp = await resolveEmployee(employeeId);
      if (emp) employeeId = emp.id;
    }

    const condNorm = condition
      ? condition.toLowerCase() === "new"
        ? "new"
        : condition.toLowerCase() === "fair"
          ? "fair"
          : condition.toLowerCase().includes("damage") || condition.toLowerCase().includes("service")
            ? "damaged"
            : "good"
      : undefined;

    const statusNorm = status
      ? status.toLowerCase() === "assigned"
        ? "assigned"
        : status.toLowerCase() === "retired"
          ? "retired"
          : status.toLowerCase().includes("repair") || status.toLowerCase().includes("maint")
            ? "under_repair"
            : "available"
      : undefined;

    const updated = await prisma.assets.update({
      where: { id: req.params.id },
      data: {
        ...(condNorm && { condition: condNorm as any }),
        ...(statusNorm && { status: statusNorm as any }),
        ...(location !== undefined && { location }),
        ...(employeeId !== undefined && { current_employee_id: employeeId || null }),
        ...(serial !== undefined && { serial_number: serial }),
        ...(serialNumber !== undefined && { serial_number: serialNumber }),
        updated_at: new Date(),
      },
    });

    res.json({ success: true, data: { id: updated.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update asset" });
  }
});

// GET /api/assets/requests
router.get("/requests", async (req, res) => {
  try {
    const { employeeId } = req.query as { employeeId?: string };
    let realEmpId = employeeId;
    if (employeeId) {
      const emp = await resolveEmployee(employeeId);
      if (emp) realEmpId = emp.id;
    }

    const requests = await prisma.asset_requests.findMany({
      where: realEmpId ? { employee_id: realEmpId } : undefined,
      orderBy: { requested_at: "desc" },
      include: {
        employees: { select: { full_name: true } },
      },
    });

    const mapped = requests.map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      employeeName: r.employees.full_name,
      assetTypeRequested: r.asset_type_requested,
      item: r.asset_type_requested,
      reason: r.reason ?? "",
      justification: r.reason ?? "",
      status: r.status,
      priority: "Medium",
      category: (r.asset_type_requested || "Laptop") as any,
      raisedOn: r.requested_at.toISOString().slice(0, 10),
      requestedAt: r.requested_at.toISOString(),
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch asset requests" });
  }
});

// POST /api/assets/requests
router.post("/requests", async (req, res) => {
  try {
    const { employeeId, assetTypeRequested, reason, item, justification, category } = req.body as any;

    const emp = await resolveEmployee(employeeId);
    if (!emp) return res.status(404).json({ success: false, error: "Employee not found" });

    const request = await prisma.asset_requests.create({
      data: {
        employee_id: emp.id,
        asset_type_requested: assetTypeRequested || item || category || "Equipment",
        reason: reason || justification || null,
        status: "pending",
      },
    });

    res.status(201).json({ success: true, data: { id: request.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create asset request" });
  }
});

// PATCH /api/assets/requests/:id
router.patch("/requests/:id", async (req, res) => {
  try {
    const { status } = req.body as { status: string };
    const normStatus =
      status === "approved" || status === "fulfilled"
        ? "approved"
        : status === "rejected"
          ? "rejected"
          : status === "in_review"
            ? "pending"
            : status === "cancelled"
              ? "cancelled"
              : "pending";

    const updated = await prisma.asset_requests.update({
      where: { id: req.params.id },
      data: { status: normStatus as any, resolved_at: normStatus !== "pending" ? new Date() : null },
    });
    res.json({ success: true, data: { id: updated.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update asset request" });
  }
});

export default router;
