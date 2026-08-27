"use client";

import { useEvents } from "@/lib/queries";
import { useCurrentEvent } from "@/components/event-context";

export function Topbar() {
  const { data: events = [] } = useEvents();
  const { currentEventId, setCurrentEventId } = useCurrentEvent();

  const current = events.find((e) => e.id === currentEventId) || null;

  return (
    <div className="flex items-center gap-3 px-7 py-4 border-b border-line bg-card">
      <div className="flex items-center gap-2.5">
        <span className="text-xs text-ink-soft uppercase tracking-wider">Event</span>
        <select
          value={currentEventId || ""}
          onChange={(e) => e.target.value && setCurrentEventId(e.target.value)}
          className="border border-line rounded-lg px-2.5 py-2 bg-paper text-ink font-semibold max-w-[260px]"
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
          className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${
            current.status === "active" ? "bg-mint-tint text-mint" : "bg-line text-ink-soft"
          }`}
        >
          {current.status === "active" ? "Active" : "Ended"}
        </span>
      )}
    </div>
  );
}
