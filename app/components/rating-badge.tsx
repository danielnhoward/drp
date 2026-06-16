type RatingSummary = {
  average: number | null;
  count: number;
};

export default function RatingBadge({
  summary,
  compact = false,
}: {
  summary: RatingSummary;
  compact?: boolean;
}) {
  const hasRatings = summary.count > 0 && summary.average !== null;
  // average is stored as 1 (thumbs down) or 5 (thumbs up); convert to %
  const thumbsUpPct = hasRatings
    ? Math.round(((summary.average! - 1) / 4) * 100)
    : null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${
        compact ? "text-xs" : "text-sm"
      } ${
        hasRatings
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-border bg-surface-2 text-muted"
      }`}
      title={
        hasRatings
          ? `${thumbsUpPct}% thumbs up from ${summary.count} rating${summary.count === 1 ? "" : "s"}`
          : "No ratings yet"
      }
    >
      <ThumbIcon filled={hasRatings} />
      {hasRatings ? (
        <>
          <span className="font-mono tnum">{thumbsUpPct}%</span>
          <span className="font-mono tnum font-normal opacity-75">
            ({summary.count})
          </span>
        </>
      ) : (
        <span>New runner</span>
      )}
    </span>
  );
}

function ThumbIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  );
}
