"use client";

import { useEffect, useMemo, useState } from "react";

import RunnerModal from "./runner-modal";
import type { Runner } from "@/lib/runs";

type RunMessageUpdatedEvent = {
  type: "run.message.updated";
  runId: number;
  userId: number;
  message: string;
};

export default function RunPartnersLive({
  runId,
  initialPartners,
}: {
  runId: number;
  initialPartners: Runner[];
}) {
  const [partners, setPartners] = useState(initialPartners);
  const partnerIds = useMemo(() => new Set(partners.map((p) => p.id)), [partners]);

  useEffect(() => {
    const stream = new EventSource(`/api/runs/${runId}/events`);

    stream.onmessage = (raw) => {
      let event: RunMessageUpdatedEvent;
      try {
        event = JSON.parse(raw.data) as RunMessageUpdatedEvent;
      } catch {
        return;
      }
      if (event.type !== "run.message.updated") return;
      if (event.runId !== runId) return;
      if (!partnerIds.has(event.userId)) return;

      setPartners((prev) =>
        prev.map((partner) =>
          partner.id === event.userId
            ? {
                ...partner,
                message: event.message,
              }
            : partner,
        ),
      );
    };

    return () => {
      stream.close();
    };
  }, [partnerIds, runId]);

  return (
    <ul className="mt-1.5 flex flex-col gap-2">
      {partners.map((partner) => (
        <li key={partner.id} className="flex flex-col gap-1.5">
          {partner.message && (
            <div className="relative mt-0.5">
              <div className="inline-block rounded-2xl border border-black/10 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-400">
                <p className="whitespace-pre-line">{partner.message}</p>
              </div>
              <div className="absolute -bottom-1 left-3 h-3 w-3 rotate-45 border-b border-r border-black/10 bg-zinc-50 dark:border-white/15 dark:bg-zinc-800" />
            </div>
          )}
          <RunnerModal runner={partner} />
        </li>
      ))}
    </ul>
  );
}
