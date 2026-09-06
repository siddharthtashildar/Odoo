import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Headphones,
  LifeBuoy,
  MessageSquare,
  Plus,
  Search,
  Send,
  ShieldAlert,
  UserCheck,
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
import type { HelpdeskTicket, TicketCategory, TicketPriority, TicketStatus } from "@/lib/mock-data";



export const Route = createFileRoute("/app/helpdesk")({
  head: () => ({
    meta: [
      { title: "IT Helpdesk · PeoplePay360" },
      { name: "description", content: "Service desk ticketing, hardware support, software provisioning, and incident resolution." },
      { property: "og:title", content: "IT Helpdesk · PeoplePay360" },
    ],
  }),
  component: HelpdeskPage,
});

const emptyTicket = {
  subject: "",
  category: "Hardware" as TicketCategory,
  priority: "Medium" as TicketPriority,
  description: "",
};

function HelpdeskPage() {
  const { helpdesk, employees, createTicket, updateTicket, addTicketComment, log, role, persona } = useApp();
  const nameOf = useEmployeeName();
  const ready = useDelayed();

  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [addOpen, setAddOpen] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");

  const [form, setForm] = useState(emptyTicket);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const isEmployeeOnly = role === "employee";
  const canTriage = role === "it_asset_manager" || role === "admin" || role === "hr_manager";

  const me = employees.find(
    (e) =>
      e.id === persona.employeeId ||
      e.code === persona.employeeCode ||
      (persona.email && e.email.toLowerCase() === persona.email.toLowerCase()),
  );
  const myId = me?.id || persona.employeeId;
  const myCode = me?.code || persona.employeeCode;

  const isTicketMine = (t: HelpdeskTicket) =>
    t.requesterId === myId ||
    (myCode && (t.requesterId === myCode || (t as any).employeeId === myCode || (t as any).employeeCode === myCode)) ||
    (me?.email && ((t as any).employeeEmail?.toLowerCase() === me.email.toLowerCase() || (t as any).email?.toLowerCase() === me.email.toLowerCase()));

  // Summaries
  const myTickets = helpdesk.filter(isTicketMine);
  const activeTicketSet = isEmployeeOnly ? myTickets : helpdesk;
  const openTickets = activeTicketSet.filter((t) => t.status === "Open" || t.status === "In Progress");
  const criticalCount = activeTicketSet.filter((t) => (t.priority === "Critical" || t.priority === "High") && t.status !== "Closed").length;
  const resolvedCount = activeTicketSet.filter((t) => t.status === "Resolved" || t.status === "Closed").length;
  const myAssignedCount = isEmployeeOnly ? myTickets.length : helpdesk.filter((t) => t.assignedTechnician === persona.name).length;

  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    return helpdesk.filter((t) => {
      if (isEmployeeOnly) {
        if (!isTicketMine(t)) return false;
      }

      const requesterName = nameOf(t.requesterId || (t as any).employeeId || "").toLowerCase();
      const matchQ =
        t.id.toLowerCase().includes(q.toLowerCase()) ||
        t.subject.toLowerCase().includes(q.toLowerCase()) ||
        requesterName.includes(q.toLowerCase());
      const matchCat = catFilter === "all" || t.category === catFilter;
      const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      return matchQ && matchCat && matchPriority && matchStatus;
    });
  }, [helpdesk, isEmployeeOnly, myId, myCode, me?.email, q, catFilter, priorityFilter, statusFilter, nameOf]);

  const PAGE_SIZE = 5;
  const totalPages = Math.ceil(rows.length / PAGE_SIZE) || 1;
  const paginatedRows = useMemo(() => {
    return rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [rows, page]);

  const activeTicket = helpdesk.find(
    (t) => t.id === activeTicketId || (t as any).ticketId === activeTicketId || (t as any).ticketNumber === activeTicketId,
  ) ?? null;

  const handleCreate = () => {
    const next: Record<string, string | undefined> = {};
    if (form.subject.trim().length < 5) next["subject"] = "Enter a descriptive subject (5+ chars).";
    if (form.description.trim().length < 10) next["description"] = "Provide more detail about the issue.";
    setErrors(next);
    if (Object.keys(next).length) return;

    const newTkt: HelpdeskTicket = {
      id: `TKT-${Date.now().toString().slice(-4)}`,
      subject: form.subject.trim(),
      requesterId: myId,
      category: form.category,
      priority: form.priority,
      assignedTechnician: "Karan Shah", // Default IT Lead
      createdDate: new Date().toISOString().slice(0, 10),
      updatedDate: new Date().toISOString().slice(0, 10),
      status: "Open",
      description: form.description.trim(),
      comments: [
        {
          id: `C-${Date.now().toString().slice(-4)}`,
          author: persona.name,
          text: form.description.trim(),
          at: new Date().toISOString().slice(0, 16).replace("T", " "),
        },
      ],
    };

    createTicket(newTkt);
    log(`Created helpdesk ticket ${newTkt.id}: ${newTkt.subject}`, "Helpdesk");
    toast.success("Helpdesk ticket opened", {
      description: `Ticket ${newTkt.id} assigned to IT triage.`,
    });
    setForm(emptyTicket);
    setAddOpen(false);
  };

  const handlePostComment = () => {
    if (!activeTicket || !newComment.trim()) return;
    addTicketComment(activeTicket.id, persona.name, newComment.trim());
    log(`Added comment on ticket ${activeTicket.id}`, "Helpdesk");
    setNewComment("");
    toast.success("Comment added");
  };

  const handleStatusChange = (status: TicketStatus) => {
    if (!activeTicket) return;
    // Pass UI label directly; store.updateTicket converts to backend value
    updateTicket(activeTicket.id, { status });
    log(`Changed ticket ${activeTicket.id} status to ${status}`, "Helpdesk");
    toast.success(`Ticket status updated to ${status}`);
  };

  const handlePriorityChange = (priority: TicketPriority) => {
    if (!activeTicket) return;
    updateTicket(activeTicket.id, { priority });
    log(`Changed ticket ${activeTicket.id} priority to ${priority}`, "Helpdesk");
    toast.success(`Priority set to ${priority}`);
  };

  const handleAssigneeChange = (assignedTechnician: string) => {
    if (!activeTicket) return;
    updateTicket(activeTicket.id, { assignedTechnician });
    log(`Reassigned ticket ${activeTicket.id} to ${assignedTechnician}`, "Helpdesk");
    toast.success(`Ticket reassigned to ${assignedTechnician}`);
  };

  return (
    <>
      <PageHeader
        title={isEmployeeOnly ? "My IT Support Tickets" : "IT Helpdesk"}
        description={
          isEmployeeOnly
            ? `Track and manage technical support and access requests submitted by ${me?.name || persona.name}`
            : "Internal technical support, device provisioning, network diagnostics, and access ticket resolution."
        }
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 size-4" /> Create ticket
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={isEmployeeOnly ? "My Active Tickets" : "Open Tickets"}
          value={openTickets.length}
          hint={isEmployeeOnly ? "Currently in progress" : "Active queue across IT"}
          icon={<LifeBuoy className="size-5" />}
          tone="default"
        />
        <StatCard
          label={isEmployeeOnly ? "High / Urgent" : "Critical Priority"}
          value={criticalCount}
          hint={isEmployeeOnly ? "High priority requests" : "Requires < 2hr resolution"}
          icon={<ShieldAlert className="size-5" />}
          tone="warning"
        />
        <StatCard
          label={isEmployeeOnly ? "Total Tickets Filed" : "Assigned to Me"}
          value={myAssignedCount}
          hint={isEmployeeOnly ? "All time support requests" : "Your queue workload"}
          icon={<UserCheck className="size-5" />}
          tone="accent"
        />
        <StatCard
          label="Resolved / Closed"
          value={resolvedCount}
          hint="Completed tickets"
          icon={<CheckCircle2 className="size-5" />}
          tone="success"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Ticket Queue</CardTitle>
              <CardDescription>
                {isEmployeeOnly ? "Your submitted support tickets" : "Central technical support queue"}
              </CardDescription>
            </div>
          </div>

          <div className="mt-2 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search ticket subject..."
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
                <SelectItem value="Hardware">Hardware</SelectItem>
                <SelectItem value="Software">Software</SelectItem>
                <SelectItem value="Network">Network</SelectItem>
                <SelectItem value="Account Access">Account Access</SelectItem>
                <SelectItem value="Email">Email</SelectItem>
                <SelectItem value="Payroll System">Payroll System</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Critical">Critical</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Waiting for User">Waiting for User</SelectItem>
                <SelectItem value="Resolved">Resolved</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
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
              title="No tickets found"
              description="No support requests match your selected filters."
              icon={<LifeBuoy className="size-8" />}
            />
          ) : (
            <>
              {/* Pagination ON TOP of IT Helpdesk Tickets */}
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
                      <TableHead>Ticket ID</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Requester</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Assigned Technician</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRows.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs font-semibold text-primary">
                          {t.id}
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          <p className="font-medium truncate text-sm">{t.subject}</p>
                          <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{nameOf(t.requesterId)}</div>
                          <div className="text-xs text-muted-foreground">{t.requesterId}</div>
                        </TableCell>
                        <TableCell>{t.category}</TableCell>
                        <TableCell>
                          <StatusBadge status={t.priority} />
                        </TableCell>
                        <TableCell className="text-sm">{t.assignedTechnician}</TableCell>
                        <TableCell>
                          <StatusBadge status={t.status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.updatedDate}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => setActiveTicketId(t.id)}
                            title="Open ticket thread"
                          >
                            <Eye className="size-3.5 mr-1" /> View
                          </Button>
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

      {/* Create Ticket Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Support Ticket</DialogTitle>
            <DialogDescription>
              Report hardware issues, network troubles, or access requests.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Field label="Subject / Summary" error={errors["subject"]}>
              <Input
                placeholder="Brief summary of the issue..."
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v as TicketCategory })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hardware">Hardware</SelectItem>
                    <SelectItem value="Software">Software</SelectItem>
                    <SelectItem value="Network">Network</SelectItem>
                    <SelectItem value="Account Access">Account Access</SelectItem>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="Payroll System">Payroll System</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Priority">
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm({ ...form, priority: v as TicketPriority })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Detailed Description" error={errors["description"]}>
              <Textarea
                rows={4}
                placeholder="Describe what happened, steps to reproduce, device tag if applicable..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Submit Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail & Thread Modal */}
      {activeTicket && (
        <Dialog open={!!activeTicket} onOpenChange={(o) => !o && setActiveTicketId(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <DialogHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-primary">
                    {activeTicket.id}
                  </span>
                  <StatusBadge status={activeTicket.priority} />
                </div>
                <StatusBadge status={activeTicket.status} />
              </div>
              <DialogTitle className="text-base sm:text-lg mt-1">{activeTicket.subject}</DialogTitle>
              <DialogDescription>
                Opened by {nameOf(activeTicket.requesterId)} on {activeTicket.createdDate}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
              {/* Controls bar */}
              <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs">
                <div>
                  <span className="text-muted-foreground block mb-1">Status</span>
                  {canTriage ? (
                    <Select
                      value={activeTicket.status}
                      onValueChange={(v) => handleStatusChange(v as TicketStatus)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Open">Open</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Waiting for User">Waiting for User</SelectItem>
                        <SelectItem value="Resolved">Resolved</SelectItem>
                        <SelectItem value="Closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="font-medium">{activeTicket.status}</span>
                  )}
                </div>

                <div>
                  <span className="text-muted-foreground block mb-1">Priority</span>
                  {canTriage ? (
                    <Select
                      value={activeTicket.priority}
                      onValueChange={(v) => handlePriorityChange(v as TicketPriority)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="font-medium">{activeTicket.priority}</span>
                  )}
                </div>

                <div>
                  <span className="text-muted-foreground block mb-1">Technician</span>
                  {canTriage ? (
                    <Select
                      value={activeTicket.assignedTechnician}
                      onValueChange={handleAssigneeChange}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Neel Shah">Neel Shah (IT Lead)</SelectItem>
                        <SelectItem value="Devika Rao">Devika Rao (Finance)</SelectItem>
                        <SelectItem value="Sana Iqbal">Sana Iqbal (HR)</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="font-medium">{activeTicket.assignedTechnician}</span>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="rounded-md border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Original Issue Description
                </p>
                <p className="mt-1 text-sm leading-relaxed">{activeTicket.description}</p>
              </div>

              {/* Conversation History */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Activity & Comments ({activeTicket.comments.length})
                </p>
                <div className="space-y-2">
                  {activeTicket.comments.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg border border-border bg-card p-3 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{c.author}</span>
                        <span className="text-muted-foreground">{c.at}</span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{c.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Comment composer */}
            <div className="pt-2 border-t border-border flex items-center gap-2">
              <Input
                placeholder="Write a reply or update..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePostComment()}
                className="text-sm"
              />
              <Button size="sm" onClick={handlePostComment}>
                <Send className="size-4 mr-1" /> Reply
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
