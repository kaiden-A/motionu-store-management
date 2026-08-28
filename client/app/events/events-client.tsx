"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useEvents, useCreateEvent, useUpdateEvent, useDeleteEvent } from "@/lib/queries";
import { useCurrentEvent } from "@/components/event-context";
import { useToast } from "@/components/toast";
import { AppShell, EmptyState, ViewHeader } from "@/components/shell";
import { Modal, Field, inputClass } from "@/components/modal";
import { formatDate } from "@/lib/format";
import type { EventItem } from "@/lib/types";

export function EventsPage({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const { setCurrentEventId } = useCurrentEvent();
  const { toast } = useToast();
  const { data: events = [], isLoading } = useEvents();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; event: EventItem } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EventItem | null>(null);

  const go = (eventId: string, view: "sell" | "setup" | "stats") => {
    setCurrentEventId(eventId);
    router.push(`/events/${view}/${eventId}`);
  };

  if (isLoading) return <AppShell withTopbar={false}><p className="text-ink-soft">Loading events…</p></AppShell>;

  return (
    <AppShell withTopbar={false}>
      <ViewHeader
        title="Events"
        action={
          isAdmin && (
            <button
              onClick={() => setModal({ mode: "create" })}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-violet text-white text-sm font-semibold hover:bg-violet-dark transition-colors"
            >
              <i className="fa-solid fa-plus text-[12px]" aria-hidden="true" />
              New event
            </button>
          )
        }
      />

      {events.length === 0 ? (
        <EmptyState mark={<i className="fa-solid fa-calendar-days" aria-hidden="true" />} title={isAdmin ? "No events yet" : "No events yet"}>
          {isAdmin
            ? "Create your first pop-up, market day, or con booth to start tracking what you sell."
            : "An organizer hasn't set up any events yet. Check back soon!"}
          {isAdmin && (
            <div className="mt-4">
              <button
                onClick={() => setModal({ mode: "create" })}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-violet text-white text-sm font-semibold"
              >
                <i className="fa-solid fa-plus text-[12px]" aria-hidden="true" />
                New event
              </button>
            </div>
          )}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="relative bg-card border border-line rounded-[14px] p-5 pt-4 shadow-sm hover:-rotate-1 hover:-translate-y-0.5 hover:shadow-md transition-transform"
            >
              <div className="absolute top-3.5 left-4 w-3 h-3 rounded-full bg-paper border-2 border-line" />
              <div className="flex justify-end items-start mb-2 pl-6">
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${
                    ev.status === "active" ? "bg-mint-tint text-mint" : "bg-line text-ink-soft"
                  }`}
                >
                  {ev.status === "active" ? "Active" : "Ended"}
                </span>
                {isAdmin && (
                  <EventKebab
                    event={ev}
                    onEdit={() => setModal({ mode: "edit", event: ev })}
                    onDelete={() => setDeleteTarget(ev)}
                    onToggle={() => {
                      updateEvent.mutate(
                        { id: ev.id, body: { status: ev.status === "active" ? "ended" : "active" } },
                        { onSuccess: () => toast("Event status updated.") }
                      );
                    }}
                  />
                )}
              </div>
              <h3 className="font-display font-bold text-[17px] mt-1">{ev.name}</h3>
              <div className="text-[12.5px] text-ink-soft mt-1">
                {formatDate(ev.date)}
                {ev.location ? ` · ${ev.location}` : ""}
              </div>
              <div className="flex gap-4 my-3.5 py-3 border-y border-dashed border-line">
                <div className="flex flex-col">
                  <strong className="font-display text-[15px] num">{ev.product_count}</strong>
                  <span className="text-[11px] text-ink-soft">products</span>
                </div>
                <div className="flex flex-col">
                  <strong className="font-display text-[15px] num truncate max-w-[90px]">{ev.created_by_name || "—"}</strong>
                  <span className="text-[11px] text-ink-soft">organizer</span>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => go(ev.id, "sell")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet text-white text-[13px] font-semibold hover:bg-violet-dark"
                >
                  <i className="fa-solid fa-cart-shopping text-[11px]" aria-hidden="true" />
                  Sell
                </button>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => go(ev.id, "setup")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-[13px] font-semibold hover:bg-paper"
                    >
                      <i className="fa-solid fa-sliders text-[11px]" aria-hidden="true" />
                      Setup
                    </button>
                    <button
                      onClick={() => go(ev.id, "stats")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-[13px] font-semibold hover:bg-paper"
                    >
                      <i className="fa-solid fa-chart-line text-[11px]" aria-hidden="true" />
                      Stats
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <EventModal
          mode={modal.mode}
          event={"event" in modal ? modal.event : undefined}
          onClose={() => setModal(null)}
          onSubmit={async (values) => {
            if (modal.mode === "create") {
              await createEvent.mutateAsync(values);
              toast("Event created — add products in Setup.");
            } else {
              await updateEvent.mutateAsync({ id: modal.event.id, body: values });
              toast("Event updated.");
            }
            setModal(null);
          }}
        />
      )}

      {deleteTarget && (
        <Modal
          title="Delete event?"
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg border border-line font-semibold text-sm">
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteEvent.mutate(deleteTarget.id, {
                    onSuccess: () => {
                      toast("Event deleted.");
                      setDeleteTarget(null);
                    },
                  });
                }}
                className="px-4 py-2 rounded-lg bg-red text-white font-semibold text-sm"
              >
                Delete
              </button>
            </>
          }
        >
          <p className="text-sm text-ink-soft">
            Delete “{deleteTarget.name}”? This removes all its products, combos, and
            transactions permanently.
          </p>
        </Modal>
      )}
    </AppShell>
  );
}

function EventKebab({
  event,
  onEdit,
  onDelete,
  onToggle,
}: {
  event: EventItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-1.5 rounded text-ink-soft hover:bg-paper"
        aria-label="Event actions"
      >
        <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-7 z-20 bg-card border border-line rounded-lg shadow-md min-w-[170px] flex flex-col p-1.5">
            <button onClick={() => { setOpen(false); onEdit(); }} className="flex items-center gap-2 text-left px-2.5 py-2 rounded text-[13px] hover:bg-paper">
              <i className="fa-solid fa-pen text-[11px]" aria-hidden="true" />
              Rename / Edit
            </button>
            <button onClick={() => { setOpen(false); onToggle(); }} className="flex items-center gap-2 text-left px-2.5 py-2 rounded text-[13px] hover:bg-paper">
              <i className="fa-solid fa-toggle-on text-[12px]" aria-hidden="true" />
              {event.status === "active" ? "Mark as ended" : "Mark as active"}
            </button>
            <button onClick={() => { setOpen(false); onDelete(); }} className="flex items-center gap-2 text-left px-2.5 py-2 rounded text-[13px] text-red hover:bg-paper">
              <i className="fa-solid fa-trash text-[11px]" aria-hidden="true" />
              Delete event
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function EventModal({
  mode,
  event,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  event?: EventItem;
  onClose: () => void;
  onSubmit: (values: { name: string; date?: string; location?: string; description?: string }) => void;
}) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") || "").trim();
    if (!name) return;
    onSubmit({
      name,
      date: String(f.get("date") || "") || undefined,
      location: String(f.get("location") || "").trim() || undefined,
      description: String(f.get("description") || "").trim() || undefined,
    });
  };

  return (
    <Modal
      title={mode === "create" ? "New event" : "Edit event"}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-line font-semibold text-sm">
            Cancel
          </button>
          <button type="submit" form="event-form" className="px-4 py-2 rounded-lg bg-violet text-white font-semibold text-sm">
            {mode === "create" ? "Create event" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="event-form" onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <Field label="Event name">
          <input name="name" required placeholder="e.g. Comic Con Booth #204" defaultValue={event?.name} className={inputClass} />
        </Field>
        <Field label="Date" optional>
          <input type="date" name="date" defaultValue={event?.date || ""} className={inputClass} />
        </Field>
        <Field label="Location" optional>
          <input name="location" placeholder="e.g. Hall B, Table 12" defaultValue={event?.location || ""} className={inputClass} />
        </Field>
        <Field label="Notes" optional>
          <textarea name="description" rows={2} placeholder="Anything worth remembering" defaultValue={event?.description || ""} className={inputClass} />
        </Field>
      </form>
    </Modal>
  );
}
