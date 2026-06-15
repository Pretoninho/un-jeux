# Nouveau jeu — règles du prototype (état réel)

> Référence des mécaniques qui **tournent réellement** dans le nouveau jeu (`src/engine/` +
> `src/GameView.svelte`). À tenir à jour avec le code. Le journal de conception détaillé est dans
> `.claude/design-progress.md`. Dernière mise à jour : 2026-06-15 — v1.44.
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

**Tension income/charge** : chaque hex d'income rapporte 6 et coûte un **upkeep** de 3 → ratio unitaire **2:1**
(l'upkeep plafonne la croissance et tient la tension tout du long). Le **camp de base** (QG sans income, charge 7)
te met **sous l'eau au départ** → il faut acquérir ~2 hexes pour le couvrir, puis on **progresse** (net positif,
on accumule pour acheter plus). Le ratio est affiché en jeu.

## Les pièces

### Hexes = revenus (rares, avec upkeep)
- Un hex = **une place**, **un seul occupant** (pas de partage).
- Carte = grand hexagone **rayon 5 = 91 hexes**. Les **hexes à income sont RARES** : seule une fraction
  (`incomeFraction` ≈ **0.5**) produit un revenu (base 6) ; les autres sont **stériles** (0 revenu,
  non achetables, cases grises). Placement **symétrique** (rotation 180°) → plateau équitable, **seedé**
  (un plateau différent à chaque partie), avec **≥1 hex d'income garanti à côté de chaque QG** (départ
  jouable). La rareté rend chaque hex à income **disputé** (éviction).
- **Agglomération** : chaque hex adjacent appartenant au **même** propriétaire ajoute une prime
  (`agglomerationBonus`, +2) → un cluster contigu rapporte plus que des hexes dispersés.
- **Upkeep** : chaque hex d'income possédé coûte `hexUpkeep` (**3**) par tour. Il fait monter la charge avec le
  territoire → **plafonne la croissance** et tient le ratio income/charge vers **2:1** en fin de partie (au lieu
  d'exploser). Chaque hex net = 6 − 3 = +3/tour (avant agglomération) : on progresse, mais la charge mord toujours.

### Acquisition d'un hex libre
- Prix = `base × claimMultiple` (6 × 4 = **24**), payé en cash.
- À l'achat, **le carnet d'ordres s'ouvre obligatoirement** (voir ci-dessous).

### Camp de base = QG sans income + dette de départ (fixe)
- **Posé au départ pour tous** (`foundBaseCamps`). C'est **le 1ᵉʳ et SEUL emprunt** : il donne le **capital de
  lancement** (cash = `baseCampLoan` **70**) **ET** impose sa **charge permanente** (`chargeRate × montant`
  = 0.10 × 70 = **7/tour**) — surmontable dès ~2 hexes d'income, mais réelle.
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
À son tour, l'IA : achète les meilleurs hexes abordables (priorité agglomération), tente **une** éviction
adjacente rentable (paie l'ask), pose ses ordres de vente — en gardant toujours une réserve pour couvrir ses
charges. (Pas de ré-emprunt : comme le joueur, elle s'étend avec son capital de base + son income.)

## Fin & victoire

- **Fin par le temps** : horloge fixe (`horizonTurns`, **20 tours**).
- **Victoire** : la plus haute **valeur nette** à la fin **OU** la faillite de tous les autres avant.
- **Valeur nette = cash + valeur du territoire (prix de marché des hexes) − dette restante.**
- **Faillite** = cash négatif après un tour → éliminé (hexes libérés, dette effacée).

## Réglages (`DEFAULT_CONFIG`, calibrés)

| Paramètre | Valeur | Rôle |
| --- | --- | --- |
| `horizonTurns` | 20 | durée de partie (allongée pour le grand plateau) |
| `claimMultiple` | 4 | prix d'un hex libre = base × 4 |
| `chargeRate` | 0.10 | charge/tour de la dette = taux × emprunt (camp de base = 7/tour) |
| `baseCampLoan` | 70 | camp de base = 1ᵉʳ emprunt (capital 70 + charge 7/tour) |
| `hexUpkeep` | 3 | upkeep/tour par hex d'income → plafonne la croissance, ratio fin ~2:1 |
| `askDefaultMultiple` | 12 | ask suggéré = revenu × 12 (éviction viable mais non dominante) |
| `askFloorMultiple` | 4 | plancher d'un ask = base × 4 |

Revenu de base/hex à income = **6**, agglomération = **+2**/voisin, **incomeFraction ≈ 0.5** (rareté).

**Calibrage** : `npx vite-node scripts/balance.ts` (rayon 5, rareté 0.5, horizon 20, 8 placements seedés)
mesure la **PROGRESSION** — net/tour au tour 2 (doit être > 0, sinon on est *bloqué*), nombre d'hexes en fin
de partie, ratio income/charge final, faillites. Réglage retenu (`loan 70 / chargeRate 0.10 / upkeep 3`) :
**netT2 ≈ +10** (on accumule et on continue d'acheter), **~20 hexes** en fin, **ratio fin ≈ 2:1**, **0 % de
faillite**. Leçon : une charge de base trop forte (×0.20 = 14) **bloque** la progression (net ≈ 0 après 2 hexes) ;
0.10 (charge 7) la débloque, et l'**upkeep 3** maintient la tension à 2:1 sans laisser le territoire devenir
gratuit. ⚠️ Bots crus → à valider au playtest.

## Carte des fichiers

| Fichier | Rôle |
| --- | --- |
| `src/engine/state2.ts` | `GameStateV2` (état complet : tour, carte, acteurs, ownership, camps, asks) |
| `src/engine/revenue.ts` | revenu d'un hex + agglomération |
| `src/engine/camp.ts` | camps / dette (charge par tour) |
| `src/engine/tick.ts` | tick économique (income − charges → cash, faillite) + `checkEnd` |
| `src/engine/board.ts` | générateur de plateau (hexagone rayon R, rareté des hexes à income, QG) |
| `src/engine/game.ts` | verbes du jeu : claim, ask, borrow, évict, IA, valeur nette |
| `src/GameView.svelte` | LE jeu (carte + panels + modale d'ordre de vente) |
| `scripts/balance.ts` | calibrage headless (rentier vs conquérant) |

## Ce qui n'est PAS (encore) dans le jeu

- **Branches d'évolution** des camps (revenus/charges variés, dette soldable) — la différenciation des
  styles viendra par là, une à la fois, une fois la boucle de base validée.
- Le module `orderbook.ts` (carnet multi-parts bids/asks) **n'est pas branché** : le modèle « un hex = une
  place » utilise un ask unique par hex. Il reste en réserve si une enchère plus fine devient utile.
- Plusieurs adversaires, choix d'archétype, génération de cases à revenus différenciés.
