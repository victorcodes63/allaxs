# Installment checkout — follow-up (AUDIT-D1)

## Shipped in D1

- Organizer tier flag `allowInstallments` + `installmentConfig` (existing).
- Buyer checkout toggle **Pay in installments** when a single eligible tier is in the cart.
- API creates `PaymentPlan` from **discounted** total (`Order.amountCents` net of `discountCents`).
- Paystack `transaction/initialize` charges **installment 1** only.
- Paystack webhook/confirm calls `PaymentPlansService.markInstallmentPaid` (production-enabled).

## Deferred — subsequent installments (Paystack charge authorization)

Automating installments 2..N is intentionally out of D1 scope.

Recommended follow-up:

1. On first successful charge, persist Paystack `authorization.authorization_code` (and customer email) on the order or `PaymentPlan` metadata from verify/webhook payload.
2. Add a scheduled job (cron) that finds `PaymentInstallment` rows where `dueAt <= now` and `status = PENDING`.
3. For each due row, call Paystack [Charge authorization](https://paystack.com/docs/payments/charge-authorization/) with the saved code and `amount` = installment `amount`.
4. On `charge.success`, call `markInstallmentPaid(orderId, sequence)` (same path as installment 1).
5. On repeated failure past `gracePeriodDays`, call `markDefaulted` when `autoCancelOnDefault` is set.

Until that ships, buyers pay installment 1 at checkout; remaining balances require manual ops or the existing **test-utils** simulation endpoints in non-production.
