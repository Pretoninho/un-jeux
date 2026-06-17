# un-jeux

Jeu web **de combat tactique, tour par tour, en hotseat local** (deux joueurs à tour de rôle
sur le même écran). L'esprit : **échecs + *Divinity: Original Sin*** — des pièces/héros distincts
sur un plateau, **information parfaite, aucun hasard**, des **points d'action** par pièce, des
**verbes** (garde, tir réservé, riposte) et la **Résonance** : des réactions en chaîne entre alliés
d'une même escouade (chaque duo de héros porte sa propre synergie).

En ligne (24/7, déployé à chaque push sur `main`) : **https://pretoninho.github.io/un-jeux/**

## ▶️ Lancer le jeu

**Prérequis** : Node.js 18+ et npm.

```bash
npm install      # une seule fois (ou après un pull qui ajoute des deps)
npm run dev      # démarre Vite → http://localhost:5173/
```

## 🧪 Commandes

```bash
npm test         # suite de tests du moteur (engine) — doit rester verte
npm run check    # vérification de types Svelte/TS
npm run build    # build de production (vérifie que tout compile)
```

## Principes portés par le code

- **Moteur découplé** : `src/engine/` est du TS pur (aucun DOM) → testable headless, déterministe,
  sérialisable. Chaque action rend un **nouvel état** (immuable, rejouable).
- **Topologie vs présentation** : le moteur de combat ne lit que `neighbors` → il est **agnostique
  à la forme** des tuiles (plateau hexagonal **ou** octogonal, au choix).

## Structure

```
src/
├── engine/            # TS pur (aucun DOM), testable headless
│   ├── types.ts       # la carte (Hex, GameMap)
│   ├── rng.ts         # générateur seedé
│   ├── board.ts       # plateau hexagonal (topologie + coins de déploiement)
│   ├── octaboard.ts   # plateau octogonal (OCTA_N = 23)
│   ├── combat.ts      # NOYAU : déplacement, attaque, verbes, Résonance, statuts, tours
│   └── pieces.ts      # archétypes + calibrage (portée + robustesse = 5), héros, fabrique d'unités
├── lib/               # helpers de rendu (layout hexagonal / octogonal)
├── CombatView.svelte  # le jeu : plateau (SVG) + panneaux d'info
└── App.svelte + main.ts  # coquille
```

## Stack technique

**TypeScript** · **Svelte 5** · **Vite** (build) · **Vitest** (tests) · rendu **SVG**.
Hébergement **statique** sur **GitHub Pages**, déployé via **GitHub Actions** à chaque push sur
`main` (aucun backend).

## Documentation

- **`docs/classes.md`** — archétypes, verbes et **Résonance** (source de vérité du contenu de jeu).
- **`docs/personnages.md`** — processus de création d'un héros (pas-à-pas).
- **`docs/jeu-tactique-fondations.md`** — cadrage des fondations du combat.
- **`CLAUDE.md`** — décisions de design en vigueur + règles de collaboration.

## Licence

[MIT](LICENSE).
