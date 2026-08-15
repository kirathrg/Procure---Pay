import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      // Default is true — every mounted query refetches simultaneously the
      // moment the browser window regains focus, including switching back
      // from a different application, not just a browser tab. Combined with
      // pages that show a loading state while refetching, this made the
      // whole app visibly flash/reset on every window refocus even though
      // nothing had actually changed. staleTime already governs when data
      // is refetched on its own terms; this just stops the extra trigger.
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
