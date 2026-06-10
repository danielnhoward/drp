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
          ? `${summary.average?.toFixed(1)} from ${summary.count} ratings`
          : "No ratings yet"
      }
    >
      <StarIcon filled={hasRatings} />
      {hasRatings ? (
        <>
          <span className="font-mono tnum">{summary.average?.toFixed(1)}</span>
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

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
    >
      <path d="m12 3.2 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9L6.6 20l1-6.1-4.4-4.3 6.1-.9L12 3.2Z" />
    </svg>
  );
}
