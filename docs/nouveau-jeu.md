# Nouveau jeu — règles du prototype (état réel)

> Référence des mécaniques qui **tournent réellement** dans le nouveau jeu (`src/engine/` +
> `src/GameView.svelte`). À tenir à jour avec le code. Le journal de conception détaillé est dans
> `.claude/design-progress.md`. Dernière mise à jour : 2026-06-15 — v1.42.
>
> ⚠️ L'ancien jeu (cadre finance : fragility/crisis/regime/credit) reste **runnable comme référence**
> (lien « ancien jeu → » dans l'UI) mais n'a **rien à voir** avec ce nouveau jeu, bâti sur `GameStateV2`.

## En une phrase

Un jeu de territoire **zéro-sum** : tu possèdes des hexes qui crachent un **revenu/tour**, tu portes une
**dette** (camp de base) dont la **charge** te ronde chaque tour, et tu prends les hexes adverses en
**payant le prix de sortie** que leur propriétaire a publiquement déclaré (carnet d'ordres). **Le plus
riche en valeur nette à la fin gagne**, ou fais couler les autres.

## La boucle

```
Hexes d'income        → revenu/tour (+ prime d'agglomération si voisins du même proprio)
Camp de base + hexes  → charges/tour = charge de dette + upkeep × hexes d'income
revenu − charges      → net/tour → ajouté au cash
cash < 0 après le tour → FAILLITE (hexes libérés, dette effacée)
```

**Tension income/charge** : chaque hex rapporte un revenu (6) et coûte un upkeep (3) → ratio unitaire
**2:1**. Le **camp de base** (QG sans income mais qui charge) tire le ratio **sous 1 en début de partie**
→ on démarre sous l'eau, ce qui **force l'acquisition du 1ᵉʳ hex d'income**. Le ratio est affiché en jeu.

## Les pièces

### Hexes = revenus (rares, avec upkeep)
- Un hex = **une place**, **un seul occupant** (pas de partage).
- Carte = hexagone **rayon 3 = 37 hexes**. Les **hexes à income sont RARES** : seule une fraction
  (`incomeFraction` ≈ **0.5**) produit un revenu (base 6) ; les autres sont **stériles** (0 revenu,
  non achetables, cases grises). Placement **symétrique** (rotation 180°) → plateau équitable, **seedé**
  (un plateau différent à chaque partie). La rareté rend chaque hex à income **disputé** (éviction).
- **Agglomération** : chaque hex adjacent appartenant au **même** propriétaire ajoute une prime
  (`agglomerationBonus`, +2) → un cluster contigu rapporte plus que des hexes dispersés.
- **Upkeep** : chaque hex d'income possédé coûte `hexUpkeep` (**1**) par tour. Avec la rareté, on possède
  peu d'hexes → c'est surtout la **charge du camp de base** qui porte la tension (ratio réalisé ~1.2, très
  tendu) ; l'upkeep reste un coût léger par case.

### Acquisition d'un hex libre
- Prix = `base × claimMultiple` (6 × 4 = **24**), payé en cash.
- À l'achat, **le carnet d'ordres s'ouvre obligatoirement** (voir ci-dessous).

### Camp de base = QG sans income + dette de départ (fixe)
- **Posé au départ pour tous** (`foundBaseCamps`). C'est **le 1ᵉʳ et SEUL emprunt** : il donne le **capital de
  lancement** (cash = `baseCampLoan` **70**) **ET** impose sa **charge permanente** (`chargeRate × montant`
  = 0.20 × 70 = **14/tour**).
- Son **hex (le QG)** ne rapporte **aucun income** et ne s'agglomère pas → tu démarres avec du cash mais
  une charge qui saigne, sur une case stérile : tu **dois** acquérir des hexes d'income pour la couvrir.
- Le QG **ne peut pas être évincé** (pas d'ask) et ne paie pas d'upkeep (il porte déjà sa dette).
- **Pas de ré-emprunt** : la dette est **fixe**. Ton seul levier économique est d'acquérir des hexes d'income.
- La dette compte comme **passif** dans la valeur nette → le capital reçu n'est pas de la richesse gratuite.

### Carnet d'ordres = prix de sortie (ask)
- Chaque hex possédé porte **un ordre de vente** (ask) **fixé par son propriétaire** — et **seulement** un
  ordre de vente (pas d'achat : on ne peut pas forcer quelqu'un à vendre).
- **Flux imposé** : *achat (ou éviction) d'un hex → le moteur propose un ask par défaut
  (`revenu × askDefaultMultiple`, ×12) → une **modale obligatoire** « place ton ordre de vente » →
  validation*.
- **Modifiable à tout moment** : clique un de tes hexes (sur la carte **ou** dans le panel Carnet), même
  les tours suivants, pour ré-ajuster ton prix de sortie.
- **Plancher** : un ask ne peut pas descendre sous `base × askFloorMultiple` (×4) — on ne brade pas un hex
  sous son prix d'achat.

### Éviction = payer l'ask
- Pour prendre un hex adverse, tu **paies son ask** (le prix que l'occupant a déclaré).
- **Zéro-sum** : l'assaillant paie, l'occupant encaisse, l'hex change de main, le **nouveau** propriétaire
  doit reposer un ask. Rien n'est créé ni détruit.
- Le **siège est visible** : c'est le prix affiché ⚔ sur l'hex. Un ask haut = **résistance** (cher à
  prendre) ; mais l'éviction reste **toujours possible** si l'assaillant met le prix.

### Tour de l'adversaire (IA)
À son tour, l'IA : emprunte si elle manque de capital, achète les meilleurs hexes abordables (priorité
agglomération), tente **une** éviction adjacente rentable (paie l'ask), pose ses ordres de vente — en
gardant toujours une réserve pour couvrir ses charges.

## Fin & victoire

- **Fin par le temps** : horloge fixe (`horizonTurns`, **14 tours**).
- **Victoire** : la plus haute **valeur nette** à la fin **OU** la faillite de tous les autres avant.
- **Valeur nette = cash + valeur du territoire (prix de marché des hexes) − dette restante.**
- **Faillite** = cash négatif après un tour → éliminé (hexes libérés, dette effacée).

## Réglages (`DEFAULT_CONFIG`, calibrés)

| Paramètre | Valeur | Rôle |
| --- | --- | --- |
| `horizonTurns` | 14 | durée de partie |
| `claimMultiple` | 4 | prix d'un hex libre = base × 4 |
| `chargeRate` | 0.20 | charge/tour de la dette = taux × emprunt |
| `baseCampLoan` | 70 | camp de base = 1ᵉʳ emprunt (capital + charge 14/tour) |
| `hexUpkeep` | 1 | upkeep/tour par hex d'income (léger : la rareté limite le nombre d'hexes) |
| `askDefaultMultiple` | 12 | ask suggéré = revenu × 12 (éviction viable mais non dominante) |
| `askFloorMultiple` | 4 | plancher d'un ask = base × 4 |

Revenu de base/hex à income = **6**, agglomération = **+2**/voisin, **incomeFraction ≈ 0.5** (rareté).

**Calibrage** : `npx vite-node scripts/balance.ts` balaie d'abord la **rareté** (`incomeFraction`, 8 placements
seedés), puis affine `baseCampLoan × hexUpkeep`. Constat : avec la rareté, la tension vient surtout de la
**charge du camp de base** (ratio réalisé ~1.2) ; à `loan 70 / upkeep 1`, le jeu est **survivable et disputé**
(50/50, pas de faillite systématique). ⚠️ Les bots expansent peu (≈2 hexes) → la vraie tension (sur-emprunter,
se battre pour les hexes rares) est une décision **humaine**. **À valider au playtest.**

## Carte des fichiers

| Fichier | Rôle |
| --- | --- |
| `src/engine/state2.ts` | `GameStateV2` (état complet : tour, carte, acteurs, ownership, camps, asks) |
| `src/engine/revenue.ts` | revenu d'un hex + agglomération |
| `src/engine/camp.ts` | camps / dette (charge par tour) |
| `src/engine/tick.ts` | tick économique (income − charges → cash, faillite) + `checkEnd` |
| `src/engine/board.ts` | générateur de plateau plat (hexagone rayon R) |
| `src/engine/game.ts` | verbes du jeu : claim, ask, borrow, évict, IA, valeur nette |
| `src/GameView.svelte` | LE jeu (carte + panels + modale d'ordre de vente) |
| `scripts/balance.ts` | calibrage headless (rentier vs conquérant) |

## Ce qui n'est PAS (encore) dans le jeu

- **Branches d'évolution** des camps (revenus/charges variés, dette soldable) — la différenciation des
  styles viendra par là, une à la fois, une fois la boucle de base validée.
- Le module `orderbook.ts` (carnet multi-parts bids/asks) **n'est pas branché** : le modèle « un hex = une
  place » utilise un ask unique par hex. Il reste en réserve si une enchère plus fine devient utile.
- Plusieurs adversaires, choix d'archétype, génération de cases à revenus différenciés.
