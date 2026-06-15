#!/usr/bin/env bash
# Auto-sync Codespace : tire automatiquement les push de la branche courante.
#
#   bash scripts/watch-pull.sh            # surveille la branche courante, toutes les 5 s
#   bash scripts/watch-pull.sh main 10    # surveille 'main' toutes les 10 s
#
# Sûr par conception :
#   - ne tire QUE si ton arbre de travail est propre (aucune modif non commitée) ;
#   - ne tire QUE en fast-forward (jamais d'écrasement, jamais de merge surprise) ;
#   - sinon : affiche un avertissement et n'y touche pas. Ctrl-C pour arrêter.

set -u

BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"
INTERVAL="${2:-5}"

stamp() { date '+%H:%M:%S'; }

echo "🔄 auto-pull : branche '$BRANCH', toutes les ${INTERVAL}s. Ctrl-C pour arrêter."

while true; do
  # Récupère l'état distant sans toucher au working tree.
  if ! git fetch --quiet origin "$BRANCH" 2>/dev/null; then
    echo "[$(stamp)] ⚠️  fetch impossible (réseau ?). Nouvel essai dans ${INTERVAL}s."
    sleep "$INTERVAL"; continue
  fi

  LOCAL="$(git rev-parse @ 2>/dev/null)"
  REMOTE="$(git rev-parse "origin/$BRANCH" 2>/dev/null)"
  BASE="$(git merge-base @ "origin/$BRANCH" 2>/dev/null)"

  if [ "$LOCAL" = "$REMOTE" ]; then
    :  # déjà à jour, rien à faire
  elif [ "$LOCAL" = "$BASE" ]; then
    # On est en retard ET fast-forwardable.
    if [ -n "$(git status --porcelain)" ]; then
      echo "[$(stamp)] ⏸️  nouveau push détecté mais des modifs locales non commitées bloquent le pull."
      echo "            commit/stash tes changements, puis ça repartira tout seul."
    else
      echo "[$(stamp)] ⬇️  nouveau push détecté → git pull (fast-forward)…"
      git merge --ff-only --quiet "origin/$BRANCH" \
        && echo "[$(stamp)] ✅ à jour ($(git rev-parse --short HEAD))." \
        || echo "[$(stamp)] ⚠️  pull échoué, branche inchangée."
    fi
  elif [ "$REMOTE" = "$BASE" ]; then
    echo "[$(stamp)] ↗️  ton local est en AVANCE sur le distant (tu as des commits non poussés). Rien à tirer."
  else
    echo "[$(stamp)] ⚠️  branches divergentes (local et distant ont chacun des commits). Résous à la main."
  fi

  sleep "$INTERVAL"
done
