"use client";

import { useAuth } from "@/lib/auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && user) {
      const isAdmin = user.roles?.includes("ADMIN");
      if (!isAdmin) {
        // Redirect non-admins to dashboard
        router.replace("/dashboard");
      }
    } else if (!loading && !user) {
      // Redirect unauthenticated users to login
      const nextParam = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${nextParam}`);
    }
  }, [user, loading, router, pathname]);

  // Show loading state while checking auth
  if (loading || !user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-lg text-muted">Checking access…</p>
        </div>
      </div>
    );
  }

  // Check if user is admin
  const isAdmin = user.roles?.includes("ADMIN");
  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-lg text-primary">
            You do not have permission to access this page
          </p>
          <p className="text-sm text-muted">
            Admin access is required
          </p>
        </div>
      </div>
    );
  }

  // User is authenticated and is an admin, render admin content
  return <>{children}</>;
}

