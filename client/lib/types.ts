export interface UserInfo {
  email: string
  name: string
  verified: boolean
  picture: string | null
  roles: string[]
  is_admin: boolean
}

export interface EventItem {
  id: string
  name: string
  date: string | null
  location: string | null
  description: string | null
  status: 'active' | 'ended'
  preorder_default_date: string | null
  preorder_default_time_start: string | null
  preorder_default_time_end: string | null
  created_by_sub: string
  created_by_name: string
  created_at: string
  product_count: number
}

export interface Settings {
  member_notification_emails: string[]
}

export interface Product {
  id: string
  event_id: string
  name: string
  category: string
  price: number
  stock: number
  handed_over: number
  reserved: number
  remaining: number
  sold: number
}

export interface ComboItem {
  product_id: string
  qty: number
  product_name: string
  price: number
  available: number
}

export interface Combo {
  id: string
  event_id: string
  name: string
  price: number
  handed_over: number
  reserved: number
  items: ComboItem[]
  regular_price: number
  remaining: number
  savings: number
  sold: number
}

export interface TransactionItem {
  ref_type: 'product' | 'combo'
  ref_id: string
  name: string
  unit_price: number
  qty: number
  line_total: number
}

export type OrderType = 'immediate' | 'preorder'
export type TxStatus =
  | 'completed'
  | 'preorder_pending'
  | 'preorder_ready'
  | 'fulfilled'
  | 'cancelled'
  | 'voided'
export type PaymentMethod = 'Cash' | 'Transfer' | 'E-Wallet' | 'Other'

export interface Transaction {
  id: string
  event_id: string
  seller_sub: string
  seller_name: string
  timestamp: string
  order_type: OrderType
  status: TxStatus
  items: TransactionItem[]
  total: number
  amount_paid: number
  payment_method: PaymentMethod
  customer_name: string | null
  customer_contact: string | null
  customer_email: string | null
  customer_notes: string | null
  expected_date: string | null
  pickup_time_start: string | null
  pickup_time_end: string | null
  fulfilled_at: string | null
  cancelled_at: string | null
  refund_amount: number | null
  refund_type: string | null
  balance_due: number
}

export interface CartLine {
  ref_type: 'product' | 'combo'
  ref_id: string
  qty: number
}

export interface StatsResponse {
  scope: string
  summary: {
    revenue_collected: number
    order_value: number
    outstanding: number
    transactions: number
    items_sold: number
    avg_sale: number
    pending_preorders: number
  }
  top_sellers: { name: string; revenue: number; qty: number }[]
  cumulative: { index: number; timestamp: string; cumulative: number }[]
}
