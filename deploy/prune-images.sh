#!/usr/bin/env bash
# Cancella le immagini locali di santisegreti che non servono più.
#
#   deploy/prune-images.sh [--keep N] [--dry-run]
#
# Tiene sempre:
#   - le ultime N immagini deployate con successo (default 3: quella attuale e
#     due precedenti a cui tornare senza riscaricarle), dallo storico dei deploy;
#   - qualsiasi immagine usata da un container, anche fermo.
# Cancella tutte le altre immagini del repository IMAGE_REPOSITORY (default
# xprss/santisegreti), comprese quelle di deploy falliti. Le altre immagini
# dell'host non le tocca: rimuove solo i riferimenti a IMAGE_REPOSITORY, e
# un'immagine che ha anche altri nomi resta in piedi con quelli.
#
# Un'immagine cancellata resta su Docker Hub: un deploy successivo la riscarica.
#
# Variabili: IMAGE_REPOSITORY, HISTORY_FILE.

set -euo pipefail

IMAGE_REPOSITORY="${IMAGE_REPOSITORY:-xprss/santisegreti}"
HISTORY_FILE="${HISTORY_FILE:-/var/lib/jenkins/santisegreti/deploy-history}"
KEEP=3
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep) KEEP="${2:?--keep vuole un numero}"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;;
    *) echo "Opzione sconosciuta: $1" >&2; exit 2 ;;
  esac
done
[[ "${KEEP}" =~ ^[1-9][0-9]*$ ]] || { echo "--keep deve essere un intero >= 1" >&2; exit 2; }

# Riferimenti da tenere: gli ultimi KEEP dello storico (una riga per deploy, la
# più recente in fondo; un'immagine ri-deployata conta per la sua ultima volta).
declare -A keep_refs=()
if [[ -r "${HISTORY_FILE}" ]]; then
  while IFS= read -r ref; do
    [[ -n "${ref}" ]] && keep_refs["${ref}"]=1
  done < <(tac "${HISTORY_FILE}" | awk 'NF && !seen[$1]++ {print $1}' | head -n "${KEEP}")
else
  echo "Storico dei deploy assente (${HISTORY_FILE}): tengo solo le immagini in uso" >&2
fi

# Immagini usate da un container, in esecuzione o fermo.
declare -A in_use=()
mapfile -t containers < <(docker ps -aq)
if (( ${#containers[@]} )); then
  while IFS= read -r id; do in_use["${id}"]=1; done \
    < <(docker inspect --format '{{.Image}}' "${containers[@]}")
fi

removed=0
mapfile -t image_ids < <(docker image ls -aq --no-trunc | sort -u)
(( ${#image_ids[@]} )) || exit 0

# Una riga per immagine: ID, poi tutti i suoi nomi (tag e digest).
while read -r id names; do
  refs=()
  for name in ${names}; do
    [[ "${name}" == "${IMAGE_REPOSITORY}@"* || "${name}" == "${IMAGE_REPOSITORY}:"* ]] && refs+=("${name}")
  done
  (( ${#refs[@]} )) || continue

  [[ -n "${in_use[${id}]:-}" ]] && continue
  keep=false
  for ref in "${refs[@]}"; do
    [[ -n "${keep_refs[${ref}]:-}" ]] && keep=true
  done
  "${keep}" && continue

  for ref in "${refs[@]}"; do
    if "${DRY_RUN}"; then
      echo "Da cancellare: ${ref}"
    elif docker image rm "${ref}" >/dev/null; then
      echo "Cancellata: ${ref}"
    else
      echo "Impossibile cancellare ${ref}" >&2
    fi
  done
  removed=$((removed + 1))
done < <(docker image inspect --format '{{.ID}} {{join .RepoTags " "}} {{join .RepoDigests " "}}' "${image_ids[@]}")

if "${DRY_RUN}"; then
  echo "Immagini da cancellare: ${removed}"
else
  echo "Immagini cancellate: ${removed}"
fi
