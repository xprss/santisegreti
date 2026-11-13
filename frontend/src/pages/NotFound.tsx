import { Container } from 'react-bootstrap'
import { Link } from 'react-router'

export function NotFound() {
  return (
    <Container className="ss-page ss-narrow text-center">
      <h1 className="h3">Questa pagina non c'è</h1>
      <p className="text-body-secondary">Forse il link è vecchio, o manca un pezzo.</p>
      <Link to="/">Torniamo alle tue stanze</Link>
    </Container>
  )
}
