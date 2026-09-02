# Google Form → Motion-U Pre-order Integration (Apps Script)

This document explains how to push orders from a Google Form (via Google Apps Script) into
Motion-U's pre-order system.

## Flow

```
Google Form submission
        │
        ▼
Apps Script (onFormSubmit trigger)
        │  POST /api/v1/public/preorders
        ▼
Motion-U backend (FastAPI)
        │
        ├── 1. Pre-order created → appears in the Pre-orders page
        ├── 2. Confirmation email → customer
        └── 3. "New pre-order received" email → members (configured in app Settings)
```

The pre-order is created as **fully paid** (`amount_paid = total`) — per Motion-U policy, Google
Form orders are paid before pickup, so only collection remains.

## Endpoint

```
POST {BASE_URL}/api/v1/public/preorders
```

| Item | Value |
| --- | --- |
| `BASE_URL` | The **backend's** public URL (e.g. `https://pinpoint-backend-xxxx.asia-southeast1.run.app`). **Do not use the login-protected app URL** — the app's `/api` proxy requires a logged-in session. In local development this is `http://127.0.0.1:8000`. |
| Method | `POST` |
| Content-Type | `application/json` |
| Auth header | `motionu-api-key: <FORM_API_KEY>` |

`FORM_API_KEY` is set in the server environment (`server/.env` for local dev, and the Cloud Run
environment variables in production). Anyone with this key can create pre-orders, so keep it
secret.

## Request body

```json
{
  "event_id": "a1b2c3d4-...",
  "customer": {
    "name": "Aina Rahman",
    "email": "aina@example.com",
    "contact": "012-3456789",
    "notes": "Optional note from the form"
  },
  "lines": [
    { "name": "Motion-U Tee", "qty": 2 },
    { "name": "Sticker Pack", "qty": 1 },
    { "name": "Merch Bundle", "qty": 1, "type": "combo" }
  ],
  "payment_method": "Other"
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `event_id` | yes | UUID of the event receiving the order. Event must exist and be `active`. |
| `customer.name` | yes | Customer's full name. |
| `customer.email` | yes | Used for the confirmation / pickup / thank-you emails. |
| `customer.contact` | no | Phone or social handle. |
| `customer.notes` | no | Free text, shown to staff on the Pre-orders page. |
| `lines[]` | yes (≥1) | Ordered items. `name` must match a product name in that event **exactly** (case-insensitive, leading/trailing spaces ignored). |
| `lines[].qty` | yes | Quantity, ≥ 1. |
| `lines[].type` | no | `product` (default) or `combo`. Use `combo` to order a bundle — `name` must then match a combo name in the event exactly. |
| `payment_method` | no | `Cash`, `Transfer`, `E-Wallet`, or `Other`. Defaults to `Other`. |

## Response

`201 Created` on success — returns the created pre-order:

```json
{
  "id": "fbe44426-02a6-44fa-8fb9-26036a00aa6c",
  "event_id": "a1b2c3d4-...",
  "seller_name": "Google Form",
  "order_type": "preorder",
  "status": "preorder_pending",
  "items": [
    { "ref_type": "product", "name": "Motion-U Tee", "unit_price": 40.0, "qty": 2, "line_total": 80.0 }
  ],
  "total": 80.0,
  "amount_paid": 80.0,
  "expected_date": "2026-09-08",
  "pickup_time_start": "14:00",
  "pickup_time_end": "16:00",
  "balance_due": 0.0
}
```

`expected_date` / `pickup_time_*` come from the event's **Pre-order defaults** (Setup →
Pre-orders tab), falling back to the event date. These are the pickup details included in the
customer's confirmation email.

## Error codes

| Status | Meaning |
| --- | --- |
| `401` | Missing or invalid `motionu-api-key`. |
| `404` | `event_id` does not exist. |
| `400` | Event is not `active`, a product name didn't match, invalid email, invalid quantity, etc. For unknown products the response lists the valid product names, e.g. `Unknown product 'No Such Product'. Valid products: Motion-U Tee, Sticker Pack`. |
| `422` | Malformed JSON / missing required fields. |
| `503` | `FORM_API_KEY` is not configured on the server. |

## Apps Script example

Install the script as a **container-bound** script on your Google Form spreadsheet (or use an
installable `onFormSubmit` trigger) and replace the column names with your form's actual field
names.

```javascript
const BASE_URL = 'https://pinpoint-backend-xxxx.asia-southeast1.run.app'; // backend URL, not the app URL
const API_KEY = 'YOUR_FORM_API_KEY'; // from the server env vars
const EVENT_ID = 'a1b2c3d4-...'; // the active event's UUID

function onFormSubmit(e) {
  const vals = e.namedValues;
  const body = {
    event_id: EVENT_ID,
    customer: {
      name: vals['Name'][0],
      email: vals['Email'][0],
      contact: (vals['Phone'] || [''])[0],
      notes: (vals['Notes'] || [''])[0],
    },
    lines: [{ name: vals['Item'][0], qty: Number(vals['Quantity'][0]) }],
  };

  const res = UrlFetchApp.fetch(BASE_URL + '/api/v1/public/preorders', {
    method: 'post',
    headers: { 'motionu-api-key': API_KEY },
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });

  Logger.log(res.getResponseCode() + ' ' + res.getContentText());
}
```

Notes for Apps Script:

- The product names in `lines[].name` **must exactly match** the product names configured in the
  app (case-insensitive). If the form uses a dropdown, keep its options in sync with the
  products in Motion-U.
- `e.namedValues` keys match your form's question titles (capitalized) — adapt the snippet.
- The call is synchronous; on failure (`res.getResponseCode() !== 201`) log the response body and
  consider alerting you, since the order was not created.
- The endpoint is **not idempotent** — re-running the trigger (e.g. after an Apps Script error) or
  resubmitting the form creates a duplicate pre-order. Guard against this if needed (e.g. keep a
  record of the form's row `e.range.getRow()` alongside the returned order id).

## Setup checklist

1. Server: `FORM_API_KEY` must be set in `server/.env` (local) and in the Cloud Run env vars
   (production). Ask the developer who deployed the server if you don't have it.
2. App → Settings → **Member emails**: add the team addresses that should receive the
   "New pre-order received" notification (one per email, comma-separated).
3. App → Setup (event) → **Pre-orders** tab: set the default expected ready date and pickup time
   frame. These become the pickup info in the customer's confirmation email.
4. Wire up the Apps Script with the trigger and the exact `BASE_URL` + `API_KEY`.

## What happens after the order lands

| Step | Email |
| --- | --- |
| Order created | Customer: "We've received your pre-order". Members: "New pre-order received". |
| Staff mark **Ready** | Customer: "Your Motion-U order is ready for pickup!" (date, pickup window, location). |
| Staff **Fulfill** | Customer: "Thank you for choosing Motion-U!". |
| Staff **Cancel** | No automated email (handled manually with the refund). |
