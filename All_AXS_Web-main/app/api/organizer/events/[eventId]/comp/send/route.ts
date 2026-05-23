import { makeBackendProxyDynamic } from "@/lib/api/backend-proxy";

export const POST = makeBackendProxyDynamic<{ eventId: string }>(({ eventId }) => ({
  method: "POST",
  path: `organizers/events/${eventId}/comp/send`,
  errorMessage: "Failed to send complimentary ticket",
}));
