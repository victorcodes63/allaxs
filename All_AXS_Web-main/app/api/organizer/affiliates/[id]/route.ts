import { makeBackendProxyDynamic } from "@/lib/api/backend-proxy";

export const PATCH = makeBackendProxyDynamic<{ id: string }>(({ id }) => ({
  method: "PATCH",
  path: `organizers/affiliates/${id}`,
  errorMessage: "Failed to update affiliate",
}));

export const DELETE = makeBackendProxyDynamic<{ id: string }>(({ id }) => ({
  method: "DELETE",
  path: `organizers/affiliates/${id}`,
  errorMessage: "Failed to remove affiliate",
}));
