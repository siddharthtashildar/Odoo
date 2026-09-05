import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ROLE_ACCESS, useApp } from "@/lib/store";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { signedIn, hydrated, role } = useApp();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (hydrated && !signedIn) navigate({ to: "/" });
  }, [signedIn, hydrated, navigate]);

  useEffect(() => {
    if (!hydrated || !signedIn) return;
    const key = Object.keys(ROLE_ACCESS)
      .filter((k) => path === k || path.startsWith(`${k}/`))
      .sort((a, b) => b.length - a.length)[0];
    if (key && !ROLE_ACCESS[key]!.includes(role)) {
      toast.error("Access restricted", { description: "This area is not available for your role." });
      navigate({ to: "/app/dashboard" });
    }
  }, [path, role, hydrated, signedIn, navigate]);

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

