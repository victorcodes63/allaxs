import { HubAccessLayout } from "@/components/layout/hub/HubAccessLayout";

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <HubAccessLayout mode="role-shell">{children}</HubAccessLayout>;
}
