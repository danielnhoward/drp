import RunMap from "./run-map";
import FinishRun from "./finish-run";
import RunnerModal from "./runner-modal";
import type { Run } from "@/lib/runs";
import { formatDate } from "@/lib/format-date";

export default function RunCard({ run }: { run: Run }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/15 dark:bg-zinc-900">
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Left column: the run details. */}
        <dl className="flex flex-1 flex-col gap-2 text-base">
          <Detail label="Date">{formatDate(run.date)}</Detail>
          <Detail label="Time">{run.time}</Detail>
          <Detail label="Distance">{run.distanceKm} km</Detail>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Meet at:</dt>
            <dd className="font-medium">{run.meetAt}</dd>
          </div>
        </dl>

        {/* Right column: who you're running with, plus the map. */}
        <div className="flex flex-1 flex-col gap-3">
          <div>
            <p className="text-zinc-500 dark:text-zinc-400">Running with:</p>
            <ul className="mt-1.5 flex flex-col gap-2">
              {run.partners.map((partner) => (
                <li key={partner.id}>
                  <RunnerModal runner={partner} />
                </li>
              ))}
            </ul>
          </div>

          <RunMap lat={run.lat} lon={run.lon} label={run.meetAt} />
          <div className="flex justify-end">
            <FinishRun runId={run.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-zinc-500 dark:text-zinc-400">{label}:</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
