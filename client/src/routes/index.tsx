import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, KeyRound, Loader2, Lock, Mail, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brand } from "@/components/app-shell";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import { ROLE_LABELS, type Role } from "@/lib/mock-data";

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

function LoginPage() {
  const { signIn, log } = useApp();
  const navigate = useNavigate();

  // Mode: "login" or "change_password"
  const [mode, setMode] = useState<"login" | "change_password">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    tempPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  // Check URL query parameters for password change redirect
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get("email");
      const actionParam = params.get("action");
      const changePasswordParam = params.get("changePassword");

      if (emailParam) {
        setEmail(emailParam);
      }

      if (actionParam === "change-password" || changePasswordParam === "true") {
        setMode("change_password");
        toast.info("Welcome! Please establish your permanent password to complete activation.");
      }
    }
  }, []);

  const submitLogin = async (e: React.FormEvent) => {
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
      signIn(matchedRole, {
        id: userRes.userId,
        email: userRes.email,
        name: userRes.employeeName || userRes.email,
        role: matchedRole,
        employeeId: userRes.employeeId,
        employeeCode: (userRes as any).employeeCode || null,
      });
      log(`Signed in as ${userRes.employeeName || userRes.email}`, "Auth");
      toast.success(`Welcome back, ${userRes.employeeName || userRes.email}`, {
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

  const submitChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Enter a valid company email address.";
    if (!tempPassword) next.tempPassword = "Enter the temporary password from your email.";
    if (newPassword.length < 6) next.newPassword = "New password must be at least 6 characters.";
    if (newPassword !== confirmPassword) next.confirmPassword = "Passwords do not match.";

    setErrors(next);
    if (Object.keys(next).length) {
      toast.error("Please correct the errors in the form");
      return;
    }

    setLoading(true);
    try {
      const userRes = await api.auth.changePassword({
        email: email.trim(),
        currentPassword: tempPassword.trim(),
        newPassword: newPassword.trim(),
      });

      const matchedRole = (userRes.role as Role) || "employee";
      signIn(matchedRole, {
        id: userRes.userId,
        email: userRes.email,
        name: userRes.employeeName || userRes.email,
        role: matchedRole,
        employeeId: userRes.employeeId,
        employeeCode: userRes.employeeCode || null,
      });

      log(`Activated account and changed password for ${userRes.email}`, "Auth");
      toast.success("Password successfully established!", {
        description: `Welcome to PeoplePay360, ${userRes.employeeName || userRes.email}!`,
      });

      navigate({ to: "/app/dashboard" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update password";
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

      {/* Right Login / Change Password Form Panel */}
      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden">
            <Brand />
          </div>

          <Card className="border-border/70 shadow-md">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-bold tracking-tight">
                  {mode === "login" ? "Sign In to Workspace" : "Set Permanent Password"}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-primary h-7 px-2"
                  onClick={() => {
                    setMode(mode === "login" ? "change_password" : "login");
                    setErrors({});
                  }}
                >
                  {mode === "login" ? "First-time setup?" : "Back to Sign In"}
                </Button>
              </div>
              <CardDescription>
                {mode === "login"
                  ? "Enter your company email and password to access the PeoplePay360 portal."
                  : "Activate your account by establishing a secure password for your work email."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === "login" ? (
                <form onSubmit={submitLogin} className="space-y-4" noValidate>
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
              ) : (
                <form onSubmit={submitChangePassword} className="space-y-3.5" noValidate>
                  <div className="space-y-1.5">
                    <Label htmlFor="change-email" className="flex items-center gap-1.5">
                      <Mail className="size-3.5 text-muted-foreground" /> Work Email
                    </Label>
                    <Input
                      id="change-email"
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
                    <Label htmlFor="temp-password" className="flex items-center gap-1.5">
                      <KeyRound className="size-3.5 text-muted-foreground" /> Temporary Password (from email)
                    </Label>
                    <Input
                      id="temp-password"
                      type="password"
                      placeholder="e.g. PP360!ABC123"
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      aria-invalid={!!errors.tempPassword}
                    />
                    {errors.tempPassword && <p className="text-xs text-destructive">{errors.tempPassword}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="new-password" className="flex items-center gap-1.5">
                      <Lock className="size-3.5 text-muted-foreground" /> New Permanent Password
                    </Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="Minimum 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      aria-invalid={!!errors.newPassword}
                      autoComplete="new-password"
                    />
                    {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password" className="flex items-center gap-1.5">
                      <Lock className="size-3.5 text-muted-foreground" /> Confirm New Password
                    </Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      aria-invalid={!!errors.confirmPassword}
                      autoComplete="new-password"
                    />
                    {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
                  </div>

                  <Button type="submit" className="w-full mt-2" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    Set Password &amp; Enter Workspace
                    {!loading && <ArrowRight className="ml-2 size-4" />}
                  </Button>
                </form>
              )}

              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-1">
                  <Shield className="size-3 text-primary" /> Enterprise Access Policy
                </p>
                <p>
                  Public registration is restricted. Only Human Resources or Administrators can provision accounts.
                  New team members receive temporary credentials via email to set their permanent password.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
