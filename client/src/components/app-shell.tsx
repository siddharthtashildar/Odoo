import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  BadgeIndianRupee,
  Building2,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  Clock,
  Coins,
  FileBarChart2,
  FileSignature,
  HandCoins,
  IndianRupee,
  Laptop,
  LayoutDashboard,
  LayoutList,
  LifeBuoy,
  LogOut,
  Menu,
  Moon,
  PackageCheck,
  Receipt,
  ReceiptText,
  Settings,
  ShieldCheck,
  Sun,
  UserMinus,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { ROLE_LABELS, type Role } from "@/lib/mock-data";

const NAV: { to: string; label: string; icon: typeof Users; roles: Role[]; group: string }[] = [
  // Overview
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Overview", roles: ["employee", "hr_manager", "payroll_user", "payroll_manager", "it_asset_manager", "admin"] },
  { to: "/app/me", label: "My Workspace", icon: UserRound, group: "Overview", roles: ["employee", "hr_manager", "payroll_user", "payroll_manager", "it_asset_manager", "admin"] },

  // People & Lifecycle
  { to: "/app/employees", label: "Employees", icon: Users, group: "People", roles: ["hr_manager", "payroll_user", "payroll_manager", "it_asset_manager", "admin"] },
  { to: "/app/onboarding", label: "Onboarding", icon: UserPlus, group: "People", roles: ["hr_manager", "payroll_user", "payroll_manager", "admin"] },
  { to: "/app/offboarding", label: "Offboarding", icon: UserMinus, group: "People", roles: ["hr_manager", "payroll_user", "payroll_manager", "admin"] },
  { to: "/app/contracts", label: "Contracts", icon: FileSignature, group: "People", roles: ["hr_manager", "payroll_user", "payroll_manager", "admin"] },

  // Time & Attendance
  { to: "/app/attendance", label: "Attendance", icon: Clock, group: "Time & Leave", roles: ["employee", "hr_manager", "payroll_user", "payroll_manager", "it_asset_manager", "admin"] },
  { to: "/app/leave", label: "Time Off", icon: CalendarDays, group: "Time & Leave", roles: ["employee", "hr_manager", "payroll_user", "payroll_manager", "admin"] },
  { to: "/app/schedule", label: "Work Schedule", icon: CalendarRange, group: "Time & Leave", roles: ["employee", "hr_manager", "payroll_user", "payroll_manager", "it_asset_manager", "admin"] },

  // Compensation & Finance
  { to: "/app/payroll", label: "Payroll", icon: Coins, group: "Compensation", roles: ["payroll_user", "payroll_manager", "admin"] },
  { to: "/app/salary", label: "Salary", icon: IndianRupee, group: "Compensation", roles: ["payroll_user", "payroll_manager", "admin"] },
  { to: "/app/salary-structure", label: "Salary Structure", icon: LayoutList, group: "Compensation", roles: ["payroll_user", "payroll_manager", "admin"] },
  { to: "/app/payslips", label: "Payslips", icon: Receipt, group: "Compensation", roles: ["employee", "hr_manager", "payroll_user", "payroll_manager", "admin"] },
  { to: "/app/reimbursement", label: "Reimbursement", icon: ReceiptText, group: "Compensation", roles: ["employee", "hr_manager", "payroll_user", "payroll_manager", "admin"] },

  // Operations & IT
  { to: "/app/assets", label: "AssetFlow", icon: Laptop, group: "Operations", roles: ["employee", "it_asset_manager", "hr_manager", "payroll_user", "payroll_manager", "admin"] },
  { to: "/app/asset-requests", label: "Asset Requests", icon: PackageCheck, group: "Operations", roles: ["employee", "it_asset_manager", "hr_manager", "payroll_user", "payroll_manager", "admin"] },
  { to: "/app/helpdesk", label: "IT Helpdesk", icon: LifeBuoy, group: "Operations", roles: ["employee", "it_asset_manager", "hr_manager", "payroll_user", "payroll_manager", "admin"] },

  // Insights & Governance
  { to: "/app/reports", label: "Reports", icon: FileBarChart2, group: "Insights", roles: ["hr_manager", "payroll_user", "payroll_manager", "admin"] },
  { to: "/app/admin", label: "Administration", icon: ShieldCheck, group: "Insights", roles: ["admin"] },
  { to: "/app/settings", label: "Settings", icon: Settings, group: "Insights", roles: ["employee", "hr_manager", "payroll_user", "payroll_manager", "it_asset_manager", "admin"] },
];

function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("pp360-theme");
    const isDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  const toggle = () => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("pp360-theme", next ? "dark" : "light");
      return next;
    });
  };
  return { dark, toggle };
}

export function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-lg bg-accent text-accent-foreground">
        <Building2 className="size-5" />
      </span>
      {!compact && (
        <span className="font-display text-lg font-semibold leading-none">
          PeoplePay<span className="text-accent">360</span>
        </span>
      )}
    </div>
  );
}

function NavList({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const items = NAV.filter((n) => n.roles.includes(role));
  const groups = Array.from(new Set(items.map((i) => i.group)));
  return (
    <nav className="space-y-6 px-3 py-4">
      {groups.map((g) => (
        <div key={g}>
          <p className="px-3 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/50">
            {g}
          </p>
          <ul className="space-y-0.5">
            {items
              .filter((i) => i.group === g)
              .map((i) => (
                <li key={i.to}>
                  <Link
                    to={i.to}
                    onClick={onNavigate}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:font-medium data-[status=active]:text-sidebar-primary"
                  >
                    <i.icon className="size-4 shrink-0" />
                    {i.label}
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { role, setRole, persona, signOut } = useApp();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const current = NAV.find((n) => path.startsWith(n.to));

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="px-5 py-5 text-sidebar-foreground">
          <Brand />
        </div>
        <NavList role={role} />
        <div className="mt-auto p-4 text-[0.7rem] leading-relaxed text-sidebar-foreground/50">
          Production Workspace · Realtime PostgreSQL &amp; Better Auth
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur sm:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 overflow-y-auto bg-sidebar p-0 text-sidebar-foreground">
              <SheetTitle className="px-5 pt-5 text-sidebar-foreground">
                <Brand />
              </SheetTitle>
              <NavList role={role} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold sm:text-base">
              {current?.label ?? "PeoplePay360"}
            </p>
            <p className="hidden text-xs text-muted-foreground sm:block">Signed in as {ROLE_LABELS[role]}</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>{ROLE_LABELS[role]}</span>
              {persona.employeeCode && <span className="text-[10px] text-muted-foreground/70">({persona.employeeCode})</span>}
            </div>

            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                      {(persona.name || "User").split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm md:inline">{persona.name}</span>
                  <ChevronDown className="hidden size-4 md:inline" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="text-sm">{persona.name}</p>
                  <p className="text-xs font-normal text-muted-foreground">{ROLE_LABELS[role]}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/app/me" })}>
                  <UserRound className="mr-2 size-4" /> My workspace
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/app/settings" })}>
                  <Settings className="mr-2 size-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    signOut();
                    navigate({ to: "/" });
                  }}
                >
                  <LogOut className="mr-2 size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
