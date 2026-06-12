# un-jeux

4X économique atemporel : le joueur incarne un allocateur de capital. Jeu web,
solo-first. La conception vit dans `docs/`, le suivi dans `.claude/design-progress.md`.

## ▶️ Lancer le jeu (frontend)

**Prérequis** : Node.js 18+ et npm (déjà présents dans le Codespace).

```bash
# 1. Installer les dépendances (une seule fois, ou après un git pull qui en ajoute)
npm install

# 2. Lancer le frontend en mode développement
npm run dev
```

`npm run dev` démarre **Vite** et affiche une URL dans le terminal, du type :

```
  ➜  Local:   http://localhost:5173/
```

- **En local** : ouvre cette URL dans ton navigateur.
- **En Codespace GitHub** : un bandeau « Port 5173 » apparaît → clique **« Ouvrir dans le navigateur »** (ou onglet *Ports* → ouvre le port 5173). Le jeu s'ouvre dans un onglet.

Le serveur **recharge à chaud** : à chaque sauvegarde de fichier, la page se met à jour toute seule. Après un `git pull`, si l'affichage semble figé, **arrête (`Ctrl+C`) et relance** `npm run dev`, puis recharge la page (`Ctrl+Shift+R`).

> ⚠️ Lance toujours `npm run dev` **depuis le dossier du repo** (`/workspaces/un-jeux` en Codespace). En cas de doute : `cd /workspaces/un-jeux` d'abord.

## 🧪 Autres commandes

```bash
npm test         # suite de tests du moteur (engine) — doit rester verte
npm run build    # build de production (vérifie que tout compile)
npm run check    # vérification de types Svelte/TS (optionnel)
```

## État du projet

- **Design** : cœur économique complet et audité (memo `docs/game-design-memo.md`).
- **Code** : moteur jouable (J1→J4) + UI (J5). Un **prototype d'exploration** est à
  l'essai (carte générée, brouillard, CHAIN, profil neutre, long/short). Voir §30 du memo.

## Principes portés par le code

- **Moteur découplé** : `src/engine/` est du TS pur (aucun DOM) → testable headless, simulable.
- **Tout est données** : archétypes, profils IA et cartes vivent dans `src/data/` (interchangeables).
- **Anti-script structurel** : RNG seedé + paramètres en plages tirées par instance →
  les phénomènes émergent, rien n'est câblé ni scénarisé.

## Structure

```
src/
├── engine/   # TS pur : état, moteur de prix, jauge, cascade, signaux, IA, score, harness (+ tests)
├── data/     # cartes (fixe + générateur), profils (neutre, archétypes), IA, presets
└── App.svelte + lib/   # UI (le joueur humain est une Policy alimentée par l'UI)
```

## Jalons (voir `docs/mvp-spec.md` §12)

J1 squelette ✅ · J2 moteur + harness ✅ · J3 cascade ✅ · J4 IA ✅ · J5 UI ✅ · J6 post-mortem · J7 calibrage.
