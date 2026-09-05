import { Router } from "express";
import { prisma } from "../lib/prisma";

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

    const mapped = assets.map((a) => ({
      id: a.id,
      assetCode: a.asset_code,
      assetType: a.asset_type,
      serialNumber: a.serial_number ?? "",
      condition: a.condition,
      status: a.status,
      location: a.location ?? "",
      currentEmployeeId: a.current_employee_id ?? null,
      currentEmployeeName: a.employees?.full_name ?? null,
      purchaseDate: a.purchase_date?.toISOString().slice(0, 10) ?? null,
      purchaseCost: Number(a.purchase_cost ?? 0),
      warrantyExpiry: a.warranty_expiry?.toISOString().slice(0, 10) ?? null,
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch assets" });
  }
});

// GET /api/assets/requests
router.get("/requests", async (req, res) => {
  try {
    const { employeeId } = req.query as { employeeId?: string };
    const requests = await prisma.asset_requests.findMany({
      where: employeeId ? { employee_id: employeeId } : undefined,
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
      reason: r.reason ?? "",
      status: r.status,
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
    const { employeeId, assetTypeRequested, reason } = req.body as {
      employeeId: string;
      assetTypeRequested: string;
      reason?: string;
    };

    const request = await prisma.asset_requests.create({
      data: {
        employee_id: employeeId,
        asset_type_requested: assetTypeRequested,
        reason: reason ?? null,
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
    const updated = await prisma.asset_requests.update({
      where: { id: req.params.id },
      data: { status: status as any, resolved_at: new Date() },
    });
    res.json({ success: true, data: { id: updated.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update asset request" });
  }
});

export default router;
