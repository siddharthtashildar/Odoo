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
  Sparkles,
  UploadCloud,
  Users,
  XCircle,
  ArrowRight,
  ShieldCheck,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Field, PageHeader, StatusBadge, TableSkeleton, TablePagination } from "@/components/bits";
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

  // Compute metrics for conversational hero
  const myClaims = reimbursements.filter((r) => r.employeeId === myId || (myCode && r.employeeId === myCode));
  const activeSet = isEmployeeOnly ? myClaims : reimbursements;

  const totalClaimsCount = activeSet.length;
  const pendingClaimsList = activeSet.filter((r) => r.approvalStatus === "pending");
  const pendingCount = pendingClaimsList.length;
  const approvedClaimsList = activeSet.filter((r) => r.approvalStatus === "approved");
  const approvedAmountTotal = approvedClaimsList.reduce((s, r) => s + r.amount, 0);
  const paidCount = activeSet.filter((r) => r.paymentStatus === "paid").length;

  // Get distinct recent claim submitter names for human headline
  const recentSubmitters = useMemo(() => {
    const names: string[] = [];
    activeSet.forEach((r) => {
      const n = nameOf(r.employeeId);
      if (n && n !== "Unknown" && !names.includes(n)) {
        names.push(n);
      }
    });
    return names;
  }, [activeSet, nameOf]);

  const heroHeadline = useMemo(() => {
    if (pendingCount === 0) {
      return "All clear! Every teammate's expense claim is currently up to date.";
    }
    const firstTwo = recentSubmitters.slice(0, 2);
    const restCount = Math.max(0, recentSubmitters.length - 2);
    const who = firstTwo.length > 0 ? firstTwo.join(", ") : "Teammates";
    const extra = restCount > 0 ? ` and ${restCount} others` : "";
    return `${who}${extra} submitted claims recently. ${pendingCount} ${pendingCount === 1 ? "claim is" : "claims are"} waiting for your sign-off.`;
  }, [pendingCount, recentSubmitters]);

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
    <div className="space-y-6">
      {/* Human-Centered Page Header */}
      <PageHeader
        title="Expense Claims & Reimbursements"
        description="Every claim represents out-of-pocket effort by your team. Verify receipts and approve disbursals promptly."
        actions={
          <Button
            onClick={() => setAddOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Plus className="mr-2 size-4" /> Claim Expense
          </Button>
        }
      />

      {/* ONE BOLD VISUAL IDEA: Human Conversational Pulse Banner (Replaces 4 uniform stat cards) */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-secondary/50 p-6 shadow-xs">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" />
              <span>Team Expense Overview</span>
            </div>
            
            <h2 className="text-xl font-medium tracking-tight text-foreground sm:text-2xl">
              {heroHeadline}
            </h2>
            
            <p className="text-sm text-muted-foreground">
              {isEmployeeOnly
                ? `You have ${myClaims.length} recorded claims totaling ${inr(approvedAmountTotal)} in approved reimbursements.`
                : `Totaling ${inr(approvedAmountTotal)} approved across ${approvedClaimsList.length} verified expense claims.`}
            </p>

            {/* Avatar Stack of Team Members */}
            {recentSubmitters.length > 0 && (
              <div className="flex items-center gap-3 pt-1">
                <div className="flex -space-x-2 overflow-hidden">
                  {recentSubmitters.slice(0, 4).map((name, i) => (
                    <Avatar key={i} className="size-8 border-2 border-background ring-1 ring-border">
                      <AvatarFallback className="bg-primary/15 text-[0.7rem] font-semibold text-primary">
                        {name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground font-medium">
                  {recentSubmitters.slice(0, 3).join(", ")} {recentSubmitters.length > 3 ? `+${recentSubmitters.length - 3} more` : ""}
                </span>
              </div>
            )}
          </div>

          {/* Quiet, Disciplined Metric Badges */}
          <div className="flex flex-wrap items-center gap-3 lg:flex-col lg:items-end">
            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-background/80 px-4 py-2.5 shadow-2xs">
              <Clock className="size-4 text-accent" />
              <div className="text-right">
                <p className="text-[0.7rem] uppercase font-semibold text-muted-foreground">Pending Review</p>
                <p className="font-display text-lg font-bold text-foreground tabular-nums">{pendingCount} claims</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-background/80 px-4 py-2.5 shadow-2xs">
              <CheckCircle2 className="size-4 text-success" />
              <div className="text-right">
                <p className="text-[0.7rem] uppercase font-semibold text-muted-foreground">Approved Disbursal</p>
                <p className="font-display text-lg font-bold text-foreground tabular-nums">{inr(approvedAmountTotal)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card with Tactile Human Controls */}
      <Card className="border border-border shadow-xs">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Expense Claims</CardTitle>
              <CardDescription>
                {isEmployeeOnly
                  ? "Showing claims submitted by you"
                  : "All departmental expense submissions and receipt verifications"}
              </CardDescription>
            </div>

            {/* Tactile Status Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto rounded-lg border border-border bg-muted/40 p-1">
              {[
                { id: "all", label: `All (${activeSet.length})` },
                { id: "pending", label: `Needs Review (${pendingCount})` },
                { id: "approved", label: `Approved (${approvedClaimsList.length})` },
                { id: "paid", label: `Disbursed (${paidCount})` },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setStatusFilter(pill.id)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-primary ${
                    statusFilter === pill.id
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by team member, claim ID, or reason..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              />
            </div>

            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                <SelectValue placeholder="Filter by Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Travel">Travel & Lodging</SelectItem>
                <SelectItem value="Food">Food & Teammate Outings</SelectItem>
                <SelectItem value="Medical">Medical Insurance / Expenses</SelectItem>
                <SelectItem value="Internet">Internet & Work Wi-Fi</SelectItem>
                <SelectItem value="Office Supplies">Hardware & Supplies</SelectItem>
                <SelectItem value="Training">Workshops & Learning</SelectItem>
                <SelectItem value="Other">Other Expenses</SelectItem>
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
            <div className="p-8">
              <EmptyState
                title={statusFilter === "pending" ? "Everyone's claims are up to date!" : "No reimbursement claims match your filter"}
                description={
                  statusFilter === "pending"
                    ? "There are currently no pending expense claims awaiting manager sign-off."
                    : "Try adjusting your search keyword or resetting the category filter."
                }
                action={
                  statusFilter !== "all" || catFilter !== "all" || q ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStatusFilter("all");
                        setCatFilter("all");
                        setQ("");
                      }}
                      className="mt-2"
                    >
                      Reset All Filters
                    </Button>
                  ) : (
                    <Button onClick={() => setAddOpen(true)} size="sm" className="mt-2">
                      <Plus className="mr-2 size-4" /> Claim First Expense
                    </Button>
                  )
                }
                icon={<Receipt className="size-8 text-muted-foreground" />}
              />
            </div>
          ) : (
            <>
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={rows.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-[110px]">Claim ID</TableHead>
                      <TableHead>Teammate</TableHead>
                      <TableHead>Category & Notes</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Receipt</TableHead>
                      <TableHead>Approval</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRows.map((r) => {
                      const empName = nameOf(r.employeeId);
                      return (
                        <TableRow key={r.id} className="hover:bg-muted/20 transition-colors">
                          <TableCell className="font-mono text-xs font-semibold text-primary">
                            {r.id}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar className="size-7">
                                <AvatarFallback className="bg-primary/10 text-[0.65rem] font-semibold text-primary">
                                  {empName.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium text-foreground text-sm">{empName}</div>
                                <div className="text-[0.7rem] text-muted-foreground">{r.employeeId}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-xs">{r.category}</div>
                            <div className="max-w-[200px] truncate text-[0.75rem] text-muted-foreground">
                              {r.description}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-display text-sm font-semibold text-foreground tabular-nums">
                            {inr(r.amount)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
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
                                className="h-8 px-2 focus-visible:ring-2 focus-visible:ring-primary"
                                onClick={() => setViewClaim(r)}
                                title="View details"
                              >
                                <Eye className="size-3.5" />
                              </Button>
                              {r.receiptFileName && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
                                  onClick={() => handleDownloadReceipt(r)}
                                  title="View receipt"
                                >
                                  <Download className="size-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={rows.length}
                pageSize={PAGE_SIZE}
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
            <DialogTitle>Claim a Business Expense</DialogTitle>
            <DialogDescription>
              Submit your out-of-pocket expenses for team approval and quick disbursal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Expense Category">
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v as ReimbursementCategory })}
                >
                  <SelectTrigger className="focus-visible:ring-2 focus-visible:ring-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Travel">Travel & Lodging</SelectItem>
                    <SelectItem value="Food">Food & Entertainment</SelectItem>
                    <SelectItem value="Medical">Medical Insurance</SelectItem>
                    <SelectItem value="Internet">Internet & Telecom</SelectItem>
                    <SelectItem value="Office Supplies">Hardware & Supplies</SelectItem>
                    <SelectItem value="Training">Training & Certification</SelectItem>
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
                  className="focus-visible:ring-2 focus-visible:ring-primary"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Expense Date">
                <Input
                  type="date"
                  value={form.submittedDate}
                  onChange={(e) => setForm({ ...form, submittedDate: e.target.value })}
                  className="focus-visible:ring-2 focus-visible:ring-primary"
                />
              </Field>

              <Field label="Disbursement Method">
                <Select
                  value={form.paymentMethod}
                  onValueChange={(v) =>
                    setForm({ ...form, paymentMethod: v as ReimbursementClaim["paymentMethod"] })
                  }
                >
                  <SelectTrigger className="focus-visible:ring-2 focus-visible:ring-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bank Transfer">Direct Bank Transfer</SelectItem>
                    <SelectItem value="Payroll Cycle">Next Salary Cycle</SelectItem>
                    <SelectItem value="UPI">Instant UPI Direct</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Business Reason & Context" error={errors["description"]}>
              <Textarea
                rows={3}
                placeholder="Explain the work purpose (e.g., Client lunch with team, flight to HQ...)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="focus-visible:ring-2 focus-visible:ring-primary"
              />
            </Field>

            <Field label="Supporting Receipts (Optional — Max 2 Files)">
              <div className="space-y-2">
                {attachments.length < 2 && (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-3.5 transition-colors hover:bg-muted/50 focus-within:ring-2 focus-within:ring-primary">
                    <UploadCloud className="size-5 text-primary" />
                    <span className="mt-1 text-xs font-medium text-foreground">
                      Attach digital receipts (PDF, Image, Bill)
                    </span>
                    <span className="text-[0.7rem] text-muted-foreground">
                      {attachments.length === 0 ? "Up to 2 files" : "1 attached · Add 1 more"}
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
              </div>
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Submit Claim
            </Button>
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
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-secondary/30 p-3.5">
                <div>
                  <p className="text-xs text-muted-foreground">Expense Category</p>
                  <p className="font-medium text-foreground">{viewClaim.category}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Claimed</p>
                  <p className="font-display text-base font-bold text-primary">
                    {inr(viewClaim.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Disbursement Mode</p>
                  <p className="font-medium text-foreground">{viewClaim.paymentMethod}</p>
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
                <p className="mt-1 text-xs leading-relaxed text-foreground/90">
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
                          <Eye className="mr-1 size-3.5 text-primary" /> View Attachment
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {canApprove && (
                <div className="space-y-2 rounded-xl border border-border bg-card p-3.5 shadow-2xs">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Manager Sign-off Controls
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      className="bg-success text-success-foreground hover:bg-success/90"
                      onClick={() => handleDecision(viewClaim.id, "approved")}
                    >
                      <Check className="mr-1 size-3.5" /> Approve Claim
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
                          Mark Disbursed
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
    </div>
  );
}
