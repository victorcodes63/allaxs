import { Suspense } from "react";
import { PaymentCallbackClient } from "./PaymentCallbackClient";

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={<div className="max-w-lg mx-auto py-20 text-center text-muted">Confirming your payment...</div>}>
      <PaymentCallbackClient />
    </Suspense>
  );
}
