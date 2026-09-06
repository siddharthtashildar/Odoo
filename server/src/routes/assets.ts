import { Router } from "express";
import { prisma } from "../lib/prisma";
import { resolveEmployee } from "../lib/resolve-employee";
import { sendAssetAllotmentEmail } from "../lib/email";

const router = Router();

// GET /api/assets
router.get("/", async (_req, res) => {
  try {
    const assets = await prisma.assets.findMany({
      orderBy: { created_at: "desc" },
      include: {
        employees: { select: { id: true, employee_code: true, full_name: true, email: true } },
        asset_assignments: {
          orderBy: { created_at: "desc" },
          include: {
            employees: { select: { id: true, employee_code: true, full_name: true } },
          },
        },
      },
    });

    const mapped = assets.map((a) => {
      const conditionMap = {
        new: "New",
        good: "Good",
        fair: "Fair",
        damaged: "Needs Service",
      } as const;

      const assignmentHistory = (a.asset_assignments || []).map((asgn) => ({
        date: asgn.assigned_on ? asgn.assigned_on.toISOString().slice(0, 10) : asgn.created_at.toISOString().slice(0, 10),
        action: asgn.status === "assigned"
          ? `Assigned to ${asgn.employees.full_name} (${asgn.employees.employee_code})`
          : `Returned by ${asgn.employees.full_name} to IT Inventory`,
        actor: "HR / IT Admin",
      }));

      const history = [
        ...assignmentHistory,
        {
          date: a.purchase_date?.toISOString().slice(0, 10) ?? a.created_at.toISOString().slice(0, 10),
          action: "Procured and catalogued in AssetFlow",
          actor: "IT Inventory Management",
        },
      ];

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
        status: (String(a.status) === "assigned"
          ? "Assigned"
          : String(a.status) === "available"
            ? "Available"
            : String(a.status) === "under_repair" || String(a.status) === "repair"
              ? "Under Maintenance"
              : a.status) as any,
        location: a.location ?? "Ahmedabad IT Vault",
        assignedTo: a.employees?.employee_code || a.employees?.id || a.current_employee_id || undefined,
        currentEmployeeId: a.current_employee_id ?? null,
        currentEmployeeCode: a.employees?.employee_code ?? null,
        currentEmployeeName: a.employees?.full_name ?? null,
        purchasedOn: a.purchase_date?.toISOString().slice(0, 10) ?? "2025-01-15",
        purchaseDate: a.purchase_date?.toISOString().slice(0, 10) ?? null,
        value: Number(a.purchase_cost ?? 0),
        purchaseCost: Number(a.purchase_cost ?? 0),
        warrantyExpiry: a.warranty_expiry?.toISOString().slice(0, 10) ?? null,
        history,
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

    const code = (tag || assetCode || `AST-${Date.now().toString().slice(-4)}`).toUpperCase();
    const condNorm =
      condition?.toLowerCase() === "new"
        ? "good"
        : condition?.toLowerCase() === "fair"
          ? "damaged"
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
        purchase_date: purchaseDate || purchasedOn ? new Date(purchaseDate || purchasedOn) : new Date(),
      },
      include: { employees: { select: { full_name: true, employee_code: true } } },
    });

    if (employeeId) {
      await prisma.asset_assignments.create({
        data: {
          asset_id: created.id,
          employee_id: employeeId,
          condition_at_assignment: condNorm as any,
          status: "assigned",
        },
      });

      const emp = await prisma.employees.findUnique({ where: { id: employeeId } });
      if (emp?.email) {
        sendAssetAllotmentEmail({
          to: emp.email,
          employeeName: emp.full_name,
          assetCode: created.asset_code,
          assetType: created.asset_type,
          serialNumber: created.serial_number || undefined,
          condition: created.condition,
          location: created.location || undefined,
        }).catch((e) => console.warn("Asset allotment mail error:", e));
      }
    }

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

    let employeeId: string | null | undefined = undefined;
    if (assignedTo !== undefined || currentEmployeeId !== undefined) {
      const raw = assignedTo !== undefined ? assignedTo : currentEmployeeId;
      if (raw) {
        const emp = await resolveEmployee(raw);
        employeeId = emp ? emp.id : null;
      } else {
        employeeId = null;
      }
    }

    const condNorm = condition
      ? condition.toLowerCase() === "new" || condition.toLowerCase() === "good"
        ? "good"
        : condition.toLowerCase() === "fair" || condition.toLowerCase().includes("damage") || condition.toLowerCase().includes("service")
          ? "damaged"
          : "good"
      : undefined;

    const statusNorm = status
      ? status.toLowerCase() === "assigned" || (employeeId && status.toLowerCase() !== "available")
        ? "assigned"
        : status.toLowerCase() === "retired"
          ? "retired"
          : status.toLowerCase().includes("repair") || status.toLowerCase().includes("maint")
            ? "under_repair"
            : "available"
      : employeeId !== undefined
        ? employeeId ? "assigned" : "available"
        : undefined;

    const updated = await prisma.assets.update({
      where: { id: req.params.id },
      data: {
        ...(condNorm && { condition: condNorm as any }),
        ...(statusNorm && { status: statusNorm as any }),
        ...(location !== undefined && { location }),
        ...(employeeId !== undefined && { current_employee_id: employeeId }),
        ...(serial !== undefined && { serial_number: serial }),
        ...(serialNumber !== undefined && { serial_number: serialNumber }),
        updated_at: new Date(),
      },
    });

    // Handle asset_assignments audit tracking
    if (employeeId) {
      await prisma.asset_assignments.create({
        data: {
          asset_id: updated.id,
          employee_id: employeeId,
          condition_at_assignment: updated.condition,
          status: "assigned",
        },
      });

      const emp = await prisma.employees.findUnique({ where: { id: employeeId } });
      if (emp?.email) {
        sendAssetAllotmentEmail({
          to: emp.email,
          employeeName: emp.full_name,
          assetCode: updated.asset_code,
          assetType: updated.asset_type,
          serialNumber: updated.serial_number || undefined,
          condition: updated.condition,
          location: updated.location || undefined,
        }).catch((e) => console.warn("Asset allotment update mail error:", e));
      }
    } else if (employeeId === null || statusNorm === "available") {
      await prisma.asset_assignments.updateMany({
        where: { asset_id: updated.id, status: "assigned" },
        data: { status: "returned", returned_on: new Date() },
      });
    }

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
        employees: { select: { id: true, employee_code: true, full_name: true, email: true } },
        assets: { select: { id: true, asset_code: true, asset_type: true } },
      },
    });

    const mapped = requests.map((r) => {
      const statusMap: Record<string, string> = {
        pending: "open",
        approved: "in_progress",
        fulfilled: "resolved",
        rejected: "rejected",
      };

      return {
        id: r.id,
        employeeId: r.employees.employee_code || r.employees.id || r.employee_id,
        employeeCode: r.employees.employee_code,
        employeeName: r.employees.full_name,
        assetTypeRequested: r.asset_type_requested,
        item: r.asset_type_requested,
        reason: r.reason ?? "",
        justification: r.reason ?? "",
        status: statusMap[r.status] ?? r.status,
        rawStatus: r.status,
        priority: "Medium",
        category: (r.asset_type_requested || "Laptop") as any,
        raisedOn: r.requested_at.toISOString().slice(0, 10),
        requestedAt: r.requested_at.toISOString(),
        fulfilledAssetId: r.fulfilled_asset_id ?? null,
        fulfilledAssetName: r.assets ? `${r.assets.asset_type} (${r.assets.asset_code})` : null,
      };
    });

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch asset requests" });
  }
});

// POST /api/assets/requests
router.post("/requests", async (req, res) => {
  try {
    const { employeeId, assetTypeRequested, reason, item, justification, category, assetId, requiredFrom, requiredUntil } = req.body as any;

    const emp = await resolveEmployee(employeeId);
    if (!emp) return res.status(404).json({ success: false, error: "Employee not found" });

    const requestedCategory = category || assetTypeRequested || item || "Equipment";

    // Validate assetId category if specified
    if (assetId) {
      const selectedAsset = await prisma.assets.findUnique({ where: { id: assetId } });
      if (!selectedAsset) {
        return res.status(400).json({ success: false, error: "Specified asset not found" });
      }
      if (requestedCategory && selectedAsset.asset_type.toLowerCase() !== requestedCategory.toLowerCase()) {
        return res.status(400).json({
          success: false,
          error: `Selected asset (${selectedAsset.asset_code}) of type '${selectedAsset.asset_type}' does not match requested category '${requestedCategory}'`,
        });
      }
    }

    const timeWindow = requiredFrom && requiredUntil ? ` [Required: ${requiredFrom} to ${requiredUntil}]` : "";
    const fullReason = `${reason || justification || "Standard issue hardware request"}${timeWindow}`;

    const request = await prisma.asset_requests.create({
      data: {
        employee_id: emp.id,
        asset_type_requested: requestedCategory,
        reason: fullReason,
        status: "pending",
        ...(assetId && { fulfilled_asset_id: assetId }),
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
    const { status, fulfilledAssetId } = req.body as { status: string; fulfilledAssetId?: string };

    const normStatus =
      status === "approved" || status === "in_progress"
        ? "approved"
        : status === "fulfilled" || status === "resolved"
          ? "fulfilled"
          : status === "rejected"
            ? "rejected"
            : status === "cancelled"
              ? "rejected"
              : "pending";

    const existing = await prisma.asset_requests.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Asset request not found" });
    }

    const updated = await prisma.asset_requests.update({
      where: { id: req.params.id },
      data: {
        status: normStatus as any,
        ...(fulfilledAssetId && { fulfilled_asset_id: fulfilledAssetId }),
        resolved_at: normStatus === "fulfilled" || normStatus === "rejected" ? new Date() : null,
      },
    });

    // If an asset was assigned upon fulfillment, update the asset inventory record and log assignment
    if ((normStatus === "fulfilled" || fulfilledAssetId) && fulfilledAssetId) {
      await prisma.assets.update({
        where: { id: fulfilledAssetId },
        data: {
          status: "assigned",
          current_employee_id: existing.employee_id,
          updated_at: new Date(),
        },
      });

      await prisma.asset_assignments.create({
        data: {
          asset_id: fulfilledAssetId,
          employee_id: existing.employee_id,
          status: "assigned",
          condition_at_assignment: "good",
        },
      });
    }

    res.json({ success: true, data: { id: updated.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update asset request" });
  }
});

export default router;
