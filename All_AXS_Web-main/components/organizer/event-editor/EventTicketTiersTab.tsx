"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ticketTierSchema,
  type TicketTierInput,
  EventStatus,
} from "@/lib/validation/event";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { apiClient } from "@/lib/api-client";

interface TicketType {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  quantityTotal: number;
  quantitySold: number;
  maxPerOrder?: number;
  salesStart?: string;
  salesEnd?: string;
  currency: string;
  allowInstallments?: boolean;
  installmentConfig?: {
    mode: "PERCENT_SPLITS";
    splits: Array<{
      seq: number;
      pct: number;
      dueAfterDays: number;
    }>;
    minDepositPct?: number;
    gracePeriodDays?: number;
    autoCancelOnDefault?: boolean;
  } | null;
  [key: string]: unknown; // Allow additional properties to match parent component interface
}

interface Event {
  id: string;
  title?: string;
  type?: "IN_PERSON" | "VIRTUAL" | "HYBRID";
  venue?: string;
  status: string;
  slug?: string;
  startAt: string;
  endAt: string;
  description?: string;
  bannerUrl?: string | null;
  ticketTypes?: TicketType[];
  [key: string]: unknown; // Allow additional properties
}

interface EventTicketTiersTabProps {
  event: Event;
  onEventUpdate: (event: Event) => void;
}

export function EventTicketTiersTab({
  event,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onEventUpdate: _onEventUpdate,
}: EventTicketTiersTabProps) {
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isEditable =
    event.status === EventStatus.DRAFT ||
    event.status === EventStatus.PENDING_REVIEW;
  const isLocked = event.status === EventStatus.PUBLISHED;

  // Fetch ticket types on mount and when event changes
  useEffect(() => {
    const fetchTicketTypes = async () => {
      try {
        setLoading(true);
        setError(null);
        // Call Nest API directly
        const response = await apiClient.get(`/events/${event.id}/ticket-types`);
        setTicketTypes(response.data || []);
      } catch (err) {
        const apiError = err as {
          response?: { status?: number; data?: { message?: string } };
        };
        
        // If 404, just set empty array (no ticket types yet)
        if (apiError.response?.status === 404) {
          setTicketTypes([]);
        } else {
          const message =
            apiError.response?.data?.message || "Failed to load ticket types";
          setError(message);
          
          // Log full error in dev mode
          if (process.env.NODE_ENV !== "production") {
            console.error("Failed to load ticket types:", err);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    if (event.id) {
      fetchTicketTypes();
    }
  }, [event.id]);

  const handleCreate = () => {
    setEditingId("new");
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
  };

  const handleCancel = () => {
    setEditingId(null);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (!isEditable) {
      setError("Ticket tiers cannot be edited in the current event status");
      return;
    }

    if (
      !confirm("Are you sure you want to delete this ticket tier? This action cannot be undone.")
    ) {
      return;
    }

    setError(null);

    try {
      // Call Nest API directly - DELETE /ticket-types/:id
      await apiClient.delete(`/ticket-types/${id}`);
      
      // Refresh ticket types list
      const refreshResponse = await apiClient.get(`/events/${event.id}/ticket-types`);
      setTicketTypes(refreshResponse.data || []);
      
      setSuccess("Ticket tier deleted successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const apiError = err as {
        response?: { status?: number; data?: { message?: string } };
      };
      
      if (apiError.response?.status === 403) {
        setError("You do not have permission to delete ticket tiers for this event");
      } else if (apiError.response?.status === 404) {
        setError("Ticket tier not found");
      } else {
        const message =
          apiError.response?.data?.message || "Failed to delete ticket tier";
        setError(message);
        
        // Log full error in dev mode
        if (process.env.NODE_ENV !== "production") {
          console.error("Failed to delete ticket tier:", err);
        }
      }
    }
  };

  const onSubmit = async (data: TicketTierInput) => {
    // Diagnostic log
    if (process.env.NODE_ENV !== "production") {
      console.log("[TicketTierForm] onSubmit called with data:", data);
    }

    if (!isEditable) {
      setError("Ticket tiers cannot be edited in the current event status");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      // Validate sales window
      // Sales can start at any time (even before event)
      // Sales end must be before or at event end
      const eventEnd = new Date(event.endAt);

      if (data.salesEndAt) {
        const salesEnd = new Date(data.salesEndAt);
        if (salesEnd > eventEnd) {
          setError("Sales end must be on or before event end");
          setIsSubmitting(false);
          return;
        }
      }

      if (data.salesStartAt && data.salesEndAt) {
        const salesStart = new Date(data.salesStartAt);
        const salesEnd = new Date(data.salesEndAt);
        if (salesEnd <= salesStart) {
          setError("Sales end must be after sales start");
          setIsSubmitting(false);
          return;
        }
      }

      // Convert price from currency units to cents
      // Remove empty strings for optional fields (convert to undefined)
      const allowInstallments = Boolean(data.allowInstallments);
      const payload: {
        name: string;
        description?: string;
        priceCents: number;
        quantity: number;
        maxPerOrder?: number;
        salesStartAt?: string;
        salesEndAt?: string;
        allowInstallments: boolean;
        installmentConfig?: {
          mode: "PERCENT_SPLITS";
          splits: Array<{ seq: number; pct: number; dueAfterDays: number }>;
          minDepositPct?: number;
          gracePeriodDays?: number;
          autoCancelOnDefault: boolean;
        };
      } = {
        name: data.name,
        description: data.description || undefined,
        priceCents: Math.round(data.priceCents * 100), // Convert to cents
        quantity: data.quantity,
        maxPerOrder: data.maxPerOrder || undefined,
        salesStartAt: data.salesStartAt || undefined,
        salesEndAt: data.salesEndAt || undefined,
        allowInstallments,
      };

      // Only include installmentConfig if installments are enabled and config exists
      if (allowInstallments && data.installmentConfig && data.installmentConfig.splits) {
        payload.installmentConfig = {
          mode: "PERCENT_SPLITS",
          splits: data.installmentConfig.splits
            .filter((s) => s.seq && s.pct !== undefined && s.dueAfterDays !== undefined)
            .map((s) => ({
              seq: Number(s.seq),
              pct: Number(s.pct),
              dueAfterDays: Number(s.dueAfterDays),
            })),
          minDepositPct: data.installmentConfig.minDepositPct
            ? Number(data.installmentConfig.minDepositPct)
            : undefined,
          gracePeriodDays: data.installmentConfig.gracePeriodDays
            ? Number(data.installmentConfig.gracePeriodDays)
            : undefined,
          autoCancelOnDefault: data.installmentConfig.autoCancelOnDefault || false,
        };
      }

      // Diagnostic log
      if (process.env.NODE_ENV !== "production") {
        console.log("[TicketTierForm] Sending payload:", payload);
      }

      if (editingId === "new") {
        // Create ticket type - POST /events/:eventId/ticket-types
        if (process.env.NODE_ENV !== "production") {
          console.log("[TicketTierForm] POST /events/" + event.id + "/ticket-types");
        }
        await apiClient.post(`/events/${event.id}/ticket-types`, payload);
        setSuccess("Ticket tier created successfully");
      } else {
        // Update ticket type - PATCH /ticket-types/:id
        if (process.env.NODE_ENV !== "production") {
          console.log("[TicketTierForm] PATCH /ticket-types/" + editingId);
        }
        await apiClient.patch(`/ticket-types/${editingId}`, payload);
        setSuccess("Ticket tier updated successfully");
      }
      
      // Refresh ticket types list
      const refreshResponse = await apiClient.get(`/events/${event.id}/ticket-types`);
      setTicketTypes(refreshResponse.data || []);
      
      setTimeout(() => {
        setSuccess(null);
        setEditingId(null);
      }, 3000);
    } catch (err) {
      const apiError = err as {
        response?: { status?: number; data?: { message?: string } };
      };
      
      if (apiError.response?.status === 403) {
        setError("You do not have permission to manage ticket tiers for this event");
      } else if (apiError.response?.status === 400) {
        const message =
          apiError.response.data?.message || "Validation failed. Please check your input.";
        setError(message);
      } else {
        const message =
          apiError.response?.data?.message || "Failed to save ticket tier";
        setError(message);
        
        // Log full error in dev mode
        if (process.env.NODE_ENV !== "production") {
          console.error("Failed to save ticket tier:", err);
          if (apiError.response?.data) {
            console.error("Error response:", apiError.response.data);
          }
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const editingTier = editingId
    ? ticketTypes.find((t) => t.id === editingId)
    : null;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-primary/10 border border-primary/30 text-primary rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-300 text-green-800 rounded-lg p-3 text-sm">
          {success}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Ticket Tiers</h3>
          <p className="text-sm text-black/60">
            Manage ticket types for this event
          </p>
        </div>
        {isEditable && editingId === null && (
          <Button type="button" onClick={handleCreate}>
            Add Ticket Tier
          </Button>
        )}
      </div>

      {editingId && (
        <TicketTierForm
          tier={editingId === "new" ? null : editingTier || null}
          eventStartAt={event.startAt}
          eventEndAt={event.endAt}
          onSubmit={onSubmit}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
          isEditable={isEditable}
        />
      )}

      {loading && (
        <div className="bg-black/5 rounded-lg p-8 text-center">
          <p className="text-black/60">Loading ticket tiers...</p>
        </div>
      )}

      {!loading && ticketTypes.length === 0 && editingId === null && (
        <div className="bg-black/5 rounded-lg p-8 text-center">
          <p className="text-black/60 mb-2">No ticket tiers yet</p>
          {isEditable && (
            <p className="text-sm text-black/40">
              Click &quot;Add Ticket Tier&quot; to create your first ticket type
            </p>
          )}
        </div>
      )}

      {!loading && ticketTypes.length > 0 && editingId === null && (
        <div className="space-y-4">
          {ticketTypes.map((tier) => (
            <TicketTierCard
              key={tier.id}
              tier={tier}
              onEdit={() => handleEdit(tier.id)}
              onDelete={() => handleDelete(tier.id)}
              isEditable={isEditable}
              isLocked={isLocked}
            />
          ))}
        </div>
      )}

      {!isEditable && (
        <p className="text-sm text-black/60">
          Ticket tiers cannot be edited in the current event status. Only events
          in DRAFT or PENDING_REVIEW status can have their ticket tiers
          modified.
        </p>
      )}

      {isLocked && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> This event is published. Ticket tiers are
            locked and cannot be modified.
          </p>
        </div>
      )}
    </div>
  );
}

interface TicketTierFormProps {
  tier: TicketType | null;
  eventStartAt: string;
  eventEndAt: string;
  onSubmit: (data: TicketTierInput) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  isEditable: boolean;
}

function TicketTierForm({
  tier,
  eventEndAt,
  onSubmit,
  onCancel,
  isSubmitting,
  isEditable,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  eventStartAt: _eventStartAt,
}: TicketTierFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    control,
    setValue,
  } = useForm<TicketTierInput>({
    resolver: zodResolver(ticketTierSchema),
    mode: "onChange",
    defaultValues: {
      name: tier?.name || "",
      description: tier?.description || "",
      priceCents: tier ? tier.priceCents / 100 : 0, // Convert cents to currency units for display
      quantity: tier?.quantityTotal || 1,
      maxPerOrder: tier?.maxPerOrder || undefined,
      salesStartAt: tier?.salesStart
        ? new Date(tier.salesStart).toISOString().slice(0, 16)
        : "",
      salesEndAt: tier?.salesEnd
        ? new Date(tier.salesEnd).toISOString().slice(0, 16)
        : "",
      allowInstallments: tier?.allowInstallments || false,
      installmentConfig: tier?.installmentConfig
        ? {
            mode: "PERCENT_SPLITS" as const,
            splits: tier.installmentConfig.splits || [],
            minDepositPct: tier.installmentConfig.minDepositPct,
            gracePeriodDays: tier.installmentConfig.gracePeriodDays,
            autoCancelOnDefault: tier.installmentConfig.autoCancelOnDefault,
          }
        : undefined,
    },
  });

  const allowInstallments = watch("allowInstallments");
  const installmentConfig = watch("installmentConfig");
  const splits = installmentConfig?.splits || [];

  const { fields, append, remove } = useFieldArray({
    control,
    name: "installmentConfig.splits",
  });

  // Initialize splits and config structure if installments enabled but no splits exist
  useEffect(() => {
    if (allowInstallments && fields.length === 0) {
      // Ensure installmentConfig structure exists
      const currentConfig = watch("installmentConfig");
      if (!currentConfig) {
        setValue(
          "installmentConfig",
          {
            mode: "PERCENT_SPLITS",
            splits: [],
            minDepositPct: undefined,
            gracePeriodDays: undefined,
            autoCancelOnDefault: false,
          },
          { shouldValidate: false }
        );
      }
      // Add default splits
      append({ seq: 1, pct: 50, dueAfterDays: 0 });
      append({ seq: 2, pct: 50, dueAfterDays: 30 });
    } else if (!allowInstallments && installmentConfig) {
      // Clear config when installments disabled
      setValue("installmentConfig", undefined, { shouldValidate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowInstallments, fields.length]);

  // Calculate running sum
  const totalPct = splits.reduce((sum, split) => sum + (split.pct || 0), 0);

  // Add submit handler with error logging
  const onFormSubmit = handleSubmit(
    (data) => {
      if (process.env.NODE_ENV !== "production") {
        console.log("[TicketTierForm] Form validation passed, calling onSubmit");
      }
      return onSubmit(data);
    },
    (errors) => {
      // Log validation errors and show them
      if (process.env.NODE_ENV !== "production") {
        console.error("[TicketTierForm] Form validation failed:", errors);
        console.error("[TicketTierForm] Error details:", JSON.stringify(errors, null, 2));
      }
      // Scroll to first error
      const firstErrorField = Object.keys(errors)[0];
      if (firstErrorField) {
        const element = document.querySelector(`[name="${firstErrorField}"]`);
        if (element) {
          (element as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }
  );

  return (
    <form
      onSubmit={onFormSubmit}
      className="bg-white border border-black/10 rounded-lg p-6 space-y-4"
    >
      <h4 className="text-lg font-semibold">
        {tier ? "Edit Ticket Tier" : "New Ticket Tier"}
      </h4>

      <Input
        label="Name *"
        type="text"
        placeholder="General Admission"
        {...register("name")}
        error={errors.name?.message}
        disabled={!isEditable}
      />

      <Textarea
        label="Description"
        rows={3}
        placeholder="Ticket tier description..."
        {...register("description")}
        error={errors.description?.message}
        disabled={!isEditable}
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Input
            label="Price (KES) *"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            {...register("priceCents", {
              valueAsNumber: true,
            })}
            error={errors.priceCents?.message}
            disabled={!isEditable}
          />
          <p className="text-xs text-black/60 mt-1">
            Price in Kenyan Shillings (e.g., 1000.00 for 1000 KES)
          </p>
        </div>

        <Input
          label="Quantity *"
          type="number"
          min="0"
          placeholder="100"
          {...register("quantity", { valueAsNumber: true })}
          error={errors.quantity?.message}
          disabled={!isEditable}
        />
      </div>

      <Input
        label="Max Per Order"
        type="number"
        min="1"
        placeholder="Optional"
        {...register("maxPerOrder", {
          valueAsNumber: true,
          setValueAs: (v) => (v === "" ? undefined : Number(v)),
        })}
        error={errors.maxPerOrder?.message}
        disabled={!isEditable}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Sales Start"
          type="datetime-local"
          max={new Date(eventEndAt).toISOString().slice(0, 16)}
          {...register("salesStartAt")}
          error={errors.salesStartAt?.message}
          disabled={!isEditable}
        />

        <Input
          label="Sales End"
          type="datetime-local"
          max={new Date(eventEndAt).toISOString().slice(0, 16)}
          {...register("salesEndAt")}
          error={errors.salesEndAt?.message}
          disabled={!isEditable}
        />
      </div>
      <p className="text-xs text-black/60 mt-1">
        Sales can start at any time. Sales end must be on or before event end.
      </p>

      {/* Installment Configuration */}
      <div className="border-t border-black/10 pt-4 space-y-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="allowInstallments"
            {...register("allowInstallments")}
            disabled={!isEditable}
            className="w-4 h-4"
          />
          <label
            htmlFor="allowInstallments"
            className="text-sm font-medium cursor-pointer"
          >
            Allow payment in installments
          </label>
        </div>
        {errors.allowInstallments && (
          <p className="text-sm text-red-600">
            {errors.allowInstallments.message}
          </p>
        )}

        {allowInstallments && (
          <div className="ml-6 space-y-4 border-l-2 border-black/10 pl-4">
            {/* Hidden field to ensure mode is set for validation */}
            <input
              type="hidden"
              {...register("installmentConfig.mode")}
              value="PERCENT_SPLITS"
            />
            <div>
              <label className="text-sm font-medium mb-2 block">
                Payment Splits *
              </label>
              <div className="space-y-2">
                <table className="w-full text-sm border border-black/10 rounded">
                  <thead className="bg-black/5">
                    <tr>
                      <th className="p-2 text-left">#</th>
                      <th className="p-2 text-left">%</th>
                      <th className="p-2 text-left">Due After (days)</th>
                      <th className="p-2 text-left"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => {
                      const splitErrors = errors.installmentConfig?.splits?.[index];
                      return (
                        <tr key={field.id} className="border-t border-black/10">
                          <td className="p-2">
                            <input
                              type="number"
                              {...register(
                                `installmentConfig.splits.${index}.seq` as const,
                                { valueAsNumber: true, required: true }
                              )}
                              disabled={!isEditable}
                              className="w-16 px-2 py-1 border rounded"
                              min="1"
                            />
                            {splitErrors?.seq && (
                              <p className="text-xs text-red-600 mt-1">
                                {splitErrors.seq.message}
                              </p>
                            )}
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.01"
                              {...register(
                                `installmentConfig.splits.${index}.pct` as const,
                                { valueAsNumber: true, required: true }
                              )}
                              disabled={!isEditable}
                              className="w-20 px-2 py-1 border rounded"
                              min="0"
                              max="100"
                            />
                            {splitErrors?.pct && (
                              <p className="text-xs text-red-600 mt-1">
                                {splitErrors.pct.message}
                              </p>
                            )}
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              {...register(
                                `installmentConfig.splits.${index}.dueAfterDays` as const,
                                { valueAsNumber: true, required: true }
                              )}
                              disabled={!isEditable}
                              className="w-24 px-2 py-1 border rounded"
                              min="0"
                            />
                            {splitErrors?.dueAfterDays && (
                              <p className="text-xs text-red-600 mt-1">
                                {splitErrors.dueAfterDays.message}
                              </p>
                            )}
                          </td>
                          <td className="p-2">
                            {isEditable && fields.length > 2 && (
                              <button
                                type="button"
                                onClick={() => remove(index)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {errors.installmentConfig && (
                  <div className="space-y-1">
                    {errors.installmentConfig.splits && (
                      <p className="text-sm text-red-600">
                        {typeof errors.installmentConfig.splits === "string"
                          ? errors.installmentConfig.splits
                          : errors.installmentConfig.splits.message ||
                            errors.installmentConfig.splits.root?.message ||
                            "Please fix the errors in the payment splits"}
                      </p>
                    )}
                    {errors.installmentConfig.message && (
                      <p className="text-sm text-red-600">
                        {errors.installmentConfig.message}
                      </p>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-black/60">
                      Total: <span className="font-medium">{totalPct.toFixed(2)}%</span>
                      {Math.abs(totalPct - 100) > 0.01 && (
                        <span className="text-red-600 ml-2">
                          (Must equal 100%)
                        </span>
                      )}
                    </p>
                  </div>
                  {isEditable && (
                    <button
                      type="button"
                      onClick={() =>
                        append({
                          seq: fields.length + 1,
                          pct: 0,
                          dueAfterDays: 0,
                        })
                      }
                      className="text-sm text-primary hover:text-primary/80"
                    >
                      + Add Split
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Min Deposit %"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="Optional"
                {...register("installmentConfig.minDepositPct", {
                  valueAsNumber: true,
                  setValueAs: (v) => (v === "" ? undefined : Number(v)),
                })}
                error={errors.installmentConfig?.minDepositPct?.message}
                disabled={!isEditable}
              />

              <Input
                label="Grace Period (days)"
                type="number"
                min="0"
                placeholder="Optional"
                {...register("installmentConfig.gracePeriodDays", {
                  valueAsNumber: true,
                  setValueAs: (v) => (v === "" ? undefined : Number(v)),
                })}
                error={errors.installmentConfig?.gracePeriodDays?.message}
                disabled={!isEditable}
              />

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="autoCancelOnDefault"
                  {...register("installmentConfig.autoCancelOnDefault")}
                  disabled={!isEditable}
                  className="w-4 h-4"
                />
                <label
                  htmlFor="autoCancelOnDefault"
                  className="text-sm cursor-pointer"
                >
                  Auto-cancel on default
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          disabled={!isEditable || isSubmitting}
          data-testid={tier ? "update-ticket-tier-button" : "create-ticket-tier-button"}
        >
          {isSubmitting ? "Saving..." : tier ? "Update" : "Create"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

interface TicketTierCardProps {
  tier: TicketType;
  onEdit: () => void;
  onDelete: () => void;
  isEditable: boolean;
  isLocked: boolean;
}

function TicketTierCard({
  tier,
  onEdit,
  onDelete,
  isEditable,
  isLocked,
}: TicketTierCardProps) {
  const price = (tier.priceCents / 100).toFixed(2);
  const available = tier.quantityTotal - tier.quantitySold;

  return (
    <div className="bg-white border border-black/10 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-semibold text-lg">{tier.name}</h4>
          {tier.description && (
            <p className="text-sm text-black/60 mt-1">{tier.description}</p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-black/60">Price: </span>
              <span className="font-medium">{price} {tier.currency}</span>
            </div>
            <div>
              <span className="text-black/60">Quantity: </span>
              <span className="font-medium">
                {available} / {tier.quantityTotal} available
              </span>
            </div>
            {tier.maxPerOrder && (
              <div>
                <span className="text-black/60">Max per order: </span>
                <span className="font-medium">{tier.maxPerOrder}</span>
              </div>
            )}
            {tier.salesStart && (
              <div>
                <span className="text-black/60">Sales start: </span>
                <span className="font-medium">
                  {new Date(tier.salesStart).toLocaleDateString()}
                </span>
              </div>
            )}
            {tier.salesEnd && (
              <div>
                <span className="text-black/60">Sales end: </span>
                <span className="font-medium">
                  {new Date(tier.salesEnd).toLocaleDateString()}
                </span>
              </div>
            )}
            {tier.allowInstallments && (
              <div className="col-span-2">
                <span className="text-black/60">Installments: </span>
                <span className="font-medium">Enabled</span>
                {tier.installmentConfig?.splits && (
                  <span className="text-black/60 ml-2">
                    ({tier.installmentConfig.splits.length} payments)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        {isEditable && !isLocked && (
          <div className="flex gap-2 ml-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onEdit}
              className="px-3 py-1 text-sm"
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onDelete}
              className="px-3 py-1 text-sm"
            >
              Delete
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

