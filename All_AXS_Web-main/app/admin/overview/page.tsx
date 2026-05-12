import { redirect } from "next/navigation";

/** Overview lives at `/admin`; keep this path for bookmarks and old links. */
export default function AdminOverviewRedirectPage() {
  redirect("/admin");
}
