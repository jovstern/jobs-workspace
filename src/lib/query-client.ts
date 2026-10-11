import { QueryClient } from '@tanstack/react-query'

// Mutations are paid AI calls: never retried by themselves, and never paused offline and fired
// later when the connection returns (networkMode 'always' fails them at once instead).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
    mutations: { retry: false, networkMode: 'always' },
  },
})
