import { makeBackendProxyDynamic } from "@/lib/api/backend-proxy";

export const DELETE = makeBackendProxyDynamic<{ id: string }>(({ id }) => ({
  method: "DELETE",
  path: `organizers/waitlist/${id}`,
  errorMessage: "Failed to cancel waitlist entry",
}));
