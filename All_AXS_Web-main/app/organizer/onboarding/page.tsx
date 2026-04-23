"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import {
  organizerOnboardingSchema,
  type OrganizerOnboardingInput,
} from "@/lib/validation/organizer";
import { AuthCard } from "@/components/auth/AuthCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Step = 1 | 2;

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    trigger,
  } = useForm<OrganizerOnboardingInput>({
    resolver: zodResolver(organizerOnboardingSchema),
    mode: "onChange",
  });

  const payoutMethod = watch("payoutMethod");

  // Check if profile already exists on mount
  useEffect(() => {
    const checkProfile = async () => {
      try {
        const response = await axios.get("/api/organizer/profile");
        if (response.status === 200 && response.data) {
          setHasProfile(true);
          // Redirect to dashboard if profile exists
          router.replace("/organizer/dashboard");
        }
      } catch (err) {
        if ((err as { response?: { status?: number } }).response?.status === 404) {
          // No profile exists, continue with onboarding
          setHasProfile(false);
        } else {
          console.error("Error checking profile:", err);
        }
      } finally {
        setIsChecking(false);
      }
    };

    checkProfile();
  }, [router]);

  const validateStep = async (step: Step): Promise<boolean> => {
    if (step === 1) {
      const isValid = await trigger([
        "orgName",
        "supportEmail",
        "legalName",
        "website",
        "supportPhone",
      ]);
      return isValid;
    } else if (step === 2) {
      const fields: Array<keyof OrganizerOnboardingInput> = ["payoutMethod"];
      
      if (payoutMethod === "BANK_ACCOUNT") {
        fields.push("bankName", "bankAccountName", "bankAccountNumber");
      }
      
      if (payoutMethod === "MPESA") {
        fields.push("mpesaPaybill", "mpesaTillNumber");
      }
      
      fields.push("taxId", "payoutInstructions");
      
      const isValid = await trigger(fields);
      return isValid;
    }
    return false;
  };

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid) {
      setCurrentStep(2);
      setError(null);
    }
  };

  const handleBack = () => {
    setCurrentStep(1);
    setError(null);
  };

  const onSubmit = async (data: OrganizerOnboardingInput) => {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await axios.post("/api/organizer/profile", data);
      if (response.status === 200 || response.status === 201) {
        // Redirect to organizer dashboard
        router.push("/organizer/dashboard");
      }
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ||
        "An error occurred while saving your profile";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-black/60">Loading...</p>
        </div>
      </div>
    );
  }

  if (hasProfile) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-2xl">
        <AuthCard
          title="Set up your organizer profile"
          subtitle="Tell us about your organization and how you want to get paid."
        >
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full ${
                currentStep >= 1
                  ? "bg-primary text-white"
                  : "bg-black/10 text-black/40"
              }`}
            >
              1
            </div>
            <div
              className={`h-1 w-16 ${
                currentStep >= 2 ? "bg-primary" : "bg-black/10"
              }`}
            />
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full ${
                currentStep >= 2
                  ? "bg-primary text-white"
                  : "bg-black/10 text-black/40"
              }`}
            >
              2
            </div>
          </div>
          <p className="text-center text-sm text-black/60 mb-6">
            Step {currentStep} of 2
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="bg-primary/10 border border-primary/30 text-primary rounded-lg p-3 text-sm">
                {error}
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-black mb-4">
                  Organization Details
                </h2>

                <Input
                  label="Organization Name *"
                  type="text"
                  placeholder="Acme Events"
                  {...register("orgName")}
                  error={errors.orgName?.message}
                />

                <Input
                  label="Legal Name"
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
                  label="Support Email *"
                  type="email"
                  placeholder="support@example.com"
                  {...register("supportEmail")}
                  error={errors.supportEmail?.message}
                />

                <Input
                  label="Support Phone"
                  type="tel"
                  placeholder="+1234567890"
                  {...register("supportPhone")}
                  error={errors.supportPhone?.message}
                />

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleNext}
                    className="flex-1"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-black mb-4">
                  Payout Details
                </h2>
                <p className="text-sm text-black/60 mb-4">
                  This is a placeholder for payout information. Your payout
                  details will be finalized when we integrate with payment
                  service providers.
                </p>

                <div>
                  <label className="block font-medium mb-2 text-sm text-black">
                    Payout Method *
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="BANK_ACCOUNT"
                        {...register("payoutMethod")}
                        className="w-4 h-4 text-primary focus:ring-primary"
                      />
                      <span className="text-sm">Bank Account</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="MPESA"
                        {...register("payoutMethod")}
                        className="w-4 h-4 text-primary focus:ring-primary"
                      />
                      <span className="text-sm">MPESA</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="OTHER"
                        {...register("payoutMethod")}
                        className="w-4 h-4 text-primary focus:ring-primary"
                      />
                      <span className="text-sm">Other</span>
                    </label>
                  </div>
                  {errors.payoutMethod && (
                    <p className="mt-1 text-sm text-primary">
                      {errors.payoutMethod.message}
                    </p>
                  )}
                </div>

                {payoutMethod === "BANK_ACCOUNT" && (
                  <div className="space-y-4 pl-6 border-l-2 border-primary/20">
                    <Input
                      label="Bank Name *"
                      type="text"
                      placeholder="Chase Bank"
                      {...register("bankName")}
                      error={errors.bankName?.message}
                    />

                    <Input
                      label="Account Name *"
                      type="text"
                      placeholder="Acme Events"
                      {...register("bankAccountName")}
                      error={errors.bankAccountName?.message}
                    />

                    <Input
                      label="Account Number *"
                      type="text"
                      placeholder="1234567890"
                      {...register("bankAccountNumber")}
                      error={errors.bankAccountNumber?.message}
                    />
                  </div>
                )}

                {payoutMethod === "MPESA" && (
                  <div className="space-y-4 pl-6 border-l-2 border-primary/20">
                    <Input
                      label="Paybill Number"
                      type="text"
                      placeholder="123456"
                      {...register("mpesaPaybill")}
                      error={errors.mpesaPaybill?.message}
                    />

                    <Input
                      label="Till Number"
                      type="text"
                      placeholder="123456"
                      {...register("mpesaTillNumber")}
                      error={errors.mpesaTillNumber?.message}
                    />

                    <p className="text-xs text-black/60">
                      At least one of Paybill or Till Number is required
                    </p>
                  </div>
                )}

                {payoutMethod === "OTHER" && (
                  <div className="space-y-4 pl-6 border-l-2 border-primary/20">
                    <div>
                      <label className="block font-medium mb-1 text-sm text-black">
                        Payout Instructions
                      </label>
                      <textarea
                        {...register("payoutInstructions")}
                        rows={3}
                        className="w-full border border-black/20 rounded-lg px-4 py-2 bg-white text-black focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                        placeholder="Describe your preferred payout method..."
                      />
                    </div>
                  </div>
                )}

                <Input
                  label="Tax ID"
                  type="text"
                  placeholder="Optional"
                  {...register("taxId")}
                  error={errors.taxId?.message}
                />

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleBack}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    {isSubmitting ? "Saving..." : "Save & Continue"}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </AuthCard>
      </div>
    </div>
  );
}


