import '@fontsource/fuzzy-bubbles/400.css'
import '@fontsource/fuzzy-bubbles/700.css'
import '@fontsource/henny-penny'
import './theme/theme.scss'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { Layout } from './components/Layout'
import { Join } from './pages/Join'
import { ManageRoom } from './pages/ManageRoom'
import { NewRoom } from './pages/NewRoom'
import { NotFound } from './pages/NotFound'
import { Profile } from './pages/Profile'
import { Room } from './pages/Room'
import { Rooms } from './pages/Rooms'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: true, staleTime: 15_000 },
  },
})

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Rooms /> },
      { path: '/stanze/nuova', element: <NewRoom /> },
      { path: '/stanze/:id', element: <Room /> },
      { path: '/stanze/:id/gestisci', element: <ManageRoom /> },
      { path: '/unisciti', element: <Join /> },
      { path: '/profilo', element: <Profile /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
