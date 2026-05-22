import { TicketsList } from "./TicketsList";
import { isApiCheckoutEnabled } from "@/lib/checkout-mode";

export const metadata = {
  title: "My tickets | All AXS",
  description: "Access your QR passes and event details.",
};

export default function TicketsPage() {
  const apiCheckout = isApiCheckoutEnabled();

  return (
    <div className="space-y-10 pb-12">
      <header className="max-w-3xl space-y-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Wallet</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          My tickets
        </h1>
        <p className="text-sm leading-relaxed text-muted sm:text-base">
          {apiCheckout ? (
            <>
              Tap a pass for a scannable QR code or download a PDF. After purchase we also email a PDF attachment with
              your entry codes—open that file at the door if you are not using this page.
            </>
          ) : (
            <>
              Tap a pass for a scannable QR code. Demo passes stay in this browser until you clear session data.
            </>
          )}
        </p>
      </header>
      <TicketsList />
    </div>
  );
}
