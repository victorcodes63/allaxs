"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import axios from "axios";
import { Button } from "@/components/ui/Button";
import { EventStatus } from "@/lib/validation/event";
import { getEventBannerUrl, shouldUnoptimizeEventImage } from "@/lib/utils/image";

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
  [key: string]: unknown;
}

interface Event {
  id: string;
  title?: string;
  type?: "IN_PERSON" | "VIRTUAL" | "HYBRID";
  venue?: string;
  startAt?: string;
  endAt?: string;
  description?: string;
  status: string;
  slug?: string;
  bannerUrl?: string | null;
  ticketTypes?: TicketType[];
  [key: string]: unknown; // Allow additional properties
}

interface EventMediaTabProps {
  event: Event;
  onEventUpdate: (event: Event) => void;
  /**
   * Set by the admin editor to allow banner replacement on PUBLISHED /
   * APPROVED events (e.g. to take down inappropriate imagery flagged
   * post-launch). Backend audit-logs the upload as
   * `ADMIN_UPDATE_EVENT_BANNER`.
   */
  canEditOverride?: boolean;
}

export function EventMediaTab({
  event,
  onEventUpdate,
  canEditOverride = false,
}: EventMediaTabProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    event.bannerUrl || null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update preview URL when event banner changes
  useEffect(() => {
    setPreviewUrl(event.bannerUrl || null);
  }, [event.bannerUrl]);

  const isEditable =
    canEditOverride ||
    event.status === EventStatus.DRAFT ||
    event.status === EventStatus.PENDING_REVIEW ||
    event.status === EventStatus.REJECTED;
  const resolvedPreviewUrl = previewUrl ? getEventBannerUrl(previewUrl) : null;

  // MIME types and file size limits should match backend configuration
  // Backend uses UPLOAD_ALLOWED_MIME and UPLOAD_MAX_MB env vars (default: 10MB)
  const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (matches backend default)

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`;
    }

    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    }

    return null;
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    await uploadBanner(file);
  };

  const uploadBanner = async (file: File) => {
    if (!isEditable) {
      setError("Event cannot be edited in its current status");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // For local storage, we can use direct upload
      // First, initialize the upload to get the path hint
      const initResponse = await axios.post(
        `/api/uploads/events/${event.id}/banner/init`,
        {
          mime: file.type,
          size: file.size,
        }
      );

      if (initResponse.data.directUpload) {
        const formData = new FormData();
        formData.append("file", file);

        const uploadResponse = await axios.post(
          `/api/uploads/events/${event.id}/banner/direct`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );

        // Update event with new banner URL (direct upload auto-commits)
        onEventUpdate(uploadResponse.data.event);
        setPreviewUrl(uploadResponse.data.finalUrl);
        setSuccess("Poster uploaded successfully");
        setTimeout(() => setSuccess(null), 3000);
      } else if (initResponse.data.mode === "presigned") {
        const uploadUrl = initResponse.data.uploadUrl as string | undefined;
        const finalUrl = initResponse.data.finalUrl as string | undefined;

        if (!uploadUrl || !finalUrl) {
          setError("Upload could not be initialized. Please try again.");
          return;
        }

        const uploadHeaders = {
          ...(initResponse.data.headers ?? {}),
          "Content-Type": file.type,
        } as Record<string, string>;
        delete uploadHeaders["Content-Length"];
        delete uploadHeaders["content-length"];

        await axios.put(uploadUrl, file, {
          headers: uploadHeaders,
        });

        const commitResponse = await axios.post(
          `/api/events/${event.id}/banner/commit`,
          { url: finalUrl },
        );

        onEventUpdate(commitResponse.data);
        setPreviewUrl(finalUrl);
        setSuccess("Poster uploaded successfully");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError("Upload mode is not supported by this storage driver.");
      }
    } catch (err) {
      const axiosError = err as {
        response?: { status?: number; data?: { message?: string } };
      };
      const status = axiosError.response?.status;
      const rawMessage = axiosError.response?.data?.message;
      const isStorageDisabled =
        status === 501 ||
        (typeof rawMessage === "string" &&
          /file uploads are disabled|storage_driver/i.test(rawMessage));

      if (isStorageDisabled) {
        setError(
          "Poster uploads are not configured on this server yet. Ask an admin to enable storage (e.g. STORAGE_DRIVER=local in dev, or DigitalOcean Spaces in production).",
        );
      } else if (status === 403) {
        setError("You do not have permission to upload a poster for this event.");
      } else if (status === 404) {
        setError("Event not found.");
      } else if (status === 400) {
        setError(rawMessage || "Invalid file. Check the file type and size and try again.");
      } else {
        setError(rawMessage || "Failed to upload poster. Please try again.");
      }

      setPreviewUrl(event.bannerUrl || null);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveBanner = async () => {
    if (!isEditable) {
      setError("Event cannot be edited in its current status");
      return;
    }

    if (
      !confirm(
        "Are you sure you want to remove the banner? This action cannot be undone."
      )
    ) {
      return;
    }

    setError(null);

    try {
      // Note: The backend doesn't currently support removing banners via PATCH
      // (bannerUrl is excluded from UpdateEventDto). This would require
      // a backend endpoint to delete/remove banners, or we could upload
      // a placeholder image. For now, we'll show a message.
      setError(
        "Banner removal is not yet supported. Please upload a new banner to replace the current one."
      );
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message || "Failed to remove banner";
      setError(message);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-primary/10 border border-primary/30 text-primary rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-600/35 bg-emerald-500/10 p-3 text-sm text-emerald-100">
          {success}
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface/60 p-6">
        <h3 className="mb-4 text-lg font-semibold text-foreground">
          Poster / banner
        </h3>
        <p className="mb-4 text-sm text-muted">
          This image appears on your public listing, checkout, and organizer list.
          Use a wide image (about 2:1) or a tall poster — it will be cropped to fit.
        </p>

        {resolvedPreviewUrl ? (
          <div className="space-y-4">
            <div className="relative h-64 w-full overflow-hidden rounded-lg bg-wash">
              <Image
                src={resolvedPreviewUrl}
                alt="Event banner preview"
                fill
                className="object-cover"
                sizes="100vw"
                unoptimized={shouldUnoptimizeEventImage(resolvedPreviewUrl)}
                onError={() => {
                  setError("Failed to load banner image");
                }}
              />
            </div>
            {isEditable && (
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Replace poster"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleRemoveBanner}
                  disabled={uploading}
                >
                  Remove Banner
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative flex h-64 w-full items-center justify-center rounded-lg border-2 border-dashed border-border bg-wash">
              <div className="text-center px-4">
                <p className="mb-2 text-sm font-medium text-foreground">
                  No poster yet
                </p>
                {isEditable && (
                  <p className="text-sm text-muted">
                    JPEG, PNG, or WebP — up to 10MB
                  </p>
                )}
              </div>
            </div>
            {isEditable && (
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? "Uploading..." : "Upload poster"}
              </Button>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_MIME_TYPES.join(",")}
          onChange={handleFileSelect}
          className="hidden"
          disabled={!isEditable || uploading}
        />
      </div>

      {!isEditable && (
        <p className="text-sm text-muted">
          Posters cannot be edited in the current event status. Only events in
          DRAFT, PENDING_REVIEW, or REJECTED can be updated.
        </p>
      )}

      <div className="rounded-lg border border-border bg-surface/40 p-4">
        <h4 className="mb-2 font-semibold text-foreground">Guidelines</h4>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted">
          <li>Supported formats: JPEG, PNG, WebP</li>
          <li>Maximum file size: 10MB</li>
          <li>Recommended: wide hero ~1200×600, or a tall poster (min. 800px on the short edge)</li>
        </ul>
      </div>
    </div>
  );
}

