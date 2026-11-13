import { Container, Dropdown, Navbar } from 'react-bootstrap'
import { Link, Outlet, ScrollRestoration, useNavigate } from 'react-router'
import { useLogout, useMe } from '../api/hooks'
import { Landing } from '../pages/Landing'
import { ErrorAlert, Loading } from './feedback'
import { CandyCane } from './CandyCane'
import { Garland } from './Garland'

export function Layout() {
  const me = useMe()
  const logout = useLogout()
  const navigate = useNavigate()

  return (
    <>
      <header className="sticky-top">
        <Navbar variant="dark" className="ss-navbar">
          <Container>
            <Navbar.Brand as={Link} to="/" className="ss-brand">
              santisegreti
            </Navbar.Brand>
            {me.data && (
              <Dropdown align="end">
                <Dropdown.Toggle variant="link" className="ss-menu-toggle" aria-label="Menu">
                  <CandyCane />
                </Dropdown.Toggle>
                <Dropdown.Menu className="ss-menu">
                  <Dropdown.Item as={Link} to="/profilo">
                    Il tuo profilo
                  </Dropdown.Item>
                  <Dropdown.Item
                    as="button"
                    onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/') })}
                  >
                    Esci
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
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
