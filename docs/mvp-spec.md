# Spécification du MVP web — VERROUILLÉ (proposition)

> Version 0.5 — 12 juin 2026. Dérive du game-design-memo (v1.6).
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
| Banque centrale | **non** au MVP (taux = règle réactive simple fonction de `F`, **réactive et non scriptée**) | IA de contrainte active |
| Badges | **0** | draft de 2 badges |
| Verbes | **3** — LIRE, POSITIONNER, RÉSERVER | CONSTRUIRE, NÉGOCIER |
| Arbre de compétences | **aucun** | 4 branches |
| Points de compétence | **aucun** | 1 / 3 tours |
| Cycles | **1** (~12–15 tours) | 3 cycles |
| Conditions de victoire | **survie + Track Record** (memo §27) | les 4 autres |
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
| Dépense | déploiement massif de la réserve quand il juge le creux atteint — **aucun bonus scripté** : c'est la physique neutre qui paie (acheter la dislocation `V≪A` capte la réversion *si* la recovery vient, memo §25.6) |
| Victoire naturelle | Score (Track Record, memo §27) |
| Friction intégrée | chaque tour en réserve = carry et drift abandonnés, chiffrés à l'écran (memo §25.5) |

**Le pari du Vautour** : tenir la réserve pendant que la bulle gonfle (frustrant), ne pas se faire piéger par le rebond (§24.2), déployer dans la vraie jambe — en acceptant qu'une dead recovery (memo §25.6) ou une partie sans crise (memo §26.2) puisse le faire perdre. La friction *est* le gameplay ; la patience est un pari, pas une recette.

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

## 8. Jauge, cascade et moteur de prix

Repris **tel quel** de §23 (modèle numérique), §24 (cascade) et **§25 (moteur de prix, verrouillé v1.4)** : structure à facteurs, ancre `A` cachée (plancher de bruit), `flux` = impact-prix, carry, recovery stochastique avec dead recoveries. Valeurs MVP : seuils `0.40 / 0.85`, `k=1.5`, purge `0.05/0.02`.

**Rien de scripté (§24.2)** : la cascade est une *morphologie*, pas une séquence figée. Par instance, on **tire** :
- durées de phase dans des plages (jambe 1 ∈ 1–2, rebond ∈ 1–3, jambe 3 ∈ 1–3 tours) ;
- ampleur du rebond ∈ 25–55 % de la jambe 1 ;
- **si le rebond est un vrai plancher (≈ 30 %, pas de jambe 3) ou un piège.**

Aucune de ces valeurs n'est observable ni constante d'une partie à l'autre. Le moteur ne rejoue jamais deux fois la même crise.

**Régimes émergents (§15)** : bull/tension/crise/recovery sont des *lectures* de `F` + tendance des prix, pas un scénario que la partie déroule. Une partie prudente peut ne jamais crasher ; une partie imprudente peut crasher deux fois. Le nombre de crises est émergent.

**3 signaux actifs** (le 4ᵉ, Initiés, est hors MVP) :

| Signal | Retard | σ | Accès MVP |
|---|---|---|---|
| Volatilité | 0 | 0.20 | gratuit |
| Écart de crédit | 1 | 0.10 | 1 PA LIRE, ou analyste sur un hexe crédit |
| Financement | 2 | 0.04 | présence au nœud LIQ |

---

## 9. Victoire et fin de partie

- La partie dure **1 cycle (~12–15 tours)** ou s'arrête si le joueur atteint l'**Effondrement** (§14).
- **Score = Track Record** (memo §27) : `rendement excédentaire vs marché − α·MaxDrawdown − pénalités de détresse`, α=0.5. Benchmark = indice fixe des hexes investissables de la carte ; drawdown en mark-to-market. Affiché en continu (marché vs joueur) pour la pression FOMO.
- Écran de **post-mortem** (§18 écran 4) à la fin : révèle la courbe réelle de `F` superposée aux signaux vus, + le rapport Track Record (Vous / Marché / Excédent / Pire séquence). C'est le moment d'apprentissage.

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
2. **J2 — Moteur sans UI** : état de partie, boucle de tour, jauge `F` (§23) + `F(0)` en plage, moteur de prix (§25), score Track Record (§27). **Inclut un harness de simulation headless** (jouer N parties sans écran) — prérequis du calibrage J7.
3. **J3 — Cascade** : la morphologie (§24) + mensonge des signaux. Testé en unitaire.
4. **J4 — Les 2 IA** (§7) branchées dans la boucle.
5. **J5 — UI vue principale** : carte SVG, actions, signaux, jauges visibles + bandeau Track Record (marché vs joueur, §27.4).
6. **J6 — Détail hexe + post-mortem** : modale + écran de fin avec courbe `F` révélée + rapport Track Record.
7. **J7 — Calibrage** : régler les paramètres (§23.8, §24.7, §25.10, α du score) via le harness jusqu'à atteindre les **cibles statistiques de tempo (§28.2)** et **valider le critère « les signaux battent l'horloge » (§28.7)**.

**Chemin critique** : J2 → J3 (le moteur et la cascade). Le harness de J2 est ce qui rend J7 mesurable. L'UI vient après et peut rester rustique tant que la boucle est juste.

---

## 13. Questions à valider avant de coder

- [ ] Le périmètre §2 te convient-il (notamment : Vautour comme unique archétype, 3 verbes) ?
- [ ] La carte §4 (16 hexes, ces adjacences) est-elle un bon point de départ ?
- [ ] Stack Svelte/TS/SVG validée, ou tu préfères autre chose (React, vanilla) ?
- [ ] Durée cible (~30–45 min, 12–15 tours) cohérente avec ce que tu imagines ?
