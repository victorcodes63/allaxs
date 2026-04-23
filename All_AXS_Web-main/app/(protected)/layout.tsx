"use client";

import { useAuth } from "@/lib/auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      const nextParam = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${nextParam}`);
    }
  }, [user, loading, router, pathname]);

  // Show loading state while checking auth or redirecting
  if (loading || !user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-lg text-black/60">Checking access…</p>
          <p className="text-sm text-black/40">(route guard placeholder)</p>
        </div>
      </div>
    );
  }

  // User is authenticated, render protected content
  return <>{children}</>;
}

