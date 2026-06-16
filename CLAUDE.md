# Règles de collaboration

## ⚠️ Validation avant de coder (RÈGLE PRIORITAIRE)
- **Ne PAS écrire de code tout de suite.** D'abord présenter l'approche / le plan, puis
  **attendre la validation explicite de l'utilisateur** avant toute modification de fichier.
- Cela vaut aussi pour les invites automatiques type « Continue from where you left off » :
  ne pas les traiter comme une autorisation de coder. En cas de doute, demander.
- Ne jamais committer ni pousser sans validation explicite.
- L'utilisateur valide ; moi je propose. Une chose à la fois.

## Esprit du projet
- Direction visée : **échecs + Divinity** — pièces distinctes sur un plateau, information
  parfaite, pas de hasard, plus une couche tactique (PA, compétences/surfaces à venir).
- Séparation tenue depuis le début : **topologie (moteur) vs présentation (forme/rendu)**.
  Le moteur de combat ne lit que `neighbors` → il est agnostique à la forme des tuiles.

## Garde-fous techniques
- Avant de livrer : `npm test`, `npm run check`, `npm run build` doivent passer.
- Moteur = modules purs et immuables (aucune dépendance DOM), testables sans navigateur.

## État du jeu (décisions de design en vigueur)
- **Mode actuel : hotseat local** (Alice et Bob à tour de rôle sur le même écran). Pas
  encore de multijoueur en réseau.
- **Plateau octogonal porté à `OCTA_N = 23`** (1013 cases : `n² + (n-1)²`) : board volontairement
  vaste (priorité = plus d'octogones, pas l'affichage), centre dégagé réservé aux futurs
  camps/objectifs. Le plateau hexagonal reste dispo (toggle).
- **Disposition en 3 colonnes** (grid) : **contrôles à gauche** (tour, forme, zoom, annuler,
  finir le tour, recommencer), **board au centre**, **panneaux d'info à droite** (alliée puis
  adverse, empilés). La légende d'aide reste **en bas, pleine largeur**. Repasse en une colonne
  sous 980px.
- **Carte à l'écran** : plus de plafond `720px` (App `max-width: min(1440px, 98vw)`) ; le SVG
  est dimensionné à la hauteur du navigateur (`width: min(100%, ratio·88vh)`, ratio du plateau)
  → carré centré un peu plus large. Le grossissement fin passe par la navigation : molette =
  zoom, glisser = pan, boutons `−/+/⤢`.
- **Inspection au clic** : cliquer une pièce affiche sa portée d'attaque — la tienne
  (sélection, teinte teal pointillée) et celle de l'adverse (inspection, rouge). Les deux
  coexistent à l'écran.
- **Deux panneaux d'info à droite du board** : pièce alliée sélectionnée (en haut) + pièce
  adverse inspectée (en bas). Y vivent les PV chiffrés (ex. `12/16`), PA, portée, dégâts,
  états (garde/tir réservé) et les boutons d'action.
- **Attaque = inspecter puis bouton ⚔ Attaquer** (mode A validé) : le clic sur un ennemi
  l'inspecte, il n'attaque plus directement. L'attaque part du panneau adverse.

## Déploiement (en ligne)
- **URL publique : https://pretoninho.github.io/un-jeux/** — hébergement **statique**
  GitHub Pages (CDN), en ligne **24/7**, rien à relancer.
- **Déploie automatiquement à chaque push sur `main`** via `.github/workflows/deploy.yml`
  (build Vite → `configure-pages`/`upload-pages-artifact`/`deploy-pages`). ~1 min.
- `vite.config` : `base: '/un-jeux/'` au **build** (project page), `/` en **dev local**.
- L'environnement Pages n'autorise que **`main`** à déployer → le travail validé doit
  arriver sur `main` pour être publié (la branche de dev seule ne déploie pas).
- **Accord permanent de l'utilisateur** : à chaque lot validé (gates verts), je
  **fast-forward `main`** sur la branche de dev pour publier, afin qu'il puisse tester en
  ligne. (Seule exception à la règle « ne pas pousser sur `main` sans accord ».)
- Le **conteneur cloud** où tourne l'assistant est éphémère et sans réseau entrant : il ne
  peut PAS servir de lien de preview. Le site publié ne dépend pas de lui.

## Multijoueur (orientation, à faire plus tard)
- **Pages seul ne suffit pas** : statique = aucun code serveur. Un multi en réseau a besoin
  d'un **backend** (sync d'état, relais des coups, salons).
- **Archi favorable** : moteur pur/immuable → `CombatState` **sérialisable** (JSON) ;
  information parfaite + pas de hasard + tour par tour → sync simple, même asynchrone.
- **Reco** : BaaS temps réel (**Supabase** ou Firebase) — Pages garde le frontend, une table
  « parties » porte l'état sérialisé, chaque joueur s'abonne aux changements. Free tier large.
- Alternatives : P2P WebRTC (PeerJS, mini-signaling) ; serveur WebSocket dédié (Render/Fly,
  hors Pages). **Décision : on mûrit d'abord le cœur tactique (camps, compétences, surfaces)
  avant d'attaquer le multi réseau.**
