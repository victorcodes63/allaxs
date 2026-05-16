"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-credentials";

/** Footer trigger on `/login` only — demo accounts in a dialog. */
export function AuthFooterDemoLogins() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname !== "/login") return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65 transition-colors hover:text-primary"
      >
        Demo logins
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Demo logins"
        footer={
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Close
          </Button>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          Seeded accounts for local and staging. All use the same password.
        </p>
        <dl className="mt-4 space-y-3">
          {DEMO_ACCOUNTS.map((account) => (
            <div
              key={account.email}
              className="rounded-lg border border-border/60 bg-background/40 px-3 py-2.5"
            >
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                {account.role}
              </dt>
              <dd className="mt-1 font-mono text-[13px] text-foreground">{account.email}</dd>
              <dd className="mt-0.5 text-xs text-muted">{account.note}</dd>
            </div>
          ))}
          <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Password</dt>
            <dd className="mt-1 font-mono text-[13px] text-foreground">{DEMO_PASSWORD}</dd>
          </div>
        </dl>
      </Dialog>
    </>
  );
}
