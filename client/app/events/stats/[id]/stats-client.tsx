"use client";

import { useEffect, useState } from "react";
import { useStats, useStockTable, useAllTransactions, useVoidTransaction } from "@/lib/queries";
import { useToast } from "@/components/toast";
import { AppShell } from "@/components/shell";
import { Modal } from "@/components/modal";
import { TopSellersBar, CumulativeLine } from "@/components/charts";
import { formatMoney, formatDateTime, isLowStock, categoryColorClass } from "@/lib/format";
import { useCurrentEvent } from "@/components/event-context";
import type { Transaction } from "@/lib/types";

export function StatsPage({ eventId }: { eventId: string; isAdmin: boolean }) {
  const { setCurrentEventId } = useCurrentEvent();

  useEffect(() => {
    setCurrentEventId(eventId);
  }, [eventId, setCurrentEventId]);

  const [scope, setScope] = useState<"event" | "all">("event");
  const { data: stats, isLoading } = useStats(scope, eventId);
  const { data: stock = [] } = useStockTable(eventId);
  const { data: history = [] } = useAllTransactions(eventId);
  const voidTx = useVoidTransaction();
  const { toast } = useToast();
  const [voidTarget, setVoidTarget] = useState<Transaction | null>(null);

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display text-[22px] font-bold">Statistics</h2>
      </div>

      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setScope("event")}
          className={`px-4 py-1.5 rounded-full text-[13px] font-semibold border ${scope === "event" ? "bg-ink text-white border-ink" : "bg-card text-ink-soft border-line"}`}
        >
          This event
        </button>
        <button
          onClick={() => setScope("all")}
          className={`px-4 py-1.5 rounded-full text-[13px] font-semibold border ${scope === "all" ? "bg-ink text-white border-ink" : "bg-card text-ink-soft border-line"}`}
        >
          All events
        </button>
      </div>

      {isLoading || !stats ? (
        <p className="text-ink-soft">Loading stats…</p>
      ) : (
        (() => {
          const s = stats.summary;
          return (
            <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3 mb-5">
              <StatCard value={formatMoney(s.revenue_collected)} label="Revenue (collected)" />
              <StatCard value={formatMoney(s.order_value)} label="Order value" />
              <StatCard value={formatMoney(s.outstanding)} label="Outstanding balance" />
              <StatCard value={String(s.pending_preorders)} label="Pending pre-orders" />
              <StatCard value={String(s.transactions)} label="Transactions" />
              <StatCard value={String(s.items_sold)} label="Items sold" />
              <StatCard value={formatMoney(s.avg_sale)} label="Avg. sale" />
            </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-card border border-line rounded-[14px] p-4">
              <h4 className="font-display font-bold mb-2.5">Top sellers by revenue</h4>
              {stats.top_sellers.length === 0 ? (
                <p className="text-ink-soft text-sm py-8 text-center">No sales yet.</p>
              ) : (
                <TopSellersBar data={stats.top_sellers} money={formatMoney} />
              )}
            </div>
            <div className="bg-card border border-line rounded-[14px] p-4">
              <h4 className="font-display font-bold mb-2.5">Cumulative revenue</h4>
              {stats.cumulative.length === 0 ? (
                <p className="text-ink-soft text-sm py-8 text-center">No sales yet.</p>
              ) : (
                <CumulativeLine data={stats.cumulative} money={formatMoney} />
              )}
            </div>
          </div>

          {scope === "event" && stock.length > 0 && (
            <div className="bg-card border border-line rounded-[14px] mb-6 overflow-x-auto">
              <h4 className="font-display font-bold px-4 pt-3.5">Stock remaining</h4>
              <table className="w-full min-w-[500px] border-collapse">
                <thead>
                  <tr>
                    {["Product", "Category", "Stock", "Sold", "Remaining"].map((h, i) => (
                      <th
                        key={i}
                        className={`text-left px-4 py-3 text-[11.5px] uppercase tracking-wider text-ink-soft font-semibold border-b border-line ${
                          h === "Stock" || h === "Sold" ? "text-right" : ""
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stock.map((p) => {
                    const pct = p.stock ? Math.max(0, Math.min(100, (p.remaining / p.stock) * 100)) : 0;
                    const low = isLowStock(p.remaining, p.stock);
                    return (
                      <tr key={p.id} className="border-b border-line last:border-b-0">
                        <td className="px-4 py-3 font-semibold">{p.name}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${categoryColorClass(p.category)}`}>{p.category}</span>
                        </td>
                        <td className="px-4 py-3 text-right num">{p.stock}</td>
                        <td className="px-4 py-3 text-right num">
                          {p.sold}
                          {p.reserved > 0 && <span className="text-amber"> (+{p.reserved})</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="h-1.5 bg-line rounded-full overflow-hidden mb-1 w-[110px]">
                            <div
                              className={`h-full rounded-full ${p.remaining <= 0 ? "bg-red" : low ? "bg-amber" : "bg-mint"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`text-[12.5px] ${p.remaining <= 0 ? "text-red font-semibold" : ""}`}>{p.remaining}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-card border border-line rounded-[14px] overflow-x-auto">
            <div className="flex items-center justify-between px-4 pt-3.5">
              <h4 className="font-display font-bold">Transaction history</h4>
              <a
                href={`/api/stats/export?scope=${scope}${scope === "event" ? `&event_id=${eventId}` : ""}`}
                className="px-3 py-1.5 rounded-lg border border-line text-[13px] font-semibold hover:bg-paper"
              >
                Export CSV
              </a>
            </div>
            {history.length === 0 ? (
              <p className="text-ink-soft text-sm px-4 py-4">No transactions yet.</p>
            ) : (
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr>
                    {["Time", "Items", "Seller", "Total", "Payment", "Status", ""].map((h, i) => (
                      <th
                        key={i}
                        className={`text-left px-4 py-3 text-[11.5px] uppercase tracking-wider text-ink-soft font-semibold border-b border-line ${h === "Total" ? "text-right" : ""}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((t) => (
                    <tr
                      key={t.id}
                      className={`border-b border-line last:border-b-0 ${
                        t.status === "voided" || t.status === "cancelled" ? "opacity-50 line-through" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-[13px]">{formatDateTime(t.timestamp)}</td>
                      <td className="px-4 py-3 text-[13px]">{t.items.map((i) => `${i.qty}×${i.name}`).join(", ")}</td>
                      <td className="px-4 py-3 text-[13px]">{t.seller_name || "—"}</td>
                      <td className="px-4 py-3 text-right text-[13px] num">{formatMoney(t.total)}</td>
                      <td className="px-4 py-3 text-[13px]">{t.payment_method}</td>
                      <td className="px-4 py-3">
                        <StatusPill t={t} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {(t.status === "completed" || t.status === "fulfilled") && (
                          <button onClick={() => setVoidTarget(t)} className="text-violet text-[13px] font-semibold">
                            Void
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
            </>
          );
        })()
      )}

      {voidTarget && (
        <Modal
          title="Void this transaction?"
          onClose={() => setVoidTarget(null)}
          footer={
            <>
              <button onClick={() => setVoidTarget(null)} className="px-4 py-2 rounded-lg border border-line font-semibold text-sm">Cancel</button>
              <button
                onClick={() => {
                  voidTx.mutate(voidTarget.id, {
                    onSuccess: () => {
                      toast("Transaction voided and stock restored.");
                      setVoidTarget(null);
                    },
                    onError: (e) => toast(e instanceof Error ? e.message : "Failed to void.", "error"),
                  });
                }}
                className="px-4 py-2 rounded-lg bg-red text-white font-semibold text-sm"
              >
                Void
              </button>
            </>
          }
        >
          <p className="text-sm text-ink-soft">
            Stock will be restored and this transaction excluded from revenue. This cannot be undone.
          </p>
        </Modal>
      )}
    </AppShell>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-card border border-line rounded-[14px] p-4 flex flex-col gap-1">
      <span className="font-display text-[22px] font-bold num">{value}</span>
      <span className="text-[11.5px] text-ink-soft uppercase tracking-wider">{label}</span>
    </div>
  );
}

function StatusPill({ t }: { t: Transaction }) {
  const map: Record<string, { text: string; cls: string }> = {
    completed: { text: "Completed", cls: "bg-mint-tint text-mint" },
    fulfilled: { text: "Fulfilled", cls: "bg-mint-tint text-mint" },
    preorder_pending: { text: "Pre-order", cls: "bg-violet-tint text-violet-dark" },
    preorder_ready: { text: "Ready", cls: "bg-amber-tint text-amber" },
    cancelled: { text: "Cancelled", cls: "bg-line text-ink-soft" },
    voided: { text: "Voided", cls: "bg-line text-ink-soft" },
  };
  const m = map[t.status] || { text: t.status, cls: "bg-line text-ink-soft" };
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${m.cls}`}>{m.text}</span>;
}
