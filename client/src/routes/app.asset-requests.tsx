import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Inbox, Plus, AlertCircle, CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, Field, PageHeader, StatCard, StatusBadge, TableSkeleton, TablePagination } from "@/components/bits";
import { useApp, useDelayed, useEmployeeName } from "@/lib/store";
import type { Asset, AssetRequest, AssetCategory } from "@/lib/mock-data";

function isAssetAvailable(asset: Asset) {
  const status = asset.status.toLowerCase().replace(/_/g, " ");
  return status === "available" || status === "in stock";
}

const assetCategories: AssetCategory[] = [
  "Laptop",
  "Desktop",
  "Monitor",
  "Keyboard",
  "Mouse",
  "Mobile phone",
  "ID card",
  "Access card",
  "Software license",
  "Phone",
  "Accessory",
  "License",
  "Other",
];

export const Route = createFileRoute("/app/asset-requests")({
  head: () => ({
    meta: [
      { title: "Asset requests · PeoplePay360" },
      { name: "description", content: "Raise and triage hardware, licence and accessory requests." },
      { property: "og:title", content: "Asset requests · PeoplePay360" },
      { property: "og:description", content: "Raise and triage hardware, licence and accessory requests." },
    ],
  }),
  component: AssetRequestsPage,
});

function AssetRequestsPage() {
  const { assetRequests, assets, employees, addAssetRequest, updateAssetRequest, log, persona, role } = useApp();
  const nameOf = useEmployeeName();
  const ready = useDelayed();

  // HR Manager, IT Asset Manager, and Admin can triage and assign assets
  const isIt = role === "it_asset_manager" || role === "admin" || role === "hr_manager";

  const me = employees.find(
    (e) =>
      e.id === persona.employeeId ||
      e.code === persona.employeeCode ||
      (persona.email && e.email.toLowerCase() === persona.email.toLowerCase()),
  );
  const myId = me?.id || persona.employeeId;
  const myCode = me?.code || persona.employeeCode;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    category: "",
    item: "",
    assetId: "",
    requiredFrom: "",
    requiredUntil: "",
    reason: "",
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  // Fulfill & Assign modal state
  const [fulfillTarget, setFulfillTarget] = useState<AssetRequest | null>(null);
  const [chosenAssetId, setChosenAssetId] = useState("");
  const [fulfillError, setFulfillError] = useState<string | undefined>();

  const [page, setPage] = useState(1);

  const visible = isIt
    ? assetRequests
    : assetRequests.filter(
        (r) =>
          r.employeeId === myId ||
          (myCode && (r.employeeId === myCode || (r as any).employeeCode === myCode)) ||
          (me?.email && (r as any).employeeEmail?.toLowerCase() === me.email.toLowerCase()),
      );

  const PAGE_SIZE = 5;
  const totalPages = Math.ceil(visible.length / PAGE_SIZE) || 1;
  const paginatedVisible = useMemo(() => {
    return visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [visible, page]);

  // Filter assets by selected category
  const assetsInCategory = form.category
    ? assets.filter((a) => a.category === form.category)
    : [];

  // Get selected asset for availability check
  const selectedAsset = form.assetId ? assets.find((a) => a.id === form.assetId) : null;

  // Available inventory assets for fulfillment dialog
  const availableInventory = useMemo(() => {
    return assets.filter(isAssetAvailable);
  }, [assets]);

  const moveStatus = (id: string, status: AssetRequest["status"]) => {
    updateAssetRequest(id, { status });
    log(`Moved request ${id} to ${status.replace(/_/g, " ")}`, "Assets");
    toast.success(`Request marked ${status.replace(/_/g, " ")}`);
  };

  const handleOpenFulfill = (request: AssetRequest) => {
    setFulfillTarget(request);
    // Preselect an available asset matching the requested category if one exists
    const matching = availableInventory.find((a) => a.category === request.category);
    setChosenAssetId(matching ? matching.id : (availableInventory[0]?.id || ""));
    setFulfillError(undefined);
  };

  const handleConfirmFulfill = () => {
    if (!fulfillTarget) return;
    if (!chosenAssetId) {
      setFulfillError("Please choose an available inventory asset to assign.");
      return;
    }

    const assignedItem = assets.find((a) => a.id === chosenAssetId);
    updateAssetRequest(fulfillTarget.id, {
      status: "resolved",
      fulfilledAssetId: chosenAssetId,
    });

    log(`Fulfilled request ${fulfillTarget.id} and assigned ${assignedItem?.tag || "asset"}`, "Assets");
    toast.success("Request fulfilled & asset assigned", {
      description: `${assignedItem?.name || "Device"} assigned to ${nameOf(fulfillTarget.employeeId)}`,
    });

    setFulfillTarget(null);
    setChosenAssetId("");
  };

  const raise = () => {
    const next: Record<string, string | undefined> = {};
    if (!form.category) next["category"] = "Select an asset category.";
    if (!form.item.trim() && !form.assetId) next["item"] = "Specify device specification or item name.";
    if (!form.requiredFrom) next["requiredFrom"] = "Enter required from date.";
    if (!form.requiredUntil) next["requiredUntil"] = "Enter required until date.";
    if (form.requiredFrom && form.requiredUntil && form.requiredFrom > form.requiredUntil)
      next["requiredUntil"] = "Until date must be on or after from date.";
    if (form.reason.trim().length < 5) next["reason"] = "Provide a justification (5+ characters).";
    setErrors(next);
    if (Object.values(next).some(Boolean)) {
      toast.error("Please complete all required fields");
      return;
    }

    const itemName = form.item.trim() || selectedAsset?.name || form.category;
    const newReq: AssetRequest = {
      id: `AR-${Date.now().toString().slice(-4)}`,
      employeeId: myId,
      item: itemName,
      justification: form.reason.trim(),
      raisedOn: new Date().toISOString().slice(0, 10),
      status: "open",
      priority: "Medium",
      category: form.category as AssetCategory,
      assetId: form.assetId || undefined,
      requiredFrom: form.requiredFrom,
      requiredUntil: form.requiredUntil,
    };

    addAssetRequest(newReq);
    log(`Raised asset request for ${itemName}`, "Assets");
    toast.success("Request submitted", { description: "HR and IT will review and assign your equipment." });
    setForm({
      category: "",
      item: "",
      assetId: "",
      requiredFrom: "",
      requiredUntil: "",
      reason: "",
    });
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        title="Asset Requests"
        description={
          isIt
            ? "Review and triage hardware, accessories, and software license requests from employees across all departments."
            : "Request new hardware, monitors, laptops, accessories, or software access from IT & HR."
        }
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 size-4" /> Raise request
          </Button>
        }
      />

      {isIt ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Pending / Open"
            value={visible.filter((r) => r.status === "open").length}
            tone="warning"
            icon={<Inbox className="size-5" />}
            hint="Awaiting review"
          />
          <StatCard
            label="Under Review"
            value={visible.filter((r) => r.status === "in_progress").length}
            hint="Sourcing / procurement in progress"
          />
          <StatCard
            label="Fulfilled & Resolved"
            value={visible.filter((r) => r.status === "resolved").length}
            tone="success"
            icon={<CheckCircle2 className="size-5" />}
            hint="Equipment assigned"
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="My Active Requests"
            value={visible.filter((r) => r.status === "open" || r.status === "in_progress").length}
            tone="warning"
            icon={<Inbox className="size-5" />}
            hint="Pending allocation"
          />
          <StatCard
            label="Fulfilled Requests"
            value={visible.filter((r) => r.status === "resolved").length}
            tone="success"
            icon={<CheckCircle2 className="size-5" />}
            hint="Completed device allocations"
          />
          <StatCard
            label="Total Raised"
            value={visible.length}
            hint="All-time equipment requests"
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Request Queue ({visible.length})</CardTitle>
          <CardDescription>
            {isIt
              ? "Approve, reject, or assign available assets to fulfill employee requests."
              : "Track the status of your equipment and hardware requests."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!ready ? (
            <div className="p-4"><TableSkeleton rows={4} /></div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<Inbox className="size-5" />}
              title="Nothing in the queue"
              description="Raise a request when you need hardware, an extra monitor, or accessories."
              action={<Button onClick={() => setOpen(true)}>Raise request</Button>}
            />
          ) : (
            <>
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={visible.length}
                pageSize={5}
                onPageChange={setPage}
              />
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isIt && <TableHead>Requester</TableHead>}
                      <TableHead>Asset Requested</TableHead>
                      <TableHead className="hidden sm:table-cell">Category</TableHead>
                      <TableHead>Required Period</TableHead>
                      <TableHead className="hidden md:table-cell">Reason / Justification</TableHead>
                      <TableHead>Status</TableHead>
                      {isIt && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedVisible.map((r) => (
                      <TableRow key={r.id}>
                        {isIt && (
                          <TableCell className="font-medium text-sm">
                            <div className="font-semibold">{r.employeeName || nameOf(r.employeeId)}</div>
                            <div className="text-xs text-muted-foreground">{r.employeeCode || r.employeeId}</div>
                          </TableCell>
                        )}
                        <TableCell>
                          <p className="font-medium">{r.item}</p>
                          <p className="text-xs text-muted-foreground font-mono">{r.id}</p>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">
                          <Badge variant="outline">{r.category || "Hardware"}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.requiredFrom && r.requiredUntil ? (
                            <div>
                              <div className="font-medium">{r.requiredFrom} → {r.requiredUntil}</div>
                              <div className="text-xs text-muted-foreground">Raised: {r.raisedOn}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">{r.raisedOn}</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden max-w-xs truncate md:table-cell text-xs text-muted-foreground">
                          {r.justification}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={r.status} />
                        </TableCell>
                        {isIt && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {r.status === "open" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs"
                                    onClick={() => moveStatus(r.id, "in_progress")}
                                  >
                                    Review
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={() => handleOpenFulfill(r)}
                                  >
                                    Fulfill & Assign
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 text-xs text-destructive hover:text-destructive"
                                    onClick={() => moveStatus(r.id, "resolved")}
                                    title="Reject request"
                                  >
                                    <XCircle className="size-3.5" />
                                  </Button>
                                </>
                              )}
                              {r.status === "in_progress" && (
                                <>
                                  <Button
                                    size="sm"
                                    className="h-8 text-xs bg-primary"
                                    onClick={() => handleOpenFulfill(r)}
                                  >
                                    Assign & Fulfill
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs"
                                    onClick={() => moveStatus(r.id, "resolved")}
                                  >
                                    Close
                                  </Button>
                                </>
                              )}
                              {r.status === "resolved" && (
                                <span className="text-xs text-emerald-600 font-medium inline-flex items-center gap-1">
                                  <CheckCircle2 className="size-3.5" /> Fulfilled
                                </span>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={visible.length}
                pageSize={5}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Raise Request Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Raise an Asset Request</DialogTitle>
            <DialogDescription>
              Request hardware, accessories, or software licenses needed for your daily work.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Field label="Category" error={errors["category"]}>
              <Select
                value={form.category}
                onValueChange={(v) => {
                  setForm({ ...form, category: v, assetId: "" });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  {assetCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Device or Item Description" error={errors["item"]}>
              <Input
                placeholder="e.g. MacBook Pro M2 16GB, Dell 27' 4K Monitor, Magic Mouse"
                value={form.item}
                onChange={(e) => setForm({ ...form, item: e.target.value })}
              />
            </Field>

            {form.category && assetsInCategory.length > 0 && (
              <Field label="Specific Asset (Optional)">
                <Select
                  value={form.assetId}
                  onValueChange={(v) => {
                    const found = assets.find((a) => a.id === v);
                    setForm({
                      ...form,
                      assetId: v,
                      item: found ? found.name : form.item,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose from inventory (optional)..." />
                  </SelectTrigger>
                  <SelectContent>
                    {assetsInCategory.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} ({a.tag}) · {isAssetAvailable(a) ? "Available" : "Assigned"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Required From" error={errors["requiredFrom"]}>
                <Input
                  type="date"
                  value={form.requiredFrom}
                  onChange={(e) => setForm({ ...form, requiredFrom: e.target.value })}
                />
              </Field>

              <Field label="Required Until" error={errors["requiredUntil"]}>
                <Input
                  type="date"
                  value={form.requiredUntil}
                  onChange={(e) => setForm({ ...form, requiredUntil: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Business Justification" error={errors["reason"]}>
              <Textarea
                rows={3}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Provide details on project requirements, client deliverables, or equipment replacement reasons..."
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={raise}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fulfill & Assign Modal (HR / IT Manager) */}
      <Dialog open={Boolean(fulfillTarget)} onOpenChange={(v) => !v && setFulfillTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fulfill Request & Assign Asset</DialogTitle>
            <DialogDescription>
              Assign an available device from the inventory directly to{" "}
              <span className="font-semibold text-foreground">
                {fulfillTarget ? (fulfillTarget.employeeName || nameOf(fulfillTarget.employeeId)) : "the employee"}
              </span>.
            </DialogDescription>
          </DialogHeader>

          {fulfillTarget && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Requested Item:</span>
                  <span className="font-semibold">{fulfillTarget.item}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category:</span>
                  <span>{fulfillTarget.category || "General Equipment"}</span>
                </div>
                <div className="text-xs text-muted-foreground pt-1 border-t mt-2">
                  <span className="font-medium text-foreground">Justification: </span>
                  {fulfillTarget.justification}
                </div>
              </div>

              <Field label="Select Inventory Asset to Allocate" error={fulfillError}>
                <Select value={chosenAssetId} onValueChange={setChosenAssetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select available asset..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableInventory.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No available assets in inventory
                      </SelectItem>
                    ) : (
                      availableInventory.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} ({a.tag}) · {a.location}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </Field>

              {availableInventory.length === 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>
                    There are no available assets in the inventory right now. Please add new assets in AssetFlow first.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setFulfillTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmFulfill}
              disabled={availableInventory.length === 0 || !chosenAssetId}
            >
              <ShieldCheck className="mr-1.5 size-4" /> Confirm & Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
