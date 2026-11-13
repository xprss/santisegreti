import { Container, Navbar } from 'react-bootstrap'
import { Link, Outlet, ScrollRestoration } from 'react-router'
import { useMe } from '../api/hooks'
import { Landing } from '../pages/Landing'
import { ErrorAlert, Loading } from './feedback'
import { Gingerbread } from './Gingerbread'
import { Garland } from './Garland'

export function Layout() {
  const me = useMe()

  return (
    <>
      <header className="sticky-top">
        <Navbar variant="dark" className="ss-navbar">
          <Container>
            <Navbar.Brand as={Link} to="/" className="ss-brand">
              santisegreti
            </Navbar.Brand>
            {me.data && (
              <Link
                to="/profilo"
                className="d-flex align-items-center gap-2 text-decoration-none text-cream"
                aria-label="Il tuo profilo"
              >
                <span className="d-none d-sm-inline small fw-semibold">{me.data.name}</span>
                <Gingerbread color={me.data.color} accessory={me.data.accessory} size={28} />
              </Link>
            )}
          </Container>
        </Navbar>
        <Garland />
      </header>

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
