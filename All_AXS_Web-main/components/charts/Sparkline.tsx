/** Daily order aggregate used by organizer/admin sparklines. */
export type OrderTrendPoint = {
  date: string;
  count: number;
  grossCents: number;
};

/**
 * Tiny SVG sparkline for KPI cards (paid / refunded daily counts).
 *
 * Renders points as a single-stroke polyline scaled to fit the box, plus a
 * lightly-shaded area underneath so even a flat zero-line is visible against
 * the surface. Designed to read at-a-glance in a 90×24-ish slot.
 */
export function Sparkline({
  points,
  ariaLabel,
  tone = "neutral",
}: {
  points: OrderTrendPoint[];
  ariaLabel: string;
  tone?: "neutral" | "positive" | "warn";
}) {
  if (points.length === 0) return null;
  const max = Math.max(1, ...points.map((p) => p.count));
  const width = 100;
  const height = 28;
  const stepX = points.length > 1 ? width / (points.length - 1) : width;
  const path = points
    .map((p, i) => {
      const x = points.length > 1 ? i * stepX : width / 2;
      const y = height - (p.count / max) * (height - 4) - 2;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  const area = `${path} L ${width.toFixed(2)} ${height} L 0 ${height} Z`;
  const stroke =
    tone === "positive"
      ? "stroke-emerald-300"
      : tone === "warn"
        ? "stroke-red-300"
        : "stroke-foreground/70";
  const fill =
    tone === "positive"
      ? "fill-emerald-400/10"
      : tone === "warn"
        ? "fill-red-400/10"
        : "fill-foreground/10";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      className="block h-7 w-full"
      preserveAspectRatio="none"
    >
      <path d={area} className={fill} />
      <path
        d={path}
        className={stroke}
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
