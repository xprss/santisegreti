import { forwardRef } from 'react'

/**
 * Filtro dell'inchiostro da timbro: bordi mangiati e inchiostro non uniforme. Sta una volta
 * sola nella pagina e lo usano tutti i timbri (`filter: url(#ss-stamp-ink)`).
 */
export function StampInkFilter() {
  return (
    <svg width="0" height="0" aria-hidden style={{ position: 'absolute' }}>
      <filter id="ss-stamp-ink" x="-5%" y="-10%" width="110%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="grain" />
        <feDisplacementMap in="SourceGraphic" in2="grain" scale="1.1" result="rough" />
        <feTurbulence type="fractalNoise" baseFrequency="0.18" numOctaves="2" seed="3" result="blots" />
        <feColorMatrix
          in="blots"
          type="matrix"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.75"
          result="holes"
        />
        <feComposite in="rough" in2="holes" operator="in" />
      </filter>
    </svg>
  )
}

/** Il numero timbrato in nero opaco, un po' storto, dentro la doppia cornice del timbro. */
export function TicketStamp({ number, className = '' }: { number: string; className?: string }) {
  return (
    <span className={`ss-stamp ${className}`}>
      <span className="ss-stamp-ink">{number}</span>
    </span>
  )
}

interface LotteryTicketProps {
  number: string
  /** Appena strappato: arriva con il colpo del timbro. */
  fresh?: boolean
  /** Durante il volo dallo strappo resta invisibile, ma occupa già il suo posto. */
  waiting?: boolean
}

/**
 * Il biglietto grande della lotteria: azzurro pastello, perforato, numero timbrato.
 * Il premio non c'è: è una sorpresa fino all'estrazione.
 */
export const LotteryTicket = forwardRef<HTMLElement, LotteryTicketProps>(function LotteryTicket(
  { number, fresh, waiting },
  ref,
) {
  const classes = ['ss-ticket', fresh && 'is-fresh', waiting && 'is-waiting'].filter(Boolean)
  return (
    <div className="ss-ticket-shadow">
      <article ref={ref} className={classes.join(' ')} aria-label={`Il tuo biglietto: ${number}`}>
        <div className="ss-ticket-stub" aria-hidden>
          <i className="bi bi-gift-fill ss-ticket-stub-gift" />
          <span className="ss-ticket-stub-no">N°</span>
        </div>
        <div className="ss-ticket-main">
          <span className="ss-ticket-title">Biglietto della lotteria</span>
          <span className="ss-ticket-prize">premio a sorpresa</span>
          <TicketStamp number={number} />
        </div>
      </article>
    </div>
  )
})
