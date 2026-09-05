import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string | undefined;
  icon?: ReactNode | undefined;
  tone?: "default" | "accent" | "success" | "warning" | undefined;
}) {
  const tones = {
    default: "bg-primary/10 text-primary",
    accent: "bg-accent/20 text-accent-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
  } as const;
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</p>
          {hint ? <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {icon ? <span className={cn("rounded-lg p-2", tones[tone])}>{icon}</span> : null}
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string | undefined;
  action?: ReactNode | undefined;
  icon?: ReactNode | undefined;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-14 text-center">
      {icon ? <div className="rounded-full bg-muted p-3 text-muted-foreground">{icon}</div> : null}
      <div>
        <p className="font-medium">{title}</p>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-1">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

const statusTone: Record<string, string> = {
  active: "bg-success/15 text-success border-success/30",
  approved: "bg-success/15 text-success border-success/30",
  paid: "bg-success/15 text-success border-success/30",
  settled: "bg-success/15 text-success border-success/30",
  resolved: "bg-success/15 text-success border-success/30",
  completed: "bg-success/15 text-success border-success/30",
  present: "bg-success/15 text-success border-success/30",
  cleared: "bg-success/15 text-success border-success/30",
  available: "bg-success/15 text-success border-success/30",
  good: "bg-success/15 text-success border-success/30",
  new: "bg-success/15 text-success border-success/30",
  
  assigned: "bg-info/15 text-info border-info/30",
  in_progress: "bg-info/15 text-info border-info/30",
  "in progress": "bg-info/15 text-info border-info/30",
  processing: "bg-info/15 text-info border-info/30",
  onboarding: "bg-info/15 text-info border-info/30",
  "account created": "bg-info/15 text-info border-info/30",
  "invitation sent": "bg-info/15 text-info border-info/30",
  sent: "bg-info/15 text-info border-info/30",
  
  pending: "bg-warning/25 text-warning-foreground border-warning/40",
  pending_approval: "bg-warning/25 text-warning-foreground border-warning/40",
  "pending clearance": "bg-warning/25 text-warning-foreground border-warning/40",
  "expiring soon": "bg-warning/25 text-warning-foreground border-warning/40",
  "waiting for user": "bg-warning/25 text-warning-foreground border-warning/40",
  late: "bg-warning/25 text-warning-foreground border-warning/40",
  "half day": "bg-warning/25 text-warning-foreground border-warning/40",
  medium: "bg-warning/25 text-warning-foreground border-warning/40",
  open: "bg-warning/25 text-warning-foreground border-warning/40",
  on_leave: "bg-warning/25 text-warning-foreground border-warning/40",
  "on leave": "bg-warning/25 text-warning-foreground border-warning/40",
  "changes requested": "bg-warning/25 text-warning-foreground border-warning/40",
  changes_requested: "bg-warning/25 text-warning-foreground border-warning/40",
  
  draft: "bg-muted text-muted-foreground border-border",
  in_stock: "bg-muted text-muted-foreground border-border",
  exited: "bg-muted text-muted-foreground border-border",
  retired: "bg-muted text-muted-foreground border-border",
  returned: "bg-muted text-muted-foreground border-border",
  low: "bg-muted text-muted-foreground border-border",
  "not started": "bg-muted text-muted-foreground border-border",
  closed: "bg-muted text-muted-foreground border-border",
  holiday: "bg-primary/10 text-primary border-primary/25",
  
  offboarding: "bg-destructive/15 text-destructive border-destructive/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  repair: "bg-destructive/15 text-destructive border-destructive/30",
  "under maintenance": "bg-destructive/15 text-destructive border-destructive/30",
  absent: "bg-destructive/15 text-destructive border-destructive/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  expired: "bg-destructive/15 text-destructive border-destructive/30",
  terminated: "bg-destructive/15 text-destructive border-destructive/30",
  lost: "bg-destructive/15 text-destructive border-destructive/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-destructive/15 text-destructive border-destructive/30",
  overdue: "bg-destructive/15 text-destructive border-destructive/30",
  "needs service": "bg-destructive/15 text-destructive border-destructive/30",
};

export function StatusBadge({ status }: { status: string }) {
  const norm = status.toLowerCase().replace(/_/g, " ");
  return (
    <Badge variant="outline" className={cn("capitalize font-medium text-xs", statusTone[norm] ?? statusTone[status.toLowerCase()] ?? "bg-muted text-muted-foreground")}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

export function Field({
  label,
  error,
  className,
  hint,
  children,
}: {
  label: string;
  error?: string | undefined;
  className?: string | undefined;
  hint?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-sm font-medium leading-none">{label}</label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
