"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEvents } from "@/lib/queries";
import { useCurrentEvent } from "@/components/event-context";
import { Modal } from "@/components/modal";
import { formatDate } from "@/lib/format";

export function EventPickerModal() {
  const { pendingView, closeEventPicker, setCurrentEventId } = useCurrentEvent();
  const { data: events = [] } = useEvents();
  const router = useRouter();

  if (!pendingView) return null;

  const label = pendingView[0].toUpperCase() + pendingView.slice(1);

  const choose = (id: string) => {
    setCurrentEventId(id);
    router.push(`/events/${pendingView}/${id}`);
    closeEventPicker();
  };

  return (
    <Modal title={`Choose an event for ${label}`} onClose={closeEventPicker}>
      {events.length === 0 ? (
        <div className="text-sm text-ink-soft leading-relaxed">
          <p>No events yet — create one first, then open {label} for it.</p>
          <div className="mt-4">
            <Link
              href="/events"
              onClick={closeEventPicker}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet text-white text-sm font-semibold"
            >
              <i className="fa-solid fa-calendar-days text-[12px]" aria-hidden="true" />
              Go to Events
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
          {events.map((e) => (
            <button
              key={e.id}
              onClick={() => choose(e.id)}
              className="flex items-center justify-between gap-3 text-left px-4 py-3 rounded-xl border border-line bg-paper hover:border-violet hover:bg-white transition-colors"
            >
              <span className="min-w-0">
                <span className="block font-semibold text-[14px] truncate">{e.name}</span>
                <span className="block text-[12px] text-ink-soft truncate">
                  {formatDate(e.date)}
                  {e.location ? ` · ${e.location}` : ""}
                </span>
              </span>
              <span
                className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  e.status === "active" ? "bg-mint-tint text-mint" : "bg-line text-ink-soft"
                }`}
              >
                {e.status === "active" ? "Active" : "Ended"}
              </span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
