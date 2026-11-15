import { useLayoutEffect, useRef } from 'react'
import { Container, Dropdown, Navbar } from 'react-bootstrap'
import { Link, Outlet, ScrollRestoration, useNavigate } from 'react-router'
import { useLogout, useMe } from '../api/hooks'
import { Landing } from '../pages/Landing'
import { ErrorAlert, Loading } from './feedback'
import { CandyCane } from './CandyCane'
import { Garland } from './Garland'

/**
 * Espone l'altezza dell'header come --ss-header-h: la scena e lo snap dello scroll la usano.
 * Conta lo spazio che occupa davvero nella pagina (la ghirlanda sporge sotto con margine negativo),
 * cioè dove comincia il <main> che lo segue.
 */
function useHeaderHeight() {
  const header = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const element = header.current
    if (!element) return
    const root = document.documentElement
    const update = () => {
      const next = element.nextElementSibling as HTMLElement | null
      const height = next ? next.offsetTop : element.offsetHeight
      root.style.setProperty('--ss-header-h', `${height}px`)
    }
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return header
}

export function Layout() {
  const header = useHeaderHeight()
  const me = useMe()
  const logout = useLogout()
  const navigate = useNavigate()

  return (
    <>
      <header ref={header} className="sticky-top">
        <Navbar variant="dark" className="ss-navbar">
          <Container>
            <Navbar.Brand as={Link} to="/" className="ss-brand">
              Santi Segreti
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
