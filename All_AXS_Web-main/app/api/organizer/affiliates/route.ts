import { makeBackendProxy } from "@/lib/api/backend-proxy";

export const GET = makeBackendProxy({
  method: "GET",
  path: "organizers/affiliates",
});

export const POST = makeBackendProxy({
  method: "POST",
  path: "organizers/affiliates",
  errorMessage: "Failed to create affiliate",
});
