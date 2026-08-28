"use client";

import { useState, type FormEvent } from "react";
import {
  usePreOrders,
  useEvents,
  useFulfillPreOrder,
  useMarkReady,
  useCancelPreOrder,
} from "@/lib/queries";
import { useToast } from "@/components/toast";
import { AppShell, EmptyState, ViewHeader } from "@/components/shell";
import { Modal, Field, inputClass } from "@/components/modal";
import { formatMoney, formatDateTime, formatDate, PAYMENT_METHODS } from "@/lib/format";
import type { Transaction } from "@/lib/types";

export function PreOrdersPage() {
  const { data: preorders = [], isLoading } = usePreOrders();
  const { data: events = [] } = useEvents();
  const fulfill = useFulfillPreOrder();
  const markReady = useMarkReady();
  const cancel = useCancelPreOrder();
  const { toast } = useToast();

  const [eventFilter, setEventFilter] = useState<string>("");
  const [fulfillTarget, setFulfillTarget] = useState<Transaction | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Transaction | null>(null);

  const filtered = eventFilter ? preorders.filter((p) => p.event_id === eventFilter) : preorders;
  const today = new Date().toISOString().slice(0, 10);

  const eventName = (id: string) => events.find((e) => e.id === id)?.name || "—";

  return (
    <AppShell>
      <ViewHeader title="Pre-orders" />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <label className="text-xs uppercase tracking-wider text-ink-soft">Event</label>
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="border border-line rounded-lg px-2.5 py-2 bg-card text-ink font-semibold min-w-0 max-w-full"
        >
          <option value="">All events</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-ink-soft">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState mark={<i className="fa-solid fa-box" aria-hidden="true" />} title="Nothing waiting">
          Pre-orders you take (paid now, item handed over later) will show up here.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((p) => {
            const overdue = p.expected_date && p.expected_date < today;
            return (
              <div key={p.id} className="bg-card border border-line rounded-[14px] p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold">{p.customer_name || "Unknown customer"}</span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-violet-tint text-violet-dark">
                        {p.status === "preorder_ready" ? "Ready" : "Pending"}
                      </span>
                      {overdue && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-tint text-red">Overdue</span>
                      )}
                    </div>
                    <div className="text-[12.5px] text-ink-soft mt-0.5">
                      {eventName(p.event_id)} · placed {formatDateTime(p.timestamp)}
                      {p.seller_name ? ` · by ${p.seller_name}` : ""}
                    </div>
                    <div className="text-[13px] mt-1.5">
                      {p.items.map((i) => `${i.qty}×${i.name}`).join(", ")}
                    </div>
                    {p.customer_contact && (
                      <div className="text-[12px] text-ink-soft mt-1">
                        <i className="fa-solid fa-phone mr-1.5" aria-hidden="true" />
                        {p.customer_contact}
                      </div>
                    )}
                    {p.customer_email && (
                      <div className="text-[12px] text-ink-soft mt-0.5">
                        <i className="fa-solid fa-envelope mr-1.5" aria-hidden="true" />
                        {p.customer_email}
                      </div>
                    )}
                    {p.customer_notes && (
                      <div className="text-[12px] text-ink-soft mt-0.5 italic">“{p.customer_notes}”</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold num">
                      Paid {formatMoney(p.amount_paid)}
                      <span className="text-ink-soft font-normal"> of {formatMoney(p.total)}</span>
                    </div>
                    {p.balance_due > 0 && (
                      <div className="text-[12.5px] text-amber font-semibold num">Balance due {formatMoney(p.balance_due)}</div>
                    )}
                    <div className="text-[12.5px] text-ink-soft mt-1">
                      Expected: {formatDate(p.expected_date)}
                    </div>
                    {(p.pickup_time_start || p.pickup_time_end) && (
                      <div className="text-[12.5px] text-ink-soft mt-0.5">
                        Pickup window: {p.pickup_time_start || "—"} – {p.pickup_time_end || "—"}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-3 border-t border-dashed border-line pt-3">
                  {p.status === "preorder_pending" && (
                    <button
                      onClick={() => {
                        markReady.mutate(p.id, {
                          onSuccess: () => toast("Marked as ready for pickup."),
                          onError: (e) => toast(e instanceof Error ? e.message : "Failed.", "error"),
                        });
                      }}
                      className="px-3 py-1.5 rounded-lg border border-line text-[13px] font-semibold hover:bg-paper"
                    >
                      Mark ready
                    </button>
                  )}
                  <button
                    onClick={() => setFulfillTarget(p)}
                    className="px-3 py-1.5 rounded-lg bg-violet text-white text-[13px] font-semibold hover:bg-violet-dark"
                  >
                    Fulfill
                  </button>
                  <button
                    onClick={() => setCancelTarget(p)}
                    className="px-3 py-1.5 rounded-lg bg-red-tint text-red text-[13px] font-semibold hover:bg-red hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {fulfillTarget && (
        <FulfillModal
          tx={fulfillTarget}
          onClose={() => setFulfillTarget(null)}
          onSubmit={async (paymentMethod) => {
            try {
              await fulfill.mutateAsync({ txId: fulfillTarget.id, payment_method: paymentMethod });
              toast("Pre-order fulfilled.");
              setFulfillTarget(null);
            } catch (e) {
              toast(e instanceof Error ? e.message : "Fulfillment failed.", "error");
            }
          }}
        />
      )}

      {cancelTarget && (
        <CancelModal
          tx={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onSubmit={async (refundType, refundAmount) => {
            try {
              await cancel.mutateAsync({
                txId: cancelTarget.id,
                body: refundType === "partial" ? { refund_type: refundType, refund_amount: refundAmount } : { refund_type: refundType },
              });
              toast("Pre-order cancelled.");
              setCancelTarget(null);
            } catch (e) {
              toast(e instanceof Error ? e.message : "Cancellation failed.", "error");
            }
          }}
        />
      )}
    </AppShell>
  );
}

function FulfillModal({
  tx,
  onClose,
  onSubmit,
}: {
  tx: Transaction;
  onClose: () => void;
  onSubmit: (paymentMethod?: string) => void;
}) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(tx.balance_due > 0 ? String(new FormData(e.currentTarget).get("payment_method") || "Cash") : undefined);
  };

  return (
    <Modal
      title="Fulfill pre-order"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-line font-semibold text-sm">Cancel</button>
          <button type="submit" form="fulfill-form" className="px-4 py-2 rounded-lg bg-violet text-white font-semibold text-sm">
            Hand over items
          </button>
        </>
      }
    >
      <form id="fulfill-form" onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <p className="text-sm text-ink-soft">
          Handing over <strong className="text-ink">{tx.items.map((i) => `${i.qty}×${i.name}`).join(", ")}</strong> to{" "}
          <strong className="text-ink">{tx.customer_name}</strong>.
        </p>
        {tx.balance_due > 0 ? (
          <>
            <p className="text-sm">
              Balance due: <strong className="num text-amber">{formatMoney(tx.balance_due)}</strong>
            </p>
            <Field label="How was the balance paid?">
              <select name="payment_method" defaultValue="Cash" className={inputClass}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
          </>
        ) : (
          <p className="text-sm">Fully paid — nothing left to collect.</p>
        )}
      </form>
    </Modal>
  );
}

function CancelModal({
  tx,
  onClose,
  onSubmit,
}: {
  tx: Transaction;
  onClose: () => void;
  onSubmit: (refundType: "full" | "forfeit_deposit" | "partial", refundAmount?: number) => void;
}) {
  const [refundType, setRefundType] = useState<"full" | "forfeit_deposit" | "partial">("full");
  const [partialAmount, setPartialAmount] = useState<number>(tx.amount_paid);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (refundType === "partial" && (isNaN(partialAmount) || partialAmount < 0 || partialAmount > tx.amount_paid)) return;
    onSubmit(refundType, refundType === "partial" ? partialAmount : undefined);
  };

  return (
    <Modal
      title="Cancel pre-order"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-line font-semibold text-sm">Cancel</button>
          <button type="submit" form="cancel-form" className="px-4 py-2 rounded-lg bg-red text-white font-semibold text-sm">
            Cancel pre-order
          </button>
        </>
      }
    >
      <form id="cancel-form" onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <p className="text-sm text-ink-soft">
          Cancelling releases the reserved stock for{" "}
          <strong className="text-ink">{tx.items.map((i) => `${i.qty}×${i.name}`).join(", ")}</strong>. Paid:{" "}
          <strong className="num">{formatMoney(tx.amount_paid)}</strong>.
        </p>
        <div className="flex flex-col gap-2">
          {(
            [
              ["full", "Full refund", `Refund the full ${formatMoney(tx.amount_paid)} back to the customer.`],
              ["forfeit_deposit", "Forfeit deposit", "Keep the money paid (e.g. custom work already started)."],
              ["partial", "Partial refund", "Refund a custom amount and keep the rest."],
            ] as const
          ).map(([value, label, desc]) => (
            <label
              key={value}
              className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer ${refundType === value ? "border-violet bg-violet-tint" : "border-line"}`}
            >
              <input
                type="radio"
                name="refund_type"
                value={value}
                checked={refundType === value}
                onChange={() => setRefundType(value)}
                className="mt-1"
              />
              <span>
                <span className="block text-[13px] font-semibold">{label}</span>
                <span className="block text-[12px] text-ink-soft">{desc}</span>
              </span>
            </label>
          ))}
        </div>
        {refundType === "partial" && (
          <Field label="Refund amount">
            <input
              type="number"
              min={0}
              max={tx.amount_paid}
              step={0.01}
              value={partialAmount}
              onChange={(e) => setPartialAmount(Number(e.target.value))}
              className={inputClass}
            />
          </Field>
        )}
      </form>
    </Modal>
  );
}
