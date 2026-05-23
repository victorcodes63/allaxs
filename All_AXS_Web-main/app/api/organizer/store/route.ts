import { makeBackendProxy } from "@/lib/api/backend-proxy";

export const GET = makeBackendProxy({
  method: "GET",
  path: "organizers/store",
});

export const PATCH = makeBackendProxy({
  method: "PATCH",
  path: "organizers/store",
  errorMessage: "Failed to update store",
});
