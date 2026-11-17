import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { Me } from './api'

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/auth/me'), staleTime: 5 * 60_000, retry: false })
