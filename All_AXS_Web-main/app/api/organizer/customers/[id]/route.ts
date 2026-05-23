import { makeBackendProxyDynamic } from "@/lib/api/backend-proxy";

export const GET = makeBackendProxyDynamic<{ id: string }>(({ id }) => ({
  method: "GET",
  path: `organizers/customers/${id}`,
}));
