import { makeBackendProxyDynamic } from "@/lib/api/backend-proxy";

export const POST = makeBackendProxyDynamic<{ id: string }>(({ id }) => ({
  method: "POST",
  path: `organizers/waitlist/${id}/notify`,
  errorMessage: "Failed to notify waitlist entry",
}));
