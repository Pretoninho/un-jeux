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

## Classes, verbes & Résonance (avancement — détail : `docs/classes.md`)
> **Créer un personnage : processus pas-à-pas → `docs/personnages.md`.**
- **Calibrage « portée + robustesse = 5 »** (`engine/pieces.ts`, `profileFor`) : une pièce
  *sur la droite* est définie par son seul palier de portée `r∈{1..4}`, `t=5−r` → `maxHp=4+3t`,
  `damage=1+t`, `attackCost=2`. Aucune pièce strictement meilleure, tout est positionnel.
- **Pièces hors-droite** : hook `Archetype.profile?: Partial<Profile>` → `makeUnit` fusionne
  `profileFor(rangeTier)` + override (la portée reste sur la droite).
- **Verbes** (capacités à nombres personnalisables, portés par la pièce) :
  - **Garde** (`guard`, CAC) — Lourde : 3 PA → ×0.5 dégâts subis.
  - **Tir réservé** (`overwatch`, distance) — Tireur : 3 PA, réflexe à l'arrivée d'un ennemi.
  - **Riposte** (`riposte`, atypique Duelliste) — 2 PA : contre un attaquant **adjacent** qui
    le frappe (s'il survit) ; miroir mêlée du tir réservé ; résolu dans `attack()`.
- **Effectif déployé** : Lourde + Tireur + **Duelliste** (3/camp pour l'instant). Cible = 4
  (le **Soigneur** sera la 4ᵉ). Exotiques (Hallebardier/Saboteur) en réserve dans le registre.
  Le **Duelliste** est hors-droite (PV 9, dégâts 2, **attaque 1 PA** → frappe deux fois/tour).
- **Couche PERSONNAGE** (`Character`/`CHARACTERS`, `makeUnitFromCharacter`) : une pièce déployée
  = **socle de classe** (archétype) + **calque perso** (nom, override de stats, **Résonance
  signature**). Fusion des Résonances **par `id`** (signature étend/écrase le socle). Les deux
  camps alignent des **héros distincts** (noms propres) aux **stats miroir** (équité). `Unit.kind`
  reste l'archétype → la matrice `amountBySource` (× classe-source) intacte, la signature ajoute
  l'axe *× personnage*. Noms actuels = **placeholders**. Épines = signature des Duellistes-héros.
  - **Axe « × personnage » CÂBLÉ (sous-lot A, 2026-06-16)** : `Unit.characterId` (identité héros
    stable, posée par `makeUnitFromCharacter` ; sert aussi vivier/draft) + `ReactionSpec.amountByCharacter`.
    Lookup `reactionAmount` priorisé : **héros** (`characterId`) → **classe** (`kind`) → défaut → 1.
    UI : le panneau `?` affiche « selon classe » **et** « selon héros ». **Sous-lot B AJOURNÉ** :
    faire varier l'**effet** (`kind`) et pas seulement le **nombre** par héros source.
- **HÉROS UNIQUES (cap visée — décidé le 2026-06-16)** : on quitte le miroir. Chaque
  personnage devient un **héros unique** (identité propre, **Résonance signature** propre,
  **stats sur-mesure** autorisées — calque `profile?` au niveau perso, hors-droite permis).
  À terme : **vivier commun** où n'importe quel héros peut être choisi par n'importe quel camp
  (plus de pool a_/b_ couplé au camp).
  - **Deux couches séparables** : (1) **les héros eux-mêmes** = la fondation, déjà en place,
    qu'on enrichit *sans* toucher au reste ; (2) **le draft** (comment on les choisit) = couche
    au-dessus, ajoutée plus tard.
  - **Décision de draft / d'équité AJOURNÉE** : on ne tranche le modèle (miroir / exclusif /
    libre) **qu'au moment de construire l'écran de sélection**, quand le vivier sera assez
    profond. Conséquence assumée : héros uniques + fieldés une fois ⇒ escouades **asymétriques
    par nature** → l'**équité devient un sujet de design au draft**, pas avant (sans gravité en
    phase de construction).
  - **Méthode** : on façonne les héros **un à la fois** (un héros = un petit lot validé, comme
    une cellule de matrice) ; line-up par défaut jouable conservé pour tester en attendant.
- **RÉSONANCE** = système de **réactions en chaîne** (synergies d'escouade), dans
  `engine/combat.ts` : un événement émet un **signal typé**, les alliés dont un passif
  (`ReactionSpec`) l'**écoute** réagissent ; l'effet dépend de la **source** (`amountBySource`)
  → matrice « possesseur × déclencheur » qui **émerge** (on n'écrit que les cellules utiles).
  Garde-fous : déterministe + **prévisualisable** (`previewReactions`, dry-run pur, affiché
  avant l'attaque) ; **portée** par réaction (`{radius}` ou `{squad}`) ; **cooldown** par passif
  (décompté à `endTurn`) ; **terminaison** (file FIFO bornée + un passif au plus une fois/cascade).
  `attack()` scindé en `strike()` (frappe nue + signal) + résolution → permettra de rebrancher
  `overwatch`/`riposte` sur ce canal plus tard.
  - **1ʳᵉ cellule livrée** — *Épines relayées* (Duelliste) : un allié **en garde** (rayon 2)
    qui **encaisse** → le Duelliste pince l'attaquant (Lourde→2, défaut 1), CD 2 tours.
  - **UI** : badge `RÉSONANCE ✦ {effet}` + cooldown (⏳n/prêt) dans les panneaux d'info, bouton
    `?` pour déplier le détail (déclencheur, portée, CD, dégâts par source).
- **Suite (la matrice se remplit une cellule = un lot validé)** : nouveaux signaux
  (`allie_a_terre`, `pres_de_mourir`…), nouvelles cellules sur pièces existantes, nouveaux
  effets `kind`, puis **spécialistes** (Soigneur/Hallebardier/Saboteur) « nés résonants ».

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
