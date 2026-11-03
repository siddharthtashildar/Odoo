import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Building2,
  CheckCircle2,
  ClipboardCopy,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/app/ms365")({
  head: () => ({
    meta: [
      { title: "Microsoft 365 Users · PeoplePay360" },
      { name: "description", content: "Provision Microsoft 365 accounts for employees." },
    ],
  }),
  component: MS365Page,
});

type Ms365Account = {
  enabled: boolean;
  upn: string | null;
  microsoftUserId: string | null;
  accountStatus: string;
  licenseStatus: string;
  mailboxStatus: string;
  credentialEmailStatus: string;
  lastError: string | null;
  temporaryPassword?: string;
  outlookUrl: string;
};

function statusBadge(status: string) {
  const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    created: "default",
    assigned: "default",
    ready: "default",
    sent: "default",
    provisioning: "secondary",
    pending: "secondary",
    skipped: "outline",
    failed: "destructive",
    shown_to_hr: "secondary",
  };
  const variant = map[status] ?? "outline";
  return (
    <Badge variant={variant} className="capitalize text-xs">
      {status}
    </Badge>
  );
}

function AccountCard({ account }: { account: Ms365Account }) {
  const [showPw, setShowPw] = useState(false);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied!`));
  };

  return (
    <Card className="border-border/60">
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="size-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">{account.upn ?? "—"}</p>
              <p className="text-xs text-muted-foreground">
                ID: {account.microsoftUserId ? account.microsoftUserId.slice(0, 8) + "…" : "—"}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {statusBadge(account.accountStatus)}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md bg-muted/40 p-2 text-center space-y-1">
            <p className="text-muted-foreground">License</p>
            {statusBadge(account.licenseStatus)}
          </div>
          <div className="rounded-md bg-muted/40 p-2 text-center space-y-1">
            <p className="text-muted-foreground">Mailbox</p>
            {statusBadge(account.mailboxStatus)}
          </div>
          <div className="rounded-md bg-muted/40 p-2 text-center space-y-1">
            <p className="text-muted-foreground">Credentials</p>
            {statusBadge(account.credentialEmailStatus)}
          </div>
        </div>

        {account.upn && (
          <div className="flex items-center gap-2">
            <Mail className="size-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs font-mono flex-1 truncate">{account.upn}</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => copyText(account.upn!, "Email")}
            >
              <ClipboardCopy className="size-3" />
            </Button>
          </div>
        )}

        {account.temporaryPassword && (
          <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 space-y-2">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              Temporary Password — shown once only
            </p>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono flex-1 select-all">
                {showPw ? account.temporaryPassword : "••••••••••••••••"}
              </code>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setShowPw(!showPw)}>
                {showPw ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyText(account.temporaryPassword!, "Password")}>
                <ClipboardCopy className="size-3" />
              </Button>
            </div>
          </div>
        )}

        {account.lastError && (
          <p className="text-xs text-destructive bg-destructive/10 rounded p-2">{account.lastError}</p>
        )}
      </CardContent>
    </Card>
  );
}

function MS365Page() {
  const { role } = useApp();
  const canAccess = role === "hr_manager" || role === "admin" || role === "it_asset_manager";

  const [showForm, setShowForm] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Ms365Account[]>([]);
  const [fetched, setFetched] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [latestResult, setLatestResult] = useState<Ms365Account | null>(null);

  const fetchAccounts = async () => {
    setFetching(true);
    try {
      const data = await api.ms365.list();
      setAccounts((data ?? []).filter((a): a is Ms365Account => !!a));
      setFetched(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch accounts");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First name and last name are required");
      return;
    }
    setLoading(true);
    setLatestResult(null);
    try {
      const result = await api.ms365.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      setLatestResult(result);
      if (result.accountStatus === "created") {
        toast.success("Microsoft 365 account provisioned!", { description: result.upn ?? undefined });
      } else if (result.lastError) {
        toast.error("Provisioning error", { description: result.lastError });
      }
      setFirstName("");
      setLastName("");
      setShowForm(false);
      await fetchAccounts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Provisioning failed");
    } finally {
      setLoading(false);
    }
  };

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-2 text-muted-foreground">
        <Building2 className="size-8 opacity-40" />
        <p className="text-sm">You don&apos;t have access to this page.</p>
      </div>
    );
  }

  const emailPreview = firstName.trim() || lastName.trim()
    ? `${firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, "") || "firstname"}.${lastName.trim().toLowerCase().replace(/[^a-z0-9]/g, "") || "lastname"}@peoplepay360.onmicrosoft.com`
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="size-6 text-primary" />
            Microsoft 365 Users
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Provision Microsoft 365 accounts with Business Standard license.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAccounts} disabled={fetching}>
            {fetching ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            <span className="ml-1.5">Refresh</span>
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)} disabled={showForm}>
            <Plus className="size-4 mr-1.5" />
            Add Microsoft User
          </Button>
        </div>
      </div>

      {latestResult && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="size-4 text-primary" />
              Provisioning Result
            </p>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setLatestResult(null)}>
              <X className="size-3.5" />
            </Button>
          </div>
          <AccountCard account={latestResult} />
        </div>
      )}

      {showForm && (
        <Card className="border-primary/30 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">New Microsoft 365 Account</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ms365-first-name">First Name</Label>
                  <Input
                    id="ms365-first-name"
                    placeholder="Arham"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoFocus
                    disabled={loading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ms365-last-name">Last Name</Label>
                  <Input
                    id="ms365-last-name"
                    placeholder="Shaikh"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              {emailPreview && (
                <div className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2 font-mono">
                  {emailPreview}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? (
                    <><Loader2 className="size-4 mr-2 animate-spin" />Provisioning…</>
                  ) : (
                    "Create Account"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setShowForm(false); setFirstName(""); setLastName(""); }}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {!fetched ? (
        <div className="text-center py-12 text-muted-foreground space-y-2">
          <Building2 className="size-10 mx-auto opacity-30" />
          <p className="text-sm">Click <strong>Refresh</strong> to load existing Microsoft 365 accounts.</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground space-y-2">
          <Building2 className="size-10 mx-auto opacity-30" />
          <p className="text-sm">No Microsoft 365 accounts provisioned yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground font-medium">
            {accounts.length} account{accounts.length !== 1 ? "s" : ""}
          </p>
          {accounts.map((acc, i) => (
            <AccountCard key={acc.microsoftUserId ?? acc.upn ?? i} account={acc} />
          ))}
        </div>
      )}
    </div>
  );
}
