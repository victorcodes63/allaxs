import { makeBackendProxyDynamic } from "@/lib/api/backend-proxy";

export const DELETE = makeBackendProxyDynamic<{ id: string }>(({ id }) => ({
  method: "DELETE",
  path: `events/${id}/banner`,
  errorMessage: "Failed to remove banner",
}));
