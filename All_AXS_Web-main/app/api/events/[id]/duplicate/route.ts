import { makeBackendProxyDynamic } from "@/lib/api/backend-proxy";

export const POST = makeBackendProxyDynamic<{ id: string }>(({ id }) => ({
  method: "POST",
  path: `events/${id}/duplicate`,
  errorMessage: "Failed to duplicate event",
}));
