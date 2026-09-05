import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Inbox, Plus, AlertCircle } from "lucide-react";
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
import { EmptyState, Field, PageHeader, StatCard, StatusBadge, TableSkeleton } from "@/components/bits";
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
  const { assetRequests, assets, update, log, persona, role } = useApp();
  const nameOf = useEmployeeName();
  const ready = useDelayed();
  const isIt = role === "it_asset_manager" || role === "admin";

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    category: "",
    assetId: "",
    requiredFrom: "",
    requiredUntil: "",
    reason: "",
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const visible = isIt ? assetRequests : assetRequests.filter((r) => r.employeeId === persona.employeeId);

  // Filter assets by selected category
  const assetsInCategory = form.category
    ? assets.filter((a) => a.category === form.category)
    : [];

  // Get selected asset for availability check
  const selectedAsset = form.assetId ? assets.find((a) => a.id === form.assetId) : null;

  const move = (id: string, status: AssetRequest["status"]) => {
    update("assetRequests", assetRequests.map((r) => (r.id === id ? { ...r, status } : r)));
    log(`Moved request ${id} to ${status.replace(/_/g, " ")}`, "Assets");
    toast.success(`Request ${status.replace(/_/g, " ")}`);
  };

  const raise = () => {
    const next: Record<string, string | undefined> = {};
    if (!form.category) next["category"] = "Select a category.";
    if (!form.assetId) next["assetId"] = "Select an asset.";
    if (!form.requiredFrom) next["requiredFrom"] = "Enter required from date.";
    if (!form.requiredUntil) next["requiredUntil"] = "Enter required until date.";
    if (form.requiredFrom && form.requiredUntil && form.requiredFrom > form.requiredUntil)
      next["requiredUntil"] = "Until date must be on or after from date.";
    if (form.reason.trim().length < 5) next["reason"] = "Provide a reason (5+ characters).";
    setErrors(next);
    if (Object.values(next).some(Boolean)) {
      toast.error("Please complete the request");
      return;
    }

    const assetName = selectedAsset?.name || "";
    update("assetRequests", [
      {
        id: `AR-${80 + assetRequests.length}`,
        employeeId: persona.employeeId,
        item: assetName,
        justification: form.reason.trim(),
        raisedOn: new Date().toISOString().slice(0, 10),
        status: "open",
        priority: "Medium",
        category: form.category as AssetCategory,
        assetId: form.assetId,
        requiredFrom: form.requiredFrom,
        requiredUntil: form.requiredUntil,
      },
      ...assetRequests,
    ]);
    log(`Raised asset request for ${assetName}`, "Assets");
    toast.success("Request submitted", { description: "IT will review and process your request." });
    setForm({
      category: "",
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
        title="Asset requests"
        description={isIt ? "Everything employees have asked IT for, newest first." : "Requests you have raised with IT."}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 size-4" /> Raise request
          </Button>
        }
      />

      {isIt && (
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Open" value={visible.filter((r) => r.status === "open").length} tone="warning" icon={<Inbox className="size-5" />} />
        <StatCard label="In progress" value={visible.filter((r) => r.status === "in_progress").length} />
        <StatCard label="Resolved" value={visible.filter((r) => r.status === "resolved").length} tone="success" />
      </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Request queue</CardTitle>
          <CardDescription>{isIt ? "You can progress each request." : "Track the status of your requests."}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!ready ? (
            <div className="p-4"><TableSkeleton rows={4} /></div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<Inbox className="size-5" />}
              title="Nothing in the queue"
              description="Raise a request when you need hardware, a licence or an accessory."
              action={<Button onClick={() => setOpen(true)}>Raise request</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isIt && <TableHead>Requester</TableHead>}
                    <TableHead>Asset Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Category</TableHead>
                    <TableHead>Required Period</TableHead>
                    <TableHead className="hidden md:table-cell">Reason</TableHead>
                    <TableHead>Status</TableHead>
                    {isIt && <TableHead className="text-right">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((r) => (
                    <TableRow key={r.id}>
                      {isIt && <TableCell className="font-medium text-sm">{nameOf(r.employeeId)}</TableCell>}
                      <TableCell>
                        <p className="font-medium">{r.item}</p>
                        <p className="text-xs text-muted-foreground">{r.id}</p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{r.category || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {r.requiredFrom && r.requiredUntil ? (
                          <div>
                            <div className="font-medium">{r.requiredFrom} → {r.requiredUntil}</div>
                            <div className="text-xs text-muted-foreground">{r.raisedOn}</div>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="hidden max-w-xs truncate md:table-cell text-xs text-muted-foreground">
                        {r.justification}
                      </TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      {isIt && (
                        <TableCell className="text-right">
                          {r.status === "open" ? (
                            <Button size="sm" variant="outline" onClick={() => move(r.id, "in_progress")}>Start</Button>
                          ) : r.status === "in_progress" ? (
                            <Button size="sm" onClick={() => move(r.id, "resolved")}>Resolve</Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Closed</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Raise an asset request</DialogTitle>
            <DialogDescription>Select the asset category and item you need.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Category" error={errors["category"]}>
              <Select value={form.category} onValueChange={(v) => {
                setForm({ ...form, category: v, assetId: "" });
              }}>
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

            {form.category && (
              <Field label="Asset Name" error={errors["assetId"]}>
                <Select value={form.assetId} onValueChange={(v) => setForm({ ...form, assetId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select asset..." />
                  </SelectTrigger>
                  <SelectContent>
                    {assetsInCategory.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} {isAssetAvailable(a) ? "(Available)" : "(Not Available)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {selectedAsset && (
              <Alert variant={isAssetAvailable(selectedAsset) ? "default" : "destructive"}>
                <AlertCircle className="size-4" />
                <AlertDescription>
                  {isAssetAvailable(selectedAsset)
                    ? "This asset is currently available."
                    : "This asset is not currently available. Request will be queued."}
                </AlertDescription>
              </Alert>
            )}

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

            <Field label="Reason / Description" error={errors["reason"]}>
              <Textarea
                rows={3}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Why do you need this asset? What will you use it for?"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={raise}>Raise Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
