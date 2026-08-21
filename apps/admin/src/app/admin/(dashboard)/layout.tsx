"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AuthGuard } from "@/components/auth/auth-guard";
import { isAdminDashboard } from "@/lib/admin-path";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <AuthGuard>
      <AdminShell withRightPanel={isAdminDashboard(pathname)}>{children}</AdminShell>
    </AuthGuard>
  );
}
