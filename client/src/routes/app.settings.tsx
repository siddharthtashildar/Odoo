import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Field, PageHeader } from "@/components/bits";
import { useApp } from "@/lib/store";
import { ROLE_LABELS } from "@/lib/mock-data";

export const Route = createFileRoute("/app/settings")({
  head: () => ({
    meta: [
      { title: "Settings · PeoplePay360" },
      { name: "description", content: "Workspace preferences, notifications and demo data controls." },
      { property: "og:title", content: "Settings · PeoplePay360" },
      { property: "og:description", content: "Workspace preferences, notifications and demo data controls." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { role, persona } = useApp();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState({
    leaveEmails: true,
    payrollAlerts: true,
    assetDigest: false,
    weekStart: "Monday",
    currency: "INR",
  });

  const save = () => toast.success("Preferences saved");

  const reset = () => {
    localStorage.removeItem("pp360-state-v1");
    toast.success("Demo data reset", { description: "Reloading the seeded workspace…" });
    setTimeout(() => window.location.assign("/"), 600);
  };

  return (
    <>
      <PageHeader title="Settings" description="Preferences for this demo workspace." />

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Signed in as {persona.name} · {ROLE_LABELS[role]}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Week starts on">
            <Select value={prefs.weekStart} onValueChange={(v) => setPrefs({ ...prefs, weekStart: v })}>
              <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Monday", "Sunday"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Display currency">
            <Select value={prefs.currency} onValueChange={(v) => setPrefs({ ...prefs, currency: v })}>
              <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["INR", "USD", "EUR"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Choose what this workspace pings you about</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <Toggle
            label="Leave approvals and decisions"
            checked={prefs.leaveEmails}
            onChange={(v) => setPrefs({ ...prefs, leaveEmails: v })}
          />
          <Separator />
          <Toggle
            label="Payroll run status changes"
            checked={prefs.payrollAlerts}
            onChange={(v) => setPrefs({ ...prefs, payrollAlerts: v })}
          />
          <Separator />
          <Toggle
            label="Weekly asset inventory digest"
            checked={prefs.assetDigest}
            onChange={(v) => setPrefs({ ...prefs, assetDigest: v })}
          />
          <div className="pt-4">
            <Button onClick={save}>Save preferences</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Demo data</CardTitle>
          <CardDescription>
            Everything you change is stored on this device only. Reset to return to the seeded workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <RotateCcw className="mr-2 size-4" /> Reset demo data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset this workspace?</AlertDialogTitle>
                <AlertDialogDescription>
                  Employees, payroll runs, leave, assets and the audit trail all return to their original demo state.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={reset}>Reset</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" onClick={() => navigate({ to: "/app/dashboard" })}>
            Back to dashboard
          </Button>
        </CardContent>
      </Card>
    </>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
