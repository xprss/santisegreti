import { Container, Navbar } from 'react-bootstrap'
import { Link, Outlet, ScrollRestoration } from 'react-router'
import { useMe } from '../api/hooks'
import { Landing } from '../pages/Landing'
import { ErrorAlert, Loading } from './feedback'
import { Gingerbread } from './Gingerbread'
import { Logo } from './Logo'

export function Layout() {
  const me = useMe()

  return (
    <>
      <Navbar variant="dark" className="ss-navbar sticky-top">
        <Container>
          <Navbar.Brand as={Link} to="/" className="d-flex align-items-center gap-2 ss-brand">
            <Logo size={30} />
            <span>santisegreti</span>
          </Navbar.Brand>
          {me.data && (
            <Link
              to="/profilo"
              className="d-flex align-items-center gap-2 text-decoration-none text-cream"
              aria-label="Il tuo profilo"
            >
              <span className="d-none d-sm-inline small fw-semibold">{me.data.name}</span>
              <Gingerbread color={me.data.color} size={28} />
            </Link>
          )}
        </Container>
      </Navbar>

      <main>
        {me.isPending ? (
          <Loading />
        ) : me.isError ? (
          <Container className="ss-page">
            <ErrorAlert error={me.error} />
          </Container>
        ) : me.data ? (
          <Outlet />
        ) : (
          <Landing />
        )}
      </main>
      <ScrollRestoration />
    </>
  )
}
