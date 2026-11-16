# santisegreti.it

Il Secret Santa per amici, famiglie e colleghi: stanze segrete su invito, estrazione con regole di esclusione, e un albero di Natale in WebGL con tutti i partecipanti intorno.

- **Frontend**: React + TypeScript (Vite), React Bootstrap, three.js con `@react-three/fiber`
- **PWA**: installabile sulla home (manifest e service worker generati da `vite-plugin-pwa`); il service worker precarica la build ma non mette mai in cache `/api`
- **Backend**: FastAPI, Beanie su MongoDB
- **Deploy**: un'unica immagine Docker (FastAPI serve anche il frontend), pubblicata su Docker Hub da GitHub Actions

## Come funziona

- Si entra con Google. Ognuno ha un profilo con nome, una breve bio e un colore (all'inizio casuale), che diventa il colore del suo omino di pan di zenzero.
- L'omino può portare un accessorio, uno solo oppure nessuno (all'inizio nessuno): cappelli, corna da renna, parrucche, occhiali, cravatta, sciarpa, zainetto e altri. Il catalogo sta in `frontend/src/accessories/catalog.ts` e i disegni servono sia per l'SVG sia per la scena 3D. Un test del backend controlla che gli id coincidano con `app/models/accessories.py`.
- Chi apre una stanza ne è l'admin e partecipa anche all'estrazione. Decide budget, tema (facoltativo) e data dello scambio, e può cambiarli in seguito.
- Si entra in una stanza solo con un codice di invito: l'admin lo genera, lo vede a schermo e lo gira come preferisce (link, chat, a voce). Ogni codice vale per una persona e scade dopo 3 minuti.
- L'admin può creare **gruppi di esclusione**: chi sta nello stesso gruppo non si pesca a vicenda (coppie, famiglie…).
- L'estrazione produce una catena unica (A → B → C → … → A) quando le esclusioni lo permettono, altrimenti un abbinamento valido qualsiasi. Ognuno vede solo la persona a cui fa il regalo, admin compreso.
- L'admin può annullare l'estrazione e rifarla. Ingressi, uscite e modifiche alle esclusioni sono possibili solo prima dell'estrazione.

### Lotteria

- Ogni stanza ha al massimo **una lotteria**. L'admin la crea (nasce in bozza e finché resta così la vede solo l'admin), la apre e poi la estrae. Prima dell'estrazione può eliminarla; dopo è definitiva.
- Ognuno, admin compreso, prende un biglietto `SANTO-XXXXXX`: un dialogo in pixel chiede conferma, la macchinetta lo stampa, si strappa e vola nella sezione sopra le polaroid. Il premio resta una sorpresa fino all'estrazione.
- Sulle polaroid si vede chi ha il biglietto (il numero solo chi lo possiede) e chi ha la stanza aperta in quel momento.
- L'estrazione è **in diretta**: il server sceglie subito il vincitore ma lo tiene segreto, a tutti i collegati parte lo stesso conto alla rovescia di 10 secondi (`LOTTERY_COUNTDOWN_SECONDS`) e a zero il vincitore arriva a tutti insieme dal WebSocket `/api/rooms/{id}/lottery/ws`. Servono almeno 2 biglietti.
- Il premio di quest'anno è la **tunica di fiori**, un accessorio speciale che si sblocca solo vincendo (`special: true` nel catalogo, `SPECIAL_ACCESSORIES` nel backend). Chi vince la trova nel profilo e la indossa se vuole; agli altri compare bloccata, senza svelare cos'è.
- Il WebSocket tiene le connessioni in memoria: funziona perché l'app gira in un solo processo uvicorn. Con più worker o repliche servirebbe un canale condiviso (change stream di Mongo, pub/sub).

## Sviluppo locale

Servono Docker e Docker Compose.

```bash
cp .env.example .env   # in sviluppo basta GOOGLE_CLIENT_ID, il resto lo imposta compose.dev.yaml
docker compose -f compose.dev.yaml up --watch
```

- App: http://localhost:5173 (Vite, con proxy di `/api` verso il backend)
- API e documentazione: http://localhost:8000/api/docs
- MongoDB: `localhost:27017`

Compose Watch sincronizza `backend/app` e `frontend/src` nei container (uvicorn `--reload` e HMR di Vite) e ricostruisce le immagini quando cambiano `uv.lock` o `package-lock.json`.

In sviluppo è attivo un **accesso di prova** senza Google (`DEV_LOGIN=true`, solo in `compose.dev.yaml`): nella pagina di accesso basta un nome e un'email qualsiasi. Per una stanza demo con una dozzina di partecipanti:

```bash
docker compose -f compose.dev.yaml exec backend python -m scripts.seed_dev anna@example.test
```

e poi si entra come `anna@example.test`.

### Test

```bash
cd backend && uv sync && uv run pytest
```

I test delle API usano un MongoDB reale su `localhost:27017` (quello di `compose.dev.yaml` va bene; `TEST_MONGO_URI` per cambiarlo) e creano un database temporaneo che cancellano alla fine.

```bash
cd frontend && npm ci && npm run lint && npm run build
```

### PWA

`vite-plugin-pwa` genera in build `manifest.webmanifest`, `sw.js` (Workbox) e `registerSW.js`. Le icone stanno in `frontend/public/` (`pwa-*.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`) e riprendono il cappello di `favicon.svg`. Il service worker si aggiorna da solo: dopo un deploy la versione nuova arriva alla navigazione successiva. Il backend serve i file fuori da `/assets` con `Cache-Control: no-cache`, così il browser ricontrolla sempre `sw.js` e il manifest. In sviluppo (`vite dev`) il service worker è spento; per provarlo: `npm run build && npm run preview`.

## Accesso con Google

1. Su Google Cloud Console, in *API e servizi → Credenziali*, si crea un ID client OAuth di tipo **Applicazione web**.
2. In *Origini JavaScript autorizzate* vanno `http://localhost:5173` e il dominio di produzione (es. `https://santisegreti.it`).
3. L'ID client va in `GOOGLE_CLIENT_ID` nel `.env`. Il client secret non serve: il backend verifica l'ID token di Google e poi usa un suo cookie di sessione.

## Produzione

Gira su https://santisegreti.hexaquot.it (`www.` rimanda lì), sulla stessa macchina e con lo stesso Jenkins di hexaquot (https://ci.hexaquot.it). MongoDB è esterno.

| Cosa | Dove |
| --- | --- |
| Container | `santisegreti`, in ascolto solo su `127.0.0.1:8085` |
| Configurazione runtime | `/etc/santisegreti/production.env` (root:jenkins, 0640), vedi sotto |
| Reverse proxy e TLS | `/etc/nginx/conf.d/santisegreti.hexaquot.it.conf` (copia in [`deploy/`](deploy/nginx-santisegreti.hexaquot.it.conf)), certificato Let's Encrypt via webroot |
| Job Jenkins | `santisegreti-deploy`, pipeline [`deploy/Jenkinsfile`](deploy/Jenkinsfile) letta da `main` (config in [`deploy/jenkins-job.xml`](deploy/jenkins-job.xml)) |

**WebSocket della lotteria:** nginx deve inoltrare l'`Upgrade` su `/api/rooms/{id}/lottery/ws` (vedi la `location` dedicata nella [copia della configurazione](deploy/nginx-santisegreti.hexaquot.it.conf)). Il file sul server va aggiornato a mano (`sudo nginx -t && sudo systemctl reload nginx`) **prima** che la lotteria arrivi su `main`, perché il push fa partire il deploy. Senza, le pagine funzionano lo stesso ma l'estrazione non è in diretta.

`production.env` contiene `MONGO_URI`, `MONGO_DB`, `GOOGLE_CLIENT_ID` e `SESSION_SECRET` (almeno 32 caratteri: `openssl rand -hex 32`), una riga `KEY=valore` ciascuno e **senza virgolette** (lo legge `docker --env-file`). `DEV_LOGIN=false` e `COOKIE_SECURE=true` li forza lo script di deploy. Nella console Google, l'ID client deve avere `https://santisegreti.hexaquot.it` tra le origini JavaScript autorizzate.

`compose.yaml` resta per chi vuole far girare l'immagine altrove: avvia solo l'app (porta `APP_PORT`, default 8000) con l'immagine `DOCKERHUB_USERNAME/santisegreti:APP_VERSION`; HTTPS va gestito davanti, con `COOKIE_SECURE=true`.

## Rilascio

Il workflow [`.github/workflows/publish.yml`](.github/workflows/publish.yml) parte a ogni push su `main`:

1. lint e test di backend e frontend (con un MongoDB di servizio);
2. build multi-architettura (amd64 e arm64) e push su Docker Hub con i tag `x.y.z` (dal file `VERSION`), `latest` e `sha-<commit>`, e le etichette OCI `version` e `revision`;
3. avvio del job Jenkins `santisegreti-deploy` con il **digest** dell'immagine appena pubblicata.

Il job Jenkins ([`deploy/deploy-image.sh`](deploy/deploy-image.sh)) scarica l'immagine per digest, controlla che l'etichetta `revision` corrisponda al commit, sostituisce il container e aspetta che `/api/health` risponda: siccome all'avvio l'app crea gli indici su Mongo, una risposta vuol dire che anche il database è raggiungibile. Poi verifica l'URL pubblico. Se la nuova versione non parte, **rimette in piedi quella precedente** e il build fallisce, con log e stato del container tra gli artefatti.

Dopo un deploy riuscito, [`deploy/prune-images.sh`](deploy/prune-images.sh) cancella le immagini locali di `xprss/santisegreti` che non servono più. Tiene le ultime 3 deployate con successo (quella attuale e due a cui tornare senza riscaricarle; `KEEP_IMAGES` per cambiarlo) e qualsiasi immagine usata da un container. Lo storico dei deploy riusciti sta in `/var/lib/jenkins/santisegreti/deploy-history`. Le altre immagini dell'host non le tocca. Si può lanciare anche a mano: `sudo -u jenkins deploy/prune-images.sh --dry-run`.

Secrets del repository GitHub:

- `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`: utente e access token di Docker Hub;
- `JENKINS_TRIGGER_USER`, `JENKINS_TRIGGER_TOKEN`: l'utente tecnico `github-actions` di Jenkins e il suo token API `santisegreti-delivery`, che può solo leggere e avviare `santisegreti-deploy`.

Per una nuova versione si aggiorna `VERSION` e si fa push.

**Tornare a una versione precedente:** su Jenkins, *santisegreti-deploy → Build with Parameters*, con il digest della versione voluta (si trova in `deployment.json` tra gli artefatti dei build passati, oppure su Docker Hub), il commit completo e la versione. Se l'immagine è già stata cancellata dall'host, il deploy la riscarica da Docker Hub.
