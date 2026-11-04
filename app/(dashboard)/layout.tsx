"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { ShellFrame } from "@/components/shell-frame";
import { WorkspaceNav } from "@/features/workspace-nav";
import type { RootState } from "@/store";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const token = useSelector((state: RootState) => state.auth.token);

  useEffect(() => {
    if (!token) router.replace("/login");
  }, [token, router]);

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <ShellFrame sidebar={<WorkspaceNav />}>{children}</ShellFrame>;
}
