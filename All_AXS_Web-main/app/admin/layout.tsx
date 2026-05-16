"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { buildLoginRedirectFromPath } from "@/lib/auth/post-auth-redirect";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(
        pathname ? buildLoginRedirectFromPath(pathname) : "/login",
      );
      return;
    }
    if (!user.roles?.includes("ADMIN")) {
      router.replace("/dashboard");
    }
  }, [user, loading, router, pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="space-y-2 text-center">
          <p className="text-lg text-muted">Checking access…</p>
        </div>
      </div>
    );
  }

  if (!user.roles?.includes("ADMIN")) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="space-y-2 text-center">
          <p className="text-lg text-primary">
            You do not have permission to access this page
          </p>
          <p className="text-sm text-muted">Admin access is required</p>
        </div>
      </div>
    );
  }

  return <AdminShell user={user}>{children}</AdminShell>;
}
