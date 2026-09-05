import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader, StatCard } from "@/components/bits";
import { useApp } from "@/lib/store";
import { ROLE_LABELS, type Role } from "@/lib/mock-data";

export const Route = createFileRoute("/app/admin")({
  head: () => ({
    meta: [
      { title: "Administration · PeoplePay360" },
      { name: "description", content: "Manage workspace users, role access and review the audit trail." },
      { property: "og:title", content: "Administration · PeoplePay360" },
      { property: "og:description", content: "Manage workspace users, role access and review the audit trail." },
    ],
  }),
  component: AdminPage,
});

const MODULES = [
  { key: "People records", roles: ["hr_manager", "admin"] },
  { key: "Lifecycle (on/offboarding)", roles: ["hr_manager", "admin"] },
  { key: "Leave approvals", roles: ["hr_manager", "admin"] },
  { key: "Payroll preparation", roles: ["payroll_user", "admin"] },
  { key: "Payroll approval & payout", roles: ["payroll_manager", "admin"] },
  { key: "Asset inventory", roles: ["it_asset_manager", "admin"] },
  { key: "Reports", roles: ["hr_manager", "payroll_manager", "admin"] },
];

function AdminPage() {
  const { users, update, log, audit } = useApp();
  const [q, setQ] = useState("");

  const rows = users.filter(
    (u) => u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase()),
  );

  const setUserRole = (id: string, role: Role) => {
    update("users", users.map((u) => (u.id === id ? { ...u, role } : u)));
    const u = users.find((x) => x.id === id);
    log(`Changed role for ${u?.name} to ${ROLE_LABELS[role]}`, "Admin");
    toast.success("Role updated", { description: `${u?.name} is now ${ROLE_LABELS[role]}.` });
  };

  const toggleActive = (id: string, active: boolean) => {
    update("users", users.map((u) => (u.id === id ? { ...u, active } : u)));
    const u = users.find((x) => x.id === id);
    log(`${active ? "Enabled" : "Disabled"} account for ${u?.name}`, "Admin");
    toast[active ? "success" : "warning"](`Account ${active ? "enabled" : "disabled"}`);
  };

  return (
    <>
      <PageHeader title="Administration" description="Who can access what, and everything that happened here." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Workspace users" value={users.length} icon={<UserCog className="size-5" />} />
        <StatCard label="Active accounts" value={users.filter((u) => u.active).length} tone="success" />
        <StatCard label="Audit entries" value={audit.length} icon={<ShieldCheck className="size-5" />} tone="accent" />
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users & roles</TabsTrigger>
          <TabsTrigger value="matrix">Access matrix</TabsTrigger>
          <TabsTrigger value="audit">Audit trail</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader className="gap-3">
              <div>
                <CardTitle>Users</CardTitle>
                <CardDescription>Assign roles or disable access</CardDescription>
              </div>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users" className="max-w-sm" />
            </CardHeader>
            <CardContent className="p-0">
              {rows.length === 0 ? (
                <EmptyState title="No users match" description="Try a different name or email." />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>
                            <p className="font-medium">{u.name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </TableCell>
                          <TableCell>
                            <Select value={u.role} onValueChange={(v) => setUserRole(u.id, v as Role)}>
                              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <Switch checked={u.active} onCheckedChange={(v) => toggleActive(u.id, v)} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matrix" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Access matrix</CardTitle>
              <CardDescription>Which roles reach which module in this workspace</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Module</TableHead>
                      <TableHead>Roles with access</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MODULES.map((m) => (
                      <TableRow key={m.key}>
                        <TableCell className="font-medium">{m.key}</TableCell>
                        <TableCell className="flex flex-wrap gap-1.5">
                          {m.roles.map((r) => (
                            <Badge key={r} variant="secondary">{ROLE_LABELS[r as Role]}</Badge>
                          ))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit trail</CardTitle>
              <CardDescription>Newest activity first</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead className="text-right">Module</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{a.at}</TableCell>
                        <TableCell className="font-medium">{a.actor}</TableCell>
                        <TableCell>{a.action}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{a.module}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
