import { OrderConfirmation } from "@/components/orders/OrderConfirmation";

interface Props {
  params: Promise<{ orderId: string }>;
}

export default async function DashboardOrderConfirmationPage({ params }: Props) {
  const { orderId } = await params;
  return <OrderConfirmation orderId={orderId} hubContext />;
}
