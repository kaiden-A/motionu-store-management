"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useProducts, useCombos, useRecentTransactions, useCheckout, useVoidTransaction } from "@/lib/queries";
import { useToast } from "@/components/toast";
import { AppShell, EmptyState } from "@/components/shell";
import { Modal, Field, inputClass } from "@/components/modal";
import { formatMoney, isLowStock, categoryColorClass, PAYMENT_METHODS } from "@/lib/format";
import { useCurrentEvent } from "@/components/event-context";
import type { CartLine, Combo, PaymentMethod, Product, Transaction } from "@/lib/types";

interface CartItem {
  ref_type: "product" | "combo";
  ref_id: string;
  qty: number;
}

export function SellPage({ eventId, isAdmin }: { eventId: string; isAdmin: boolean }) {
  const { setCurrentEventId } = useCurrentEvent();

  useEffect(() => {
    setCurrentEventId(eventId);
  }, [eventId, setCurrentEventId]);

  const { data: products = [], isLoading: loadingProducts } = useProducts(eventId);
  const { data: combos = [] } = useCombos(eventId);
  const { data: recent = [] } = useRecentTransactions(eventId, 5);
  const checkout = useCheckout();
  const voidTx = useVoidTransaction();
  const { toast } = useToast();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [filter, setFilter] = useState("All");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<Transaction | null>(null);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((p) => p.category)))],
    [products]
  );

  const productRemaining = (p: Product, excludeIndex?: number) => {
    let reserved = 0;
    cart.forEach((item, idx) => {
      if (excludeIndex !== undefined && idx === excludeIndex) return;
      if (item.ref_type === "product" && item.ref_id === p.id) reserved += item.qty;
      if (item.ref_type === "combo") {
        const c = combos.find((x) => x.id === item.ref_id);
        if (c) {
          const comp = c.items.find((ci) => ci.product_id === p.id);
          if (comp) reserved += comp.qty * item.qty;
        }
      }
    });
    return p.remaining - reserved;
  };

  const comboRemaining = (c: Combo, excludeIndex?: number) => {
    if (c.items.length === 0) return 0;
    return Math.min(
      ...c.items.map((ci) => {
        const p = products.find((x) => x.id === ci.product_id);
        return p ? Math.floor(productRemaining(p, excludeIndex) / ci.qty) : 0;
      })
    );
  };

  const cartTotal = cart.reduce((sum, item) => {
    if (item.ref_type === "product") {
      const p = products.find((x) => x.id === item.ref_id);
      return sum + (p ? p.price * item.qty : 0);
    }
    const c = combos.find((x) => x.id === item.ref_id);
    return sum + (c ? c.price * item.qty : 0);
  }, 0);

  const addToCart = (type: "product" | "combo", id: string) => {
    const remaining = type === "product"
      ? productRemaining(products.find((p) => p.id === id) as Product)
      : comboRemaining(combos.find((c) => c.id === id) as Combo);
    if (remaining <= 0) {
      toast("Not enough stock left.", "error");
      return;
    }
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.ref_type === type && i.ref_id === id);
      if (idx >= 0) {
        return prev.map((i, n) => (n === idx ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { ref_type: type, ref_id: id, qty: 1 }];
    });
  };

  const incQty = (idx: number, delta: number) => {
    setCart((prev) => {
      const item = prev[idx];
      if (!item) return prev;
      if (delta > 0) {
        const remaining =
          item.ref_type === "product"
            ? productRemaining(products.find((p) => p.id === item.ref_id) as Product, idx)
            : comboRemaining(combos.find((c) => c.id === item.ref_id) as Combo, idx);
        if (remaining <= 0) {
          toast("Not enough stock left.", "error");
          return prev;
        }
      }
      const next = prev.map((i, n) => (n === idx ? { ...i, qty: i.qty + delta } : i));
      return next.filter((i) => i.qty > 0);
    });
  };

  if (loadingProducts) {
    return <AppShell><p className="text-ink-soft">Loading…</p></AppShell>;
  }

  return (
    <AppShell>
      {products.length === 0 ? (
        <EmptyState mark={<i className="fa-solid fa-receipt" aria-hidden="true" />} title="Nothing to sell yet">
          {isAdmin
            ? `Add products to this event in Setup before you start selling.`
            : "The organizer hasn't added any products for this event yet."}
        </EmptyState>
      ) : (
        <>
        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0">
            <div className="flex gap-2 flex-wrap mb-4">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  className={`px-4 py-1.5 rounded-full text-[13px] font-semibold border transition-colors ${
                    filter === c
                      ? "bg-ink text-white border-ink"
                      : "bg-card text-ink-soft border-line hover:text-ink"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
              {filter === "All" &&
                combos.map((c) => {
                  const remaining = comboRemaining(c);
                  const soldOut = remaining <= 0;
                  const itemsList = c.items.map((ci) => `${ci.qty}×${ci.product_name}`).join(" + ");
                  return (
                    <button
                      key={c.id}
                      disabled={soldOut}
                      onClick={() => addToCart("combo", c.id)}
                      className={`relative bg-pink-tint border border-[#F4C7D6] rounded-[14px] p-3.5 text-left flex flex-col gap-1 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all ${
                        soldOut ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      <span className="self-start px-2 py-0.5 rounded text-[11px] font-bold bg-pink-tint tag-pink">COMBO</span>
                      <span className="font-bold text-[14px] mt-0.5">{c.name}</span>
                      <span className="text-[11px] text-ink-soft">{itemsList}</span>
                      <span className="font-display font-bold text-[16px] mt-0.5">{formatMoney(c.price)}</span>
                      <span className={`text-[11.5px] ${soldOut ? "text-red font-semibold" : "text-ink-soft"}`}>
                        {soldOut ? "Sold out" : `${remaining} left`}
                      </span>
                    </button>
                  );
                })}

              {products
                .filter((p) => filter === "All" || p.category === filter)
                .map((p) => {
                  const remaining = productRemaining(p);
                  const soldOut = remaining <= 0;
                  const low = isLowStock(remaining, p.stock);
                  return (
                    <button
                      key={p.id}
                      disabled={soldOut}
                      onClick={() => addToCart("product", p.id)}
                      className={`relative bg-card border border-line rounded-[14px] p-3.5 text-left flex flex-col gap-1 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all ${
                        soldOut ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      <span className={`self-start px-2 py-0.5 rounded text-[11px] font-bold ${categoryColorClass(p.category)}`}>
                        {p.category}
                      </span>
                      <span className="font-bold text-[14px] mt-0.5">{p.name}</span>
                      <span className="font-display font-bold text-[16px] mt-0.5">{formatMoney(p.price)}</span>
                      <span className={`text-[11.5px] ${soldOut ? "text-red font-semibold" : low ? "text-amber font-semibold" : "text-ink-soft"}`}>
                        {soldOut ? "Sold out" : `${remaining} left`}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="w-[340px] shrink-0 hidden lg:flex flex-col gap-4">
            <CartPanel
              cart={cart}
              products={products}
              combos={combos}
              cartTotal={cartTotal}
              onInc={(idx) => incQty(idx, 1)}
              onDec={(idx) => incQty(idx, -1)}
              onRemove={(idx) => setCart((prev) => prev.filter((_, n) => n !== idx))}
              onClear={() => setCart([])}
              onCharge={() => setCheckoutOpen(true)}
            />
            <RecentActivity recent={recent} isAdmin={isAdmin} onVoid={setVoidTarget} />
          </div>
        </div>

        <div className="mt-5 lg:hidden">
          <RecentActivity recent={recent} isAdmin={isAdmin} onVoid={setVoidTarget} />
        </div>
        </>
      )}

      {cart.length > 0 && (
        <div className="lg:hidden fixed inset-x-0 z-20 px-3 pb-2 pointer-events-none bottom-[calc(3.5rem+env(safe-area-inset-bottom))]">
          <button
            onClick={() => setCartSheetOpen(true)}
            className="pointer-events-auto w-full bg-ink text-white rounded-2xl px-4 py-3 flex items-center justify-between gap-3 shadow-lg"
          >
            <span className="flex items-center gap-2 text-sm font-semibold min-w-0">
              <i className="fa-solid fa-cart-shopping text-[15px]" aria-hidden="true" />
              <span className="truncate">
                {cart.reduce((s, i) => s + i.qty, 0)} item
                {cart.reduce((s, i) => s + i.qty, 0) === 1 ? "" : "s"} in cart
              </span>
            </span>
            <span className="flex items-center gap-3 shrink-0">
              <span className="font-display text-[15px] font-bold num">{formatMoney(cartTotal)}</span>
              <span className="bg-violet text-white rounded-xl px-4 py-2 text-sm font-semibold inline-flex items-center gap-1.5">
                <i className="fa-solid fa-credit-card text-[12px]" aria-hidden="true" />
                Charge
              </span>
            </span>
          </button>
        </div>
      )}

      {cartSheetOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
            onClick={() => setCartSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[82dvh] bg-card rounded-t-2xl shadow-xl flex flex-col">
            <div className="relative px-4 pt-2 pb-1 shrink-0">
              <div className="mx-auto w-10 h-1 rounded-full bg-line" />
              <button
                onClick={() => setCartSheetOpen(false)}
                aria-label="Close cart"
                className="absolute right-3 top-3 w-8 h-8 rounded-lg flex items-center justify-center text-ink-soft hover:bg-paper"
              >
                <i className="fa-solid fa-xmark text-[15px]" aria-hidden="true" />
              </button>
            </div>
            <div className="overflow-y-auto px-4 pb-6 flex-1">
              <CartPanel
                cart={cart}
                products={products}
                combos={combos}
                cartTotal={cartTotal}
                onInc={(idx) => incQty(idx, 1)}
                onDec={(idx) => incQty(idx, -1)}
                onRemove={(idx) => setCart((prev) => prev.filter((_, n) => n !== idx))}
                onClear={() => setCart([])}
                onCharge={() => {
                  setCartSheetOpen(false);
                  setCheckoutOpen(true);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <CheckoutModal
          total={cartTotal}
          onClose={() => setCheckoutOpen(false)}
          onSubmit={async (payload) => {
            try {
              await checkout.mutateAsync({
                eventId,
                body: {
                  lines: cart.map((i): CartLine => ({ ref_type: i.ref_type, ref_id: i.ref_id, qty: i.qty })),
                  ...payload,
                },
              });
              setCart([]);
              setCheckoutOpen(false);
              toast("Sale recorded!");
            } catch (e) {
              toast(e instanceof Error ? e.message : "Checkout failed.", "error");
            }
          }}
        />
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
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red text-white font-semibold text-sm"
              >
                <i className="fa-solid fa-ban text-[13px]" aria-hidden="true" />
                Void
              </button>
            </>
          }
        >
          <p className="text-sm text-ink-soft">
            Stock will be restored and this sale excluded from revenue. This cannot be undone.
          </p>
        </Modal>
      )}
    </AppShell>
  );
}

function CartPanel({
  cart,
  products,
  combos,
  cartTotal,
  onInc,
  onDec,
  onRemove,
  onClear,
  onCharge,
}: {
  cart: CartItem[];
  products: Product[];
  combos: Combo[];
  cartTotal: number;
  onInc: (idx: number) => void;
  onDec: (idx: number) => void;
  onRemove: (idx: number) => void;
  onClear: () => void;
  onCharge: () => void;
}) {
  return (
    <div className="bg-card border border-line rounded-[14px] p-4 pb-7 shadow-sm relative">
      <div className="flex justify-between items-center mb-2.5">
        <h3 className="font-display font-bold">Current sale</h3>
        {cart.length > 0 && (
          <button onClick={onClear} className="text-[13px] font-semibold text-violet">
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2.5 max-h-[320px] overflow-y-auto pb-1.5">
        {cart.length === 0 ? (
          <p className="text-center py-5 text-ink-soft text-[13px]">
            Tap a product or combo to add it here.
          </p>
        ) : (
          cart.map((item, idx) => {
            let name = "—";
            let unit = 0;
            if (item.ref_type === "product") {
              const p = products.find((x) => x.id === item.ref_id);
              name = p?.name || "—";
              unit = p?.price || 0;
            } else {
              const c = combos.find((x) => x.id === item.ref_id);
              name = c ? `${c.name} (combo)` : "—";
              unit = c?.price || 0;
            }
            return (
              <div key={idx} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 pb-2 border-b border-dashed border-line num">
                <div className="min-w-0">
                  <div className="font-semibold text-[13px] truncate">{name}</div>
                  <div className="text-[11px] text-ink-soft">{formatMoney(unit)} each</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => onDec(idx)} className="w-[26px] h-[26px] rounded border border-line bg-paper font-bold leading-none flex items-center justify-center" aria-label="Decrease quantity">
                    <i className="fa-solid fa-minus text-[9px]" aria-hidden="true" />
                  </button>
                  <span className="text-[13px] min-w-[18px] text-center">{item.qty}</span>
                  <button onClick={() => onInc(idx)} className="w-[26px] h-[26px] rounded border border-line bg-paper font-bold leading-none flex items-center justify-center" aria-label="Increase quantity">
                    <i className="fa-solid fa-plus text-[9px]" aria-hidden="true" />
                  </button>
                </div>
                <span className="font-bold text-[13px]">{formatMoney(unit * item.qty)}</span>
                <button
                  onClick={() => onRemove(idx)}
                  className="w-[30px] h-[30px] rounded-lg border border-line text-ink-soft hover:bg-paper flex items-center justify-center"
                  aria-label="Remove"
                >
                  <i className="fa-solid fa-xmark text-[13px]" aria-hidden="true" />
                </button>
              </div>
            );
          })
        )}
      </div>
      <div className="flex justify-between items-center mt-3.5 mb-3 pt-2.5 border-t border-line">
        <span className="text-[13px]">Total</span>
        <span className="font-display text-xl font-bold num">{formatMoney(cartTotal)}</span>
      </div>
      <button
        disabled={cart.length === 0}
        onClick={onCharge}
        className="w-full py-2.5 rounded-lg bg-violet text-white text-sm font-semibold hover:bg-violet-dark disabled:bg-[#C9C6E8] disabled:cursor-not-allowed"
      >
        <i className="fa-solid fa-credit-card text-[12px] mr-1.5" aria-hidden="true" />
        Charge {formatMoney(cartTotal)}
      </button>
      <div className="absolute left-0 right-0 -bottom-px h-2.5 bg-[repeating-linear-gradient(-45deg,var(--paper)_0_6px,transparent_6px_12px)] rounded-b-[14px]" />
    </div>
  );
}

function RecentActivity({
  recent,
  isAdmin,
  onVoid,
}: {
  recent: Transaction[];
  isAdmin: boolean;
  onVoid: (t: Transaction) => void;
}) {
  return (
    <div>
      <h4 className="mb-2 text-ink-soft text-xs uppercase tracking-wider">Recent activity</h4>
      {recent.length === 0 ? (
        <p className="text-ink-soft text-[12.5px]">No sales recorded yet.</p>
      ) : (
        recent.map((t) => (
          <div
            key={t.id}
            className={`flex justify-between gap-2.5 py-2 border-b border-line text-[12.5px] ${t.status === "voided" ? "opacity-50" : ""}`}
          >
            <div className="min-w-0">
              <span className="block text-[11px] text-ink-soft">
                {new Date(t.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
                · {new Date(t.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="block truncate max-w-[190px]">
                {t.items.map((i) => `${i.qty}×${i.name}`).join(", ")}
              </span>
              {t.seller_name && <span className="block text-[11px] text-ink-soft">by {t.seller_name}</span>}
            </div>
            <div className="text-right flex flex-col items-end gap-0.5 font-semibold">
              <span className="num">{formatMoney(t.total)}</span>
              {t.status === "voided" ? (
                <span className="text-ink-soft font-normal">Voided</span>
              ) : (
                isAdmin && (
                  <button onClick={() => onVoid(t)} className="text-violet font-semibold text-[12px]">
                    Void
                  </button>
                )
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function CheckoutModal({
  total,
  onClose,
  onSubmit,
}: {
  total: number;
  onClose: () => void;
  onSubmit: (payload: {
    payment_method: PaymentMethod;
    order_type: "immediate" | "preorder";
    amount_paid?: number;
    customer?: { name: string; contact?: string; notes?: string };
    expected_date?: string;
  }) => void;
}) {
  const [orderType, setOrderType] = useState<"immediate" | "preorder">("immediate");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const paymentMethod = String(f.get("payment_method") || "Cash") as PaymentMethod;
    if (orderType === "immediate") {
      onSubmit({ payment_method: paymentMethod, order_type: "immediate" });
      return;
    }
    const name = String(f.get("customer_name") || "").trim();
    if (!name) return;
    const amountPaid = Number(f.get("amount_paid"));
    if (isNaN(amountPaid) || amountPaid < 0 || amountPaid > total) return;
    onSubmit({
      payment_method: paymentMethod,
      order_type: "preorder",
      amount_paid: amountPaid,
      customer: {
        name,
        contact: String(f.get("customer_contact") || "").trim() || undefined,
        notes: String(f.get("customer_notes") || "").trim() || undefined,
      },
      expected_date: String(f.get("expected_date") || "").trim() || undefined,
    });
  };

  return (
    <Modal
      title="Complete sale"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-line font-semibold text-sm">Cancel</button>
          <button type="submit" form="checkout-form" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet text-white font-semibold text-sm">
            <i className="fa-solid fa-circle-check text-[13px]" aria-hidden="true" />
            Confirm &amp; complete sale
          </button>
        </>
      }
    >
      <form id="checkout-form" onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <p className="text-[15px]">
          Total due: <strong className="num">{formatMoney(total)}</strong>
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOrderType("immediate")}
            className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-colors ${orderType === "immediate" ? "bg-ink text-white border-ink" : "bg-card text-ink-soft border-line"}`}
          >
            Immediate sale
          </button>
          <button
            type="button"
            onClick={() => setOrderType("preorder")}
            className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-colors ${orderType === "preorder" ? "bg-ink text-white border-ink" : "bg-card text-ink-soft border-line"}`}
          >
            Pre-order
          </button>
        </div>
        <p className="text-xs text-ink-soft">
          {orderType === "immediate"
            ? "Payment and handover happen now."
            : "Customer pays now, item is handed over later (e.g. sold out items being restocked)."}
        </p>

        <Field label="Payment method">
          <select name="payment_method" defaultValue="Cash" className={inputClass}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>

        {orderType === "preorder" && (
          <>
            <Field label="Customer name">
              <input name="customer_name" required placeholder="e.g. Aina" className={inputClass} />
            </Field>
            <Field label="Contact" optional>
              <input name="customer_contact" placeholder="Phone, email, or social handle" className={inputClass} />
            </Field>
            <Field label="Amount paid" optional>
              <input
                type="number"
                name="amount_paid"
                min={0}
                max={total}
                step={0.01}
                defaultValue={total}
                className={inputClass}
              />
              <span className="text-xs text-ink-soft font-normal">
                Leave as total for full payment, or lower for a deposit (balance due {formatMoney(total)} later).
              </span>
            </Field>
            <Field label="Expected ready date" optional>
              <input type="date" name="expected_date" className={inputClass} />
            </Field>
            <Field label="Notes" optional>
              <textarea name="customer_notes" rows={2} className={inputClass} />
            </Field>
          </>
        )}
      </form>
    </Modal>
  );
}
