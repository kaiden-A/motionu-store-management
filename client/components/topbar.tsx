"use client";

import { useEvents } from "@/lib/queries";
import { useCurrentEvent } from "@/components/event-context";

export function Topbar() {
  const { data: events = [] } = useEvents();
  const { currentEventId, setCurrentEventId } = useCurrentEvent();

  const current = events.find((e) => e.id === currentEventId) || null;

  return (
    <div className="flex items-center gap-3 px-4 sm:px-7 py-4 border-b border-line bg-card">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <i className="fa-solid fa-location-dot text-violet hidden sm:inline-block" aria-hidden="true" />
        <span className="text-xs text-ink-soft uppercase tracking-wider hidden sm:inline">
          Event
        </span>
        <select
          value={currentEventId || ""}
          onChange={(e) => e.target.value && setCurrentEventId(e.target.value)}
          className="border border-line rounded-lg px-2.5 py-2 bg-paper text-ink font-semibold min-w-0 max-w-[58vw] sm:max-w-[260px]"
        >
          {events.length === 0 && <option>No events yet</option>}
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>
      {current && (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide shrink-0 ${
            current.status === "active" ? "bg-mint-tint text-mint" : "bg-line text-ink-soft"
          }`}
        >
          <i
            className={`fa-solid ${
              current.status === "active" ? "fa-circle-check" : "fa-flag"
            } text-[10px]`}
            aria-hidden="true"
          />
          {current.status === "active" ? "Active" : "Ended"}
        </span>
      )}
    </div>
  );
}
