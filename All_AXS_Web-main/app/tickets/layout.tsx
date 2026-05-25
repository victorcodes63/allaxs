import { HubAccessLayout } from "@/components/layout/hub/HubAccessLayout";

/**
 * Tickets stay reachable without sign-in for session-stored demo passes; signed-in
 * users get the fan hub shell and the same role-based redirects as `/dashboard/*`.
 */
export default function TicketsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HubAccessLayout mode="fan-only" requireAuth={false}>
      {children}
    </HubAccessLayout>
  );
}
