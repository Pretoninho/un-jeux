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

## Feuille de route — priorités (décidé 2026-06-18)
> Ordre de travail validé. Méthode inchangée : **un lot = une cellule validée** (proposer → valider → coder → gates verts).
1. **Terminer les Résonances des autres personnages** — ✅ **matrice des possesseurs PLEINE** : les 6 héros
   (Estoc, Fil, Mireille, Orso, Bastion, Rempart) ont leur rangée complète (4 duos). **RÉCIPROCITÉ = ACQUISE
   (constat 2026-06-18)** : remplir toutes les rangées a *mécaniquement* rempli **les deux sens de chaque
   arête** — 12 arêtes inter-archétypes × 2 sens = 24 duos dirigés = 6 héros × 4 partenaires (aucun sens ne
   manque). Suite possible : **(a)** passe de **cohérence de paire** (que les deux sens d'une arête racontent
   *une* histoire — polish, **après playtest**) ; **(b)** élargir le **vocabulaire de signaux**
   (`allie_a_terre`, `pres_de_mourir`, double-frappe, soin…) — le **vrai levier de densité** (aujourd'hui un
   possesseur ne réagit à son partenaire que dans 3 postures : garde encaissée / tir réservé / riposte).
   *Rappel garde-fou* : un duo n'existe que si le partenaire **émet un signal** (cf. revue de conception, pt 1).
2. **Création de nouveaux personnages** — enrichir le **vivier plat** (`CHARACTERS`), un héros à la fois
   (procédé : `docs/personnages.md`). Inclut les **spécialistes** en réserve (Soigneur = 4ᵉ archétype visé,
   Hallebardier/Saboteur) « nés résonants ».
3. **Némésis — découpler la rivalité de la composition** via `isNemesis` + couche de données (détail dans la
   sous-section NÉMÉSIS ci-dessous). Prérequis logique des deux premiers : plus le vivier est riche, plus le
   découplage + le draft libre prennent leur sens.

## Garde-fous techniques
- Avant de livrer : `npm test`, `npm run check`, `npm run build` doivent passer.
- Moteur = modules purs et immuables (aucune dépendance DOM), testables sans navigateur.

## État du jeu (décisions de design en vigueur)
- **Modes locaux : hotseat OU vs IA** (décidé/livré 2026-06-18) — choisis sur l'**écran de pré-partie**
  (setup). Hotseat = Alice et Bob à tour de rôle ; vs IA = **Alice = toi, Bob = IA** (3 niveaux). Pas
  encore de multijoueur en réseau.
- **Écran de pré-partie (setup) LIVRÉ (2026-06-18)** — `phase: 'setup' | 'combat'` dans `CombatView`,
  démarrage sur le setup. On y choisit : **plateau** (Entraînement/Partie), **adversaire** (Hotseat /
  vs IA + niveau), et **ton escouade** (1 héros par archétype). Vivier à **2 héros/archétype** → choisir
  tes 3 héros **détermine** ceux de l'adversaire (les complémentaires, `complementOf`). `initialFor(geo,
  alice, bob)` déploie les deux escouades choisies. Boutons : « Recommencer » (même config), « ⚙ Nouvelle
  partie » (revient au setup). *Le vrai draft libre (2 sens, équité) reste ajourné — cf. Némésis.*
- **Plateau = octogone, deux tailles (décidé 2026-06-18)** : on quitte le toggle forme et on
  passe **tout en octogone**. Le sélecteur est désormais un **MODE** :
  - **🎓 Entraînement** = petit octogone **`OCTA_TRAIN = 9`** (145 cases) — plateau resserré, sert
    le **tuto jouable** (forcé dessus) et la practice. **Démarrage par défaut** au chargement.
  - **⚔ Partie** = grand octogone **`OCTA_GAME = 23`** (1013 cases : `n² + (n-1)²`) — board
    volontairement vaste (priorité = plus d'octogones), centre dégagé réservé aux futurs camps/objectifs.
  - L'**hexagone** (`makeBoard`) reste dispo (cf. toggle de forme ci-dessous).
- **TOGGLE DE FORME (RÉ-OUVERT 2026-06-18) — comparaison octogone / hexagone / carré** : on **réfléchit
  à changer de forme** (octogone actuel vs hexagone vs carré). Comme le moteur est **agnostique à la
  forme** (il ne lit que `neighbors`), c'est un choix **présentation/topologie** sans toucher au combat.
  Sélecteur **`shape: 'octa' | 'hex' | 'square'`** dans le **setup** ET dans les contrôles en combat
  (bascule live → `setShape`, redéploie). `SIZE[shape][mode]` donne la taille (entraînement/partie) par
  forme. **Carré = `makeSquareBoard(n)`** (engine pur, testé) : grille n×n, **voisinage 8 directions**
  (déplacement « roi » diagonales = 1 pas, esprit échecs/Divinity). **Le tuto reste forcé sur l'octogone.**
  *Décision finale de forme = AJOURNÉE (comparaison au feeling : portées/kiting/lisibilité).* Rappel :
  l'octogone garde son **grand centre dégagé** (futurs camps/objectifs) ; hex = adjacence uniforme
  (distances non-ambiguës) ; carré = familier mais diagonale « gratuite ».
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
- **Lisibilité du combat (LIVRÉ 2026-06-19)** : (1) **flèche d'attaque transitoire** sur le board
  (origine → cible, couleur du camp attaquant, halo sur la victime, fondu ~1,5 s) — couvre attaque
  directe, **tir réservé** et coups de l'IA (`attacks`/`flashAttack`/`flashOverwatch`, markers SVG) ;
  (2) **Journal** (encart scrollable à droite) : 1 ligne/action (déplacement, `⚔ atk → def`, verbes,
  morts, séparateurs de tour), **dégâts/morts calculés par DIFF d'état** (robuste : capture aussi tir
  réservé + Résonances). Vidé au restart ; **annulation** synchronisée (`logMarks`). IA & tuto journalisés.

## Classes, verbes & Résonance (avancement — détail : `docs/classes.md`)
> **Créer un personnage : processus pas-à-pas → `docs/personnages.md`.**
> **Créer une Résonance (duo) : procédé + référence des clés → `docs/resonances.md`.**
- **Calibrage « portée + robustesse = 5 »** (`engine/pieces.ts`, `profileFor`) : une pièce
  *sur la droite* est définie par son seul palier de portée `r∈{1..4}`, `t=5−r` → `maxHp=4+3t`,
  `damage=1+t`, `attackCost=2`. Aucune pièce strictement meilleure, tout est positionnel.
- **Pièces hors-droite** : hook `Archetype.profile?: Partial<Profile>` → `makeUnit` fusionne
  `profileFor(rangeTier)` + override (la portée reste sur la droite).
- **Axe MOBILITÉ (séparé de la droite) — `moveCap` (livré 2026-06-18)** : plafond de **pas/tour**
  indépendant des PA (les attaques restent payées sur les PA pleins). `Unit.moveCap`/`Unit.moved`
  (pas faits ce tour, remis à 0 à `endTurn`). **La Lourde est LENTE (`moveCap: 3`)** → le Tireur
  (4 pas) peut enfin **kiter** (rééquilibrage de la mêlée sans toucher au calibrage portée/robustesse).
  1ᵉʳ levier du triangle anti-mêlée (cf. plus bas).
- **DÉPLACEMENT DÉCOUPLÉ DES PA (livré 2026-06-18)** — *bug constaté : le buff `charge` des Lourdes
  était inerte car les PA bridaient le mouvement avant le `moveCap`*. Correctif : **marcher ne coûte
  plus de PA** (`moveUnit` ne touche plus à `ap`) ; le déplacement est gated **uniquement** par le
  `moveCap` → `moveBudget = max(0, (moveCap + haste) − moved − estropie)` (plus aucun terme `ap`).
  Les **PA ne paient que les attaques + verbes** (garde/tir réservé/riposte/futur soin). **Garde-fou**
  (sinon les pièces sans `moveCap` bougeraient à l'infini) : `DEFAULT_MOVE_CAP = 4` (= ancien plafond
  PA implicite) + **Tireur & Duelliste passent à `moveCap: 4` explicite** → comportement préservé
  (4 = ancien mur PA). **`estropie` (`cripple`) redirigée** du pool PA vers le budget de déplacement
  (enfin cohérente avec son libellé « − déplacement »). **Conséquences** : (1) une pièce peut **bouger
  ET agir** le même tour ; (2) la **charge** (`haste +2`) atteint enfin son plein effet (cap 3→5, plus
  bridé) → les deux leviers « mobilité » des Lourdes deviennent lisibles ; (3) le **Duelliste** est le
  plus renforcé (déplacement plein + jusqu'à 4× attaque à 1 PA) → **curseur à surveiller au playtest**
  (levier : son `moveCap`/ses PA). La promesse « `moveCap` indépendant des PA » est désormais **réellement** tenue.
- **Verbes** (capacités à nombres personnalisables, portés par la pièce) :
  - **Garde** (`guard`, CAC) — Lourde : 3 PA → ×0.5 dégâts subis.
  - **Tir réservé** (`overwatch`, distance) — Tireur : 3 PA, réflexe à l'arrivée d'un ennemi.
  - **Riposte** (`riposte`, atypique Duelliste) — 2 PA : contre un attaquant **adjacent** qui
    le frappe (s'il survit) ; miroir mêlée du tir réservé ; résolu dans `attack()`.
  - **Soin** (`heal`, support — Soigneur) — 3 PA → **+4 PV** à un allié à ≤2 cases, **plafonné
    au `maxHp`** (`canHeal`/`healUnit`). 1ᵉʳ verbe qui vise un AUTRE et qui **augmente** les PV.
    **Burst payé** (instantané). Soin PUR (n'inflige/ne pose rien d'autre).
- **SOIGNEUR — 4ᵉ archétype LIVRÉ (2026-06-18, EN RÉSERVE)** : support « **pur soin** » (sur-droite
  **tier 3** : portée 3 / PV 10 / dégâts 3, `moveCap: 4`). **IDENTITÉ DE RANGÉE = PUR SOIN** : son
  verbe ET toutes ses Résonances ne font QUE soigner — **jamais** de contrôle/dégâts/buff offensif
  (≠ Lourde=mobilité, Tireur=contrôle, Duelliste=burst). **3 facettes du soin** : (1) verbe **Soin**
  (burst payé) ; (2) effet réactif **`regen`** = statut `Unit.regen` (HoT) qui rend `+amount` PV **au
  rechargement** pendant `duration` tours (plafonné, tické à `endTurn`) ; (3) effet réactif **`soin`** =
  soin **instantané** (+amount PV plafonné, posé tout de suite) — (2) et (3) visent l'allié **SOURCE** du
  signal. **EN RÉSERVE** : présent dans `CHARACTERS`/`ARCHETYPES` mais **PAS dans les `SLOTS`** de
  l'escouade par défaut (non fieldable, IA/fielding différés ; libellés/glyphe UI `regen`/`soin` posés).
  **2 héros (paire), rangées PLEINES + DISTINCTES** : **Baume** = **`regen`** × 7 (régén étalée, +2×2) ;
  **Mélisse** = **`soin`** × 7 (burst instantané, +4) — *Baume soigne dans la durée, Mélisse recolle d'un
  coup* (miroir burst/sustain, comme Bastion/Rempart pour la charge). → **Némésis Soigneur↔Soigneur
  (Baume↔Mélisse) ACTIVE** automatiquement (déclencheur `kind===kind` déjà générique, 0 code ; élan = `round(10/8)=1`).
  *Stats/nombres à affiner au playtest.*
- **Effectif** : escouade par défaut = Lourde + Tireur + **Duelliste** (3/camp). Le **Soigneur** (4ᵉ
  archétype) est **créé mais en réserve** (pas encore dans l'escouade — passage à 4 = lot ultérieur).
  Exotiques (Hallebardier/Saboteur) toujours en réserve. Le **Duelliste** est hors-droite (PV 9,
  dégâts 2, **attaque 1 PA** → frappe deux fois/tour).
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
  - **⚠️ MODÈLE RÉVISÉ — « UN POSSESSEUR = UN EFFET » (décidé/livré 2026-06-18)** — *durcissement du
    « thème de rangée »* : on **abandonne la variété par-duo** au profit de la **lisibilité**. Chaque
    héros-possesseur porte désormais **UN SEUL `kind`**, le **même pour TOUS ses duos** ; le partenaire
    ne change que le **déclencheur** (le signal qu'il émet : `garde_encaissee`=Lourde, `tir_reserve`=Tireur,
    `riposte`=Duelliste). L'effet **EST** l'identité du possesseur. Roster homogénéisé : **Estoc=`epines`,
    Fil=`vendetta`, Mireille=`silence`, Orso=`racine`, Bastion/Rempart=`charge`, Flèche=`marquage`,
    Baume=`regen`**. Conséquences : *Fil × Mireille* (jadis `ralliement`/mort) rebranché sur `tir_reserve`
    (→ `vendetta`) — la mécanique « mort→ralliement » est **retirée du roster** (effet conservé dans le
    moteur, réutilisable). Les effets `marquage`(Estoc)/`estropier`/`provocation`/`couverture`/`appui`/
    `etourdir`/`ruee` ne sont **plus câblés** au roster (restent dans le moteur). **⚠️ Les descriptions
    par-duo détaillées ci-dessous (Estoc×Mireille=marque, Fil×Rempart=étourdir, etc.) sont OBSOLÈTES** :
    seul compte désormais « possesseur → son effet unique ».
  - **Mélisse (2ᵉ Soigneur) n'a PLUS de Résonance** (`reactions: []`) — on lui en créera une (lot à venir).
  - **MATRICE COMPLÉTÉE pour les nouveaux héros (2026-06-18)** — les rangées de **Flèche** et **Baume**
    (jadis 1 seul duo × Bastion) sont remplies avec leur effet unique : **Flèche = `marquage` × 4**
    (Bastion, Rempart, Estoc, Fil — ses partenaires Lourdes + Duellistes) + **réciproques × Flèche**
    (Bastion/Rempart `charge`, Estoc `epines`, Fil `vendetta`, sur le `tir_reserve` de Flèche) ; **Baume
    = `regen` × 7** (Bastion, Rempart, Mireille, Orso, Flèche, Estoc, Fil = TOUS les non-Soigneurs).
    **ASYMÉTRIE assumée — le Soigneur est POSSESSEUR-ONLY** : il n'émet **aucun signal** (Soin = burst,
    `regen` = statut) → **personne ne peut avoir un duo « × Baume/Mélisse »** tant qu'un soin n'émet pas
    de signal (levier futur si on veut la réciprocité). Mélisse reste vide.
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
  - **Duo livré — *Orso × Bastion*** (1ᵉʳ façonnage d'Orso ; **1ᵉʳ effet de l'axe mobilité**) : quand
    Bastion (en garde) encaisse, Orso **ENRACINE** l'attaquant (`kind: 'racine'`, `fromCharacter: 'bastion'`,
    escouade, CD 3, `duration: 2`) : son **déplacement tombe à 0** (attaques/verbes intacts ; `moveBudget` → 0
    via `Unit.root`, décompté à `endTurn`). « **Silence de mobilité** » (miroir du silence : le silence coupe
    tout sauf le déplacement, l'enracinement coupe le déplacement seul). **Contre direct de la mêlée** : un
    bruiser qui frappe ta Lourde se retrouve cloué → ton Tireur kite, l'escouade focus/désengage.
  - **Duo livré — *Bastion × Mireille*** (1ᵉʳ façonnage de Bastion ; **3ᵉ côté du triangle anti-mêlée**) :
    quand le Tir réservé de Mireille part (`tir_reserve`, `fromCharacter: 'mireille'`, escouade), Bastion
    gagne une **CHARGE** (`kind: 'charge'`, auto-buff, amount 2, `duration: 1`, CD 3) : **+2 à son plafond de
    déplacement** pour son prochain tour (statut `Unit.haste` lu dans `moveBudget`, décompté à `endTurn`) →
    la Lourde lente (3) **s'engage à pleine vitesse** quand la Tireuse ouvre le feu. **L'axe mobilité a
    maintenant ses deux signes** : malus (`cripple`/`racine`) ↔ bonus (`haste`/`charge`).
  - **Rangées Orso, Bastion & Rempart COMPLÉTÉES (2026-06-18) → matrice des POSSESSEURS pleine** — 10 duos
    ajoutés (effets/signaux existants, pures cellules). **Orso (Tireur, contrôle)** : ×Rempart (`estropier` 2,
    garde), ×Estoc (`estropier` 1, riposte), ×Fil (`racine`, riposte). **Bastion (Lourde, mobilité-ÉCLAIR)** :
    ×Orso (tir réservé), ×Estoc & ×Fil (riposte) → `charge` +2 **1 tour**. **Rempart (Lourde, mobilité
    SOUTENUE)** : ×Mireille & ×Orso (tir réservé), ×Estoc & ×Fil (riposte) → `charge` +2 **2 tours** (les deux
    Lourdes partagent le thème mais diffèrent : Bastion = burst, Rempart = prolongé). **Les 6 héros ont leur
    rangée complète (4 duos)** → **RÉCIPROCITÉ ACQUISE** : les 12 arêtes inter-archétypes ont leurs **deux
    sens** remplis (24 duos dirigés = 6 × 4). Plus aucun sens à remplir ; suite = cohérence de paire (polish)
    ou nouveaux signaux / nouveaux héros (cf. feuille de route, pt 1).
  - **THÈME DE RANGÉE — identité par possesseur (orientation 2026-06-18)** : pour rendre la matrice lisible
    et créer un gabarit de héros, chaque archétype-possesseur porte un *thème* — **Lourde = mobilité/charge**
    (`charge` → +déplacement, posé chez Bastion), **Tireur = contrôle** (ralentir `estropier` / enraciner
    `racine`, posé chez Orso), **Duelliste = burst** (`marquage` → bonus dégâts, déjà chez Estoc). Sert le
    **rééquilibrage anti-mêlée** (« triangle » LIVRÉ : `moveCap` Lourde lente + contrôle Tireur + charge
    Lourde conditionnelle). **Toutes les rangées de possesseur sont remplies** (Estoc/Fil/Mireille/Orso/
    Bastion/Rempart, 4 duos chacun).
  - **UI** : badge `RÉSONANCE ✦ {effet}` (duos dormants masqués) + cooldown (⏳n/prêt) dans les panneaux,
    bouton `?` pour déplier le détail ; statuts subis affichés (marque/estropié/vendetta/enraciné) sur les pièces.
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
  - **DÉCOUPLAGE DRAFT (orientation 2026-06-18, à construire)** — *promouvoir Némésis d'effet ÉMERGENT
    (dérivé de l'invariant « escouade = 1 de chaque archétype ») à RELATION DÉCLARÉE*, pour qu'un draft
    libre (et de nouveaux archétypes) garde la mécanique. **Constat** : le moteur n'impose déjà rien — le
    déclencheur `killer.kind === dead.kind && owner !== owner` est agnostique à la composition ; ce qui est
    couplé, c'est le **récit méta** (« deux mêmes archétypes sont *toujours* ennemis » repose sur 1-de-chaque)
    et l'**équité par miroir**. **Plan** : introduire un prédicat pur `isNemesis(killer, dead)` (camps opposés
    ET rivalité *authored*), résolu depuis une **petite couche de données** à deux granularités — (1) règle
    **par archétype** par défaut (**rétro-compatible** : garde Bastion↔Rempart, Estoc↔Fil… sans rien réécrire),
    (2) paires **explicites** héros/thématiques (`Character.nemesis?: { kinds?; characters? }`) pour rivalités
    **inter-archétypes** (futur Saboteur↔Soigneur…). `resolveNemesis` appelle `isNemesis` au lieu de
    `kind===kind` (**1 ligne**, comportement actuel = règle archétype par défaut). **Débloque le draft libre** :
    « pas de rival en face → Némésis **dormant** » devient un **levier de draft** (drafter un contre *active* le
    bonus), l'**équité migre au draft**. **Cap symétrique** : `NemesisSpec` par paire (effet propre) = **matrice
    jumelle** de la Résonance (Résonance vise les alliés du mort ; Némésis vise le tueur) ; `lastHitBy` est
    **déjà** la brique d'attribution générale, composition-agnostique → rien à refaire de ce côté.
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
  5. **« Duo » = arête DIRIGÉE** (le possesseur réagit au signal du partenaire). La **réciprocité émerge**
     en remplissant les deux sens de la matrice → **ATTEINTE le 2026-06-18** : toutes les rangées pleines ⇒
     24 duos dirigés = 12 arêtes × 2 sens (chaque héros = 4 partenaires). La densité *restante* ne passe plus
     par « remplir des sens » (il n'en manque aucun) mais par **(a)** la cohérence de chaque paire (les deux
     sens forment-ils *une* histoire ?) et **(b)** de **nouveaux signaux** (une paire n'interagit qu'en garde
     encaissée / tir réservé / riposte — élargir le vocabulaire ouvre de nouvelles interactions).

## IA / adversaire (avancement)
- **CERVEAU LIVRÉ (lot 1, 2026-06-18)** — `engine/ai.ts`, **module pur** (0 DOM, déterministe, testé
  `engine/ai.test.ts`). **Aucun câblage UI** pour l'instant → **rien ne change en jeu** (pas importé
  dans `CombatView`). On valide d'abord la qualité de jeu isolément.
  - **API** : `planTurn(state, level): AiAction[]` (suite d'actions, terminée par `endTurn` → rejouable
    une par une pour un futur **auto-play animé**) ; `applyAction(state, action, apPerTurn)` (dispatcher
    fidèle au jeu : un `move` déclenche `resolveOverwatch`, un `attack` résout riposte + Résonances) ;
    `playTurn(state, apPerTurn, level)` (= repli du plan).
  - **Stratégie** : **greedy 1-ply** — énumère les actions légales du camp actif, les **score en simulant**
    sur le moteur pur (matériel : `vie + PV`, un kill ≫ un coup ; + terme positionnel de rapprochement
    via un champ de distance multi-source), joue la meilleure, recommence ; `endTurn` quand plus rien ne
    vaut le coup. Borné (`MAX_ACTIONS`) → terminaison garantie. **Pas de hasard** (départage par ids).
  - **3 niveaux sélectionnables** (`Difficulty = 'facile' | 'normal' | 'difficile'`, mêmes règles, finesse
    croissante via `Brain`) : **Facile** = aveugle au tir réservé (fonce dans l'overwatch), pas de verbes,
    score d'attaque naïf (ignore ripostes/contres subis) ; **Normal** = anticipe l'overwatch, **se met en
    garde / réserve son tir** à propos, trade lucide ; **Difficile** = Normal **+** conscient des
    **Résonances** (`previewReactions`) → **évite de frapper dans la garde/riposte adverse** **+** protège
    ses pièces exposées/entamées.
  - **Calibrage = PLAYTEST** (constantes en tête de fichier : `ALIVE/HP_W/CLOSE_W/GUARD_VALUE/…`).
  - **Lot 2 CÂBLÉ (2026-06-18)** : mode « **vs IA** » dans `CombatView` (choisi au setup, Alice = toi,
    Bob = IA, niveau réglable). `finishTurn` déclenche `runAiTurn` quand la main passe à Bob : on **planifie
    tout le tour** (`planTurn`, pur) puis on **rejoue les actions une par une** (`applyAction`) avec un délai
    (`AI_STEP_MS`) → auto-play **animé**. Entrées humaines **gelées** pendant (`aiThinking` : `reach`/verbes/
    `onHex`/boutons coupés). `cancelAi` purge le timer à chaque reset (restart/setMode/nouvelle partie). Le
    **tuto** garde son adversaire scripté (pas l'IA).

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

## Structure du site — landing + pages (orientation, à faire plus tard)
- **GitHub Pages n'est PAS bloquant** pour un site bien structuré (landing + plusieurs pages) :
  un site multi-pages = des fichiers **statiques**, exactement ce que Pages sert. Ce que Pages
  interdit, c'est le **code serveur à la requête** (SSR dynamique, BDD, auth, API) — mais une
  landing + des pages de contenu n'en ont pas besoin : tout se **pré-rend** en HTML à la build.
- **Contraintes Pages à garder en tête** : (1) tout statique → pas de backend (le multi réseau,
  lui, en aura un — cf. section Multijoueur ; indépendant de la structure) ; (2) sous-chemin
  **`/un-jeux/`** (project page) → liens/routeur doivent en tenir compte (un **domaine perso**
  via `CNAME` supprime le préfixe) ; (3) **deep-links** : un routing **client `history`** (URLs
  propres) renvoie un 404 à l'accès direct → astuce `404.html → index.html` ; les approches
  **pré-rendues** ou **multi-HTML** n'ont pas ce souci.
- **3 options** (stack actuelle : Vite + Svelte 5, une seule `index.html`, **pas** de routeur) :
  - **A — Vite multi-pages (MPA)** : plusieurs `.html` en entrée (`index.html` = landing,
    `jeu.html` = le jeu, `about.html`…) via `rollupOptions.input`. **Effort faible**, `CombatView`
    et le moteur intacts, zéro routeur, workflow inchangé. → pour **« landing + 2-3 pages »**.
  - **B — Routeur client** dans le SPA actuel (hash-routing pour éviter le 404). Effort faible/moyen,
    1 seule app mais **pas de pré-rendu** (SEO landing plus faible).
  - **C — Migrer vers SvelteKit + `adapter-static`** : routing par fichiers, **pré-rendu** (HTML
    par page), layout/nav partagés. **Effort moyen**, 100 % statique → Pages OK. Le **moteur TS pur**
    se porte tel quel, `CombatView` devient une route (`/jeu`), les `docs/*.md` peuvent alimenter des
    pages. → pour un **site qui s'étoffe** (devlog, docs personnages/classes, SEO).
- **Reco** : **A** si peu de pages (rapide, rien ne bouge) ; **C** si ambition de site pérenne.
  Aucune option ne touche au jeu (moteur + vue de combat intacts) — on n'ajoute qu'une **coquille
  de site** autour. **Décision ajournée** : trancher A vs C au moment de définir l'arborescence
  (quelles pages : landing, à-propos, personnages/devlog…).

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
