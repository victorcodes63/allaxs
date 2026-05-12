import { TicketsList } from "./TicketsList";

export const metadata = {
  title: "My tickets | All AXS",
  description: "Access your QR passes and event details.",
};

export default function TicketsPage() {
  return (
    <div className="space-y-10 pb-12">
      <header className="max-w-3xl space-y-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Wallet</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          My tickets
        </h1>
        <p className="text-sm leading-relaxed text-muted sm:text-base">
          Tap a pass for a scannable QR code. With API checkout enabled, passes sync from your
          account; otherwise demo passes stay in this browser until you clear session data.
        </p>
      </header>
      <TicketsList />
    </div>
  );
}
