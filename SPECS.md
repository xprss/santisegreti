# santisegreti.it: l'app per i tuoi Secret Santa

## Introduzione

Vogliamo realizzare un'app per la gestione dei Secret Santa.

Nome app: santisegreti.it
Logo app: cappello di babbo natale (SVG)

Github: https://github.com/xprss/santisegreti

Stack:
- frontend: React (TypeScript)
  - design system: React Bootstrap
- backend: FastAPI (Python)
- database: MongoDB
- deploy: docker con docker compose
  - supporta sia un docker compose per lo sviluppo locale (con watchfile) che per produzione
  - aggiungi github workflow on push su master per fare deploy del container
    - push su docker hub (metto io le env vars in .env)
    - usa file VERSION per tenere traccia della versione del container

Durante un Secret Santa, i partecipanti vengono accoppiati con un matching casuale per poter creare delle coppie
che devono farsi i regali vicendevolmente.

## Autenticazione

Auth con Google. Predisponiamo env vars per google, le metto poi io.

## Stanze Segrete

Le stanze segrete sono accessibili solo su invito tramite un OTP generato dall'amministratore della stanza segreta e inviato al candidato partecipante. L'OTP scade dopo 3 minuti.

## Utenti

Gli utenti possono descrivere in una breve bio qualcosa di loro e scegliere un colore che li rappresenti (by default il colore è random).

### Budget

In ogni stanza segreta il budget deve essere personalizzabile dall'admin della stanza segreta.

### Tematicità

Il tema (opzionale) può essere deciso dall'admin a creation-time oppure in seguito modificato da admin della stanza segreta

## Stanze Segrete

### Rendering della stanza segreta

La stanza segreta ha una home page che è costituita da un albero di natale renderizzato con WebGL e con attorno tutti i partecipanti renderizzati come omini di pan di zenzero con il colore dell'utente. Non deve essere troppo pesante da un punto di vista computazionale ma deve essere d'effetto e deve trasmettere calore e unione.

## Matching algorithm

Le regole di matching devono prevedere delle regole di esclusione.

### Regole di esclusione

Admin può definire delle regole di esclusione per evitare l'accoppiamento tra due o più candidati.

## Regole generali per la UI/UX

- No AI-SLOP labels
- Design consistente: usa bootstrap
- Usiamo tanto tema natalizio con rosso, verde, bianco, argento e oro
- Tone of voice:
  - leggero
  - inclusivo
  - giocoso
  - non volgare
  - non imperativo ma che guida nell'operatività

Fammi tutte le domande di cui hai bisogno per partire.
