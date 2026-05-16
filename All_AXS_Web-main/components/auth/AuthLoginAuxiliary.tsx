import Link from "next/link";

export function AuthLoginAuxiliary({ registerHref }: { registerHref: string }) {
  return (
    <div className="space-y-2.5 border-t border-border/40 pt-4">
      <p className="flex flex-col items-center gap-1.5 text-center text-[11px] text-muted">
        <span>
          <Link href="/forgot-password" className="font-medium text-primary/90 hover:text-primary">
            Forgot password
          </Link>
          <span className="mx-1.5 text-border/60">·</span>
          <Link href="/resend-verification" className="font-medium text-primary/90 hover:text-primary">
            Resend email
          </Link>
        </span>
        <span>
          No account?{" "}
          <Link href={registerHref} className="font-medium text-primary hover:text-primary">
            Sign up
          </Link>
        </span>
      </p>

    </div>
  );
}
