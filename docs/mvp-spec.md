# Spécification du MVP web — VERROUILLÉ (proposition)

> Version 0.1 — 11 juin 2026. Dérive du game-design-memo (v1.1).
> Objet : figer le périmètre exact de la première version jouable pour débloquer le code.
> Tout ce qui n'est pas listé ici est **hors MVP**.

---

## 1. Objectif et critère de réussite

**Une partie jouable en solo, dans le navigateur, en ~30–45 min**, qui teste **une seule chose** : la boucle d'inférence de la jauge cachée.

Le MVP est réussi si un joueur peut vivre ce récit :
> « J'ai lu les signaux, j'ai senti la bulle gonfler, j'ai gardé ma réserve sèche malgré la tentation, le marché a rebondi et j'ai failli redéployer trop tôt — puis le vrai krach est arrivé et j'ai déployé au bon moment. »

Si cette boucle est tendue et lisible, le concept est validé. Tout le reste est du contenu.

---

## 2. Périmètre figé

| Élément | MVP | Hors MVP (plus tard) |
|---|---|---|
| Archétypes jouables | **1** — le Vautour | les 6 autres |
| Adversaires IA | **2** — Fonds leveragé + Value patient | les 7 autres profils |
| Banque centrale | **non** (atmosphère réglementaire codée en dur) | IA de contrainte active |
| Badges | **0** | draft de 2 badges |
| Verbes | **3** — LIRE, POSITIONNER, RÉSERVER | CONSTRUIRE, NÉGOCIER |
| Arbre de compétences | **aucun** | 4 branches |
| Points de compétence | **aucun** | 1 / 3 tours |
| Cycles | **1** (~12–15 tours) | 3 cycles |
| Conditions de victoire | **survie + score Sharpe** | les 4 autres |
| Carte | **fixe, 16 hexes** | génération procédurale |
| Multijoueur | **non** | WebSockets phase 2 |
| Manipulation active du rebond | **non** (seulement émergente) | Prédateur / Dominance |

---

## 3. Configuration de partie (fixe, pas d'écran de config au MVP)

```
Archétype joueur : Vautour
Adversaires      : Fonds leveragé, Value patient
Durée            : 1 cycle, ~12–15 tours (fin du cycle OU effondrement du joueur)
Capital départ   : joueur 100, Fonds leveragé 100, Value patient 100 (unités abstraites)
```

L'écran 1 (configuration, §18) est **reporté** : au MVP la partie démarre directement.

---

## 4. La carte (16 hexes fixes)

**11 hexes marché · 3 nœuds · 2 frontière.** L'adjacence = corrélation (§11).

### Layout (4 rangées, dérivé du wireframe écran 2)

```
Rangée 0   IG_EU    IG_US    IG_EM            (crédit Investment Grade)
Rangée 1   LC_EU    LC_US    LC_EM            (actions Large Cap)
Rangée 2   IMMO     PEVC     HY_US★           (alternatifs + High Yield frontière)
Rangée 3   ◆FED     ◆LIQ     ◆INFO            (nœuds)   +  EXOT★ (frontière)
```

★ = hexe frontière (verrouillé au départ).

### Hexes marché (investissables)

| ID | Marché | Cluster de corrélation |
|---|---|---|
| IG_EU / IG_US / IG_EM | Crédit Investment Grade (EU/US/EM) | Crédit |
| LC_EU / LC_US / LC_EM | Actions Large Cap (EU/US/EM) | Actions |
| IMMO | Immobilier | Alternatifs |
| PEVC | Private Equity / VC | Alternatifs |
| HY_US ★ | Crédit High Yield US (frontière) | Crédit (le plus fragile) |
| EXOT ★ | Dérivés exotiques (frontière) | — |

### Nœuds (non-investissables, §11)

| ID | Type | Effet de présence |
|---|---|---|
| FED | Réglementaire | lecture anticipée des taux/levier autorisé |
| LIQ | Liquidité (prime broker) | levier moins cher **mais** + contribution à `F` ; débloque le signal Financement |
| INFO | Information (agence de notation) | signaux moins bruités/retardés |

### Matrice d'adjacence (= corrélation)

Adjacence forte au sein d'un cluster ; ponts entre clusters par géographie.

```
IG_EU  ↔ IG_US, LC_EU
IG_US  ↔ IG_EU, IG_EM, LC_US, HY_US, FED, INFO
IG_EM  ↔ IG_US, LC_EM
LC_EU  ↔ LC_US, IG_EU, IMMO
LC_US  ↔ LC_EU, LC_EM, IG_US, PEVC
LC_EM  ↔ LC_US, IG_EM
IMMO   ↔ LC_EU, PEVC
PEVC   ↔ LC_US, IMMO, EXOT
HY_US  ↔ IG_US, LIQ            (frontière — débloque via crise/RÉSERVER prolongé)
EXOT   ↔ PEVC                  (frontière — hors MVP réel, décor)
FED    ↔ IG_US, LIQ
LIQ    ↔ FED, INFO, HY_US
INFO   ↔ IG_US, LIQ
```

**Implication** : le cluster crédit (IG_US/HY_US) est le plus connecté → c'est par là que la contagion se propage en crise. Position de départ du Vautour : **réserve sèche, 1 analyste sur LC_US** (cœur de marché, bien connecté).

---

## 5. Boucle de tour

- **4 PA par tour** (valeur §8 conservée).
- 3 verbes seulement :

| Verbe | Coût | Effet MVP |
|---|---|---|
| **LIRE** | 1 PA | rafraîchit un signal (valable 1 tour) ou pose/déplace un analyste (signal continu) |
| **POSITIONNER** | 1–2 PA | ouvre / redimensionne / ferme une position (impact prix si taille) |
| **RÉSERVER** | 0 PA | garde la réserve sèche ; **réduit `F` de 0.05** (purge, §23.3) ; accumule la ressource Réserve sèche du Vautour |

Ordre du tour : actions joueur → actions des 2 IA → résolution marché (rendements, mise à jour `F`, test de crise §23.4 / avancée de cascade §24).

---

## 6. Le Vautour (archétype MVP)

| Trait | Valeur MVP |
|---|---|
| Fantasme | survivre aux crises, acheter en détresse |
| Ressource | **Réserve sèche** — +1 par tour passé en RÉSERVER |
| Dépense | déploiement massif en haute fragilité (bonus de rendement si achat pendant phase 3 de la cascade) |
| Victoire naturelle | Score (Sharpe cumulé) |
| Friction intégrée | chaque tour en réserve = coût d'opportunité visible (le marché monte sans lui) |

**Le pari du Vautour** : tenir la réserve pendant que la bulle gonfle (frustrant), ne pas se faire piéger par le rebond (§24.2), déployer dans la vraie jambe. La friction *est* le gameplay.

---

## 7. Les deux IA (rule-based, §16)

### Fonds leveragé — moteur de fragilité

```
SI régime bull ET F (perçue via volatilité) basse :
    → POSITIONNER avec levier max sur le cluster le plus performant (souvent actions/HY)
SI volatilité monte :
    → réduit lentement (trop tard en général)
En crise : rasé proportionnellement à l'amplitude (§23.5) → peut s'effondrer
```
Rôle : pousse `F` vers le haut (`+0.06 × ratio_levier`), crée le crowding, alimente le rebond en se couvrant (§24.3).

### Value patient — stabilisateur

```
SI un hexe est décoté (rendement estimé élevé vs base) :
    → POSITIONNER sans levier, petite taille, ignore le bruit
Jamais de levier. Ne vend pas en panique.
```
Rôle : absorbe les chocs, abaisse `F` relativement, sert de contrepoint au Vautour (lui aussi achète bas, mais en continu, pas en embuscade).

---

## 8. Jauge et cascade

Repris **tel quel** de §23 (modèle numérique) et §24 (cascade 4 phases). Valeurs MVP : seuils `0.40 / 0.85`, `k=1.5`, purge `0.05/0.02`, cascade `1/2/2/2` tours, rebond récupère ~40 %.

**3 signaux actifs** (le 4ᵉ, Initiés, est hors MVP) :

| Signal | Retard | σ | Accès MVP |
|---|---|---|---|
| Volatilité | 0 | 0.20 | gratuit |
| Écart de crédit | 1 | 0.10 | 1 PA LIRE, ou analyste sur un hexe crédit |
| Financement | 2 | 0.04 | présence au nœud LIQ |

---

## 9. Victoire et fin de partie

- La partie dure **1 cycle (~12–15 tours)** ou s'arrête si le joueur atteint l'**Effondrement** (§14).
- **Score = Sharpe cumulé** (rendement / volatilité des rendements sur la partie). Récompense la régularité, pas la taille brute.
- Écran de **post-mortem** (§18 écran 4) à la fin : révèle la courbe réelle de `F` superposée aux signaux vus. C'est le moment d'apprentissage.

---

## 10. UI — 3 écrans au MVP

| Écran | Source | MVP |
|---|---|---|
| Configuration | §18 écran 1 | **reporté** (partie auto-configurée) |
| Vue principale | §18 écran 2 | **oui** — carte SVG, panneau actions, panneau signaux |
| Détail d'un hexe | §18 écran 3 | **oui** — modale au clic |
| Post-mortem | §18 écran 4 | **oui** — fin de partie + courbe `F` révélée |

---

## 11. Stack technique (proposition)

- **Svelte + Vite** — état réactif natif pour une UI à jauges/signaux, build léger, zéro backend (le solo tourne 100 % client).
- **Carte en SVG** — 16 hexes, simple à styliser et à rendre interactif.
- **Logique de jeu en TypeScript pur**, découplée de l'UI (un module `engine/` testable sans DOM → on pourra brancher l'IA et calibrer les paramètres en tests unitaires).
- Pas de dépendance lourde. Déployable en statique (GitHub Pages / Netlify).

---

## 12. Plan de construction par jalons

1. **J1 — Squelette** : projet Svelte/Vite + TS, structure `engine/` vs `ui/`, données de la carte (§4) en dur.
2. **J2 — Moteur sans UI** : état de partie, boucle de tour, jauge `F` (§23), rendements + corrélation. Testé en unitaire (parties simulées sans écran).
3. **J3 — Cascade** : les 4 phases (§24) + mensonge des signaux. Testé en unitaire.
4. **J4 — Les 2 IA** (§7) branchées dans la boucle.
5. **J5 — UI vue principale** : carte SVG, actions, signaux, jauges visibles (réserve/réputation/stress).
6. **J6 — Détail hexe + post-mortem** : modale + écran de fin avec courbe `F` révélée.
7. **J7 — Calibrage** : régler les paramètres (§23.8, §24.6) jusqu'à ce que la boucle soit tendue.

**Chemin critique** : J2 → J3 (le moteur et la cascade). L'UI vient après et peut rester rustique tant que la boucle est juste.

---

## 13. Questions à valider avant de coder

- [ ] Le périmètre §2 te convient-il (notamment : Vautour comme unique archétype, 3 verbes) ?
- [ ] La carte §4 (16 hexes, ces adjacences) est-elle un bon point de départ ?
- [ ] Stack Svelte/TS/SVG validée, ou tu préfères autre chose (React, vanilla) ?
- [ ] Durée cible (~30–45 min, 12–15 tours) cohérente avec ce que tu imagines ?
