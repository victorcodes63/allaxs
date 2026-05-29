import { Suspense } from "react";
import { OrderConfirmation } from "@/components/orders/OrderConfirmation";

interface Props {
  params: Promise<{ orderId: string }>;
}

export default async function OrderConfirmationPage({ params }: Props) {
  const { orderId } = await params;
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center text-muted">
          Loading confirmation…
        </div>
      }
    >
      <OrderConfirmation orderId={orderId} />
    </Suspense>
  );
}
