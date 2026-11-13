# santisegreti.it

Il Secret Santa per amici, famiglie e colleghi: stanze segrete su invito, estrazione con regole di esclusione, e un albero di Natale in WebGL con tutti i partecipanti intorno.

- **Frontend**: React + TypeScript (Vite), React Bootstrap, three.js con `@react-three/fiber`
- **Backend**: FastAPI, Beanie su MongoDB
- **Deploy**: un'unica immagine Docker (FastAPI serve anche il frontend), pubblicata su Docker Hub da GitHub Actions

## Come funziona

- Si entra con Google. Ognuno ha un profilo con nome, una breve bio e un colore (all'inizio casuale), che diventa il colore del suo omino di pan di zenzero.
- Chi apre una stanza ne è l'admin e partecipa anche all'estrazione. Decide budget, tema (facoltativo) e data dello scambio, e può cambiarli in seguito.
- Si entra in una stanza solo con un codice di invito: l'admin lo genera, lo vede a schermo e lo gira come preferisce (link, chat, a voce). Ogni codice vale per una persona e scade dopo 3 minuti.
- L'admin può creare **gruppi di esclusione**: chi sta nello stesso gruppo non si pesca a vicenda (coppie, famiglie…).
- L'estrazione produce una catena unica (A → B → C → … → A) quando le esclusioni lo permettono, altrimenti un abbinamento valido qualsiasi. Ognuno vede solo la persona a cui fa il regalo, admin compreso.
- L'admin può annullare l'estrazione e rifarla. Ingressi, uscite e modifiche alle esclusioni sono possibili solo prima dell'estrazione.

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

## Accesso con Google

1. Su Google Cloud Console, in *API e servizi → Credenziali*, si crea un ID client OAuth di tipo **Applicazione web**.
2. In *Origini JavaScript autorizzate* vanno `http://localhost:5173` e il dominio di produzione (es. `https://santisegreti.it`).
3. L'ID client va in `GOOGLE_CLIENT_ID` nel `.env`. Il client secret non serve: il backend verifica l'ID token di Google e poi usa un suo cookie di sessione.

## Produzione

```bash
cp .env.example .env   # MONGO_URI esterno, GOOGLE_CLIENT_ID, SESSION_SECRET, DOCKERHUB_USERNAME
docker compose up -d
```

`compose.yaml` avvia solo l'app (porta `APP_PORT`, default 8000) con l'immagine `DOCKERHUB_USERNAME/santisegreti:APP_VERSION`. MongoDB è esterno (`MONGO_URI`) e HTTPS va gestito davanti all'app (reverse proxy, Cloudflare…), con `COOKIE_SECURE=true`.

`SESSION_SECRET` deve avere almeno 32 caratteri: `openssl rand -hex 32`.

## Rilascio

Il workflow [`.github/workflows/publish.yml`](.github/workflows/publish.yml) parte a ogni push su `main`:

1. lint e test di backend e frontend (con un MongoDB di servizio);
2. build multi-architettura (amd64 e arm64) e push su Docker Hub con i tag `x.y.z` (dal file `VERSION`), `latest` e `sha-<commit>`.

Serve impostare nei **secrets del repository GitHub** `DOCKERHUB_USERNAME` e `DOCKERHUB_TOKEN` (un access token di Docker Hub). Per una nuova versione si aggiorna `VERSION` e si fa push.
