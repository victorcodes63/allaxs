"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios, { isAxiosError } from "axios";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { nativeDarkControlClass } from "@/components/ui/nativeDarkField";
import { normalizeOrganizerEventsListPayload } from "@/lib/organizer-events-list";
import { EventStatus } from "@/lib/validation/event";

interface MarketingEvent {
  id: string;
  title: string;
  slug: string;
  status: string;
  startAt: string;
}

function getOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

function buildEventUrl(event: MarketingEvent): string {
  const origin = getOrigin();
  if (!origin) return `/e/${event.slug}`;
  return `${origin}/e/${event.slug}`;
}

function appendUtm(
  url: string,
  utm: { source?: string; medium?: string; campaign?: string; term?: string; content?: string },
): string {
  if (!url) return url;
  try {
    const u = new URL(url, getOrigin() || "https://example.com");
    if (utm.source) u.searchParams.set("utm_source", utm.source);
    if (utm.medium) u.searchParams.set("utm_medium", utm.medium);
    if (utm.campaign) u.searchParams.set("utm_campaign", utm.campaign);
    if (utm.term) u.searchParams.set("utm_term", utm.term);
    if (utm.content) u.searchParams.set("utm_content", utm.content);
    return u.toString();
  } catch {
    return url;
  }
}

function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function buildEmbedSnippet(eventUrl: string, title: string): string {
  return `<iframe src="${eventUrl}?embed=1" width="100%" height="600" frameborder="0" loading="lazy" title="${title.replace(/"/g, "&quot;")}" style="border:0; max-width: 600px;"></iframe>`;
}

function CopyField({
  label,
  value,
  rows,
}: {
  label: string;
  value: string;
  rows?: number;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {label}
        </span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="text-xs font-semibold uppercase tracking-wide text-primary hover:underline"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {rows && rows > 1 ? (
        <textarea
          readOnly
          value={value}
          rows={rows}
          className="mt-1 w-full rounded-[var(--radius-panel)] border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground"
        />
      ) : (
        <input
          readOnly
          value={value}
          className="mt-1 w-full rounded-[var(--radius-panel)] border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground"
        />
      )}
    </div>
  );
}

export default function OrganizerMarketingPage() {
  const [events, setEvents] = useState<MarketingEvent[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [utmSource, setUtmSource] = useState("instagram");
  const [utmMedium, setUtmMedium] = useState("social");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [utmTerm, setUtmTerm] = useState("");
  const [utmContent, setUtmContent] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get<unknown>("/api/events");
      const list = normalizeOrganizerEventsListPayload<MarketingEvent>(res.data);
      const visible = list.filter((e) => e.id && e.title && e.slug);
      setEvents(visible);
      if (visible.length > 0 && !selected) {
        const firstPublished = visible.find(
          (e) => e.status === EventStatus.PUBLISHED,
        );
        setSelected((firstPublished ?? visible[0]).id);
      }
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : null;
      setError(msg || "Could not load your events.");
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const event = useMemo(
    () => events.find((e) => e.id === selected) ?? null,
    [events, selected],
  );

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <p className="text-sm text-muted">Loading marketing kit…</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="space-y-6">
        <header className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Organiser
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Marketing
          </h1>
        </header>
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/80 p-8 text-center sm:p-10">
          <p className="text-sm text-muted">
            Create an event first — share kits, QR codes, and embeds appear here
            once you have at least one event.
          </p>
        </div>
      </div>
    );
  }

  if (!event) {
    return null;
  }

  const baseUrl = buildEventUrl(event);
  const utmUrl = appendUtm(baseUrl, {
    source: utmSource,
    medium: utmMedium,
    campaign: utmCampaign,
    term: utmTerm,
    content: utmContent,
  });
  const shareText = `${event.title} — get tickets: ${utmUrl}`;
  const embedSnippet = buildEmbedSnippet(baseUrl, event.title);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          Organiser
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Marketing
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Per-event share kit: copy a clean link, post to WhatsApp, render a QR
          code, embed the listing on your site, or build a UTM link to attribute
          traffic.
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

      <div className="rounded-[var(--radius-panel)] border border-border bg-surface/80 p-4">
        <label className="block text-sm font-medium text-foreground">
          Event
        </label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className={`${nativeDarkControlClass(false)} mt-1`}
        >
          {events.map((evt) => (
            <option key={evt.id} value={evt.id}>
              {evt.title} ({evt.status.replace(/_/g, " ").toLowerCase()})
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-[var(--radius-panel)] border border-border bg-surface/80 p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Share links
          </h2>
          <CopyField label="Public link" value={baseUrl} />
          <CopyField label="Tracked link (UTM)" value={utmUrl} />
          <div className="flex flex-wrap gap-3">
            <a
              href={whatsappShareUrl(shareText)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] bg-primary px-6 text-sm font-semibold text-white"
            >
              Share on WhatsApp
            </a>
            <Button
              type="button"
              variant="secondary"
              className="w-auto"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.open(baseUrl, "_blank", "noopener");
                }
              }}
            >
              Open public page
            </Button>
          </div>
        </section>

        <section className="space-y-4 rounded-[var(--radius-panel)] border border-border bg-surface/80 p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-foreground">
            QR code
          </h2>
          <p className="text-sm text-muted">
            Print or share. The QR points to the tracked UTM link so scans appear
            in your event insights.
          </p>
          <div className="flex justify-center rounded-lg bg-white p-4">
            <QRCode value={utmUrl} size={192} />
          </div>
        </section>

        <section className="space-y-4 rounded-[var(--radius-panel)] border border-border bg-surface/80 p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-foreground">
            UTM builder
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Source"
              placeholder="instagram"
              value={utmSource}
              onChange={(e) => setUtmSource(e.target.value)}
            />
            <Input
              label="Medium"
              placeholder="social"
              value={utmMedium}
              onChange={(e) => setUtmMedium(e.target.value)}
            />
            <Input
              label="Campaign"
              placeholder="early-bird"
              value={utmCampaign}
              onChange={(e) => setUtmCampaign(e.target.value)}
            />
            <Input
              label="Term"
              placeholder="ticket"
              value={utmTerm}
              onChange={(e) => setUtmTerm(e.target.value)}
            />
            <Input
              label="Content"
              placeholder="story-1"
              value={utmContent}
              onChange={(e) => setUtmContent(e.target.value)}
            />
          </div>
        </section>

        <section className="space-y-4 rounded-[var(--radius-panel)] border border-border bg-surface/80 p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Embed code
          </h2>
          <CopyField label="Iframe embed" value={embedSnippet} rows={5} />
          <p className="text-xs text-muted">
            Paste into your CMS where you want the listing to appear. Customers
            can browse tickets without leaving your site.
          </p>
        </section>
      </div>
    </div>
  );
}
