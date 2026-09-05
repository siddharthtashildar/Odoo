import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  History,
  Laptop,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  UserCheck,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, Field, PageHeader, StatCard, StatusBadge, TableSkeleton } from "@/components/bits";
import { useApp, useDelayed, useEmployeeName } from "@/lib/store";
import { inr, type Asset, type AssetCategory, type AssetStatus } from "@/lib/mock-data";

export const Route = createFileRoute("/app/assets")({
  head: () => ({
    meta: [
      { title: "AssetFlow · PeoplePay360" },
      { name: "description", content: "End-to-end hardware, peripheral, software license and identity asset lifecycle management." },
      { property: "og:title", content: "AssetFlow · PeoplePay360" },
    ],
  }),
  component: AssetsPage,
});

const emptyAssetForm = {
  name: "",
  tag: "",
  category: "Laptop" as AssetCategory,
  serial: "",
  value: "",
  location: "Ahmedabad IT Vault",
  condition: "New" as Asset["condition"],
};

function AssetsPage() {
  const { assets, employees, update, log, role, persona } = useApp();
  const nameOf = useEmployeeName();
  const ready = useDelayed();

  const isEmployeeOnly = role === "employee";
  const canManage = role === "it_asset_manager" || role === "admin" || role === "hr_manager" || role === "hr_user" || role === "payroll_manager" || role === "payroll_user";

  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyAssetForm);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const [assignTarget, setAssignTarget] = useState<Asset | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [assignError, setAssignError] = useState<string | undefined>();

  const [transferTarget, setTransferTarget] = useState<Asset | null>(null);
  const [transferRecipient, setTransferRecipient] = useState("");

  const [viewHistoryTarget, setViewHistoryTarget] = useState<Asset | null>(null);

  // Summaries
  const availableCount = assets.filter((a) => a.status === "Available" || a.status === "in_stock").length;
  const assignedCount = assets.filter((a) => a.status === "Assigned" || a.status === "assigned").length;
  const maintenanceCount = assets.filter((a) => a.status === "Under Maintenance" || a.status === "repair").length;
  const totalBookValue = assets.reduce((s, a) => s + a.value, 0);

  const rows = useMemo(() => {
    return assets.filter((a) => {
      if (isEmployeeOnly && a.assignedTo !== persona.employeeId) return false;

      const assigneeName = a.assignedTo ? nameOf(a.assignedTo).toLowerCase() : "";
      const matchQ =
        a.name.toLowerCase().includes(q.toLowerCase()) ||
        a.tag.toLowerCase().includes(q.toLowerCase()) ||
        a.serial.toLowerCase().includes(q.toLowerCase()) ||
        assigneeName.includes(q.toLowerCase());
      const matchCat = catFilter === "all" || a.category === catFilter;
      const matchStatus =
        statusFilter === "all" ||
        a.status.toLowerCase().replace(/_/g, " ") === statusFilter.toLowerCase().replace(/_/g, " ");
      return matchQ && matchCat && matchStatus;
    });
  }, [assets, isEmployeeOnly, persona.employeeId, q, catFilter, statusFilter, nameOf]);

  const handleAddAsset = () => {
    const next: Record<string, string | undefined> = {};
    if (form.name.trim().length < 3) next["name"] = "Asset name is required.";
    if (!form.tag.trim()) next["tag"] = "Asset tag is required (e.g. LAP-2295).";
    if (assets.some((a) => a.tag.toLowerCase() === form.tag.trim().toLowerCase()))
      next["tag"] = "That tag already exists.";
    if (!form.serial.trim()) next["serial"] = "Serial number is required.";
    if (!form.value || Number(form.value) <= 0) next["value"] = "Enter valid purchase value.";
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    const newAsset: Asset = {
      id: `A-${assets.length + 11}`,
      tag: form.tag.trim().toUpperCase(),
      name: form.name.trim(),
      category: form.category,
      serial: form.serial.trim(),
      purchasedOn: new Date().toISOString().slice(0, 10),
      value: Number(form.value),
      condition: form.condition,
      status: "Available",
      location: form.location,
      assignedTo: undefined,
      history: [
        {
          date: new Date().toISOString().slice(0, 10),
          action: "Procured and checked into AssetFlow",
          actor: persona.name,
        },
      ],
    };

    update("assets", [newAsset, ...assets]);
    log(`Added asset ${newAsset.tag} (${newAsset.name})`, "Assets");
    toast.success("Asset catalogued in AssetFlow", {
      description: `${newAsset.tag} · ${newAsset.name}`,
    });
    setForm(emptyAssetForm);
    setAddOpen(false);
  };

  const handleConfirmAssign = () => {
    if (!assignTarget || !selectedAssignee) {
      setAssignError("Please choose an employee to assign this asset.");
      return;
    }
    setAssignError(undefined);

    const historyItem = {
      date: new Date().toISOString().slice(0, 10),
      action: `Assigned to ${nameOf(selectedAssignee)}`,
      actor: persona.name,
    };

    update(
      "assets",
      assets.map((a) =>
        a.id === assignTarget.id
          ? {
              ...a,
              status: "Assigned",
              assignedTo: selectedAssignee,
              history: [...(a.history ?? []), historyItem],
            }
          : a,
      ),
    );

    log(`Assigned asset ${assignTarget.tag} to ${nameOf(selectedAssignee)}`, "Assets");
    toast.success("Asset assigned successfully", {
      description: `${assignTarget.name} assigned to ${nameOf(selectedAssignee)}`,
    });
    setAssignTarget(null);
    setSelectedAssignee("");
  };

  const handleReturnAsset = (asset: Asset) => {
    const historyItem = {
      date: new Date().toISOString().slice(0, 10),
      action: `Returned by ${nameOf(asset.assignedTo ?? "")} to IT inventory`,
      actor: persona.name,
    };

    update(
      "assets",
      assets.map((a) =>
        a.id === asset.id
          ? {
              ...a,
              status: "Available",
              assignedTo: undefined,
              history: [...(a.history ?? []), historyItem],
            }
          : a,
      ),
    );

    log(`Checked in returned asset ${asset.tag}`, "Assets");
    toast.success("Asset checked into storage", {
      description: `${asset.tag} returned to available inventory.`,
    });
  };

  const handleTransferAsset = () => {
    if (!transferTarget || !transferRecipient) {
      toast.error("Please pick an employee to receive this asset.");
      return;
    }

    const historyItem = {
      date: new Date().toISOString().slice(0, 10),
      action: `Transferred from ${nameOf(transferTarget.assignedTo ?? "")} to ${nameOf(transferRecipient)}`,
      actor: persona.name,
    };

    update(
      "assets",
      assets.map((a) =>
        a.id === transferTarget.id
          ? {
              ...a,
              status: "Assigned",
              assignedTo: transferRecipient,
              history: [...(a.history ?? []), historyItem],
            }
          : a,
      ),
    );

    log(`Transferred asset ${transferTarget.tag} to ${nameOf(transferRecipient)}`, "Assets");
    toast.success("Asset transferred", {
      description: `${transferTarget.tag} now assigned to ${nameOf(transferRecipient)}`,
    });
    setTransferTarget(null);
    setTransferRecipient("");
  };

  const handleReportDamaged = (asset: Asset) => {
    const historyItem = {
      date: new Date().toISOString().slice(0, 10),
      action: "Reported damaged / Sent for maintenance",
      actor: persona.name,
    };

    update(
      "assets",
      assets.map((a) =>
        a.id === asset.id
          ? {
              ...a,
              status: "Under Maintenance",
              condition: "Needs Service",
              history: [...(a.history ?? []), historyItem],
            }
          : a,
      ),
    );

    log(`Marked asset ${asset.tag} under maintenance`, "Assets");
    toast.warning("Asset flagged for maintenance", {
      description: `${asset.tag} routed to authorized service partner.`,
    });
  };

  return (
    <>
      <PageHeader
        title="AssetFlow"
        description="Unified hardware, peripherals, mobile devices, access cards, and SaaS licenses asset management."
        actions={
          canManage && (
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="mr-2 size-4" /> Add Asset
            </Button>
          )
        }
      />

      {!isEmployeeOnly && (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Available in Stock"
          value={availableCount}
          hint="Ready for immediate allocation"
          icon={<CheckCircle2 className="size-5" />}
          tone="success"
        />
        <StatCard
          label="Assigned to Staff"
          value={assignedCount}
          hint={`${assets.length} total items tracked`}
          icon={<UserCheck className="size-5" />}
          tone="default"
        />
        <StatCard
          label="Under Maintenance"
          value={maintenanceCount}
          hint="Service / repair queue"
          icon={<Wrench className="size-5" />}
          tone="warning"
        />
        <StatCard
          label="Total Portfolio Value"
          value={inr(totalBookValue)}
          hint="Book value on inventory"
          icon={<Laptop className="size-5" />}
          tone="accent"
        />
      </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Asset Registry ({rows.length})</CardTitle>
              <CardDescription>
                {isEmployeeOnly ? "Equipment assigned to your profile" : "Global enterprise IT & physical asset registry"}
              </CardDescription>
            </div>
          </div>

          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search tag, device, serial..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Laptop">Laptop</SelectItem>
                <SelectItem value="Desktop">Desktop</SelectItem>
                <SelectItem value="Monitor">Monitor</SelectItem>
                <SelectItem value="Keyboard">Keyboard</SelectItem>
                <SelectItem value="Mouse">Mouse</SelectItem>
                <SelectItem value="Mobile phone">Mobile Phone</SelectItem>
                <SelectItem value="ID card">ID Card</SelectItem>
                <SelectItem value="Access card">Access Card</SelectItem>
                <SelectItem value="Software license">Software License</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Available">Available</SelectItem>
                <SelectItem value="Assigned">Assigned</SelectItem>
                <SelectItem value="Under Maintenance">Under Maintenance</SelectItem>
                <SelectItem value="Lost">Lost</SelectItem>
                <SelectItem value="Returned">Returned</SelectItem>
                <SelectItem value="Retired">Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {!ready ? (
            <div className="p-4">
              <TableSkeleton rows={6} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="No assets found"
              description="No assets match your search or filter criteria."
              icon={<Laptop className="size-8" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {!isEmployeeOnly && <TableHead>Asset ID</TableHead>}
                    <TableHead>Asset Name</TableHead>
                    <TableHead>Category</TableHead>
                    {!isEmployeeOnly && <TableHead>Assigned Employee</TableHead>}
                    <TableHead>Purchase Date</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                    {!isEmployeeOnly && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((a) => {
                    const isAssigned = a.status === "Assigned" || a.status === "assigned";
                    return (
                      <TableRow key={a.id}>
                        {!isEmployeeOnly && (
                        <TableCell className="font-mono text-xs font-semibold text-primary">
                          {a.tag}
                        </TableCell>
                        )}
                        <TableCell>
                          <div className="font-medium">{a.name}</div>
                          <div className="font-mono text-xs text-muted-foreground">{a.serial}</div>
                        </TableCell>
                        <TableCell>{a.category}</TableCell>
                        {!isEmployeeOnly && (
                        <TableCell>
                          {a.assignedTo ? (
                            <div>
                              <p className="font-medium text-sm">{nameOf(a.assignedTo)}</p>
                              <p className="text-xs text-muted-foreground">{a.assignedTo}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Unassigned (In Vault)</span>
                          )}
                        </TableCell>
                        )}
                        <TableCell className="text-xs text-muted-foreground">{a.purchasedOn}</TableCell>
                        <TableCell>
                          <StatusBadge status={a.condition || "Good"} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={a.status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{a.location}</TableCell>
                        {!isEmployeeOnly && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* View History */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={() => setViewHistoryTarget(a)}
                              title="View asset lifecycle history"
                            >
                              <History className="size-3.5" />
                            </Button>

                            {canManage && (
                              <>
                                {!isAssigned && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-2 text-primary"
                                    onClick={() => setAssignTarget(a)}
                                    title="Assign asset"
                                  >
                                    <UserCheck className="size-3.5" />
                                  </Button>
                                )}

                                {isAssigned && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 px-2 text-muted-foreground hover:text-foreground"
                                      onClick={() => setTransferTarget(a)}
                                      title="Transfer asset"
                                    >
                                      <ArrowRightLeft className="size-3.5" />
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 px-2 text-warning-foreground hover:text-warning"
                                      onClick={() => handleReturnAsset(a)}
                                      title="Return to inventory"
                                    >
                                      <RotateCcw className="size-3.5" />
                                    </Button>
                                  </>
                                )}

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2 text-destructive hover:text-destructive"
                                  onClick={() => handleReportDamaged(a)}
                                  title="Report damaged / Maintenance"
                                >
                                  <Wrench className="size-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Asset Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Asset to AssetFlow</DialogTitle>
            <DialogDescription>
              Register hardware or software license into corporate custody.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Field label="Asset Name" error={errors["name"]}>
              <Input
                placeholder='e.g. MacBook Pro 14" M4'
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Asset Tag ID" error={errors["tag"]}>
                <Input
                  placeholder="LAP-2295"
                  value={form.tag}
                  onChange={(e) => setForm({ ...form, tag: e.target.value })}
                />
              </Field>

              <Field label="Category">
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v as AssetCategory })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Laptop">Laptop</SelectItem>
                    <SelectItem value="Desktop">Desktop</SelectItem>
                    <SelectItem value="Monitor">Monitor</SelectItem>
                    <SelectItem value="Keyboard">Keyboard</SelectItem>
                    <SelectItem value="Mouse">Mouse</SelectItem>
                    <SelectItem value="Mobile phone">Mobile Phone</SelectItem>
                    <SelectItem value="ID card">ID Card</SelectItem>
                    <SelectItem value="Access card">Access Card</SelectItem>
                    <SelectItem value="Software license">Software License</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Serial Number" error={errors["serial"]}>
                <Input
                  placeholder="e.g. C02XK9LMQ1"
                  value={form.serial}
                  onChange={(e) => setForm({ ...form, serial: e.target.value })}
                />
              </Field>

              <Field label="Purchase Cost (₹)" error={errors["value"]}>
                <Input
                  type="number"
                  placeholder="e.g. 185000"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Condition">
                <Select
                  value={form.condition}
                  onValueChange={(v) => setForm({ ...form, condition: v as Asset["condition"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Good">Good</SelectItem>
                    <SelectItem value="Fair">Fair</SelectItem>
                    <SelectItem value="Needs Service">Needs Service</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Storage Location">
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </Field>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddAsset}>Register Asset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Asset Modal */}
      {assignTarget && (
        <Dialog open={!!assignTarget} onOpenChange={(o) => !o && setAssignTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Assign Asset</DialogTitle>
              <DialogDescription>
                Allocate {assignTarget.name} ({assignTarget.tag}) to an active team member.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <Field label="Assign To Employee" error={assignError}>
                <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees
                      .filter((e) => e.status !== "exited")
                      .map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name} ({e.department})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignTarget(null)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmAssign}>Confirm Allocation</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Transfer Asset Modal */}
      {transferTarget && (
        <Dialog open={!!transferTarget} onOpenChange={(o) => !o && setTransferTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Transfer Asset Custodian</DialogTitle>
              <DialogDescription>
                Transfer {transferTarget.tag} from {nameOf(transferTarget.assignedTo ?? "")} to another colleague.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <Field label="New Custodian">
                <Select value={transferRecipient} onValueChange={setTransferRecipient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose recipient" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees
                      .filter((e) => e.status !== "exited" && e.id !== transferTarget.assignedTo)
                      .map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name} ({e.department})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setTransferTarget(null)}>
                Cancel
              </Button>
              <Button onClick={handleTransferAsset}>Confirm Transfer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Asset History Modal */}
      {viewHistoryTarget && (
        <Dialog open={!!viewHistoryTarget} onOpenChange={(o) => !o && setViewHistoryTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>Asset History · {viewHistoryTarget.tag}</DialogTitle>
                <StatusBadge status={viewHistoryTarget.status} />
              </div>
              <DialogDescription>{viewHistoryTarget.name}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-sm">
              <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1 text-xs">
                <p><span className="text-muted-foreground">Serial:</span> {viewHistoryTarget.serial}</p>
                <p><span className="text-muted-foreground">Condition:</span> {viewHistoryTarget.condition}</p>
                <p><span className="text-muted-foreground">Location:</span> {viewHistoryTarget.location}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Audit Trail & Custodian Timeline
                </p>
                <div className="space-y-2 border rounded-lg p-3">
                  {(viewHistoryTarget.history ?? [
                    { date: viewHistoryTarget.purchasedOn, action: "Asset logged into AssetFlow", actor: "Neel Shah" },
                  ]).map((h, i) => (
                    <div key={i} className="text-xs border-b last:border-0 pb-1.5 pt-0.5 space-y-0.5">
                      <div className="flex justify-between font-medium">
                        <span>{h.action}</span>
                        <span className="text-muted-foreground">{h.date}</span>
                      </div>
                      <p className="text-muted-foreground text-[0.7rem]">By: {h.actor}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setViewHistoryTarget(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
