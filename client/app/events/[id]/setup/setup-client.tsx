"use client";

import { useState, type FormEvent } from "react";
import {
  useProducts,
  useCombos,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useCreateCombo,
  useUpdateCombo,
  useDeleteCombo,
} from "@/lib/queries";
import { useToast } from "@/components/toast";
import { AppShell, EmptyState } from "@/components/shell";
import { Modal, Field, inputClass } from "@/components/modal";
import { formatMoney, isLowStock, categoryColorClass, CATEGORY_DEFAULTS } from "@/lib/format";
import type { Combo, Product } from "@/lib/types";

export function SetupPage({ eventId }: { eventId: string; isAdmin: boolean }) {
  const { data: products = [], isLoading } = useProducts(eventId);
  const { data: combos = [] } = useCombos(eventId);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const createCombo = useCreateCombo();
  const updateCombo = useUpdateCombo();
  const deleteCombo = useDeleteCombo();
  const { toast } = useToast();

  const [tab, setTab] = useState<"products" | "combos">("products");
  const [productModal, setProductModal] = useState<{ mode: "create" } | { mode: "edit"; product: Product } | null>(null);
  const [comboModal, setComboModal] = useState<{ mode: "create" } | { mode: "edit"; combo: Combo } | null>(null);
  const [deleteProductTarget, setDeleteProductTarget] = useState<Product | null>(null);
  const [deleteComboTarget, setDeleteComboTarget] = useState<Combo | null>(null);

  if (isLoading) return <AppShell><p className="text-ink-soft">Loading…</p></AppShell>;

  return (
    <AppShell>
      <div className="flex gap-1 mb-5 bg-card border border-line rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("products")}
          className={`px-4 py-2 rounded-md font-semibold text-sm ${tab === "products" ? "bg-ink text-white" : "text-ink-soft"}`}
        >
          Products
        </button>
        <button
          onClick={() => setTab("combos")}
          className={`px-4 py-2 rounded-md font-semibold text-sm ${tab === "combos" ? "bg-ink text-white" : "text-ink-soft"}`}
        >
          Combos
        </button>
      </div>

      {tab === "products" ? (
        <>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-[22px] font-bold">Products</h2>
            <button
              onClick={() => setProductModal({ mode: "create" })}
              className="px-4 py-2.5 rounded-lg bg-violet text-white text-sm font-semibold hover:bg-violet-dark"
            >
              + Add product
            </button>
          </div>

          {products.length === 0 ? (
            <EmptyState mark="🧩" title="No products yet">
              Add what you&apos;ll be selling — stickers, pins, prints, whatever you&apos;ve got.
              <div className="mt-4">
                <button onClick={() => setProductModal({ mode: "create" })} className="px-4 py-2.5 rounded-lg bg-violet text-white text-sm font-semibold">
                  + Add product
                </button>
              </div>
            </EmptyState>
          ) : (
            <div className="bg-card border border-line rounded-[14px] overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse">
                <thead>
                  <tr>
                    {["Name", "Category", "Price", "Stock", "Sold", "Remaining", ""].map((h, i) => (
                      <th
                        key={i}
                        className={`text-left px-4 py-3 text-[11.5px] uppercase tracking-wider text-ink-soft font-semibold border-b border-line ${
                          h === "Price" || h === "Stock" || h === "Sold" ? "text-right" : ""
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const pct = p.stock ? Math.max(0, Math.min(100, (p.remaining / p.stock) * 100)) : 0;
                    const low = isLowStock(p.remaining, p.stock);
                    return (
                      <tr key={p.id} className="border-b border-line last:border-b-0">
                        <td className="px-4 py-3 font-semibold">{p.name}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${categoryColorClass(p.category)}`}>{p.category}</span>
                        </td>
                        <td className="px-4 py-3 text-right num">{formatMoney(p.price)}</td>
                        <td className="px-4 py-3 text-right num">{p.stock}</td>
                        <td className="px-4 py-3 text-right num">
                          {p.sold}
                          {p.reserved > 0 && <span className="text-amber font-semibold"> (+{p.reserved})</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="h-1.5 bg-line rounded-full overflow-hidden mb-1 w-[130px]">
                            <div
                              className={`h-full rounded-full ${p.remaining <= 0 ? "bg-red" : low ? "bg-amber" : "bg-mint"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`text-[12.5px] ${p.remaining <= 0 ? "text-red font-semibold" : low ? "text-amber font-semibold" : "text-ink-soft"}`}>
                            {p.remaining <= 0 ? "Sold out" : `${p.remaining} left`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button onClick={() => setProductModal({ mode: "edit", product: p })} className="w-7 h-7 rounded-lg border border-line text-ink-soft text-[13px] hover:bg-paper" title="Edit">
                            ✎
                          </button>
                          <button onClick={() => setDeleteProductTarget(p)} className="w-7 h-7 rounded-lg border border-line text-ink-soft text-[13px] hover:bg-paper ml-1" title="Delete">
                            🗑
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-[22px] font-bold">Combos</h2>
            <button
              onClick={() => setComboModal({ mode: "create" })}
              disabled={products.length === 0}
              className="px-4 py-2.5 rounded-lg bg-violet text-white text-sm font-semibold hover:bg-violet-dark disabled:bg-[#C9C6E8] disabled:cursor-not-allowed"
            >
              + Create combo
            </button>
          </div>

          {products.length === 0 ? (
            <EmptyState mark="🎁" title="No products yet">
              Add at least one product before building a combo.
            </EmptyState>
          ) : combos.length === 0 ? (
            <EmptyState mark="🎁" title="No combos yet">
              Bundle products together at a special price — e.g. two stickers and a pin for less than buying separately.
              <div className="mt-4">
                <button onClick={() => setComboModal({ mode: "create" })} className="px-4 py-2.5 rounded-lg bg-violet text-white text-sm font-semibold">
                  + Create combo
                </button>
              </div>
            </EmptyState>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
              {combos.map((c) => (
                <div key={c.id} className="relative bg-card border border-line rounded-[14px] p-5 pt-4 shadow-sm hover:-rotate-1 hover:-translate-y-0.5 hover:shadow-md transition-transform">
                  <div className="absolute top-3.5 left-4 w-3 h-3 rounded-full bg-paper border-2 border-line" />
                  <div className="flex justify-end items-start mb-2 pl-6">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold tag-pink">COMBO</span>
                    <div className="flex gap-1 ml-auto">
                      <button onClick={() => setComboModal({ mode: "edit", combo: c })} className="w-7 h-7 rounded-lg border border-line text-ink-soft text-[13px] hover:bg-paper" title="Edit">
                        ✎
                      </button>
                      <button onClick={() => setDeleteComboTarget(c)} className="w-7 h-7 rounded-lg border border-line text-ink-soft text-[13px] hover:bg-paper" title="Delete">
                        🗑
                      </button>
                    </div>
                  </div>
                  <h3 className="font-display font-bold text-[17px]">{c.name}</h3>
                  <div className="text-[12.5px] text-ink-soft my-1.5">
                    {c.items.map((ci) => `${ci.qty}× ${ci.product_name}`).join(", ")}
                  </div>
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="font-display font-bold text-[17px]">{formatMoney(c.price)}</span>
                    {c.savings > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-mint-tint text-mint">
                        Save {formatMoney(c.savings)}
                      </span>
                    )}
                  </div>
                  <div className="text-[12.5px] text-ink-soft">
                    {c.remaining <= 0 ? "Sold out" : `${c.remaining} bundles left`} · {c.sold} sold
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {productModal && (
        <ProductModal
          mode={productModal.mode}
          product={"product" in productModal ? productModal.product : undefined}
          products={products}
          onClose={() => setProductModal(null)}
          onSubmit={async (values) => {
            if (productModal.mode === "create") {
              await createProduct.mutateAsync({ eventId, body: values });
              toast("Product added.");
            } else {
              await updateProduct.mutateAsync({ id: productModal.product.id, body: values });
              toast("Product updated.");
            }
            setProductModal(null);
          }}
        />
      )}

      {comboModal && (
        <ComboModal
          mode={comboModal.mode}
          combo={"combo" in comboModal ? comboModal.combo : undefined}
          products={products}
          onClose={() => setComboModal(null)}
          onSubmit={async (values) => {
            if (comboModal.mode === "create") {
              await createCombo.mutateAsync({ eventId, body: values });
              toast("Combo created.");
            } else {
              await updateCombo.mutateAsync({ id: comboModal.combo.id, body: values });
              toast("Combo updated.");
            }
            setComboModal(null);
          }}
        />
      )}

      {deleteProductTarget && (
        <Modal
          title="Delete product?"
          onClose={() => setDeleteProductTarget(null)}
          footer={
            <>
              <button onClick={() => setDeleteProductTarget(null)} className="px-4 py-2 rounded-lg border border-line font-semibold text-sm">Cancel</button>
              <button
                onClick={() => {
                  deleteProduct.mutate(deleteProductTarget.id, {
                    onSuccess: () => {
                      toast("Product removed.");
                      setDeleteProductTarget(null);
                    },
                    onError: (e) => toast(e instanceof Error ? e.message : "Delete failed.", "error"),
                  });
                }}
                className="px-4 py-2 rounded-lg bg-red text-white font-semibold text-sm"
              >
                Delete
              </button>
            </>
          }
        >
          <p className="text-sm text-ink-soft">Delete “{deleteProductTarget.name}”? This can&apos;t be undone.</p>
        </Modal>
      )}

      {deleteComboTarget && (
        <Modal
          title="Delete combo?"
          onClose={() => setDeleteComboTarget(null)}
          footer={
            <>
              <button onClick={() => setDeleteComboTarget(null)} className="px-4 py-2 rounded-lg border border-line font-semibold text-sm">Cancel</button>
              <button
                onClick={() => {
                  deleteCombo.mutate(deleteComboTarget.id, {
                    onSuccess: () => {
                      toast("Combo removed.");
                      setDeleteComboTarget(null);
                    },
                    onError: (e) => toast(e instanceof Error ? e.message : "Delete failed.", "error"),
                  });
                }}
                className="px-4 py-2 rounded-lg bg-red text-white font-semibold text-sm"
              >
                Delete
              </button>
            </>
          }
        >
          <p className="text-sm text-ink-soft">Delete combo “{deleteComboTarget.name}”? This can&apos;t be undone.</p>
        </Modal>
      )}
    </AppShell>
  );
}

function ProductModal({
  mode,
  product,
  products,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  product?: Product;
  products: Product[];
  onClose: () => void;
  onSubmit: (values: { name: string; category: string; price: number; stock: number }) => void;
}) {
  const cats = Array.from(new Set([...CATEGORY_DEFAULTS, ...products.map((p) => p.category)]));

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") || "").trim();
    const category = String(f.get("category") || "").trim();
    const price = Number(f.get("price"));
    const stock = Math.round(Number(f.get("stock")));
    if (!name || !category || isNaN(price) || price < 0 || isNaN(stock) || stock < 0) return;
    onSubmit({ name, category, price, stock });
  };

  return (
    <Modal
      title={mode === "create" ? "Add product" : "Edit product"}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-line font-semibold text-sm">Cancel</button>
          <button type="submit" form="product-form" className="px-4 py-2 rounded-lg bg-violet text-white font-semibold text-sm">
            {mode === "create" ? "Add product" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <Field label="Item name">
          <input name="name" required placeholder="e.g. Star Sticker" defaultValue={product?.name} className={inputClass} />
        </Field>
        <Field label="Category">
          <input name="category" list="category-options" required placeholder="e.g. Sticker" defaultValue={product?.category} className={inputClass} />
          <datalist id="category-options">
            {cats.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <div className="flex gap-3">
          <Field label={`Price (RM)`}>
            <input type="number" name="price" min={0} step={0.01} required defaultValue={product?.price} className={inputClass} />
          </Field>
          <Field label="Target stock">
            <input type="number" name="stock" min={0} step={1} required defaultValue={product?.stock} className={inputClass} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function ComboModal({
  mode,
  combo,
  products,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  combo?: Combo;
  products: Product[];
  onClose: () => void;
  onSubmit: (values: { name: string; price: number; items: { product_id: string; qty: number }[] }) => void;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    products.forEach((p) => {
      initial[p.id] = combo?.items.find((i) => i.product_id === p.id)?.qty || 0;
    });
    return initial;
  });
  const [price, setPrice] = useState<number>(combo?.price || 0);

  const regular = products.reduce((sum, p) => sum + (quantities[p.id] || 0) * p.price, 0);
  const count = Object.values(quantities).reduce((s, n) => s + (n || 0), 0);
  const savings = regular - price;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") || "").trim();
    const bundlePrice = Number(f.get("price"));
    const items = Object.entries(quantities)
      .filter(([, qty]) => (qty || 0) > 0)
      .map(([product_id, qty]) => ({ product_id, qty }));
    if (!name || isNaN(bundlePrice) || bundlePrice < 0 || items.length === 0) return;
    onSubmit({ name, price: bundlePrice, items });
  };

  return (
    <Modal
      title={mode === "create" ? "Create combo" : "Edit combo"}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-line font-semibold text-sm">Cancel</button>
          <button type="submit" form="combo-form" className="px-4 py-2 rounded-lg bg-violet text-white font-semibold text-sm">
            {mode === "create" ? "Create combo" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="combo-form" onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <Field label="Combo name">
          <input name="name" required placeholder="e.g. Starter Bundle" defaultValue={combo?.name} className={inputClass} />
        </Field>
        <Field label="Bundle price (RM)">
          <input
            type="number"
            name="price"
            min={0}
            step={0.01}
            required
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <div>
          <span className="text-[13px] font-semibold">
            Included items <span className="text-ink-soft text-xs font-normal">(set quantity for each)</span>
          </span>
          <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto border border-line rounded-lg p-2 mt-2">
            {products.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2.5 py-1">
                <span className="text-[13px]">
                  {p.name} <span className="text-ink-soft text-xs">({formatMoney(p.price)})</span>
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={quantities[p.id] || 0}
                  onChange={(e) => setQuantities((prev) => ({ ...prev, [p.id]: Math.max(0, Math.round(Number(e.target.value))) }))}
                  className="w-16 px-2 py-1.5 border border-line rounded-md text-center"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="text-[13px] bg-violet-tint rounded-lg px-3 py-2.5">
          {count === 0 ? (
            <span className="text-ink-soft">Pick at least one item above.</span>
          ) : (
            <>
              Regular price: <strong className="num">{formatMoney(regular)}</strong>
              {savings > 0 && (
                <>
                  {" "}
                  · <span className="text-mint font-semibold">Customer saves {formatMoney(savings)}</span>
                </>
              )}
              {savings < 0 && <span className="text-amber"> · Bundle priced above regular total</span>}
            </>
          )}
        </div>
      </form>
    </Modal>
  );
}
