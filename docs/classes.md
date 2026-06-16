# Classes de pièces

Référence vivante des archétypes. Source de vérité du code : `src/engine/pieces.ts`
(registre `ARCHETYPES`, dérivation `profileFor`, fabrique `makeUnit`).

## Calibrage — la droite « portée + robustesse = 5 »

Une pièce *sur la droite* est définie par un seul levier : son palier de **portée**
`r ∈ {1,2,3,4}`. On pose `t = 5 − r` (palier de robustesse/puissance), d'où :

```
maxHp = 4 + 3·t      damage = 1 + t      attackCost = 2
```

| r | t | PV | dégâts | coût attaque |
|---|---|----|--------|--------------|
| 1 | 4 | 16 | 5 | 2 |
| 2 | 3 | 13 | 4 | 2 |
| 3 | 2 | 10 | 3 | 2 |
| 4 | 1 | 7  | 2 | 2 |

Principe : aucune pièce n'est strictement meilleure — courte portée = encaisse et frappe
fort mais doit s'approcher ; longue portée = frappe à l'abri mais fragile. Tout est positionnel.

### Pièces hors-droite

Certaines pièces **cassent** ce calibrage volontairement, via le hook
`profile?: Partial<Profile>` de l'archétype : `makeUnit` applique
`{ ...profileFor(rangeTier), ...archetype.profile }`. La portée reste prise sur la droite ;
seuls les champs surchargés (PV, dégâts, coût) dévient. Voir le **Duelliste**.

## Verbes (capacités)

Les capacités sont des **verbes** portés par la pièce ; leurs **nombres** vivent sur la pièce
(personnalisables perso par perso). Une pièce sans le verbe ne peut pas l'employer.

- **Garde** (`guard`) — verbe « se défendre », propre aux CAC. Dépense des PA pour réduire
  les dégâts subis jusqu'au début de son prochain tour. (Lourde : 3 PA → ×0.5.)
- **Tir réservé** (`overwatch`) — verbe « réflexe », propre aux pièces à distance. Dépense
  des PA pour armer un tir qui part quand un ennemi s'arrête à portée. (Tireur : 3 PA.)
- **Riposte** (`riposte`) — verbe « contre », atypique (Duelliste). Miroir mêlée du tir
  réservé : dépense des PA pour armer un contre qui part quand un ennemi **adjacent l'attaque**
  (et qu'elle survit au coup). Le contre rend les dégâts propres de la pièce, puis la posture
  est consommée. Un attaquant **à distance n'est pas contré**. (Duelliste : 2 PA.)

## Réactions en chaîne (synergies d'escouade)

Au-delà des verbes actifs, des **passifs** font **communiquer les pièces** : un événement de
combat émet un **signal typé**, les alliés dont un passif **écoute** ce signal **réagissent** —
et l'effet peut dépendre de **qui** a déclenché (archétype de la source). On obtient ainsi une
**matrice « possesseur × déclencheur »** qui *émerge* (on n'écrit que les cellules utiles, jamais
les N²). Source de vérité : `resolveReactions`/`pendingReactions` dans `engine/combat.ts`.

Garde-fous (déterminisme + terminaison, esprit échecs) :
- **Lisibilité** : tout est déterministe et **pré-visualisable** — `previewReactions` rejoue la
  frappe sans la committer ; l'UI annonce la cascade avant le coup.
- **Portée** par réaction : `scope = { radius: n }` (rayon autour de la source) ou `{ squad: true }`
  (toute l'escouade — réservé aux rares passifs « commandement »).
- **Cooldown** par passif (en tours du possesseur), décompté à `endTurn`.
- **Terminaison** : file FIFO bornée + « un passif au plus une fois par cascade ».

**Première cellule livrée** — *Épines relayées* (Duelliste) : quand un allié **en garde** (rayon 2)
**encaisse** un coup, le Duelliste **pince l'attaquant** ; dégâts selon la source (Lourde → 2,
défaut 1), CD 2 tours. À terme, `overwatch` et `riposte` passeront par ce même canal.

## Effectif déployé (hotseat)

Équipe **visée : 4 pièces/camp**. Composition cible : **Lourde + Tireur + Duelliste + Soigneur**.
Les archétypes du registre non déployés restent « en réserve », prêts à permuter.

| Classe | Clé | Glyphe | Portée | PV | Dégâts | Coût att. | Verbe | Statut |
|--------|-----|:------:|:------:|:--:|:------:|:---------:|-------|--------|
| Lourde | `lourde` | L | 1 | 16 | 5 | 2 | Garde | **déployée** |
| Tireur | `tireur` | T | 4 | 7 | 2 | 2 | Tir réservé | **déployée** |
| Duelliste | `duelliste` | D | 1 | 9 | 2 | **1** | Riposte | **déployée** |
| Soigneur | `soigneur` | S | 2 | ~ | ~ | ~ | Soin | *à venir (Lot 1)* |
| Hallebardier | `hallebardier` | H | 2 | 13 | 4 | 2 | Repousser | *réserve (Lot 2)* |
| Saboteur | `saboteur` | Sa | ~ | ~ | ~ | ~ | Surface | *réserve (Lot 3)* |

### Duelliste (hors-droite)

Mêlée (portée 1) comme la Lourde, mais **fragile et qui gratte** (PV 9, dégâts 2) — en
échange, son attaque ne coûte que **1 PA**, donc elle peut **frapper deux fois par tour**.
Rôle : escarmouche / harcèlement. Verbe signature : **Riposte** (2 PA) — punit quiconque
vient la frapper au corps-à-corps, ce qui force l'adversaire à la traiter avec respect ou à
la cueillir à distance.

## Feuille de route des spécialistes

Trois spécialistes définis chacun par un **verbe inédit**, livrés un lot à la fois (chaque
lot : tests + gates verts + déploiement) :

1. **Soigneur** — verbe `heal` : dépense des PA pour rendre des PV à un allié adjacent.
   Calque le patron `guard`/`overwatch` ; ouvre l'axe support. *4ᵉ pièce déployée.*
2. **Hallebardier** — primitive de **déplacement forcé** (Repousser : recule la cible d'1
   case si libre). Contrôle de zone / positionnement.
3. **Saboteur** — sous-système **surfaces** : pose un état dangereux sur une tuile, résolu en
   dégâts de zone. Amorce l'axe « surfaces » de la direction Divinity.
