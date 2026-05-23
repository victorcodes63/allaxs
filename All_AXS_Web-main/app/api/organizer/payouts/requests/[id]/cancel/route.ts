import { makeBackendProxyDynamic } from "@/lib/api/backend-proxy";

export const POST = makeBackendProxyDynamic<{ id: string }>(({ id }) => ({
  method: "POST",
  path: `organizers/payouts/requests/${id}/cancel`,
  errorMessage: "Failed to cancel withdrawal request",
}));
