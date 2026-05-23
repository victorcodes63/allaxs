import { makeBackendProxy } from "@/lib/api/backend-proxy";

export const GET = makeBackendProxy({
  method: "GET",
  path: "organizers/waitlist",
});
