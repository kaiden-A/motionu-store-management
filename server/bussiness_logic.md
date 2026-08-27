# PinPoint — Business Logic Specification

This document is the single source of truth for how PinPoint is supposed to behave. It covers the logic already built (events, products, combos, cart, checkout, stats) and adds the new **pre-order** logic: money collected now, item handed over later.

Rules are numbered (e.g. `PRD-3`) so they can be referenced in code comments, tickets, and future changes.

## Contents

1. [Core entities](#1-core-entities)
2. [Events — existing logic](#2-events--existing-logic)
3. [Products — existing logic](#3-products--existing-logic)
4. [Combos — existing logic](#4-combos--existing-logic)
5. [Cart & stock reservation — existing logic](#5-cart--stock-reservation--existing-logic)
6. [Checkout & transactions — existing logic](#6-checkout--transactions--existing-logic)
7. [Void — existing logic](#7-void--existing-logic)
8. [Statistics — existing logic](#8-statistics--existing-logic)
9. [**NEW: Pre-orders**](#9-new-pre-orders)
10. [Updated data model](#10-updated-data-model)
11. [Transaction status state machine](#11-transaction-status-state-machine)
12. [Decisions you still need to confirm](#12-decisions-you-still-need-to-confirm)
13. [Edge cases & how to handle them](#13-edge-cases--how-to-handle-them)

---

## 1. Core entities

| Entity | What it represents |
|---|---|
| **Event** | A single selling occasion — a market day, a con booth, a pop-up. Everything else lives inside an event. |
| **Product** | One item you sell (a sticker, a pin). Has a price and a target stock quantity. |
| **Combo** | A bundle of products sold together at a special price. |
| **Transaction** | One completed sale or pre-order — a snapshot of what was bought, for how much, and (new) whether it's been handed over yet. |

---

## 2. Events — existing logic

- `EVT-1` An event has a name, date, location, description, and a status of `active` or `ended`.
- `EVT-2` All products, combos, and transactions belong to exactly one event — nothing is shared across events.
- `EVT-3` Deleting an event permanently deletes its products, combos, and transactions. This requires an explicit confirmation step.
- `EVT-4` Only one event is "current" at a time; Sell, Setup, and Stats all act on the current event unless Stats is switched to the "All events" scope.

---

## 3. Products — existing logic

- `PRD-1` A product has: name, category (free text, with suggestions), price, `stock` (target quantity), and `sold` (cumulative units committed).
- `PRD-2` **Remaining stock** = `stock − sold − (reserved in the current cart)`.
- `PRD-3` A product is **low stock** when `0 < remaining ≤ max(3, 15% of stock)`.
- `PRD-4` A product is **sold out** when `remaining ≤ 0`. Sold-out tiles are disabled in Sell.
- `PRD-5` A product **cannot be deleted** while it's used in any combo — the deletion is blocked with a message naming the combo.

---

## 4. Combos — existing logic

- `CMB-1` A combo has: name, bundle price, and a list of `{ product, quantity }` components.
- `CMB-2` **Regular price** (shown for comparison) = sum of each component's normal price × quantity.
- `CMB-3` **Savings** = regular price − bundle price. Shown to the seller as "Customer saves X" when positive.
- `CMB-4` **Combo remaining** = the smallest number of bundles makeable from current component stock, i.e. `min( floor(component remaining ÷ component qty) )` across all components.
- `CMB-5` Selling one combo consumes stock from **every** component according to its quantity — a combo is not a separate stock pool, it's a claim on product stock.

---

## 5. Cart & stock reservation — existing logic

- `CART-1` Adding a product or combo to the cart doesn't touch `sold` yet — it only reduces the *displayed* remaining count for everyone else, by reserving that quantity live.
- `CART-2` Reservation is computed on the fly from the current cart contents (both direct product lines and combo lines), so two items can never both claim the last unit before checkout.
- `CART-3` Removing or reducing a cart line immediately frees its reservation.

---

## 6. Checkout & transactions — existing logic

- `TXN-1` Checkout requires at least one cart line and a payment method (Cash / Transfer / E-Wallet / Other).
- `TXN-2` On checkout: every product line increments that product's `sold`; every combo line increments the combo's `sold` **and** each of its components' `sold` (by component qty × combo qty).
- `TXN-3` A transaction record is created with: timestamp, itemized lines (name, unit price, qty, line total), grand total, payment method. The cart is then cleared.
- `TXN-4` Until now, every transaction has represented an **immediate, in-person, fully-paid sale** — payment and handover happen at the same instant. Pre-orders (Section 9) change this assumption.

---

## 7. Void — existing logic

- `VOID-1` Voiding a transaction restores stock: every product line's `sold` decreases by its qty; every combo line's `sold` decreases, and each component's `sold` decreases accordingly.
- `VOID-2` A voided transaction stays visible in history (struck through, tagged "Voided") but is excluded from revenue, items-sold, and average-sale figures.
- `VOID-3` Voiding is one-directional — there is no "un-void."

---

## 8. Statistics — existing logic

- `STAT-1` Figures can be scoped to "this event" or "all events."
- `STAT-2` Summary cards: revenue, transaction count, items sold, average sale — all computed from **non-voided** transactions only.
- `STAT-3` Top-sellers chart ranks products/combos by revenue within the current scope.
- `STAT-4` Cumulative revenue chart plots running total in transaction order.
- `STAT-5` Stock table (event scope only) shows stock, sold, and remaining per product with a low-stock/sold-out indicator.
- `STAT-6` Transaction history is exportable to CSV.

---

## 9. NEW: Pre-orders

**Definition:** a pre-order is a transaction where the customer has paid (in full or in part) but the item has **not yet been physically handed over**. The money is real and counted; the handover is a separate, later event.

This changes one core assumption from Section 6: *payment and handover no longer have to happen at the same instant.* Everything below exists to track that gap safely.

### 9.1 What changes conceptually

Today, "sold" means one thing: money in, item out, done. Pre-orders split that into two facts that must be tracked separately per product:

| Counter | Meaning |
|---|---|
| `handedOver` | Units actually given to a customer (this is what the old `sold` field meant). |
| `reserved` | Units paid for but **not yet** handed over — promised to a specific pre-order. |

`PRE-1` **Remaining stock** becomes: `stock − handedOver − reserved − (cart reservations)`. Pre-orders reduce remaining stock exactly like a normal sale, because the unit is spoken for even though it hasn't left your hands.

`PRE-2` When a pre-order is **fulfilled** (handed over), `reserved` decreases by the qty and `handedOver` increases by the same amount. Net remaining stock does **not** change — it was already committed at order time.

`PRE-3` When a pre-order is **cancelled** before fulfillment, `reserved` decreases by the qty and nothing moves to `handedOver`. Remaining stock goes back up, same as a void.

### 9.2 Placing a pre-order

`PRE-4` At checkout, the seller chooses an **order type**: `Immediate sale` (existing behavior, default) or `Pre-order`.

`PRE-5` A pre-order requires **customer contact info** (at minimum a name and one contact method — phone, email, or social handle) so the seller can reach them later. Immediate sales never require this.

`PRE-6` A pre-order requires payment info: `amountPaid` vs `total`.
- Default assumption: **full payment upfront** (`amountPaid = total`).
- Optional: a **deposit**, where `amountPaid < total` and `balanceDue = total − amountPaid` is collected at fulfillment time.

`PRE-7` An optional **expected fulfillment date** can be attached (e.g. "ready by," "next market date," "ship by"). Not required, but used to sort and flag overdue pre-orders.

`PRE-8` **Backorder rule (important business decision):** pre-orders are allowed to be placed **even when remaining stock is 0 or would go negative**. This is the main reason pre-orders exist for a maker business — you're often taking orders *because* you've sold out of the physical item and are committing to make more. Immediate sales are never allowed to go below 0 remaining; pre-orders are exempt from that floor by default. See `12.1` if you want this to be configurable per product instead of global.

### 9.3 Fulfilling a pre-order

`PRE-9` Fulfilling is a separate action from checkout — it happens whenever the seller physically hands the item to the customer (could be days or weeks later, possibly at a different event, a meetup, or via shipping).

`PRE-10` Fulfilling does **not** require the seller to be viewing the event the pre-order was placed at. A pre-order can be created at Event A and fulfilled while Event B is active (or with no event "current" at all) — fulfillment is a status action, not a sale.

`PRE-11` If `balanceDue > 0` at the moment of fulfillment, the seller is prompted to collect the remaining balance and record how it was paid before the order can be marked fulfilled. `amountPaid` is then set equal to `total`.

`PRE-12` Fulfilling sets `fulfilledAt` (timestamp) and moves the transaction to status `fulfilled`, which behaves like `completed` everywhere in stats from that point on.

### 9.4 Cancelling a pre-order

`PRE-13` Cancelling before fulfillment releases the reserved stock (`PRE-3`) and requires the seller to record what happens to the money already paid:
- **Full refund** (default) — amount is recorded as refunded, excluded from revenue.
- **Forfeit deposit** — the deposit is kept (e.g. as compensation for custom work already started); this amount stays in revenue, only the unpaid balance (if any) is written off.
- **Partial refund** — seller enters a custom refunded amount.

`PRE-14` A cancelled pre-order is kept in history (for record-keeping) but excluded from "items sold" and treated per `PRE-13` for revenue.

### 9.5 The fulfillment queue (new screen)

`PRE-15` A dedicated view lists every pre-order that is not yet fulfilled or cancelled, across all events by default (with a per-event filter available). Each row shows: customer name/contact, items, amount paid, balance due (if any), expected date, and how long it's been waiting.

`PRE-16` Pre-orders past their expected fulfillment date are visually flagged as **overdue** so nothing gets forgotten.

`PRE-17` Actions available per pre-order: **Mark fulfilled**, **Cancel**, **Edit customer info / expected date**.

### 9.6 How pre-orders touch existing logic

- `CMB-*` combo rules apply unchanged — a combo can be pre-ordered, and its components each get `reserved` instead of `handedOver` until fulfillment.
- `STAT-*` gets new figures, not replacements — see below.
- `VOID-*` still applies, but only to `completed` or `fulfilled` transactions (money **and** item already exchanged). Voiding always fully restores stock and removes the amount from revenue, same as today.

### 9.7 New statistics

`STAT-7` **Revenue (collected)** — sum of `amountPaid` across all non-cancelled, non-voided transactions. This is real cash in hand and is the headline "Revenue" figure going forward.

`STAT-8` **Order value** — sum of `total` across the same set. Equal to Revenue (collected) unless deposits are in use.

`STAT-9` **Outstanding balance** — `Order value − Revenue (collected)`, i.e. money still owed by customers with open deposits.

`STAT-10` **Pending pre-orders** — count of transactions currently in `preorder_pending` or `preorder_ready` status. Shown as its own stat card, since it's an operational to-do count, not a money figure.

`STAT-11` Transaction history and CSV export gain columns: order type, status, customer name/contact, amount paid, balance due, fulfilled date.

---

## 10. Updated data model

Fields marked **(new)** are additions for pre-orders. Fields marked **(changed)** replace or extend an existing field — see the migration note under each entity.

### Product

| Field | Type | Notes |
|---|---|---|
| id, name, category, price, stock | — | unchanged |
| `handedOver` **(changed)** | number | replaces `sold`. Same meaning as before: units physically given out. |
| `reserved` **(new)** | number | units committed via unfulfilled pre-orders. Defaults to 0. |

> Migration note: rename `sold` → `handedOver`, add `reserved: 0` to every existing product. `remaining` calculations must subtract both fields.

### Combo

Unchanged in shape; `sold` similarly becomes `handedOver`, and fulfilling/cancelling a combo pre-order cascades to its components' `reserved`/`handedOver` exactly like checkout cascades today.

### Transaction

| Field | Type | Notes |
|---|---|---|
| id, timestamp, items, total, paymentMethod | — | unchanged |
| `voided` **(changed)** | — | folded into `status` below. Migration: existing `voided: true` → `status: "voided"`; existing `voided: false` → `status: "completed"`. |
| `status` **(new)** | enum | `completed` \| `preorder_pending` \| `preorder_ready` \| `fulfilled` \| `cancelled` \| `voided` |
| `orderType` **(new)** | enum | `immediate` \| `preorder` |
| `amountPaid` **(new)** | number | defaults to `total` for immediate sales |
| `customer` **(new)** | object \| null | `{ name, contact, notes }`, required when `orderType = preorder` |
| `expectedDate` **(new)** | date \| null | optional |
| `fulfilledAt` **(new)** | timestamp \| null | set on fulfillment |
| `cancelledAt` **(new)** | timestamp \| null | set on cancellation |
| `refund` **(new)** | object \| null | `{ amount, type: "full" \| "forfeit_deposit" \| "partial" }`, set on cancellation |

---

## 11. Transaction status state machine

```
                     ┌───────────────────────┐
   Immediate sale ──►│      completed        │──► voided (terminal)
                     └───────────────────────┘

                     ┌───────────────────────┐     ┌───────────┐
   Pre-order ───────►│   preorder_pending    │────►│ cancelled │ (terminal)
                     └──────────┬────────────┘     └───────────┘
                                │
                                ▼ (optional "item ready" step)
                     ┌───────────────────────┐     ┌───────────┐
                     │    preorder_ready     │────►│ cancelled │ (terminal)
                     └──────────┬────────────┘     └───────────┘
                                │
                                ▼ hand item to customer
                     ┌───────────────────────┐
                     │       fulfilled       │──► voided (terminal)
                     └───────────────────────┘
```

Rules:
- `preorder_ready` is optional — you can go straight from `preorder_pending` to `fulfilled` if you don't need a "prepared, awaiting pickup" middle step.
- Only `completed` and `fulfilled` count toward revenue/items-sold by default.
- `cancelled` and `voided` are both terminal and both release stock; the difference is *when* they happen (before vs after handover) and what they imply about the refund.

---

## 12. Decisions you still need to confirm

These are genuine business calls, not engineering details — flagging them now so implementation doesn't guess wrong.

**12.1 — Is the backorder rule (`PRE-8`) global, or per-product?**
Default assumed: global — any product can be pre-ordered past zero remaining. Alternative: a per-product toggle "allow pre-order when sold out," for items you never want to promise beyond what physically exists (e.g. a one-off original piece vs a reprintable sticker).

**12.2 — Are deposits allowed at all, or is full payment always required?**
Default assumed: full payment is the norm; deposits are supported but optional per order. If you never take deposits in practice, `amountPaid`/`balanceDue` can be simplified away later.

**12.3 — Does `preorder_ready` (item made, awaiting pickup) matter to you?**
Default assumed: yes, as an optional middle step. If you always hand items over the moment they're ready, you can skip it and go `preorder_pending → fulfilled` directly.

**12.4 — Partial fulfillment of a multi-item pre-order.**
Default assumed (MVP): a pre-order is fulfilled **all at once** — every line item hands over together. 
Advanced option: track fulfillment per line item, so a transaction can be "partially fulfilled" (e.g. customer picks up the pin today, the print later because it's still being reprinted). This is more realistic for backorder-heavy sellers but meaningfully more complex — recommend building the simple version first and upgrading if it becomes a real pain point.

**12.5 — Cancellation refund default.**
Default assumed: full refund unless you say otherwise at cancel time. Confirm whether "forfeit deposit" should ever be the *default* for custom/made-to-order items.

---

## 13. Edge cases & how to handle them

| Situation | Rule to apply |
|---|---|
| Customer pre-orders the last unit, then someone tries to buy it immediately at the booth | Blocked — `PRE-1` already reserved it. Immediate sales respect the stock floor even though pre-orders can bypass it (`PRE-8`). |
| A pre-ordered product is edited (price or stock changed) before fulfillment | Price already charged is untouched (`total`/`amountPaid` are locked at order time). Stock target changes just affect future remaining-stock math. |
| A product used in a pending pre-order combo needs to be deleted | Same guard as `PRD-5`, extended: block deletion while any component has `reserved > 0` from an open pre-order, not just combo membership. |
| Pre-order placed with no expected date | Allowed — it simply won't appear in the "overdue" flag (`PRE-16`) since there's nothing to compare against. |
| Customer never shows up to collect a pre-order | Stays in the fulfillment queue indefinitely until the seller manually cancels or fulfills it — no automatic expiry. |
| Voiding a `fulfilled` pre-order after the fact (item returned) | Same mechanics as voiding a `completed` sale (`VOID-1`) — restores `handedOver`, removes from revenue. |
| Switching an order from Immediate to Pre-order (or back) after checkout | Not supported — order type is fixed at checkout. To correct a mistake, void/cancel and re-enter the sale. |

---

*This spec describes intended behavior for the next build pass. Once you confirm Section 12, this becomes the checklist to implement against.*