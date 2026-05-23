import { makeBackendProxy } from "@/lib/api/backend-proxy";

export const GET = makeBackendProxy({
  method: "GET",
  path: "organizers/refunds",
});

export const POST = makeBackendProxy({
  method: "POST",
  path: "organizers/refunds",
  errorMessage: "Failed to create refund",
});
