#!/usr/bin/env bash
# Deploya un'immagine di santisegreti per digest immutabile sull'host di produzione.
# Lo usa il job Jenkins `santisegreti-deploy`, ma si può lanciare anche a mano.
#
#   deploy/deploy-image.sh \
#     --image-ref xprss/santisegreti@sha256:... \
#     --git-commit <sha completo> \
#     --app-version 0.1.0
#
# Variabili opzionali: ENV_FILE, CONTAINER_NAME, HOST_PORT, APP_MEMORY,
# APP_MEMORY_SWAP, DIAGNOSTICS_DIR, PUBLIC_URL.
#
# Se il nuovo container non diventa sano, il precedente viene riavviato
# e lo script esce con errore.

set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/santisegreti/production.env}"
CONTAINER_NAME="${CONTAINER_NAME:-santisegreti}"
HOST_PORT="${HOST_PORT:-8085}"
CONTAINER_PORT=8000
APP_MEMORY="${APP_MEMORY:-256m}"
APP_MEMORY_SWAP="${APP_MEMORY_SWAP:-384m}"
DIAGNOSTICS_DIR="${DIAGNOSTICS_DIR:-$(pwd)/deployment-diagnostics}"
PUBLIC_URL="${PUBLIC_URL:-}"

IMAGE_REF=""
GIT_COMMIT=""
APP_VERSION=""

usage() { sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image-ref) IMAGE_REF="${2:?--image-ref vuole un valore}"; shift 2 ;;
    --git-commit) GIT_COMMIT="${2:?--git-commit vuole un valore}"; shift 2 ;;
    --app-version) APP_VERSION="${2:?--app-version vuole un valore}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Opzione sconosciuta: $1" >&2; usage >&2; exit 2 ;;
  esac
done

fail() { echo "ERRORE: $*" >&2; exit 1; }

[[ "${IMAGE_REF}" =~ ^[a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._-]*@sha256:[0-9a-f]{64}$ ]] \
  || fail "--image-ref deve essere namespace/repository@sha256:<64 hex>"
[[ "${GIT_COMMIT}" =~ ^[0-9a-f]{40}$ ]] || fail "--git-commit deve essere uno SHA completo di 40 caratteri"
[[ "${APP_VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$ ]] || fail "--app-version non è una SemVer"

# --- Configurazione runtime --------------------------------------------------
[[ -r "${ENV_FILE}" ]] || fail "file di configurazione non leggibile: ${ENV_FILE}"

env_value() {
  # Ultimo valore di KEY nel file, come lo legge `docker --env-file` (niente quoting).
  sed -n "s/^$1=//p" "${ENV_FILE}" | tail -n 1
}

mongo_uri="$(env_value MONGO_URI)"
session_secret="$(env_value SESSION_SECRET)"
google_client_id="$(env_value GOOGLE_CLIENT_ID)"

[[ "${mongo_uri}" =~ ^mongodb(\+srv)?:// ]] || fail "MONGO_URI mancante o non valido in ${ENV_FILE}"
[[ "${mongo_uri}" != *"localhost"* && "${mongo_uri}" != *"127.0.0.1"* ]] \
  || fail "MONGO_URI punta a localhost: dal container non è raggiungibile"
(( ${#session_secret} >= 32 )) || fail "SESSION_SECRET deve avere almeno 32 caratteri"
[[ -n "${google_client_id}" ]] || fail "GOOGLE_CLIENT_ID mancante in ${ENV_FILE}: senza non si può accedere"
if grep -Eq '^[A-Za-z_][A-Za-z0-9_]*="' "${ENV_FILE}"; then
  fail "${ENV_FILE} contiene valori tra virgolette: docker --env-file le passerebbe letteralmente"
fi

command -v docker >/dev/null || fail "docker non trovato"
command -v curl >/dev/null || fail "curl non trovato"

mkdir -p "${DIAGNOSTICS_DIR}"

capture_diagnostics() {
  set +e
  if docker container inspect "${CONTAINER_NAME}" >/dev/null 2>&1; then
    # Solo stato e immagine: l'ambiente del container contiene segreti.
    docker inspect --format \
      '{"name":{{json .Name}},"image":{{json .Config.Image}},"state":{{json .State}}}' \
      "${CONTAINER_NAME}" > "${DIAGNOSTICS_DIR}/inspect.json" 2>/dev/null
    docker logs --tail 300 "${CONTAINER_NAME}" > "${DIAGNOSTICS_DIR}/container.log" 2>&1
  fi
  set -e
}

wait_healthy() {
  local attempt
  for attempt in $(seq 1 45); do
    if curl --fail --silent --show-error --max-time 5 \
      "http://127.0.0.1:${HOST_PORT}/api/health" > "${DIAGNOSTICS_DIR}/health-response.json" 2>/dev/null; then
      return 0
    fi
    if [[ "$(docker inspect --format '{{.State.Running}}' "${CONTAINER_NAME}" 2>/dev/null)" != "true" ]]; then
      echo "Il container ${CONTAINER_NAME} si è fermato" >&2
      return 1
    fi
    sleep 2
  done
  return 1
}

run_container() {
  local image_ref="$1" version="$2" commit="$3"
  docker run -d \
    --name "${CONTAINER_NAME}" \
    --restart unless-stopped \
    --memory "${APP_MEMORY}" \
    --memory-swap "${APP_MEMORY_SWAP}" \
    --env-file "${ENV_FILE}" \
    -e DEV_LOGIN=false \
    -e COOKIE_SECURE=true \
    --label "it.santisegreti.app-version=${version}" \
    --label "it.santisegreti.git-commit=${commit}" \
    --log-opt max-size=10m --log-opt max-file=3 \
    -p "127.0.0.1:${HOST_PORT}:${CONTAINER_PORT}" \
    "${image_ref}" >/dev/null
}

# --- Immagine ------------------------------------------------------------------
echo "Pull di ${IMAGE_REF}"
docker pull --quiet "${IMAGE_REF}" >/dev/null

image_revision="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "${IMAGE_REF}")"
[[ "${image_revision}" == "${GIT_COMMIT}" ]] \
  || fail "l'immagine dichiara revision '${image_revision}', atteso ${GIT_COMMIT}"

# --- Sostituzione del container ------------------------------------------------
previous_image=""
previous_version=""
previous_commit=""
if docker container inspect "${CONTAINER_NAME}" >/dev/null 2>&1; then
  previous_image="$(docker inspect --format '{{.Config.Image}}' "${CONTAINER_NAME}")"
  previous_version="$(docker inspect --format '{{index .Config.Labels "it.santisegreti.app-version"}}' "${CONTAINER_NAME}")"
  previous_commit="$(docker inspect --format '{{index .Config.Labels "it.santisegreti.git-commit"}}' "${CONTAINER_NAME}")"
  echo "Versione attuale: ${previous_version:-?} (${previous_image})"
  docker rm -f "${CONTAINER_NAME}" >/dev/null
fi

echo "Avvio di ${CONTAINER_NAME} ${APP_VERSION} su 127.0.0.1:${HOST_PORT}"
run_container "${IMAGE_REF}" "${APP_VERSION}" "${GIT_COMMIT}"

if ! wait_healthy; then
  capture_diagnostics
  echo "La nuova versione non risponde su /api/health. Ultimi log:" >&2
  tail -n 40 "${DIAGNOSTICS_DIR}/container.log" >&2 || true
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  if [[ -n "${previous_image}" ]]; then
    echo "Ripristino della versione precedente: ${previous_image}" >&2
    run_container "${previous_image}" "${previous_version}" "${previous_commit}"
    wait_healthy || echo "ATTENZIONE: anche la versione precedente non risponde" >&2
  fi
  exit 1
fi

if [[ -n "${PUBLIC_URL}" ]]; then
  echo "Controllo pubblico su ${PUBLIC_URL%/}/api/health"
  curl --fail --silent --show-error --max-time 20 "${PUBLIC_URL%/}/api/health" >/dev/null \
    || fail "l'app risponde in locale ma non da ${PUBLIC_URL} (nginx?)"
fi

capture_diagnostics
echo "Deploy completato: ${APP_VERSION} (${GIT_COMMIT}) da ${IMAGE_REF}"
