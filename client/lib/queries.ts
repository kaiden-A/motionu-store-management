'use client'

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api } from '@/lib/client-api'
import type {
  CartLine,
  Combo,
  EventItem,
  OrderType,
  PaymentMethod,
  Product,
  StatsResponse,
  Transaction,
  UserInfo,
} from '@/lib/types'

export function useCurrentUser() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async (): Promise<UserInfo | null> => {
      const res = await fetch('/api/auth/me')
      if (!res.ok) return null
      const data = await res.json()
      return data.user ?? null
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useEvents() {
  return useQuery({
    queryKey: ['events'],
    queryFn: () => api.get<EventItem[]>('/events'),
  })
}

export function useProducts(eventId: string | undefined) {
  return useQuery({
    queryKey: ['products', eventId],
    queryFn: () => api.get<Product[]>(`/events/${eventId}/products`),
    enabled: !!eventId,
  })
}

export function useCombos(eventId: string | undefined) {
  return useQuery({
    queryKey: ['combos', eventId],
    queryFn: () => api.get<Combo[]>(`/events/${eventId}/combos`),
    enabled: !!eventId,
  })
}

export function useRecentTransactions(eventId: string | undefined, limit = 5) {
  return useQuery({
    queryKey: ['transactions', eventId, 'recent'],
    queryFn: () =>
      api.get<Transaction[]>(`/events/${eventId}/transactions?limit=${limit}`),
    enabled: !!eventId,
  })
}

export function useAllTransactions(eventId: string | undefined) {
  return useQuery({
    queryKey: ['transactions', eventId, 'all'],
    queryFn: () => api.get<Transaction[]>(`/events/${eventId}/transactions`),
    enabled: !!eventId,
  })
}

export function usePreOrders(eventId?: string) {
  return useQuery({
    queryKey: ['preorders', eventId || 'all'],
    queryFn: () =>
      api.get<Transaction[]>(`/preorders${eventId ? `?event_id=${eventId}` : ''}`),
  })
}

export function useStats(scope: 'event' | 'all', eventId?: string) {
  return useQuery({
    queryKey: ['stats', scope, eventId],
    queryFn: () =>
      api.get<StatsResponse>(
        `/stats?scope=${scope}${scope === 'event' && eventId ? `&event_id=${eventId}` : ''}`
      ),
  })
}

export function useStockTable(eventId: string) {
  return useQuery({
    queryKey: ['stock', eventId],
    queryFn: () => api.get<Product[]>(`/stats/stock?event_id=${eventId}`),
  })
}

/* ---------- optimistic helpers ---------- */

type Snapshot = [readonly unknown[], unknown][]

function takeSnapshot(qc: QueryClient, prefixes: readonly unknown[][]): Snapshot {
  return prefixes.flatMap((prefix) => qc.getQueriesData({ queryKey: prefix }))
}

function restoreSnapshot(qc: QueryClient, snapshot: Snapshot) {
  for (const [key, data] of snapshot) qc.setQueryData(key, data)
}

function patchLists<T>(qc: QueryClient, prefix: readonly unknown[], updater: (list: T[]) => T[]) {
  qc.setQueriesData<T[]>({ queryKey: prefix }, (old) => (old ? updater(old) : old))
}

function bumpEventProductCount(qc: QueryClient, eventId: string, delta: number) {
  qc.setQueryData<EventItem[]>(['events'], (old) =>
    old?.map((e) => (e.id === eventId ? { ...e, product_count: Math.max(0, e.product_count + delta) } : e))
  )
}

/** Net stock change per product id for a transaction's line items (combos decomposed). */
function stockDelta(combos: Combo[], tx: Transaction, sign: 1 | -1): Map<string, number> {
  const delta = new Map<string, number>()
  for (const line of tx.items) {
    if (line.ref_type === 'product') {
      delta.set(line.ref_id, (delta.get(line.ref_id) || 0) + sign * line.qty)
    } else {
      const combo = combos.find((c) => c.id === line.ref_id)
      for (const ci of combo?.items || []) {
        delta.set(ci.product_id, (delta.get(ci.product_id) || 0) + sign * ci.qty * line.qty)
      }
    }
  }
  return delta
}

function applyStockDelta(qc: QueryClient, delta: Map<string, number>) {
  if (delta.size === 0) return
  qc.setQueriesData<Product[]>({ queryKey: ['products'] }, (old) =>
    old?.map((p) => {
      const d = delta.get(p.id)
      return d ? { ...p, remaining: Math.max(0, p.remaining + d) } : p
    })
  )
}

function upsertTransaction(
  qc: QueryClient,
  eventId: string,
  tx: Transaction,
  opts: { replace: boolean; recentLimit?: number }
) {
  const updater = (list: Transaction[]) => {
    const exists = list.some((t) => t.id === tx.id)
    if (opts.replace) return list.map((t) => (t.id === tx.id ? tx : t))
    if (exists) return list
    return [tx, ...list]
  }
  if (opts.recentLimit) {
    qc.setQueryData<Transaction[]>(['transactions', eventId, 'recent'], (old) =>
      updater(old || []).slice(0, opts.recentLimit)
    )
  }
  qc.setQueryData<Transaction[]>(['transactions', eventId, 'all'], (old) => updater(old || []))
  patchLists<Transaction>(qc, ['preorders'], (list) => {
    const exists = list.some((t) => t.id === tx.id)
    if (exists) return list.map((t) => (t.id === tx.id ? tx : t))
    if (tx.order_type !== 'preorder') return list
    return [tx, ...list]
  })
}

function sortByName<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name))
}

/* ---------- mutations ---------- */

function useInvalidate(...keys: (string | undefined)[]) {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['events'] })
    qc.invalidateQueries({ queryKey: ['products', keys[0]] })
    qc.invalidateQueries({ queryKey: ['combos', keys[0]] })
    qc.invalidateQueries({ queryKey: ['transactions', keys[0]] })
    qc.invalidateQueries({ queryKey: ['preorders'] })
    qc.invalidateQueries({ queryKey: ['stats'] })
    qc.invalidateQueries({ queryKey: ['stock', keys[0]] })
  }
}

export function useCreateEvent() {
  const invalidate = useInvalidate()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; date?: string; location?: string; description?: string }) =>
      api.post<EventItem>('/events', body),
    onSuccess: (created) => {
      qc.setQueryData<EventItem[]>(['events'], (old) => [created, ...(old || [])])
    },
    onSettled: () => invalidate(),
  })
}

export function useUpdateEvent() {
  const invalidate = useInvalidate()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<EventItem> }) =>
      api.patch<EventItem>(`/events/${id}`, body),
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: ['events'] })
      const previous = takeSnapshot(qc, [['events']])
      qc.setQueryData<EventItem[]>(['events'], (old) =>
        old?.map((e) => (e.id === id ? { ...e, ...body } : e))
      )
      return previous
    },
    onError: (_err, _vars, previous) => restoreSnapshot(qc, previous || []),
    onSettled: () => invalidate(),
  })
}

export function useDeleteEvent() {
  const invalidate = useInvalidate()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/events/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['events'] })
      const previous = takeSnapshot(qc, [['events']])
      qc.setQueryData<EventItem[]>(['events'], (old) => old?.filter((e) => e.id !== id))
      return previous
    },
    onError: (_err, _vars, previous) => restoreSnapshot(qc, previous || []),
    onSettled: () => invalidate(),
  })
}

export function useCreateProduct() {
  const invalidate = useInvalidate()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ eventId, body }: { eventId: string; body: { name: string; category: string; price: number; stock: number } }) =>
      api.post<Product>(`/events/${eventId}/products`, body),
    onSuccess: (created, { eventId }) => {
      qc.setQueryData<Product[]>(['products', eventId], (old) =>
        sortByName([...(old || []), created])
      )
      bumpEventProductCount(qc, eventId, 1)
    },
    onSettled: () => invalidate(),
  })
}

export function useUpdateProduct() {
  const invalidate = useInvalidate()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Product> }) =>
      api.patch<Product>(`/products/${id}`, body),
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: ['products'] })
      const previous = takeSnapshot(qc, [['products']])
      patchLists<Product>(qc, ['products'], (list) =>
        sortByName(list.map((p) => (p.id === id ? { ...p, ...body } : p)))
      )
      return previous
    },
    onError: (_err, _vars, previous) => restoreSnapshot(qc, previous || []),
    onSettled: () => invalidate(),
  })
}

export function useDeleteProduct() {
  const invalidate = useInvalidate()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/products/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['products'] })
      const previous = takeSnapshot(qc, [['products']])
      patchLists<Product>(qc, ['products'], (list) => list.filter((p) => p.id !== id))
      return previous
    },
    onError: (_err, _vars, previous) => restoreSnapshot(qc, previous || []),
    onSettled: () => invalidate(),
  })
}

export function useCreateCombo() {
  const invalidate = useInvalidate()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ eventId, body }: { eventId: string; body: { name: string; price: number; items: { product_id: string; qty: number }[] } }) =>
      api.post<Combo>(`/events/${eventId}/combos`, body),
    onSuccess: (created, { eventId }) => {
      qc.setQueryData<Combo[]>(['combos', eventId], (old) =>
        sortByName([...(old || []), created])
      )
    },
    onSettled: () => invalidate(),
  })
}

export function useUpdateCombo() {
  const invalidate = useInvalidate()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; price?: number; items?: { product_id: string; qty: number }[] } }) =>
      api.patch<Combo>(`/combos/${id}`, body),
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: ['combos'] })
      const previous = takeSnapshot(qc, [['combos']])
      const { items: incomingItems, ...rest } = body
      patchLists<Combo>(qc, ['combos'], (list) =>
        sortByName(
          list.map((c) => {
            if (c.id !== id) return c
            const merged: Combo = { ...c, ...rest }
            if (incomingItems) {
              merged.items = c.items.map((ci) => {
                const next = incomingItems.find((i) => i.product_id === ci.product_id)
                return next ? { ...ci, qty: next.qty } : ci
              })
            }
            return merged
          })
        )
      )
      return previous
    },
    onError: (_err, _vars, previous) => restoreSnapshot(qc, previous || []),
    onSettled: () => invalidate(),
  })
}

export function useDeleteCombo() {
  const invalidate = useInvalidate()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/combos/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['combos'] })
      const previous = takeSnapshot(qc, [['combos']])
      patchLists<Combo>(qc, ['combos'], (list) => list.filter((c) => c.id !== id))
      return previous
    },
    onError: (_err, _vars, previous) => restoreSnapshot(qc, previous || []),
    onSettled: () => invalidate(),
  })
}

export interface CheckoutPayload {
  lines: CartLine[]
  payment_method: PaymentMethod
  order_type: OrderType
  amount_paid?: number
  customer?: { name: string; contact?: string; email?: string; notes?: string }
  expected_date?: string
  pickup_time_start?: string
  pickup_time_end?: string
}

export function useCheckout() {
  const invalidate = useInvalidate()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ eventId, body }: { eventId: string; body: CheckoutPayload }) =>
      api.post<Transaction>(`/events/${eventId}/transactions`, body),
    onSuccess: (created, { eventId }) => {
      const combos = qc.getQueryData<Combo[]>(['combos', eventId]) || []
      const delta = stockDelta(combos, created, -1)
      applyStockDelta(qc, delta)
      upsertTransaction(qc, eventId, created, { replace: false, recentLimit: 5 })
    },
    onSettled: () => invalidate(),
  })
}

export function useVoidTransaction() {
  const invalidate = useInvalidate()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (txId: string) => api.post<Transaction>(`/transactions/${txId}/void`),
    onMutate: async (txId) => {
      await qc.cancelQueries({ queryKey: ['transactions'] })
      const previous = takeSnapshot(qc, [['transactions']])
      patchLists<Transaction>(qc, ['transactions'], (list) =>
        list.map((t) => (t.id === txId ? { ...t, status: 'voided' } : t))
      )
      return previous
    },
    onSuccess: (tx) => {
      const combos = qc
        .getQueriesData<Combo[]>({ queryKey: ['combos'] })
        .flatMap(([, data]) => data || [])
      const delta = stockDelta(combos, tx, 1)
      applyStockDelta(qc, delta)
      patchLists<Transaction>(qc, ['transactions'], (list) =>
        list.map((t) => (t.id === tx.id ? tx : t))
      )
    },
    onError: (_err, _vars, previous) => restoreSnapshot(qc, previous || []),
    onSettled: () => invalidate(),
  })
}

export function useFulfillPreOrder() {
  const invalidate = useInvalidate()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ txId, payment_method }: { txId: string; payment_method?: string }) =>
      api.post<Transaction>(`/preorders/transactions/${txId}/fulfill`, payment_method ? { payment_method } : null),
    onMutate: async ({ txId }) => {
      await qc.cancelQueries({ queryKey: ['transactions'] })
      await qc.cancelQueries({ queryKey: ['preorders'] })
      const previous = takeSnapshot(qc, [['transactions'], ['preorders']])
      const mark = (t: Transaction) => (t.id === txId ? { ...t, status: 'fulfilled' as const } : t)
      patchLists<Transaction>(qc, ['transactions'], (list) => list.map(mark))
      patchLists<Transaction>(qc, ['preorders'], (list) => list.map(mark))
      return previous
    },
    onSuccess: (tx) => {
      patchLists<Transaction>(qc, ['transactions'], (list) =>
        list.map((t) => (t.id === tx.id ? tx : t))
      )
      patchLists<Transaction>(qc, ['preorders'], (list) => list.map((t) => (t.id === tx.id ? tx : t)))
    },
    onError: (_err, _vars, previous) => restoreSnapshot(qc, previous || []),
    onSettled: () => invalidate(),
  })
}

export function useMarkReady() {
  const invalidate = useInvalidate()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (txId: string) => api.post<Transaction>(`/preorders/transactions/${txId}/ready`),
    onMutate: async (txId) => {
      await qc.cancelQueries({ queryKey: ['transactions'] })
      await qc.cancelQueries({ queryKey: ['preorders'] })
      const previous = takeSnapshot(qc, [['transactions'], ['preorders']])
      const mark = (t: Transaction) => (t.id === txId ? { ...t, status: 'preorder_ready' as const } : t)
      patchLists<Transaction>(qc, ['transactions'], (list) => list.map(mark))
      patchLists<Transaction>(qc, ['preorders'], (list) => list.map(mark))
      return previous
    },
    onSuccess: (tx) => {
      patchLists<Transaction>(qc, ['transactions'], (list) =>
        list.map((t) => (t.id === tx.id ? tx : t))
      )
      patchLists<Transaction>(qc, ['preorders'], (list) => list.map((t) => (t.id === tx.id ? tx : t)))
    },
    onError: (_err, _vars, previous) => restoreSnapshot(qc, previous || []),
    onSettled: () => invalidate(),
  })
}

export function useCancelPreOrder() {
  const invalidate = useInvalidate()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ txId, body }: { txId: string; body: { refund_type: string; refund_amount?: number } }) =>
      api.post<Transaction>(`/preorders/transactions/${txId}/cancel`, body),
    onMutate: async ({ txId }) => {
      await qc.cancelQueries({ queryKey: ['transactions'] })
      await qc.cancelQueries({ queryKey: ['preorders'] })
      const previous = takeSnapshot(qc, [['transactions'], ['preorders']])
      const mark = (t: Transaction) => (t.id === txId ? { ...t, status: 'cancelled' as const } : t)
      patchLists<Transaction>(qc, ['transactions'], (list) => list.map(mark))
      patchLists<Transaction>(qc, ['preorders'], (list) => list.map(mark))
      return previous
    },
    onSuccess: (tx) => {
      patchLists<Transaction>(qc, ['transactions'], (list) =>
        list.map((t) => (t.id === tx.id ? tx : t))
      )
      patchLists<Transaction>(qc, ['preorders'], (list) => list.map((t) => (t.id === tx.id ? tx : t)))
    },
    onError: (_err, _vars, previous) => restoreSnapshot(qc, previous || []),
    onSettled: () => invalidate(),
  })
}
