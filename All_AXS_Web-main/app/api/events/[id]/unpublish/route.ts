import { makeBackendProxyDynamic } from "@/lib/api/backend-proxy";

export const POST = makeBackendProxyDynamic<{ id: string }>(({ id }) => ({
  method: "POST",
  path: `events/${id}/unpublish`,
  errorMessage: "Failed to unpublish event",
}));
