# Nouveau jeu — règles du prototype (état réel)

> Référence des mécaniques qui **tournent réellement** dans le nouveau jeu (`src/engine/` +
> `src/GameView.svelte`). À tenir à jour avec le code. Le journal de conception détaillé est dans
> `.claude/design-progress.md`. Dernière mise à jour : 2026-06-15 — v1.39.
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
Hexes possédés        → revenu/tour (+ prime d'agglomération si voisins du même proprio)
Camp(s) / emprunts    → charge/tour (la dette de base, posée au départ)
revenu − charges      → net/tour → ajouté au cash
cash < 0 après le tour → FAILLITE (hexes libérés, dette effacée)
```

## Les pièces

### Hexes = revenus
- Un hex = **une place**, **un seul occupant** (pas de partage).
- Carte = hexagone **rayon 3 = 37 hexes**, revenu de base **plat** (6 partout, pour l'instant — on
  isole le facteur d'équilibre avant de différencier les cases).
- **Agglomération** : chaque hex adjacent appartenant au **même** propriétaire ajoute une prime
  (`agglomerationBonus`, +3) au revenu de l'hex → un cluster contigu rapporte plus que des hexes dispersés.

### Acquisition d'un hex libre
- Prix = `base × claimMultiple` (6 × 4 = **24**), payé en cash.
- À l'achat, **le carnet d'ordres s'ouvre obligatoirement** (voir ci-dessous).

### Camp de base = dette (le facteur de pondération)
- **Posé au départ pour tous** : le premier emprunt est déjà effectué (`foundBaseCamps`, **120** de capital).
- **Charge/tour = `chargeRate × montant`** (0.20 × 120 = **24/tour**). Modèle **permanent** : la charge
  ne s'éteint pas (un seul tronc de base ; les variantes soldables viendront via des **branches**).
- On peut **ré-emprunter** en cours de partie (capital immédiat, charge supplémentaire à vie).
- La dette compte comme **passif** dans la valeur nette → emprunter n'est jamais de l'argent gratuit.

### Carnet d'ordres = prix de sortie (ask)
- Chaque hex possédé porte **un ordre de vente** (ask) **fixé par son propriétaire** — et **seulement** un
  ordre de vente (pas d'achat : on ne peut pas forcer quelqu'un à vendre).
- **Flux imposé** : *achat (ou éviction) d'un hex → le moteur propose un ask par défaut
  (`revenu × askDefaultMultiple`, ×12) → une **modale obligatoire** « place ton ordre de vente » →
  validation*. Tu peux ré-ajuster tes asks depuis le panel Carnet.
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
| `chargeRate` | 0.20 | charge/tour = taux × emprunt (≈ l'income que le capital génère) |
| `baseCampLoan` | 120 | capital de lancement (camp de base) |
| `askDefaultMultiple` | 12 | ask suggéré = revenu × 12 (rend l'éviction viable mais non dominante) |
| `askFloorMultiple` | 4 | plancher d'un ask = base × 4 |

**Calibrage** : `npx vite-node scripts/balance.ts` rejoue **rentier vs conquérant** et mesure qui gagne.
Au réglage ci-dessus, ~50/50 (aucun style ne domine). ⚠️ Bots crus → calibrage de 1ère passe, à affiner au
playtest. Le vrai régulateur de l'équilibre est le **taux de charge** + le **prix de sortie par défaut**.

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
