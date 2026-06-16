# un-jeux

Jeu web **tour par tour, hotseat local** (deux joueurs à tour de rôle sur le même écran).
**Cœur actuel** : un **combat tactique** façon échecs + *Divinity: Original Sin* — des pièces
distinctes sur un plateau, **information parfaite, aucun hasard**, des **points d'action** par
pièce, des verbes (garde, tir réservé, riposte) et la **Résonance** (réactions en chaîne entre
alliés d'une même escouade).

**Direction** : fusionner ce noyau tactique avec la base **économie territoriale** (hexes
d'income, dette de base, valeur nette) restée dans le repo — la prise d'un hex adverse passera
par le **combat**, pas par l'économie.

> ⚠️ La vue économique (`GameView`) et son moteur (`revenue/camp/state/tick/game`) **dorment**
> dans le repo, en attente de fusion ; l'App lance aujourd'hui le **combat** (`CombatView`). Un
> précédent prototype 4X financier a été retiré du code (présent dans l'historique git) ; les
> `docs/*` antérieures à ce virage sont conservées comme **référence historique**.

## ▶️ Lancer le jeu

**Prérequis** : Node.js 18+ et npm.

```bash
npm install      # une seule fois (ou après un pull qui ajoute des deps)
npm run dev      # démarre Vite → http://localhost:5173/
```

En ligne (24/7, déployé à chaque push sur `main`) : **https://pretoninho.github.io/un-jeux/**

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
- **Modules purs et immuables** : chaque action rend un nouvel état (rejouable, déterministe,
  sérialisable).
- **Topologie vs présentation** : le moteur de combat ne lit que `neighbors` → il est agnostique
  à la forme des tuiles (plateau hexagonal **ou** octogonal, au choix).

## Structure

```
src/
├── engine/   # TS pur (aucun DOM), testable headless
│   ├── types.ts      # la carte (Hex, GameMap)
│   ├── rng.ts        # générateur seedé
│   ├── board.ts      # plateau hexagonal
│   ├── octaboard.ts  # plateau octogonal (OCTA_N = 23)
│   ├── combat.ts     # NOYAU tactique : déplacement, attaque, verbes, Résonance, tours
│   ├── pieces.ts     # archétypes + calibrage (portée + robustesse = 5), fabrique d'unités
│   └── revenue · camp · state · tick · game   # économie (DORMANT, en attente de fusion)
├── lib/      # helpers de rendu (layout hexagonal / octogonal)
├── CombatView.svelte # LE jeu actuel (board + panneaux d'info)
├── GameView.svelte   # vue économie (dormante)
└── App.svelte + main.ts  # coquille
```

## Documentation

- **`docs/classes.md`** — classes, verbes et **Résonance** (source de vérité du contenu de jeu).
- **`CLAUDE.md`** — décisions de design en vigueur + règles de collaboration.
- **`.claude/design-progress.md`** — journal de conception (historique + virage de direction).
</content>
