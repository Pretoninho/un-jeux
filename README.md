# un-jeux

4X économique atemporel : le joueur incarne un allocateur de capital. Jeu web,
solo-first. Voir la conception dans `docs/` et le suivi dans `.claude/design-progress.md`.

## État

- **Design** : cœur économique complet et audité anti-script (memo `docs/game-design-memo.md`, v1.7).
- **Code** : jalon **J1** — squelette. Le moteur (`src/engine/`) est du TS pur, découplé de l'UI.

## Principes portés par le code

- **Moteur découplé** : `src/engine/` n'importe aucun DOM → testable headless, simulable.
- **Tout est données** : archétypes, profils IA et cartes vivent dans `src/data/` (interchangeables).
- **Anti-script structurel** : RNG seedé (`rng.ts`) + paramètres en plages tirées par instance
  (`params.ts`) → les phénomènes émergent, rien n'est câblé ni scénarisé.

## Structure

```
src/
├── engine/   # TS pur : types, rng, params, map-utils, simulate (+ tests)
├── data/     # cartes, archétypes, profils IA, preset MVP
└── ui/       # Svelte (App.svelte) — coquille, l'UI réelle arrive en J5
```

## Commandes

```bash
npm install
npm run dev      # serveur de dev
npm test         # suite de tests (intégrité carte, RNG, plages de paramètres)
npm run build    # build de production
```

## Jalons (voir `docs/mvp-spec.md` §12)

J1 squelette ✅ · J2 moteur + harness · J3 cascade · J4 IA · J5 UI · J6 post-mortem · J7 calibrage.
