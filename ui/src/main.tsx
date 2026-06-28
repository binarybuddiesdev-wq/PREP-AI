import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { Provider } from 'react-redux'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClerkProvider } from '@clerk/clerk-react'
import { store } from '@/store'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient()

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const isClerkValid = clerkPubKey && /^pk_(test|live)_/.test(clerkPubKey)

function InnerProviders() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isClerkValid ? (
      <ClerkProvider publishableKey={clerkPubKey}>
        <InnerProviders />
      </ClerkProvider>
    ) : (
      <InnerProviders />
    )}
  </StrictMode>,
)
