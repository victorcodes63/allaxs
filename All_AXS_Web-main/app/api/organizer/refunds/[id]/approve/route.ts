import { makeBackendProxyDynamic } from "@/lib/api/backend-proxy";

export const POST = makeBackendProxyDynamic<{ id: string }>(({ id }) => ({
  method: "POST",
  path: `organizers/refunds/${id}/approve`,
  errorMessage: "Failed to approve refund",
}));
