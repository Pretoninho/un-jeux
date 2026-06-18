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
- **Plateau = octogone, deux tailles (décidé 2026-06-18)** : on quitte le toggle forme et on
  passe **tout en octogone**. Le sélecteur est désormais un **MODE** :
  - **🎓 Entraînement** = petit octogone **`OCTA_TRAIN = 9`** (145 cases) — plateau resserré, sert
    le **tuto jouable** (forcé dessus) et la practice. **Démarrage par défaut** au chargement.
  - **⚔ Partie** = grand octogone **`OCTA_GAME = 23`** (1013 cases : `n² + (n-1)²`) — board
    volontairement vaste (priorité = plus d'octogones), centre dégagé réservé aux futurs camps/objectifs.
  - L'**hexagone** (`makeBoard`, `RADIUS = 4`) est **mis de côté** : code conservé (`buildBoard('hex')`
    fonctionne) mais **plus exposé dans l'UI**, réactivable plus tard.
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
> **Créer une Résonance (duo) : procédé + référence des clés → `docs/resonances.md`.**
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
  - **VIVIER PLAT LIVRÉ (2026-06-16)** : `CHARACTERS` découplé des camps, ids = **noms neutres**
    (`bastion, mireille, estoc, rempart, orso, fil`) ; le déploiement (`CombatView`) assigne
    librement les héros aux camps. Line-up par défaut : **Alice = Bastion + Mireille + Estoc**, **Bob =
    Rempart + Orso + Fil** (→ vivants : *Estoc × Bastion*, *Estoc × Mireille* côté Alice ; *Fil × Rempart*,
    *Fil × Orso* côté Bob). **Une seule Lourde/escouade** → les duos-tank d'un héros sont **mutuellement
    exclusifs** (selon le tank fieldé). **Escouade = 1 de chaque archétype** (Lourde+Tireur+Duelliste) →
    deux héros du **même archétype** ne sont jamais coéquipiers : **tous les duos sont inter-archétypes**
    (un Fil × Estoc, 2 Duellistes, est impossible à fielder). Le **draft** reste ajourné.
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
  - **MODÈLE PAR-DUO (décidé 2026-06-16)** — *« un duo de héros = sa propre Résonance »*. Filtre
    de source `ReactionSpec.fromCharacter` / `fromKind` : une Résonance peut ne réagir QU'À une
    source précise (héros ou archétype). Chaque binôme porte alors **sa** `ReactionSpec` distincte
    (id/effet/portée/CD propres), pas un effet partagé scalé. `amountBySource`/`amountByCharacter`
    restent pour le cas léger « même effet, magnitude variable ». **Contrainte** : un duo n'existe
    que s'il a un **signal que le partenaire émet** (aujourd'hui seul `garde_encaissee`, émis par
    la Garde → seuls les duos avec un tank sont déclenchables sans nouveau signal).
  - **1ᵉʳ duo livré — *Estoc × Bastion*** : quand **Bastion** (`bastion`, en garde, rayon 2)
    encaisse, **Estoc** pince l'attaquant pour 2 (`fromCharacter: 'bastion'`), CD 2 tours.
  - **2ᵉ duo livré — *Estoc × Mireille*** : nouveau signal `tir_reserve` (émis par `resolveOverwatch`
    quand le Tir Réservé de Mireille part) ; Estoc (`fromCharacter: 'mireille'`, **portée escouade**)
    pose une **marque** (`kind: 'marquage'`) sur la cible touchée → son **1ᵉʳ coup** sur elle gagne
    **+1** puis la marque tombe. Durée 2 tours d'Estoc (statut `Unit.mark`, décompté à `endTurn`),
    CD 2. **1ᵉʳ effet PERSISTANT** + 1ᵉʳ signal hors-garde. Portée escouade voulue (Mireille tire de
    loin, Estoc au contact → jamais côte à côte).
  - **3ᵉ duo livré — *Estoc × Rempart*** : si Estoc est à **portée 2** de Rempart quand celui-ci
    (en garde) encaisse, Estoc **ESTROPIE** l'attaquant (`fromCharacter: 'rempart'`, `kind: 'estropier'`,
    amount 2, **duration 3**, CD 2) : **−2 en déplacement** sur ses **2 tours pleins** suivants, **sans
    toucher ses attaques** (statut `Unit.cripple`, lu via `moveBudget = ap − cripple`, décompté à
    `endTurn` ; duration 3 car posée pendant le tour de la cible). 2ᵉ effet persistant ; `tickStatus`
    généralise le décompte (marque + estropie).
  - **4ᵉ duo livré — *Estoc × Orso*** : quand le Tir Réservé d'Orso part (`tir_reserve`,
    `fromCharacter: 'orso'`, **portée escouade**), Estoc **PROVOQUE** la cible (`kind: 'provocation'`)
    → elle est tirée **d'1 case vers Estoc** (déplacement forcé, voisin libre le plus proche,
    déterministe ; agnostique à la forme). CD 2 (= 1 tour plein réel), posé même si la cible ne peut
    pas bouger (déjà collée à Estoc). Ne redéclenche pas l'overwatch. **Estoc a ses 4 duos** (Bastion,
    Mireille, Rempart, Orso) ; dans le line-up courant seul *× Rempart* + *× Orso* sont vivants.
  - **Duo livré — *Fil × Bastion*** (1ᵉʳ façonnage de Fil) : quand Bastion (en garde, rayon 2)
    encaisse et que Fil est à portée, Fil octroie à **Bastion** la **VENDETTA** (`fromCharacter: 'bastion'`,
    `kind: 'vendetta'`, amount 2, CD 3 = 2 tours pleins) : **+2 à sa PROCHAINE attaque**, gardée jusqu'à
    frapper (statut `Unit.vendetta`, sans expiration, consommé dans `strike()`). **1ᵉʳ effet de SOUTIEN**
    (buff d'un allié) → `PendingReaction.sourceId` ajouté (l'effet vise l'allié émetteur, pas l'attaquant).
    Dans le line-up courant, Fil et Bastion sont alliés (Bob) → ce duo est **vivant**.
  - **Duo livré — *Fil × Mireille*** (1ᵉʳ **signal de mort**) : nouveau signal `rale`, émis à CHAQUE
    mort par `reap` (retrait centralisé des pièces à hp≤0 ; porte un **snapshot** du défunt car il est
    déjà retiré). Quand **Mireille** meurt, Fil **RALLIE** (`kind: 'ralliement'`, `fromCharacter: 'mireille'`,
    portée escouade) : il se **téléporte** sur la case de Mireille (`PendingReaction.sourceHex`) et reçoit
    `Unit.block` = **immunité TOTALE** (`damageTaken` → 0) `duration: 4` (≈ 3 tours pleins). CD 3
    (cosmétique pour une mort unique, mais **revival-ready**). **1ᵉʳ effet qui vise le POSSESSEUR lui-même**.
    *Refactor associé* : la mort est désormais un **événement de 1ʳᵉ classe** (centralisée dans `reap`,
    appelée par `attack`/`resolveOverwatch`) → un futur **cimetière/réapparition** n'a qu'à consommer la
    liste des défunts (décision de design ajournée : impacte la condition de victoire).
  - **Duo livré — *Fil × Rempart*** (1ᵉʳ **stun**) : quand Rempart (en garde, rayon 2) encaisse et que
    Fil est à portée, Fil arme un **COUP ÉTOURDISSANT** sur Rempart (`kind: 'etourdir'`, `fromCharacter:
    'rempart'`, CD 3) : sa **prochaine attaque** (consommée dans `strike`) **ÉTOURDIT** la cible 1 tour.
    Étourdi = `Unit.stun` → **PA forcés à 0** au prochain tour (`endTurn`) **+ Résonances silencées**
    (`pendingReactions` ignore les étourdis). Effet **à deux temps** : `Unit.stunCharge` (sur Rempart,
    `expiresIn 3`, consommée à l'attaque) → `Unit.stun` (sur la cible). `amount` = durée du stun,
    `duration` = persistance de la charge.
  - **Duo livré — *Fil × Orso*** (INVERSE de Estoc × Orso) : quand le Tir Réservé d'Orso part
    (`tir_reserve`, `fromCharacter: 'orso'`, escouade), **Fil avance d'1 case VERS la cible** touchée
    (`kind: 'ruee'`, gap-closer). CD 2. `provocation` (cible→possesseur) et `ruee` (possesseur→cible)
    partagent le helper `stepToward`. **Fil a ses 4 duos** (Bastion, Mireille, Rempart, Orso).
  - **Duo livré — *Mireille × Bastion*** (1ᵉʳ **Tireur-possesseur** → on remplit l'autre sens de la
    matrice) : quand Bastion (en garde) encaisse, Mireille **SILENCE** l'attaquant (`kind: 'silence'`,
    `fromCharacter: 'bastion'`, escouade, CD 3, `duration: 2`) : il ne peut plus QUE **se déplacer** —
    attaque, **verbes** (garde/tir réservé/riposte), **Résonances** et **élan Némésis** tous coupés.
    « **Stun adouci** » (l'étourdissement gèle tout, le silence laisse marcher). Helper `isSilenced`
    branché dans `canAttack`/`canDefend`/`canReserve`/`canRiposte`/`resolveOverwatch`/`strike`(riposte)/
    `pendingReactions`/`resolveNemesis`.
  - **Duo livré — *Mireille × Estoc*** (1ᵉʳ signal émis par un **DUELLISTE** → ouvre les duos « × Duelliste ») :
    nouveau signal `riposte`, émis dans `strike()` quand la Riposte d'Estoc part ; Mireille la **soutient**
    (`fromCharacter: 'estoc'`, escouade, CD 3) en infligeant **1 dégât** à l'attaquant (réutilise `kind:
    'epines'` — pas de nouvel effet). Effet immédiat. Garde/Riposte exclusifs → `strike` émet au plus un
    signal.
  - **Duo livré — *Mireille × Rempart*** : quand Rempart (en garde) encaisse, Mireille entre en
    **COUVERTURE** (`kind: 'couverture'`, `fromCharacter: 'rempart'`, escouade, CD 3, `duration: 2`) :
    **+1 PA à chaque tour pendant 2 tours** (soutien-soi, statut `Unit.cover` lu au rechargement dans
    `endTurn`, comme `elan` mais persistant).
  - **Duo livré — *Mireille × Fil*** : quand la Riposte de Fil part (`riposte`, `fromCharacter: 'fil'`),
    Mireille l'**APPUIE** (`kind: 'appui'`, « appui-feu », escouade, CD 3, `duration: 2`) : +1 dégât aux
    attaques de Fil pendant 2 tours (statut `Unit.appui` lu dans `strike`). **Mireille a ses 4 duos**
    (Bastion, Estoc, Rempart, Fil) → **sa ligne de matrice est complète**.
  - **UI** : badge `RÉSONANCE ✦ {effet}` (duos dormants masqués) + cooldown (⏳n/prêt) dans les panneaux,
    bouton `?` pour déplier le détail ; statuts subis affichés (marque/estropié/vendetta) sur les pièces.
- **Suite (la matrice se remplit une cellule = un lot validé)** : nouveaux signaux
  (`allie_a_terre`, `pres_de_mourir`…), nouvelles cellules sur pièces existantes, nouveaux
  effets `kind`, puis **spécialistes** (Soigneur/Hallebardier/Saboteur) « nés résonants ».
- **NÉMÉSIS (concept posé le 2026-06-17, à construire)** — *système FRÈRE de la Résonance, mais
  antagoniste*. Comme une escouade = **1 de chaque archétype**, deux héros du **même archétype** sont
  **toujours ennemis** → ils sont **Némésis**. **Automatique** : tout couple même-archétype l'est
  (aujourd'hui Estoc↔Fil, Bastion↔Rempart, Mireille↔Orso ; plus quand le vivier grandit).
  - **Déclenchement** : **tuer son Némésis** → effet sur le **tueur**. « Tuer » = avoir infligé les
    **derniers dégâts** au défunt (`Unit.lastHitBy`), **peu importe la cause** (attaque, tir réservé,
    réaction). Réutilise le signal de mort `rale`.
  - **Nouveau SENS de réaction** (vs Résonance) : la Résonance vise les **alliés** du mort
    (`owner === source.owner`) ; la Némésis vise le **tueur** (un **ennemi** du mort). → 2ᵉ direction
    dans le moteur + **attribution du kill** (`lastHitBy`, brique réutilisable « à l'élimination »).
    Donc **lot FONDATEUR**, pas un simple duo.
  - **Décidé** : (1) kill = derniers dégâts ; (2) Némésis = automatique (même archétype). **AJOURNÉ** :
    l'**effet** (buff permanent ? one-shot ? thématique par couple), et **dirigé vs réciproque**
    (comme les duos). Méthode : commencer petit — poser `lastHitBy` + **1** effet (ex. Estoc tue Fil) — puis généraliser.
  - **Lot 1 LIVRÉ (2026-06-17) — `Unit.lastHitBy`** : posé à CHAQUE point de dégât réel (>0) — `strike`
    (coup + riposte), `resolveOverwatch`, réaction `epines`. Au décès, le tueur = `lastHitBy` (porté par le
    snapshot `rale`). Pur, sans incidence en jeu ; brique réutilisable « à l'élimination ».
  - **Lot 2 LIVRÉ (2026-06-17) — déclencheur Némésis + effet ÉLAN** : `resolveNemesis` dans `reap` (à
    côté de `rale`) — si le tueur (`lastHitBy`) est du **même archétype** ennemi → l'**ÉQUIPE** du tueur
    gagne `Unit.elan` = **bonus de PA au PROCHAIN tour** (consommé au rechargement dans `endTurn`).
    **Échelle sur la robustesse du tué** : `bonus = max(1, round(maxHp/8))` → Tireur(7)/Duelliste(9) **+1**,
    Lourde(16) **+2** (réutilise l'axe portée+robustesse=5 ; future-proof pour stats sur-mesure). **Durée 1
    tour** (pic d'élan, anti-snowball). **CD 2** sur le tueur (`cooldowns.nemesis`, cosmétique tant que mort
    unique mais **revival-ready** : anti-farm). UI : badge `⚡ Élan`. **Calibrage : effet UNIFORME** (PA),
    seule la magnitude varie ; faire varier l'**effet par archétype tué** = enrichissement futur (quand un
    mode de jeu existera pour l'ancrer). **RÉSURRECTION non construite** (design déjà res-safe : temporaire
    + échelonné) ; **question ouverte notée** : re-tuer son Némésis re-déclenche-t-il ? (le CD laisse le choix).
- **REVUE DE CONCEPTION — points retenus (2026-06-16)** : forces du système = fort effet de levier
  (on n'écrit que les cellules utiles), profondeur de draft (synergies mutuellement exclusives →
  « pas d'escouade strictement meilleure »), couches nettes (`kind`/`ReactionSpec`/roster). Points
  de vigilance et décisions associées :
  1. **Signaux = vrai facteur limitant.** Un duo n'existe que si une **action** émet un signal
     (aujourd'hui 2 : `garde_encaissee`, `tir_reserve`). Élargir le vocabulaire est une **décision
     active** à chaque nouveau type de déclencheur (riposte, double-frappe, soin, allié à terre…),
     pas un sous-produit gratuit du façonnage. *Contexte* : concentration tank/tireur actuelle =
     on n'a fait que les 2 duellistes pour l'instant.
  2. **Équilibrage par PLAYTEST**, au niveau **matchup/draft** (héros uniques fieldés une fois →
     asymétrie structurelle assumée). Pas d'équilibrage cellule par cellule en amont ; le test est
     indispensable, pas optionnel.
  3. **Lisibilité — lot UI LIVRÉ** : icônes d'état **sur la pièce du plateau** (postures + statuts
     de Résonance, rangée au-dessus du pion) + **tooltip au survol** (`<title>` SVG natif, via
     `pieceStates`/`pieceTitle`) décrivant nom/PV + chaque état actif.
  4. **État caché OK si affichage parlant** (précédent Divinity assumé).
  5. **« Duo » = arête DIRIGÉE** aujourd'hui (le possesseur réagit au signal du partenaire). La
     **réciprocité émerge** en remplissant les deux sens de la matrice → cap : matrice dense quand
     tous les héros auront toutes leurs Résonances.

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
