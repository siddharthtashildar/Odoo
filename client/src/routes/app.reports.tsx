import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PageHeader, StatCard } from "@/components/bits";
import { useApp } from "@/lib/store";
import { inr } from "@/lib/mock-data";

export const Route = createFileRoute("/app/reports")({
  head: () => ({
    meta: [
      { title: "Reports · PeoplePay360" },
      { name: "description", content: "Headcount, payroll cost, leave utilisation and asset value reporting." },
      { property: "og:title", content: "Reports · PeoplePay360" },
      { property: "og:description", content: "Headcount, payroll cost, leave utilisation and asset value reporting." },
    ],
  }),
  component: Reports,
});

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--popover-foreground)",
};

function Reports() {
  const { employees, payroll, leave, assets } = useApp();
  const [dept, setDept] = useState("all");

  const active = employees.filter((e) => e.status !== "exited");
  const scoped = dept === "all" ? active : active.filter((e) => e.department === dept);
  const departments = Array.from(new Set(active.map((e) => e.department))).sort();

  const costTrend = [...payroll]
    .reverse()
    .map((r) => ({ period: r.period.split(" ")[0], net: r.lines.reduce((s, l) => s + l.net, 0) }));

  const deptCost = departments.map((d) => ({
    department: d,
    annual: active.filter((e) => e.department === d).reduce((s, e) => s + e.ctc, 0),
  }));

  const leaveByType = ["Casual", "Sick", "Earned", "Unpaid"].map((t) => ({
    type: t,
    days: leave.filter((l) => l.type === t && l.status === "approved").reduce((s, l) => s + l.days, 0),
  }));

  const assetValue = assets.filter((a) => a.status !== "retired").reduce((s, a) => s + a.value, 0);
  const annualCost = scoped.reduce((s, e) => s + e.ctc, 0);

  const download = (name: string) => toast.success(`${name} exported`, { description: "CSV prepared (demo)." });

  return (
    <>
      <PageHeader
        title="Reports"
        description="Cost, headcount, leave and asset utilisation across the organisation."
        actions={
          <>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => download("Full report pack")}>
              <Download className="mr-2 size-4" /> Export
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Headcount in view" value={scoped.length} hint={dept === "all" ? "All departments" : dept} />
        <StatCard label="Annual salary cost" value={inr(annualCost)} tone="accent" />
        <StatCard label="Approved leave days" value={leaveByType.reduce((s, l) => s + l.days, 0)} tone="warning" />
        <StatCard label="Asset book value" value={inr(assetValue)} tone="success" />
      </div>

      <Tabs defaultValue="cost">
        <TabsList className="flex-wrap">
          <TabsTrigger value="cost">Payroll cost</TabsTrigger>
          <TabsTrigger value="headcount">Headcount</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
        </TabsList>

        <TabsContent value="cost" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Net payroll by cycle</CardTitle>
              <CardDescription>Across all runs recorded in this workspace</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={costTrend} margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v) => `${Math.round(v / 100000)}L`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => inr(v)} />
                  <Line type="monotone" dataKey="net" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Annual cost by department</CardTitle>
                <CardDescription>Sum of annual CTC</CardDescription>
              </div>
              <Button size="sm" variant="ghost" onClick={() => download("Department cost")}>Export</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">People</TableHead>
                    <TableHead className="text-right">Annual cost</TableHead>
                    <TableHead className="text-right">Average CTC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deptCost.map((d) => {
                    const n = active.filter((e) => e.department === d.department).length;
                    return (
                      <TableRow key={d.department}>
                        <TableCell className="font-medium">{d.department}</TableCell>
                        <TableCell className="text-right tabular-nums">{n}</TableCell>
                        <TableCell className="text-right tabular-nums">{inr(d.annual)}</TableCell>
                        <TableCell className="text-right tabular-nums">{inr(Math.round(d.annual / Math.max(n, 1)))}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="headcount" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Headcount by employment type</CardTitle>
              <CardDescription>{scoped.length} people in the current view</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={["Full-time", "Contract", "Intern"].map((t) => ({
                    type: t,
                    count: scoped.filter((e) => e.employmentType === t).length,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="type" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leave" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Approved leave by type</CardTitle>
              <CardDescription>Days taken across the workspace</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {leaveByType.every((l) => l.days === 0) ? (
                <EmptyState title="No approved leave yet" description="Approve requests to populate this report." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={leaveByType}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="type" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="days" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assets" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Asset utilisation</CardTitle>
                <CardDescription>By category</CardDescription>
              </div>
              <Button size="sm" variant="ghost" onClick={() => download("Asset register")}>Export</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Assigned</TableHead>
                    <TableHead className="text-right">Utilisation</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {["Laptop", "Monitor", "Phone", "Accessory", "License"].map((c) => {
                    const items = assets.filter((a) => a.category === c);
                    const used = items.filter((a) => a.status === "assigned").length;
                    return (
                      <TableRow key={c}>
                        <TableCell className="font-medium">{c}</TableCell>
                        <TableCell className="text-right tabular-nums">{items.length}</TableCell>
                        <TableCell className="text-right tabular-nums">{used}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {items.length ? Math.round((used / items.length) * 100) : 0}%
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {inr(items.reduce((s, a) => s + a.value, 0))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
