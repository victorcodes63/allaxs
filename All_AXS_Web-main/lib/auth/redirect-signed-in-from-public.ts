import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  accessTokenIsExpired,
  decodeAccessTokenPayload,
} from "@/lib/auth/jwt-payload";
import {
  isPublicBrowseActive,
  resolveGuestOnlyPublicRedirect,
} from "@/lib/auth/guest-only-public-routes";

/**
 * Server Components on guest-only marketing routes call this before rendering
 * so signed-in users never see the public catalogue HTML.
 */
export async function redirectSignedInFromGuestPublicPath(
  pathname: string,
  search = "",
): Promise<void> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  if (!accessToken) return;
  if (isPublicBrowseActive(search, cookieStore)) return;

  const decoded = decodeAccessTokenPayload(accessToken);
  if (!decoded?.email || accessTokenIsExpired(decoded)) return;

  redirect(
    resolveGuestOnlyPublicRedirect(
      pathname,
      search,
      decoded.roles ?? [],
    ),
  );
}
