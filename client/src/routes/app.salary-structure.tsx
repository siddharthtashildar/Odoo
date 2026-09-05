import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Edit2,
  FileSpreadsheet,
  Lock,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState, PageHeader, StatCard } from "@/components/bits";
import { useApp } from "@/lib/store";
import { type SalaryComponent, type SalaryStructure, type SalaryStructureStatus } from "@/lib/mock-data";

export const Route = createFileRoute("/app/salary-structure")({
  head: () => ({
    meta: [
      { title: "Salary Structures · PeoplePay360" },
      { name: "description", content: "Define and manage pay component templates used across payroll runs." },
      { property: "og:title", content: "Salary Structures · PeoplePay360" },
    ],
  }),
  component: SalaryStructurePage,
});

const STATUS_BADGE: Record<SalaryStructureStatus, string> = {
  active: "bg-success/15 text-success border-success/20",
  inactive: "bg-muted text-muted-foreground border-border",
  draft: "bg-warning/15 text-warning-foreground border-warning/20",
};

const COMPONENT_TYPE_COLORS: Record<SalaryComponent["type"], string> = {
  earning: "text-success",
  deduction: "text-destructive",
  employer: "text-accent-foreground",
};

const emptyComponent = (): SalaryComponent => ({
  name: "",
  type: "earning",
  basis: "percent_of_basic",
  value: 0,
});

const emptyForm = () => ({
  name: "",
  description: "",
  applicableTo: "All" as SalaryStructure["applicableTo"],
  status: "draft" as SalaryStructureStatus,
  effectiveFrom: "",
  components: [],
});

function SalaryStructurePage() {
  const { salaryStructures: structures, update, role } = useApp();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SalaryStructure | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<SalaryStructure | null>(null);

  const canAccess = role === "payroll_manager" || role === "payroll_user" || role === "admin";
  const canEdit = role === "payroll_manager" || role === "admin";

  const active = structures.filter((s) => s.status === "active").length;
  const drafts = structures.filter((s) => s.status === "draft").length;

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (s: SalaryStructure) => {
    setEditTarget(s);
    setForm({
      name: s.name,
      description: s.description,
      applicableTo: s.applicableTo,
      status: s.status,
      effectiveFrom: s.effectiveFrom,
      components: s.components.map((c) => ({ ...c })),
    });
    setFormOpen(true);
  };

  const addComponent = () =>
    setForm((f) => ({ ...f, components: [...f.components, emptyComponent()] }));

  const removeComponent = (i: number) =>
    setForm((f) => ({ ...f, components: f.components.filter((_, idx) => idx !== i) }));

  const patchComponent = (i: number, patch: Partial<SalaryComponent>) =>
    setForm((f) => ({
      ...f,
      components: f.components.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    }));

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("Structure name is required"); return; }
    if (!form.effectiveFrom) { toast.error("Effective date is required"); return; }
    if (form.components.some((c) => !c.name.trim() || c.value < 0)) {
      toast.error("All components need a name and a non-negative value");
      return;
    }

    const now = new Date().toISOString().slice(0, 10);
    if (editTarget) {
      const updated: SalaryStructure = { ...editTarget, ...form, updatedAt: now };
      update("salaryStructures", structures.map((s) => (s.id === editTarget.id ? updated : s)));
      toast.success("Structure updated", { description: form.name });
    } else {
      const newId = `SS-${String(structures.length + 1).padStart(3, "0")}`;
      const created: SalaryStructure = { id: newId, ...form, createdBy: "Arjun Nair", updatedAt: now };
      update("salaryStructures", [...structures, created]);
      toast.success("Structure created", { description: form.name });
    }
    setFormOpen(false);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    update("salaryStructures", structures.filter((s) => s.id !== deleteTarget.id));
    toast.success("Structure deleted", { description: deleteTarget.name });
    setDeleteTarget(null);
  };

  if (!canAccess) {
    return (
      <EmptyState
        icon={<Lock className="size-5" />}
        title="Access restricted"
        description="Salary structures are only accessible to Payroll User and Payroll Manager."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Salary Structures"
        description="Pay component templates that define how employee salaries are computed."
        actions={
          canEdit ? (
            <Button size="sm" onClick={openCreate} id="create-structure-btn">
              <Plus className="mr-1.5 size-4" /> New Structure
            </Button>
          ) : (
            <Badge variant="outline" className="gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3" /> Read-only
            </Badge>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total structures" value={structures.length} icon={<FileSpreadsheet className="size-5" />} />
        <StatCard label="Active" value={active} tone="success" />
        <StatCard label="Draft" value={drafts} tone="warning" />
      </div>

      <div className="space-y-3">
        {structures.length === 0 ? (
          <EmptyState
            icon={<FileSpreadsheet className="size-5" />}
            title="No salary structures"
            description={canEdit ? "Create your first structure to get started." : "No structures defined yet."}
            action={canEdit ? <Button size="sm" onClick={openCreate}>Create structure</Button> : undefined}
          />
        ) : (
          structures.map((s) => (
            <Card key={s.id} className="overflow-hidden transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">{s.name}</CardTitle>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[s.status]}`}
                      >
                        {s.status}
                      </span>
                      <span className="rounded border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {s.applicableTo}
                      </span>
                    </div>
                    <CardDescription className="mt-1 line-clamp-1">{s.description}</CardDescription>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {canEdit && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          aria-label="Edit structure"
                          onClick={() => openEdit(s)}
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-destructive hover:text-destructive"
                          aria-label="Delete structure"
                          onClick={() => setDeleteTarget(s)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                      aria-label={expandedId === s.id ? "Collapse" : "Expand"}
                    >
                      {expandedId === s.id ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {expandedId === s.id && (
                <CardContent className="border-t border-border pt-4">
                  <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>Effective from <strong>{s.effectiveFrom}</strong></span>
                    <span>Created by <strong>{s.createdBy}</strong></span>
                    <span>Last updated <strong>{s.updatedAt}</strong></span>
                  </div>
                  
                  {/* Earnings/Allowances */}
                  <div className="mb-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-success mb-2">Earnings / Allowances</div>
                    {s.components.filter(c => c.type === "earning").length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">None configured</p>
                    ) : (
                      <div className="space-y-1">
                        {s.components.filter(c => c.type === "earning").map((c, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between rounded-md px-3 py-1.5 bg-muted/30 text-sm"
                          >
                            <span>{c.name}</span>
                            <span className="tabular-nums text-muted-foreground">
                              {c.basis === "fixed"
                                ? `₹${c.value.toLocaleString("en-IN")} / mo`
                                : `${c.value}% of basic`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Deductions */}
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-destructive mb-2">Deductions</div>
                    {s.components.filter(c => c.type === "deduction").length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">None configured</p>
                    ) : (
                      <div className="space-y-1">
                        {s.components.filter(c => c.type === "deduction").map((c, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between rounded-md px-3 py-1.5 bg-muted/30 text-sm"
                          >
                            <span>{c.name}</span>
                            <span className="tabular-nums text-muted-foreground">
                              {c.basis === "fixed"
                                ? `₹${c.value.toLocaleString("en-IN")} / mo`
                                : `${c.value}% of basic`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Create / Edit dialog */}
      {canEdit && (
        <Dialog open={formOpen} onOpenChange={(o) => !o && setFormOpen(false)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editTarget ? "Edit Structure" : "New Salary Structure"}</DialogTitle>
              <DialogDescription>
                Configure earnings/allowances and deductions that make up the salary structure.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="struct-name">Name *</Label>
                  <Input
                    id="struct-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Standard Full-Time"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="struct-applicable">Applicable To</Label>
                  <Select
                    value={form.applicableTo}
                    onValueChange={(v) => setForm((f) => ({ ...f, applicableTo: v as SalaryStructure["applicableTo"] }))}
                  >
                    <SelectTrigger id="struct-applicable"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["All", "Senior", "Executive", "Intern", "Contract"] as const).map((o) => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="struct-effective">Effective From *</Label>
                  <Input
                    id="struct-effective"
                    type="date"
                    value={form.effectiveFrom}
                    onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="struct-status">Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm((f) => ({ ...f, status: v as SalaryStructureStatus }))}
                  >
                    <SelectTrigger id="struct-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-full space-y-1.5">
                  <Label htmlFor="struct-desc">Description</Label>
                  <Input
                    id="struct-desc"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Brief description of this structure"
                  />
                </div>
              </div>

              {/* Components - Organized by Type */}
              <div className="space-y-4">
                {/* Earnings / Allowances Section */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label className="font-semibold text-success">Earnings / Allowances</Label>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        const earning = emptyComponent();
                        earning.type = "earning";
                        setForm(f => ({ ...f, components: [...f.components, earning] }));
                      }}
                      id="add-earning-btn"
                    >
                      <Plus className="mr-1 size-3.5" /> Add Earning
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {form.components.filter(c => c.type === "earning").length === 0 ? (
                      <p className="text-xs text-muted-foreground italic px-2 py-1.5">No earnings configured yet</p>
                    ) : (
                      form.components
                        .map((c, origIdx) => ({ c, origIdx }))
                        .filter(({ c }) => c.type === "earning")
                        .map(({ origIdx }) => {
                          const c = form.components[origIdx];
                          return (
                            <div key={origIdx} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
                              <Input
                                placeholder="e.g. Basic Salary, HRA, Transport Allowance"
                                value={c.name}
                                onChange={(e) => patchComponent(origIdx, { name: e.target.value })}
                                className="flex-1 min-w-0 h-8 text-sm"
                              />
                              <Select value={c.basis} onValueChange={(v) => patchComponent(origIdx, { basis: v as SalaryComponent["basis"] })}>
                                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="percent_of_basic">% of Basic</SelectItem>
                                  <SelectItem value="fixed">Fixed (₹/mo)</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                min={0}
                                placeholder={c.basis === "fixed" ? "₹ amount" : "%"}
                                value={c.value || ""}
                                onChange={(e) => patchComponent(origIdx, { value: Number(e.target.value) })}
                                className="w-20 h-8 text-sm text-right"
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8 shrink-0 text-destructive hover:text-destructive"
                                onClick={() => removeComponent(origIdx)}
                                aria-label="Remove component"
                              >
                                <Minus className="size-3.5" />
                              </Button>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* Deductions Section */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label className="font-semibold text-destructive">Deductions</Label>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        const deduction = emptyComponent();
                        deduction.type = "deduction";
                        setForm(f => ({ ...f, components: [...f.components, deduction] }));
                      }}
                      id="add-deduction-btn"
                    >
                      <Plus className="mr-1 size-3.5" /> Add Deduction
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {form.components.filter(c => c.type === "deduction").length === 0 ? (
                      <p className="text-xs text-muted-foreground italic px-2 py-1.5">No deductions configured yet</p>
                    ) : (
                      form.components
                        .map((c, origIdx) => ({ c, origIdx }))
                        .filter(({ c }) => c.type === "deduction")
                        .map(({ origIdx }) => {
                          const c = form.components[origIdx];
                          return (
                            <div key={origIdx} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
                              <Input
                                placeholder="e.g. Income Tax, PF, Professional Tax"
                                value={c.name}
                                onChange={(e) => patchComponent(origIdx, { name: e.target.value })}
                                className="flex-1 min-w-0 h-8 text-sm"
                              />
                              <Select value={c.basis} onValueChange={(v) => patchComponent(origIdx, { basis: v as SalaryComponent["basis"] })}>
                                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="percent_of_basic">% of Basic</SelectItem>
                                  <SelectItem value="fixed">Fixed (₹/mo)</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                min={0}
                                placeholder={c.basis === "fixed" ? "₹ amount" : "%"}
                                value={c.value || ""}
                                onChange={(e) => patchComponent(origIdx, { value: Number(e.target.value) })}
                                className="w-20 h-8 text-sm text-right"
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8 shrink-0 text-destructive hover:text-destructive"
                                onClick={() => removeComponent(origIdx)}
                                aria-label="Remove component"
                              >
                                <Minus className="size-3.5" />
                              </Button>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>{editTarget ? "Save changes" : "Create structure"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirm */}
      {canEdit && (
        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the structure. Salary records using it will retain their current values.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDelete}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
