import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import type { AssetRequest } from "@/lib/mock-data";

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
  const { assetRequests, update, log, persona, role } = useApp();
  const nameOf = useEmployeeName();
  const ready = useDelayed();
  const isIt = role === "it_asset_manager" || role === "admin";

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ item: "", justification: "", priority: "Medium" });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const visible = isIt ? assetRequests : assetRequests.filter((r) => r.employeeId === persona.employeeId);

  const move = (id: string, status: AssetRequest["status"]) => {
    update("assetRequests", assetRequests.map((r) => (r.id === id ? { ...r, status } : r)));
    log(`Moved request ${id} to ${status.replace(/_/g, " ")}`, "Assets");
    toast.success(`Request ${status.replace(/_/g, " ")}`);
  };

  const raise = () => {
    const next: Record<string, string | undefined> = {};
    if (form.item.trim().length < 3) next["item"] = "Describe the item you need.";
    if (form.justification.trim().length < 10) next["justification"] = "Add a short business justification (10+ characters).";
    setErrors(next);
    if (Object.values(next).some(Boolean)) {
      toast.error("Please complete the request");
      return;
    }
    update("assetRequests", [
      {
        id: `AR-${80 + assetRequests.length}`,
        employeeId: persona.employeeId,
        item: form.item.trim(),
        justification: form.justification.trim(),
        raisedOn: new Date().toISOString().slice(0, 10),
        status: "open",
        priority: form.priority as AssetRequest["priority"],
      },
      ...assetRequests,
    ]);
    log(`Raised asset request for ${form.item.trim()}`, "Assets");
    toast.success("Request submitted", { description: "IT will pick this up from the queue." });
    setForm({ item: "", justification: "", priority: "Medium" });
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

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Open" value={visible.filter((r) => r.status === "open").length} tone="warning" icon={<Inbox className="size-5" />} />
        <StatCard label="In progress" value={visible.filter((r) => r.status === "in_progress").length} />
        <StatCard label="Resolved" value={visible.filter((r) => r.status === "resolved").length} tone="success" />
      </div>

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
                    <TableHead>Item</TableHead>
                    <TableHead className="hidden md:table-cell">Justification</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    {isIt && <TableHead className="text-right">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((r) => (
                    <TableRow key={r.id}>
                      {isIt && <TableCell className="font-medium">{nameOf(r.employeeId)}</TableCell>}
                      <TableCell>
                        <p className="font-medium">{r.item}</p>
                        <p className="text-xs text-muted-foreground">{r.id} · {r.raisedOn}</p>
                      </TableCell>
                      <TableCell className="hidden max-w-xs truncate md:table-cell text-muted-foreground">
                        {r.justification}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.priority === "High" ? "destructive" : "secondary"}>{r.priority}</Badge>
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
            <DialogDescription>IT triages requests in priority order.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="What do you need?" error={errors["item"]}>
              <Input value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} placeholder="e.g. Second monitor" />
            </Field>
            <Field label="Justification" error={errors["justification"]}>
              <Textarea rows={3} value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} />
            </Field>
            <Field label="Priority">
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Low", "Medium", "High"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={raise}>Submit request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
