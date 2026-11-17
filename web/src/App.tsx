import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { LISTS } from './nav'
import { useMe } from './lib/me'
import Login from './pages/Login'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const ListPage = lazy(() => import('./pages/ListPage'))
const Users = lazy(() => import('./pages/Admin').then(m => ({ default: m.Users })))
const TallySync = lazy(() => import('./pages/Admin').then(m => ({ default: m.TallySync })))
const Audit = lazy(() => import('./pages/Admin').then(m => ({ default: m.Audit })))
const NotFound = lazy(() => import('./pages/NotFound'))

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError } = useMe()
  const loc = useLocation()
  if (isLoading) return <div className="grid h-screen place-items-center"><img src="/crayon-mark.png" alt="" className="h-10 w-10 animate-pulse" /></div>
  if (isError || !data) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          {LISTS.map(l => <Route key={l.id} path={l.path} element={<ListPage key={l.id} def={l} />} />)}
          <Route path="/admin/users" element={<Users />} />
          <Route path="/admin/tally" element={<TallySync />} />
          <Route path="/admin/audit" element={<Audit />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
