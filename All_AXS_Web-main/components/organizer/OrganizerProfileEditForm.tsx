"use client";

import { useEffect, useState, type ReactElement } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios, { isAxiosError } from "axios";
import {
  organizerOnboardingSchema,
  type OrganizerOnboardingInput,
} from "@/lib/validation/organizer";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

type OrganizerProfileEditFormProps = {
  initialValues: OrganizerOnboardingInput;
  /** Called after a successful save with the submitted payload (for parent state sync). */
  onAfterSave?: (values: OrganizerOnboardingInput) => void;
};

export function OrganizerProfileEditForm({
  initialValues,
  onAfterSave,
}: OrganizerProfileEditFormProps): ReactElement {
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OrganizerOnboardingInput>({
    resolver: zodResolver(organizerOnboardingSchema),
    mode: "onChange",
    defaultValues: initialValues,
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const payoutMethod = useWatch({ control, name: "payoutMethod", defaultValue: initialValues.payoutMethod });

  const onSubmit = async (data: OrganizerOnboardingInput) => {
    setFormError(null);
    setSuccessMessage(null);
    try {
      const res = await axios.post<unknown>("/api/organizer/profile", data);
      if (res.status === 200 || res.status === 201) {
        setSuccessMessage("Your organizer profile was saved.");
        onAfterSave?.(data);
      }
    } catch (err) {
      const message =
        isAxiosError(err) && err.response?.data && typeof err.response.data === "object"
          ? (err.response.data as { message?: string }).message
          : undefined;
      setFormError(message || "Could not save your profile. Try again.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-10"
      aria-labelledby="org-profile-form-heading"
    >
      <h2 id="org-profile-form-heading" className="sr-only">
        Organizer profile details
      </h2>

      {formError ? (
        <div
          className="rounded-[var(--radius-panel)] border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100"
          role="alert"
        >
          {formError}
        </div>
      ) : null}

      {successMessage ? (
        <div
          className="rounded-[var(--radius-panel)] border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
          role="status"
        >
          {successMessage}
        </div>
      ) : null}

      <section
        aria-labelledby="org-details-heading"
        className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-6"
      >
        <h3
          id="org-details-heading"
          className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50"
        >
          Organization
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          These details appear on your events and in fan-facing support flows. Keep your support
          contact reachable.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label="Organization name *"
              type="text"
              placeholder="Acme Events"
              {...register("orgName")}
              error={errors.orgName?.message}
            />
          </div>
          <Input
            label="Legal name"
            type="text"
            placeholder="Acme Events Ltd."
            {...register("legalName")}
            error={errors.legalName?.message}
          />
          <Input
            label="Website"
            type="url"
            placeholder="https://example.com"
            {...register("website")}
            error={errors.website?.message}
          />
          <Input
            label="Support email *"
            type="email"
            placeholder="support@example.com"
            {...register("supportEmail")}
            error={errors.supportEmail?.message}
          />
          <Input
            label="Support phone"
            type="tel"
            placeholder="+254…"
            {...register("supportPhone")}
            error={errors.supportPhone?.message}
          />
        </div>
      </section>

      <section
        aria-labelledby="payout-heading"
        className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-6"
      >
        <h3 id="payout-heading" className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50">
          Payout
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          How you receive ticket revenue. Updates here replace your previous payout instructions on
          file for new settlements.
        </p>

        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-foreground">Payout method *</p>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground/90">
              <input
                type="radio"
                value="BANK_ACCOUNT"
                {...register("payoutMethod")}
                className="h-4 w-4 accent-primary"
              />
              Bank transfer
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground/90">
              <input type="radio" value="MPESA" {...register("payoutMethod")} className="h-4 w-4 accent-primary" />
              M-Pesa
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground/90">
              <input type="radio" value="OTHER" {...register("payoutMethod")} className="h-4 w-4 accent-primary" />
              Other
            </label>
          </div>
          {errors.payoutMethod ? (
            <p className="mt-2 text-sm text-primary" role="alert">
              {errors.payoutMethod.message}
            </p>
          ) : null}
        </div>

        {payoutMethod === "BANK_ACCOUNT" ? (
          <div className="mt-6 space-y-4 border-l-2 border-primary/25 pl-4 sm:pl-5">
            <Input
              label="Bank name *"
              type="text"
              placeholder="Your bank"
              {...register("bankName")}
              error={errors.bankName?.message}
            />
            <Input
              label="Account name *"
              type="text"
              placeholder="Name on the account"
              {...register("bankAccountName")}
              error={errors.bankAccountName?.message}
            />
            <Input
              label="Account number *"
              type="text"
              placeholder="Account number"
              {...register("bankAccountNumber")}
              error={errors.bankAccountNumber?.message}
            />
          </div>
        ) : null}

        {payoutMethod === "MPESA" ? (
          <div className="mt-6 space-y-4 border-l-2 border-primary/25 pl-4 sm:pl-5">
            <Input
              label="Paybill number"
              type="text"
              placeholder="123456"
              {...register("mpesaPaybill")}
              error={errors.mpesaPaybill?.message}
            />
            <Input
              label="Till number"
              type="text"
              placeholder="123456"
              {...register("mpesaTillNumber")}
              error={errors.mpesaTillNumber?.message}
            />
            <p className="text-xs text-muted">At least one of paybill or till is required for M-Pesa.</p>
          </div>
        ) : null}

        {payoutMethod === "OTHER" ? (
          <div className="mt-6 border-l-2 border-primary/25 pl-4 sm:pl-5">
            <Textarea
              label="Payout instructions"
              rows={4}
              placeholder="Describe how you want to be paid…"
              {...register("payoutInstructions")}
              error={errors.payoutInstructions?.message}
            />
          </div>
        ) : null}

        <div className="mt-6 max-w-md">
          <Input label="Tax ID" type="text" placeholder="Optional" {...register("taxId")} error={errors.taxId?.message} />
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isSubmitting} className="w-auto min-w-[10rem]">
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
