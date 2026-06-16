import RunMap from "./run-map";
import FinishRun from "./finish-run";
import RunMessageForm from "./run-message-form";
import RunPartnersLive from "./run-partners-live";
import { getRunParticipantMessage, type Run } from "@/lib/runs";
import { formatDate } from "@/lib/format-date";

export default function RunCard({
  run,
  currentUserId,
}: {
  run: Run;
  currentUserId: number;
}) {
  const myMessage = getRunParticipantMessage(run.id, currentUserId);
  const isCoached = run.coachSessionIndex !== null;

  return (
    <div className="card hover-lift p-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Left column: the run details. */}
        <dl className="flex flex-1 flex-col gap-2 text-base">
          <Detail label="Date">{formatDate(run.date)}</Detail>
          <Detail label="Time">
            <span className="font-mono tnum">{run.time}</span>
          </Detail>
          <Detail label="Distance">
            {isCoached && "about "}
            <span className="font-mono tnum">{run.distanceKm}</span> km
          </Detail>
          <div>
            <dt className="text-muted">Meet at:</dt>
            <dd className="font-medium">{run.meetAt}</dd>
          </div>

          {isCoached && run.description && (
            <div className="rounded-lg border border-accent/30 bg-accent/10 p-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-accent">
                Your planner
              </dt>
              <dd className="mt-1 text-sm text-foreground">{run.description}</dd>
            </div>
          )}

          <RunMessageForm runId={run.id} initialMessage={myMessage} />
        </dl>

        {/* Right column: who you're running with, plus the map. */}
        <div className="flex flex-1 flex-col gap-3">
          <div>
            <p className="text-muted">Running with:</p>
            <RunPartnersLive runId={run.id} initialPartners={run.partners} />
          </div>

          <p className="text-muted">Location:</p>
          <RunMap lat={run.lat} lon={run.lon} label={run.meetAt} />
          <div className="flex justify-end">
            <FinishRun
              runId={run.id}
              coached={isCoached}
              partners={run.partners.map(({ id, name, avatar }) => ({
                id,
                name,
                avatar,
              }))}
            />
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
      <dt className="text-muted">{label}:</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
