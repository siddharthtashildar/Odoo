import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck,
  FileText,
  FileUp,
  Filter,
  Plus,
  Receipt,
  ReceiptText,
  Search,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Field, PageHeader, StatCard, StatusBadge, TableSkeleton, TablePagination } from "@/components/bits";
import { useApp, useDelayed, useEmployeeName } from "@/lib/store";
import { inr, type ReimbursementCategory, type ReimbursementClaim } from "@/lib/mock-data";

export const Route = createFileRoute("/app/reimbursement")({
  head: () => ({
    meta: [
      { title: "Reimbursements · PeoplePay360" },
      { name: "description", content: "Submit expense claims, track receipt verifications, and disburse reimbursements." },
      { property: "og:title", content: "Reimbursements · PeoplePay360" },
    ],
  }),
  component: ReimbursementPage,
});

const emptyClaim = {
  category: "Travel" as ReimbursementCategory,
  amount: "",
  submittedDate: new Date().toISOString().slice(0, 10),
  description: "",
  paymentMethod: "Bank Transfer" as ReimbursementClaim["paymentMethod"],
  receiptFileName: "",
};

interface ParsedAttachment {
  name: string;
  url: string;
  type?: string | undefined;
}

function parseClaimAttachments(claim: ReimbursementClaim): ParsedAttachment[] {
  const raw = claim.receiptUrl || claim.receiptFileName;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item: any, i: number) => ({
        name: item.name || `Attachment_${i + 1}`,
        url: item.url || "#",
        type: item.type || (item.url?.startsWith("data:image/") ? "image/png" : undefined),
      }));
    }
    if (parsed && typeof parsed === "object" && parsed.url) {
      return [{
        name: parsed.name || "Attachment_1",
        url: parsed.url,
        type: parsed.type,
      }];
    }
  } catch {
    /* raw is a plain string or data URL */
  }

  if (typeof raw === "string" && raw.trim() && raw !== "Mock_Receipt.pdf") {
    if (raw.startsWith("data:") || raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("/")) {
      const isImg = raw.startsWith("data:image/");
      return [{ name: "Supporting_Attachment", url: raw, type: isImg ? "image/png" : undefined }];
    }
    const names = raw.split(",").map((s) => s.trim()).filter(Boolean);
    return names.map((name) => ({ name, url: "#" }));
  }

  return [];
}

function ReimbursementPage() {
  const { reimbursements, employees, submitReimbursement, updateReimbursement, log, role, persona } = useApp();
  const nameOf = useEmployeeName();
  const ready = useDelayed();

  const [previewAttachment, setPreviewAttachment] = useState<ParsedAttachment | null>(null);

  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [addOpen, setAddOpen] = useState(false);
  const [viewClaim, setViewClaim] = useState<ReimbursementClaim | null>(null);

  const [form, setForm] = useState(emptyClaim);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [attachments, setAttachments] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files);
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit
    const validFiles: File[] = [];

    for (const file of selected) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File "${file.name}" exceeds the maximum limit of 10MB.`);
      } else {
        validFiles.push(file);
      }
    }
    if (validFiles.length === 0) return;

    if (attachments.length + validFiles.length > 2) {
      toast.warning("You can attach a maximum of 2 supporting files per claim.");
    }
    const updated = [...attachments, ...validFiles].slice(0, 2);
    setAttachments(updated);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const canApprove = role === "hr_manager" || role === "payroll_manager" || role === "payroll_user" || role === "admin";
  const isEmployeeOnly = role === "employee";

  const me = employees.find(
    (e) =>
      e.id === persona.employeeId ||
      e.code === persona.employeeCode ||
      (persona.email && e.email.toLowerCase() === persona.email.toLowerCase()),
  );
  const myId = me?.id || persona.employeeId;
  const myCode = me?.code || persona.employeeCode;

  // Compute metrics
  const myClaims = reimbursements.filter((r) => r.employeeId === myId || (myCode && r.employeeId === myCode));
  const activeSet = isEmployeeOnly ? myClaims : reimbursements;

  const totalClaims = activeSet.length;
  const pendingClaims = activeSet.filter((r) => r.approvalStatus === "pending").length;
  const approvedClaims = activeSet.filter((r) => r.approvalStatus === "approved");
  const approvedAmount = approvedClaims.reduce((s, r) => s + r.amount, 0);
  const rejectedClaims = activeSet.filter((r) => r.approvalStatus === "rejected").length;
  const paidClaims = activeSet.filter((r) => r.paymentStatus === "paid").length;

  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    return reimbursements.filter((r) => {
      // Employees only see their own claims
      if (isEmployeeOnly) {
        const isMine = r.employeeId === myId || (myCode && r.employeeId === myCode);
        if (!isMine) return false;
      }

      const empName = nameOf(r.employeeId).toLowerCase();
      const matchQ =
        r.id.toLowerCase().includes(q.toLowerCase()) ||
        empName.includes(q.toLowerCase()) ||
        r.description.toLowerCase().includes(q.toLowerCase());
      const matchCat = catFilter === "all" || r.category === catFilter;
      const matchStatus = statusFilter === "all" || r.approvalStatus === statusFilter;
      return matchQ && matchCat && matchStatus;
    });
  }, [reimbursements, isEmployeeOnly, myId, myCode, q, catFilter, statusFilter, nameOf]);

  const PAGE_SIZE = 5;
  const totalPages = Math.ceil(rows.length / PAGE_SIZE) || 1;
  const paginatedRows = useMemo(() => {
    return rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [rows, page]);

  const handleSubmit = async () => {
    const next: Record<string, string | undefined> = {};
    if (!form.amount || Number(form.amount) <= 0) next["amount"] = "Enter a valid amount in ₹.";
    if (form.description.trim().length < 5) next["description"] = "Describe the business expense.";
    setErrors(next);
    if (Object.keys(next).length) return;

    let receiptPayload: string | undefined = undefined;
    if (attachments.length > 0) {
      const converted = await Promise.all(
        attachments.map(
          (file) =>
            new Promise<{ name: string; type: string; url: string }>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve({ name: file.name, type: file.type, url: reader.result as string });
              reader.onerror = () => resolve({ name: file.name, type: file.type, url: "#" });
              reader.readAsDataURL(file);
            }),
        ),
      );
      receiptPayload = JSON.stringify(converted);
    }

    const newClaim: ReimbursementClaim = {
      id: `CLM-${Date.now().toString().slice(-4)}`,
      employeeId: myId,
      category: form.category,
      amount: Number(form.amount),
      submittedDate: form.submittedDate,
      receiptStatus: attachments.length > 0 ? "Uploaded" : "Missing",
      approvalStatus: "pending",
      paymentStatus: "unpaid",
      description: form.description.trim(),
      receiptFileName: receiptPayload,
      receiptUrl: receiptPayload,
      paymentMethod: form.paymentMethod,
    };

    try {
      await submitReimbursement(newClaim);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit reimbursement";
      toast.error("Submission failed", { description: msg });
      return;
    }

    log(`Submitted expense claim ${newClaim.id} for ${inr(newClaim.amount)}`, "Reimbursements");
    toast.success("Expense claim submitted", {
      description: attachments.length > 0
        ? `Submitted with ${attachments.length} attachment(s).`
        : "Submitted without attachments.",
    });
    setAddOpen(false);
    setForm(emptyClaim);
    setAttachments([]);
  };

  const handleDecision = async (
    claimId: string,
    approvalStatus: ReimbursementClaim["approvalStatus"],
  ) => {
    await updateReimbursement(claimId, { approvalStatus });
    log(`Updated claim ${claimId} status to ${approvalStatus}`, "Reimbursements");
    toast.success(`Claim status updated to ${approvalStatus}`);
    if (viewClaim?.id === claimId) {
      setViewClaim((prev) => (prev ? { ...prev, approvalStatus } : null));
    }
  };

  const handleMarkPaid = async (claimId: string) => {
    await updateReimbursement(claimId, { paymentStatus: "paid" });
    log(`Marked claim ${claimId} as paid`, "Reimbursements");
    toast.success("Claim marked as disbursed / paid");
    if (viewClaim?.id === claimId) {
      setViewClaim((prev) => (prev ? { ...prev, paymentStatus: "paid" } : null));
    }
  };

  const handleDownloadReceipt = (claim: ReimbursementClaim) => {
    const attachs = parseClaimAttachments(claim);
    if (attachs.length === 0) {
      toast.info("No attachment found for this claim.");
      return;
    }
    setPreviewAttachment(attachs[0]!);
  };

  return (
    <>
      <PageHeader
        title="Reimbursements"
        description="Employee business expense claims, receipt validation, approval workflows, and disbursals."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 size-4" /> Submit reimbursement
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total Claims"
          value={totalClaims}
          hint="All time recorded"
          icon={<ReceiptText className="size-5" />}
        />
        <StatCard
          label="Pending Claims"
          value={pendingClaims}
          hint="Requires review"
          icon={<Clock className="size-5" />}
          tone="warning"
        />
        <StatCard
          label="Approved Amount"
          value={inr(approvedAmount)}
          hint={`${approvedClaims.length} claims approved`}
          icon={<CheckCircle2 className="size-5" />}
          tone="success"
        />
        <StatCard
          label="Paid Claims"
          value={paidClaims}
          hint="Disbursed to date"
          icon={<FileCheck className="size-5" />}
          tone="accent"
        />
        <StatCard
          label="Rejected Claims"
          value={rejectedClaims}
          hint="Policy violations"
          icon={<XCircle className="size-5" />}
          tone="default"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Expense Claims</CardTitle>
              <CardDescription>
                {isEmployeeOnly
                  ? "Showing only your submitted claims"
                  : "All departmental expense submissions"}
              </CardDescription>
            </div>
          </div>

          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search claim ID or description..."
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
                <SelectItem value="Travel">Travel</SelectItem>
                <SelectItem value="Food">Food & Entertainment</SelectItem>
                <SelectItem value="Medical">Medical</SelectItem>
                <SelectItem value="Internet">Internet & Telecom</SelectItem>
                <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                <SelectItem value="Training">Training & Education</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Approval Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="changes_requested">Changes Requested</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {!ready ? (
            <div className="p-4">
              <TableSkeleton rows={5} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="No reimbursement claims found"
              description="No expense records match your current filters."
              icon={<Receipt className="size-8" />}
            />
          ) : (
            <>
              {/* Pagination ON TOP of Reimbursement Claims */}
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={rows.length}
                pageSize={5}
                onPageChange={setPage}
              />
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Claim ID</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Submitted Date</TableHead>
                      <TableHead>Receipt</TableHead>
                      <TableHead>Approval Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs font-semibold text-primary">
                          {r.id}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{nameOf(r.employeeId)}</div>
                          <div className="text-xs text-muted-foreground">{r.employeeId}</div>
                        </TableCell>
                        <TableCell>{r.category}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {inr(r.amount)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.submittedDate}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={r.receiptStatus} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={r.approvalStatus} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={r.paymentStatus} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={() => setViewClaim(r)}
                              title="View claim"
                            >
                              <Eye className="size-3.5" />
                            </Button>
                            {r.receiptFileName && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-muted-foreground hover:text-foreground"
                                onClick={() => handleDownloadReceipt(r)}
                                title="Download receipt"
                              >
                                <Download className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={rows.length}
                pageSize={5}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Submit Reimbursement Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Reimbursement Claim</DialogTitle>
            <DialogDescription>
              Submit out-of-pocket expenses for corporate review.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v as ReimbursementCategory })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Travel">Travel</SelectItem>
                    <SelectItem value="Food">Food</SelectItem>
                    <SelectItem value="Medical">Medical</SelectItem>
                    <SelectItem value="Internet">Internet</SelectItem>
                    <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                    <SelectItem value="Training">Training</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Amount (₹)" error={errors["amount"]}>
                <Input
                  type="number"
                  placeholder="e.g. 2500"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Expense Date">
                <Input
                  type="date"
                  value={form.submittedDate}
                  onChange={(e) => setForm({ ...form, submittedDate: e.target.value })}
                />
              </Field>

              <Field label="Disbursement Method">
                <Select
                  value={form.paymentMethod}
                  onValueChange={(v) =>
                    setForm({ ...form, paymentMethod: v as ReimbursementClaim["paymentMethod"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Payroll Cycle">Next Payroll Cycle</SelectItem>
                    <SelectItem value="UPI">UPI Direct</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Description & Justification" error={errors["description"]}>
              <Textarea
                rows={3}
                placeholder="Reason for expenditure and attendees if food/travel..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>

            <Field label="Supporting Attachments (Optional — Max 2 Files)">
              <div className="space-y-2">
                {attachments.length < 2 && (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-3.5 transition-colors hover:bg-muted/50">
                    <UploadCloud className="size-5 text-muted-foreground" />
                    <span className="mt-1 text-xs font-medium text-foreground">
                      Click to choose files (Receipts, Invoices, PDFs, Images)
                    </span>
                    <span className="text-[0.7rem] text-muted-foreground">
                      {attachments.length === 0 ? "Optional · Up to 2 files" : "1 file attached · Add 1 more"}
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={handleFileChange}
                    />
                  </label>
                )}

                {attachments.length > 0 && (
                  <div className="space-y-1.5">
                    {attachments.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-md border border-border bg-background p-2 text-xs"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText className="size-4 shrink-0 text-primary" />
                          <span className="truncate font-medium">{file.name}</span>
                          <span className="shrink-0 text-[0.68rem] text-muted-foreground">
                            ({(file.size / 1024).toFixed(0)} KB)
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeAttachment(idx)}
                        >
                          <XCircle className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[0.68rem] text-muted-foreground">
                  UI Demonstration: Files are attached locally in session memory without server blob storage.
                </p>
              </div>
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Submit Claim</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Claim Detail Drawer / Modal */}
      {viewClaim && (
        <Dialog open={!!viewClaim} onOpenChange={(o) => !o && setViewClaim(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>Claim · {viewClaim.id}</DialogTitle>
                <StatusBadge status={viewClaim.approvalStatus} />
              </div>
              <DialogDescription>
                Submitted by {nameOf(viewClaim.employeeId)} on {viewClaim.submittedDate}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/40 p-3.5">
                <div>
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="font-medium">{viewClaim.category}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Claim Amount</p>
                  <p className="font-display text-base font-semibold text-primary">
                    {inr(viewClaim.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Disbursement Mode</p>
                  <p className="font-medium">{viewClaim.paymentMethod}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Payment Status</p>
                  <StatusBadge status={viewClaim.paymentStatus} />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Business Justification
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {viewClaim.description}
                </p>
              </div>

              {parseClaimAttachments(viewClaim).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Supporting Attachments ({parseClaimAttachments(viewClaim).length})
                  </p>
                  <div className="space-y-1.5">
                    {parseClaimAttachments(viewClaim).map((att, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-md border border-border bg-background p-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText className="size-4 shrink-0 text-primary" />
                          <span className="truncate font-medium">{att.name}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setPreviewAttachment(att)}
                        >
                          <Eye className="mr-1 size-3.5 text-primary" /> View / Open
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {canApprove && (
                <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Approver Controls
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      className="bg-success text-success-foreground hover:bg-success/90"
                      onClick={() => handleDecision(viewClaim.id, "approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDecision(viewClaim.id, "rejected")}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDecision(viewClaim.id, "changes_requested")}
                    >
                      Request Changes
                    </Button>
                    {viewClaim.approvalStatus === "approved" &&
                      viewClaim.paymentStatus !== "paid" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleMarkPaid(viewClaim.id)}
                        >
                          Mark as Paid
                        </Button>
                      )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setViewClaim(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Attachment Preview Modal */}
      {previewAttachment && (
        <Dialog open={!!previewAttachment} onOpenChange={(open) => !open && setPreviewAttachment(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="truncate pr-4">{previewAttachment.name}</DialogTitle>
              <DialogDescription>
                Uploaded supporting attachment preview
              </DialogDescription>
            </DialogHeader>
            <div className="my-2 max-h-[70vh] overflow-auto flex items-center justify-center bg-muted/20 p-2 rounded-lg border border-border">
              {previewAttachment.url && previewAttachment.url !== "#" ? (
                previewAttachment.type?.startsWith("image/") || previewAttachment.url.startsWith("data:image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(previewAttachment.name) ? (
                  <img src={previewAttachment.url} alt={previewAttachment.name} className="max-h-[65vh] w-auto max-w-full rounded object-contain" />
                ) : (
                  <iframe src={previewAttachment.url} title={previewAttachment.name} className="w-full h-[60vh] border-0 rounded" />
                )
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Attachment reference: <span className="font-semibold text-foreground">{previewAttachment.name}</span>
                </div>
              )}
            </div>
            <DialogFooter className="flex items-center justify-between gap-2">
              {previewAttachment.url && previewAttachment.url !== "#" ? (
                <a
                  href={previewAttachment.url}
                  download={previewAttachment.name}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                  <Download className="size-3.5" /> Download File
                </a>
              ) : <div />}
              <Button variant="outline" onClick={() => setPreviewAttachment(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
