"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { buildLoginRedirectFromPath } from "@/lib/auth/post-auth-redirect";
import { landingPathForNonAdmin } from "@/lib/auth/hub-routing";
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
    const fallback = landingPathForNonAdmin(user);
    if (fallback) {
      router.replace(fallback);
    }
  }, [user, loading, router, pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted">Checking access…</p>
      </div>
    );
  }

  const fallback = landingPathForNonAdmin(user);
  if (fallback) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted">Redirecting…</p>
      </div>
    );
  }

  return <AdminShell user={user}>{children}</AdminShell>;
}
