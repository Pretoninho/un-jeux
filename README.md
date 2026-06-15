# un-jeux

Jeu web tour par tour, solo-first. **Cœur actuel** : une économie territoriale minimale
sur grille hexagonale — on acquiert des hexes d'income, on couvre la charge de sa dette de
base, et le plus riche en valeur nette à l'horizon gagne.

**Direction** : fusionner cette base économique avec une couche de **combat tactique au tour
par tour** (inspiration *Divinity: Original Sin* — points d'action, surfaces élémentaires,
combos). La prise d'un hex adverse se fera par le combat, pas par l'économie — c'est pourquoi
le cœur a été ramené à l'essentiel (voir l'historique dans `.claude/design-progress.md`).

> ⚠️ Le précédent prototype (4X financier : fragilité/crises/crédit) a été retiré du code lors
> de la simplification — il reste dans l'historique git. Les docs `docs/*` antérieures à ce
> virage sont conservées comme **référence historique**.

## ▶️ Lancer le jeu

**Prérequis** : Node.js 18+ et npm.

```bash
npm install      # une seule fois (ou après un pull qui ajoute des deps)
npm run dev      # démarre Vite → http://localhost:5173/
```

## 🔄 Récupérer les changements dans le Codespace (sans PR)

Pas besoin d'ouvrir une PR pour tester mes modifications — il suffit de **tirer la branche
de travail**. La PR ne sert qu'à la fusion finale dans `main`.

```bash
# Une seule fois : passer sur la branche de dev
git fetch origin && git checkout claude/repo-file-review-v06fdk

# Ensuite, à chaque fois que je pousse :
git pull
```

Pour ne plus y penser, lance l'**auto-pull** dans un terminal dédié — il tire chaque push
automatiquement (fast-forward uniquement, jamais d'écrasement, ne touche à rien si tu as des
modifs locales) :

```bash
bash scripts/watch-pull.sh        # surveille la branche courante, toutes les 5 s
```

Avec `npm run dev` à côté, Vite recharge la page tout seul → tu vois mes changements en direct,
sans PR ni resynchronisation manuelle.

## 🧪 Commandes

```bash
npm test         # suite de tests du moteur (engine) — doit rester verte
npm run build    # build de production (vérifie que tout compile)
npm run check    # vérification de types Svelte/TS
```

## Principes portés par le code

- **Moteur découplé** : `src/engine/` est du TS pur (aucun DOM) → testable headless.
- **Modules purs et immuables** : chaque action rend un nouvel état (rejouable, déterministe).

## Structure

```
src/
├── engine/   # TS pur
│   ├── types.ts     # la carte (Hex, GameMap)
│   ├── rng.ts       # générateur seedé
│   ├── board.ts     # génération du plateau hexagonal (income rare, symétrique)
│   ├── revenue.ts   # income par hex
│   ├── camp.ts      # dette de base (charge permanente)
│   ├── state.ts     # état de partie
│   ├── tick.ts      # boucle économique (income − charges, faillite, fin de partie)
│   └── game.ts      # actions jouables (acquérir, emprunter, IA, valeur nette)
├── lib/      # helpers UI (layout hexagonal)
├── GameView.svelte  # LE jeu (carte + panneaux)
└── App.svelte + main.ts  # coquille
```
