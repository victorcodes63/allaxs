"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import axios from "axios";
import { Button } from "@/components/ui/Button";
import { EventStatus } from "@/lib/validation/event";

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
}

export function EventMediaTab({ event, onEventUpdate }: EventMediaTabProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    event.bannerUrl || null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to get the full banner URL for display
  // Backend serves static files from /static/... paths when using local storage
  // For production with CDN, URLs will be absolute
  const getBannerUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    // If it's already an absolute URL (CDN/production), return as is
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    // If it's a relative path (local storage), construct full URL
    // Backend serves static files, so we need the backend API URL
    if (typeof window !== "undefined") {
      // In browser, use NEXT_PUBLIC_API_URL if set, otherwise infer from current location
      // For local dev, backend typically runs on port 8080
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      return `${apiUrl}${url.startsWith("/") ? url : `/${url}`}`;
    }
    return url;
  };

  // Update preview URL when event banner changes
  useEffect(() => {
    setPreviewUrl(event.bannerUrl || null);
  }, [event.bannerUrl]);

  const isEditable =
    event.status === EventStatus.DRAFT ||
    event.status === EventStatus.PENDING_REVIEW;

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

      // If direct upload is supported, use it
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
        setSuccess("Banner uploaded successfully");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        // For presigned URLs (e.g., Spaces), we would need to implement the upload flow
        // For now, show an error
        setError("Direct upload not available. Please use a different storage driver.");
      }
    } catch (err) {
      const axiosError = err as {
        response?: { status?: number; data?: { message?: string } };
      };
      
      if (axiosError.response?.status === 403) {
        setError("You do not have permission to upload a banner for this event");
      } else if (axiosError.response?.status === 404) {
        setError("Event not found");
      } else if (axiosError.response?.status === 400) {
        const message =
          axiosError.response.data?.message || "Invalid file. Please check file type and size.";
        setError(message);
      } else {
        const message =
          axiosError.response?.data?.message || "Failed to upload banner";
        setError(message);
      }
      
      // Reset preview on error
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
        <div className="bg-green-100 border border-green-300 text-green-800 rounded-lg p-3 text-sm">
          {success}
        </div>
      )}

      <div className="bg-black/5 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Event Banner</h3>

        {previewUrl ? (
          <div className="space-y-4">
            <div className="relative w-full h-64 bg-black/5 rounded-lg overflow-hidden">
              <Image
                src={getBannerUrl(previewUrl) || ""}
                alt="Event banner preview"
                fill
                className="object-cover"
                sizes="100vw"
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
                  {uploading ? "Uploading..." : "Replace Banner"}
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
            <div className="relative w-full h-64 bg-black/5 rounded-lg border-2 border-dashed border-black/20 flex items-center justify-center">
              <div className="text-center">
                <p className="text-black/60 mb-2">No banner uploaded</p>
                {isEditable && (
                  <p className="text-sm text-black/40">
                    Upload an image to set as the event banner
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
                {uploading ? "Uploading..." : "Upload Banner"}
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
        <p className="text-sm text-black/60">
          Banner cannot be edited in the current event status. Only events in
          DRAFT or PENDING_REVIEW status can have their banners updated.
        </p>
      )}

      <div className="bg-black/5 rounded-lg p-4">
        <h4 className="font-semibold mb-2">Upload Guidelines</h4>
        <ul className="text-sm text-black/60 space-y-1 list-disc list-inside">
          <li>Supported formats: JPEG, PNG, WebP</li>
          <li>Maximum file size: 10MB</li>
          <li>Recommended dimensions: 1200x600 pixels</li>
        </ul>
      </div>
    </div>
  );
}

