import { makeBackendProxy } from "@/lib/api/backend-proxy";

export const GET = makeBackendProxy({
  method: "GET",
  path: "organizers/payouts/requests",
});

export const POST = makeBackendProxy({
  method: "POST",
  path: "organizers/payouts/request",
  errorMessage: "Failed to submit withdrawal request",
});
