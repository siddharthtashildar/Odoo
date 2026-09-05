import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Loader2, Lock, Mail, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brand } from "@/components/app-shell";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import { ROLE_LABELS, ROLE_PERSONA, type Role } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in · PeoplePay360" },
      {
        name: "description",
        content: "Enterprise workforce sign-in for PeoplePay360 — HR, payroll, IT asset and employee workspace.",
      },
      { property: "og:title", content: "Sign in · PeoplePay360" },
      {
        property: "og:description",
        content: "PeoplePay360 enterprise workforce and payroll management platform.",
      },
    ],
  }),
  component: LoginPage,
});

const QUICK_ACCOUNTS: Array<{ label: string; email: string; role: Role }> = [
  { label: "HR Manager", email: "sana.iqbal@peoplepay360.io", role: "hr_manager" },
  { label: "Payroll Manager", email: "arjun.nair@peoplepay360.io", role: "payroll_manager" },
  { label: "Payroll User", email: "charmi.patel@peoplepay360.io", role: "payroll_user" },
  { label: "IT Asset Manager", email: "karan.shah@peoplepay360.io", role: "it_asset_manager" },
  { label: "Employee", email: "rohan.mehta@peoplepay360.io", role: "employee" },
  { label: "Administrator", email: "admin@peoplepay360.io", role: "admin" },
];

function LoginPage() {
  const { signIn, log } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("sana.iqbal@peoplepay360.io");
  const [password, setPassword] = useState("demo1234");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  const fillAccount = (acc: (typeof QUICK_ACCOUNTS)[0]) => {
    setEmail(acc.email);
    setPassword("demo1234");
    setErrors({});
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Enter a valid company email address.";
    if (password.length < 6) next.password = "Password must be at least 6 characters.";
    setErrors(next);
    if (Object.keys(next).length) {
      toast.error("Please fill the required fields");
      return;
    }

    setLoading(true);
    try {
      const userRes = await api.auth.login(email, password);
      const matchedRole = (userRes.role as Role) || "employee";
      signIn(matchedRole);
      log(`Signed in as ${userRes.employeeName || userRes.email}`, "Auth");
      toast.success(`Welcome back, ${userRes.employeeName || ROLE_PERSONA[matchedRole].name}`, {
        description: ROLE_LABELS[matchedRole] || matchedRole,
      });
      navigate({ to: "/app/dashboard" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Left Branding / Features Panel */}
      <section className="relative hidden flex-col justify-between p-12 text-primary-foreground lg:flex grid-mesh">
        <div className="absolute inset-0 bg-sidebar/90" />
        <div className="relative text-sidebar-foreground">
          <Brand />
          <h1 className="mt-16 max-w-md font-display text-4xl font-semibold leading-tight">
            Connected Enterprise HR &amp; Realtime Payroll.
          </h1>
          <p className="mt-4 max-w-md text-sm text-sidebar-foreground/70">
            PeoplePay360 orchestrates the full employee lifecycle with PostgreSQL persistence, Better Auth identity
            management, and automated email credential dispatch.
          </p>
          <ul className="mt-10 space-y-3 text-sm text-sidebar-foreground/80">
            {[
              "Automated account provisioning with direct email credential dispatch",
              "Strict role-based access control (HR, Payroll, IT Asset, Admin, Employee)",
              "Formula-driven payroll calculation engine with payslip release cycles",
              "Centralized asset allocation and enterprise helpdesk tracking",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 text-sidebar-primary" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-sidebar-foreground/60">
          <Shield className="size-3.5" />
          <span>Secured with Better Auth &bull; Neon PostgreSQL Database &bull; Realtime API</span>
        </div>
      </section>

      {/* Right Login Form Panel */}
      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden">
            <Brand />
          </div>

          <Card className="border-border/70 shadow-md">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold tracking-tight">Sign In to Your Workspace</CardTitle>
              <CardDescription>
                Enter your company email and password to access the PeoplePay360 portal.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={submit} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="flex items-center gap-1.5">
                    <Mail className="size-3.5 text-muted-foreground" /> Work Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={!!errors.email}
                    autoComplete="email"
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="flex items-center gap-1.5">
                    <Lock className="size-3.5 text-muted-foreground" /> Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={!!errors.password}
                    autoComplete="current-password"
                  />
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Sign In
                  {!loading && <ArrowRight className="ml-2 size-4" />}
                </Button>
              </form>

              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-1">
                  <Shield className="size-3 text-primary" /> Enterprise Access Policy
                </p>
                <p>
                  Public registration is restricted. Only Human Resources or Administrators can provision accounts.
                  New team members receive their login credentials via email.
                </p>
              </div>

              {/* Quick Fill Testing Helper */}
              <div className="pt-2 border-t">
                <p className="text-[11px] font-medium text-muted-foreground mb-2">Quick-fill accounts for testing:</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => fillAccount(acc)}
                      className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${email === acc.email
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border"
                        }`}
                    >
                      {acc.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
