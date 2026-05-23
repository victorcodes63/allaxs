"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

interface StoreSettings {
  slug: string;
  bio: string;
  logoUrl: string;
  brandColor: string;
  isPublic: boolean;
}

const DEFAULT_SETTINGS: StoreSettings = {
  slug: "",
  bio: "",
  logoUrl: "",
  brandColor: "#F07241",
  isPublic: false,
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normalizeStore(data: unknown): StoreSettings {
  if (!isRecord(data)) return { ...DEFAULT_SETTINGS };
  return {
    slug: typeof data.slug === "string" ? data.slug : "",
    bio: typeof data.bio === "string" ? data.bio : "",
    logoUrl: typeof data.logoUrl === "string" ? data.logoUrl : "",
    brandColor:
      typeof data.brandColor === "string" && data.brandColor
        ? data.brandColor
        : "#F07241",
    isPublic: data.isPublic !== false,
  };
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](-?[a-z0-9])*$/.test(slug);
}

export default function OrganizerStorePage() {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [original, setOriginal] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get<unknown>("/api/organizer/store");
      const normalized = normalizeStore(res.data);
      setSettings(normalized);
      setOriginal(normalized);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 404) {
        // Backend hasn't enabled the store endpoint yet — keep defaults so the
        // form is usable.
        setSettings(DEFAULT_SETTINGS);
        setOriginal(DEFAULT_SETTINGS);
      } else {
        const msg = isAxiosError(err)
          ? (err.response?.data as { message?: string })?.message
          : null;
        setError(msg || "Could not load store settings.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty =
    settings.slug !== original.slug ||
    settings.bio !== original.bio ||
    settings.logoUrl !== original.logoUrl ||
    settings.brandColor !== original.brandColor ||
    settings.isPublic !== original.isPublic;

  const save = async () => {
    setError(null);
    setSuccess(null);
    if (settings.slug && !isValidSlug(settings.slug)) {
      setError(
        "Slug must use lowercase letters, numbers, and hyphens (e.g. my-events).",
      );
      return;
    }
    setSaving(true);
    try {
      const res = await axios.patch<unknown>("/api/organizer/store", settings);
      const normalized = normalizeStore(res.data);
      setSettings(normalized);
      setOriginal(normalized);
      setSuccess("Store settings saved.");
      window.setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : null;
      setError(msg || "Could not save store settings.");
    } finally {
      setSaving(false);
    }
  };

  const previewHref = settings.slug ? `/o/${settings.slug}` : null;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          Organiser
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Public store
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Customize your branded organizer page. Fans can find your published
          events at <span className="font-mono text-foreground">/o/&lt;slug&gt;</span>
          {" "}and discover everything you have on sale in one place.
        </p>
      </header>

      {error ? (
        <div
          className="rounded-[var(--radius-panel)] border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      {success ? (
        <div
          className="rounded-[var(--radius-panel)] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
          role="status"
        >
          {success}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Loading store settings…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-4 rounded-[var(--radius-panel)] border border-border bg-surface/80 p-5 sm:p-6">
            <h2 className="font-display text-lg font-semibold text-foreground">
              Identity
            </h2>
            <Input
              label="Store slug"
              placeholder="my-events"
              value={settings.slug}
              onChange={(e) =>
                setSettings({ ...settings, slug: e.target.value.toLowerCase() })
              }
              error={
                settings.slug && !isValidSlug(settings.slug)
                  ? "Lowercase letters, numbers, and hyphens only."
                  : undefined
              }
            />
            <Textarea
              label="Bio"
              rows={4}
              placeholder="Tell fans what your organization is about."
              value={settings.bio}
              onChange={(e) =>
                setSettings({ ...settings, bio: e.target.value })
              }
            />
            <Input
              label="Logo URL"
              type="url"
              placeholder="https://…/logo.png"
              value={settings.logoUrl}
              onChange={(e) =>
                setSettings({ ...settings, logoUrl: e.target.value })
              }
            />
            <div>
              <label className="block text-sm font-medium text-foreground">
                Brand color
              </label>
              <div className="mt-1 flex items-center gap-3">
                <input
                  type="color"
                  value={settings.brandColor}
                  onChange={(e) =>
                    setSettings({ ...settings, brandColor: e.target.value })
                  }
                  className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent"
                />
                <Input
                  label=""
                  value={settings.brandColor}
                  onChange={(e) =>
                    setSettings({ ...settings, brandColor: e.target.value })
                  }
                />
              </div>
            </div>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.isPublic}
                onChange={(e) =>
                  setSettings({ ...settings, isPublic: e.target.checked })
                }
                className="h-4 w-4 rounded border border-border bg-surface text-primary focus:ring-primary"
              />
              <span className="text-sm text-foreground">
                Publish my store at <span className="font-mono">/o/{settings.slug || "<slug>"}</span>
              </span>
            </label>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                type="button"
                disabled={!dirty || saving}
                onClick={() => void save()}
              >
                {saving ? "Saving…" : "Save changes"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!dirty || saving}
                onClick={() => setSettings(original)}
              >
                Reset
              </Button>
            </div>
          </section>

          <section className="space-y-4 rounded-[var(--radius-panel)] border border-border bg-surface/80 p-5 sm:p-6">
            <h2 className="font-display text-lg font-semibold text-foreground">
              Preview
            </h2>
            <div
              className="rounded-[var(--radius-panel)] border border-border bg-background p-6"
              style={{ borderTopColor: settings.brandColor }}
            >
              <div className="flex items-center gap-4">
                {settings.logoUrl ? (
                  // Use plain <img> to avoid Next/Image domain configuration for arbitrary URLs.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={settings.logoUrl}
                    alt="Store logo preview"
                    className="h-14 w-14 rounded-full border border-border object-cover"
                  />
                ) : (
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold text-white"
                    style={{ backgroundColor: settings.brandColor }}
                  >
                    {(settings.slug || "?").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-display text-xl font-semibold text-foreground">
                    {settings.slug || "Your store"}
                  </p>
                  <p className="text-xs text-muted">
                    {settings.isPublic ? "Public store" : "Hidden — only visible to you"}
                  </p>
                </div>
              </div>
              <p className="mt-4 whitespace-pre-line text-sm text-muted">
                {settings.bio || "Add a short bio so fans know what kind of events you run."}
              </p>
            </div>
            {previewHref && settings.isPublic ? (
              <Link
                href={previewHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-auto items-center text-sm font-semibold text-primary hover:underline"
              >
                Open public page →
              </Link>
            ) : (
              <p className="text-xs text-muted">
                Set a slug and toggle &ldquo;Publish my store&rdquo; to enable the public page.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
