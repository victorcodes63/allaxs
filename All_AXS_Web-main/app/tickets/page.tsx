import { TicketsList } from "./TicketsList";

export const metadata = {
  title: "My tickets | All AXS",
  description: "Access your QR passes and event details.",
};

export default function TicketsPage() {
  return (
    <div className="space-y-10 pb-12">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Wallet</p>
        <h1 className="font-display text-4xl md:text-5xl text-foreground mt-2">
          My tickets
        </h1>
        <p className="text-muted text-lg mt-3 leading-relaxed">
          Tap a pass for a scannable QR code (demo data in this browser). Create an account and use
          checkout to add passes.
        </p>
      </div>
      <TicketsList />
    </div>
  );
}
