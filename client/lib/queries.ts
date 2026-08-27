'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  return useMutation({
    mutationFn: (body: { name: string; date?: string; location?: string; description?: string }) =>
      api.post<EventItem>('/events', body),
    onSuccess: invalidate,
  })
}

export function useUpdateEvent() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<EventItem> }) =>
      api.patch<EventItem>(`/events/${id}`, body),
    onSuccess: invalidate,
  })
}

export function useDeleteEvent() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/events/${id}`),
    onSuccess: invalidate,
  })
}

export function useCreateProduct() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ eventId, body }: { eventId: string; body: { name: string; category: string; price: number; stock: number } }) =>
      api.post<Product>(`/events/${eventId}/products`, body),
    onSuccess: () => invalidate(),
  })
}

export function useUpdateProduct() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Product> }) =>
      api.patch<Product>(`/products/${id}`, body),
    onSuccess: () => invalidate(),
  })
}

export function useDeleteProduct() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/products/${id}`),
    onSuccess: () => invalidate(),
  })
}

export function useCreateCombo() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ eventId, body }: { eventId: string; body: { name: string; price: number; items: { product_id: string; qty: number }[] } }) =>
      api.post<Combo>(`/events/${eventId}/combos`, body),
    onSuccess: () => invalidate(),
  })
}

export function useUpdateCombo() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; price?: number; items?: { product_id: string; qty: number }[] } }) =>
      api.patch<Combo>(`/combos/${id}`, body),
    onSuccess: () => invalidate(),
  })
}

export function useDeleteCombo() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/combos/${id}`),
    onSuccess: () => invalidate(),
  })
}

export interface CheckoutPayload {
  lines: CartLine[]
  payment_method: PaymentMethod
  order_type: OrderType
  amount_paid?: number
  customer?: { name: string; contact?: string; notes?: string }
  expected_date?: string
}

export function useCheckout() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ eventId, body }: { eventId: string; body: CheckoutPayload }) =>
      api.post<Transaction>(`/events/${eventId}/transactions`, body),
    onSuccess: () => invalidate(),
  })
}

export function useVoidTransaction() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (txId: string) => api.post<Transaction>(`/transactions/${txId}/void`),
    onSuccess: () => invalidate(),
  })
}

export function useFulfillPreOrder() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ txId, payment_method }: { txId: string; payment_method?: string }) =>
      api.post<Transaction>(`/preorders/transactions/${txId}/fulfill`, payment_method ? { payment_method } : null),
    onSuccess: () => invalidate(),
  })
}

export function useMarkReady() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (txId: string) => api.post<Transaction>(`/preorders/transactions/${txId}/ready`),
    onSuccess: () => invalidate(),
  })
}

export function useCancelPreOrder() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ txId, body }: { txId: string; body: { refund_type: string; refund_amount?: number } }) =>
      api.post<Transaction>(`/preorders/transactions/${txId}/cancel`, body),
    onSuccess: () => invalidate(),
  })
}
