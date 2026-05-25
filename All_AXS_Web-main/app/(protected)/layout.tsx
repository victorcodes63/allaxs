import { HubAccessLayout } from "@/components/layout/hub/HubAccessLayout";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <HubAccessLayout mode="fan-only">{children}</HubAccessLayout>;
}
