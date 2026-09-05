import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brand } from "@/components/app-shell";
import { useApp } from "@/lib/store";
import { ROLE_LABELS, ROLE_PERSONA, type Role } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in · PeoplePay360" },
      {
        name: "description",
        content:
          "Demo sign-in for PeoplePay360 — switch between employee, HR, payroll, IT asset and admin roles.",
      },
      { property: "og:title", content: "Sign in · PeoplePay360" },
      {
        property: "og:description",
        content: "Explore the PeoplePay360 employee lifecycle and payroll workspace with six demo roles.",
      },
    ],
  }),
  component: LoginPage,
});

const ROLE_BLURB: Record<Role, string> = {
  employee: "Payslips, leave, asset requests and personal profile.",
  hr_manager: "Directory, onboarding, offboarding and leave approvals.",
  hr_user: "Directory, onboarding workflows, leave tracking (approval restricted).",
  payroll_user: "Build payroll runs, edit lines and submit for approval.",
  payroll_manager: "Approve runs, release payouts and read cost reports.",
  it_asset_manager: "Inventory, allocations, returns and asset requests.",
  admin: "Everything, plus user roles and the audit trail.",
};

function LoginPage() {
  const { signIn, log } = useApp();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("hr_manager");
  const [email, setEmail] = useState("sana.iqbal@peoplepay360.io");
  const [password, setPassword] = useState("demo1234");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  const pick = (r: Role) => {
    setRole(r);
    setEmail(`${ROLE_PERSONA[r].name.toLowerCase().replace(/ /g, ".")}@peoplepay360.io`);
    setErrors({});
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Enter a valid work email address.";
    if (password.length < 6) next.password = "Password must be at least 6 characters.";
    setErrors(next);
    if (Object.keys(next).length) {
      toast.error("Check the highlighted fields");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      signIn(role);
      log("Signed in to the demo workspace", "Auth");
      toast.success(`Welcome back, ${ROLE_PERSONA[role].name}`, { description: ROLE_LABELS[role] });
      navigate({ to: "/app/dashboard" });
    }, 700);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between p-12 text-primary-foreground lg:flex grid-mesh">
        <div className="absolute inset-0 bg-sidebar/90" />
        <div className="relative text-sidebar-foreground">
          <Brand />
          <h1 className="mt-16 max-w-md font-display text-4xl font-semibold leading-tight">
            One workspace from offer letter to full &amp; final settlement.
          </h1>
          <p className="mt-4 max-w-md text-sm text-sidebar-foreground/70">
            PeoplePay360 keeps people records, leave, payroll cycles and IT assets in a single connected
            lifecycle — so nothing falls between HR, Finance and IT.
          </p>
          <ul className="mt-10 space-y-3 text-sm text-sidebar-foreground/80">
            {[
              "Lifecycle tracking with onboarding and exit checklists",
              "Payroll runs with maker–checker approval",
              "Asset allocation tied to every employee record",
              "Reports across headcount, cost and utilisation",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 text-sidebar-primary" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-sidebar-foreground/50">
          Demo environment · illustrative data, no real employee information.
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden">
            <Brand />
          </div>
          <Card className="mt-6 border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl">Sign in to your workspace</CardTitle>
              <CardDescription>Pick a demo role — the whole app adapts to it.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => pick(r)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      role === r
                        ? "border-accent bg-accent/15"
                        : "border-border hover:border-accent/50 hover:bg-muted"
                    }`}
                  >
                    <p className="text-sm font-medium">{ROLE_LABELS[r]}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{ROLE_BLURB[r]}</p>
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Work email</Label>
                  <Input
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={!!errors.email}
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={!!errors.password}
                  />
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Continue as {ROLE_LABELS[role]}
                  {!loading && <ArrowRight className="ml-2 size-4" />}
                </Button>
              </form>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Any password with 6+ characters works in this demo.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
