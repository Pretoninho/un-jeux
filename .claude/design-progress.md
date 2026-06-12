# Suivi de conception — Jeu 4X Investissement

> Fichier de navigation rapide. Le détail complet est dans `docs/game-design-memo.md`.
> Dernière mise à jour : 2026-06-12 — v1.8

---

## Ce qui est tranché

| Sujet | Memo § | Version |
| --- | --- | --- |
| Cadre atemporel | §1 | v0.3 |
| Crises endogènes (modèle conditionnel) | §4 | v0.3 |
| Jauge de fragilité cachée, signaux bruités | §4 | v0.3 |
| 5 archétypes jouables + système de badges | §6, §7 | v0.4 |
| 2 badges par défaut (draft partiel) | §7 | v0.4 |
| Tour 1 = fondation (vue partielle + choix branche techno) | §8 | v0.4 |
| 4 PA par tour, 1 point de compétence tous les 3 tours | §8 | v0.4 |
| 5 verbes : LIRE / POSITIONNER / CONSTRUIRE / NÉGOCIER / RÉSERVER | §9 | v0.4 |
| Ressources : Capital (3 états) + Réputation + ressource archétype | §10 | v0.4 |
| Carte hexagonale : 3 types de hexes, adjacence = corrélation | §11 | v0.4 |
| Paliers de présence dans un hex (x4) | §11 | v0.4 |
| Prototype : carte fixe ~15-20 hexes, puis procédurale | §11 | v0.4 |
| Vocabulaire : jargon conservé + tooltips 2 niveaux | §12 | v0.4 |
| **Objectif : jeu web, solo-first, multi WebSockets phase 2** | §13 | v0.5 |
| **Tours abstraits numérotés, fin par victoire ou 3 cycles, score tiebreaker** | §15 | v0.6 |
| **IA : pool unifié 9 profils + Banque centrale, choix des adversaires, max 3** | §16 | v0.7 |
| **Signaux : 4 signaux (Volatilité/Écart crédit/Financement/Initiés), option A prototype** | §17 | v0.8 |
| **Wireframes : 4 écrans (configuration / vue principale / détail hex / post-mortem)** | §18 | v0.9 |
| **Modèle numérique de la jauge : déclencheur hybride, reset quasi-total, signaux chiffrés** | §23 | v1.0 |
| **Cascade de crise : morphologie (chute → rebond → vraie jambe), signaux qui mentent** | §24 | v1.1 |
| **Anti-script : régimes émergents (pas de séquence garantie), cascade à paramètres stochastiques** | §15, §24 | v1.2 |
| **Neutralité archétypale : marché = physique neutre, archétypes = lentilles ; « le hoarder peut perdre »** | §26 | v1.3 |
| **Moteur de prix : facteurs (40/30/30), ancre `A` cachée (2ᵉ état caché), flux = impact-prix, carry, melt-up stochastique, dead recoveries — 4 fixes anti-script A→D** | §25 | v1.4 |
| **Score = Track Record (excédent vs marché − α·drawdown) ; benchmark fixe, drawdown mark-to-market ; remplace le Sharpe** | §27 | v1.5 |
| **Tempo : calibrage statistique (cibles de distribution, pas de durée), `F(0)` en plage cachée, critère « signaux battent l'horloge » (test J7)** | §28 | v1.6 |
| **Périmètre MVP validé (T8) : architecture N-archétypes/profils/cartes = données, harness paramétrable, calibrage multi-profils + assertion de neutralité (J7)** | spec §11bis, §28.8 | v1.7 |
| **Défauts #2/#3/#4 résolus : purge symétrique agrégée, planchers de bruit irréductibles, mécanique du levier (appel de marge = transmission des cascades) — chantier script stratégique CLOS** | §23.3, §29 | v1.8 |
| **Défaite : 3 stades (Stress → Crise → Effondrement)** | §14 | v0.5 |
| **Parties indépendantes — aucun carry-over entre runs** | §14 | v0.5 |

---

## Ce qui reste à développer

Par ordre de priorité (feuille de route §16) :

1. ~~**Définition du MVP web**~~ — **PROPOSÉ (v0.1)** : périmètre figé dans `docs/mvp-spec.md` (Vautour + 2 IA, 3 verbes, carte 16 hexes, 1 cycle). En attente de validation, puis code.
2. **Structure détaillée de l'arbre de compétences** (hors MVP)
3. **Génération procédurale de la carte** (phase 2)
4. **2 archétypes manquants** à définir
5. **Noms in-game définitifs** des archétypes

> Prochaine étape concrète : valider `docs/mvp-spec.md` (§13) → démarrer le code (jalons §12).

---

## Chantier script stratégique — CLOS (v1.8)

**Moteur de prix (§25) — VERROUILLÉ v1.4** avec 4 fixes anti-script intégrés (A : taux cash jamais indexé sur `F` ; B : plancher de bruit sur l'estimation de `A` ; C : dead recoveries ; D : `λ` faible en normal).

**Les 5 défauts de §26.3 sont résolus (détail en memo §29.4) :**

| # | Défaut | Résolution |
| --- | --- | --- |
| 1 | Score Sharpe gameable | Track Record (§27) |
| 2 | RÉSERVER / purge individuelle | purge symétrique agrégée, proportionnelle à la part de capital (§23.3, §29.1) |
| 3 | Clarté achetable | planchers de bruit + délais irréductibles, en plages (§29.2) |
| 4 | Levier option morte | mécanique complète (coût, appel de marge) + test de viabilité en J7 (§29.3) |
| 5 | Bonus phase-3 du Vautour | supprimé (v1.4) |

Principe directeur : **chaque levier doit porter un coût symétrique** (règle des badges §7 : friction, pas synergie).

Restent en J7 (vérifications **numériques**, pas de design) : α, coût du levier, planchers, cibles de tempo (§28.2), critère signaux>horloge (§28.7), neutralité multi-profils (§28.8).

> Backlog design : T1 ✅ · T2 ✅ · T3 ✅ · T4 ✅ · T5 ✅ · T6 ✅ · T8 ✅ · T9 ✅ · A2 absorbée ✅. **Design MVP complet, audité, chantier clos.**
>
> **Code : J1 ✅** — squelette Svelte/Vite/TS. Moteur découplé (`src/engine/`, TS pur sans DOM), tout en données (`src/data/` : carte 16 hexes, Vautour, 2 profils IA, preset MVP). Anti-script porté par le code : RNG seedé (`rng.ts`) + paramètres en plages tirées par instance (`params.ts`, aligné v1.8 dont levier §29.3). 17 tests verts (intégrité/symétrie/connexité carte, reproductibilité RNG, plages des paramètres + `F(0)` < zone morte). Build OK.
>
> **Code : J2 ✅** — moteur sans UI exécutable. `engine/` : state, regime (émergent), market (facteurs §25, ρ→1 en crise), portfolio (mark-to-market, levier/crowding, appels de marge), fragility (§23.4), score (Track Record §27), turn (boucle), policy (interface + politiques triviales), simulate (harness §28). **Tests d'émergence verts** : levier→crises, réserve→sûr, nb de crises variable (non scripté). **37 tests**, typecheck + build OK.
>
> **Code : J3 ✅** — cascade complète (§24) : machine à phases leg1→rebond→(leg3 ou vrai plancher)→recovery, **forme tirée par crise** (anti-script intra-partie), bull trap en P&L, reset `F∝amplitude`. **Signaux observables** (`signals.ts`, §23.6) : bruités/retardés, plancher en plages, **mensonge du rebond** ambigu (§24.2). Instrument horloge-vs-signaux (§28.7) posé (assertion stricte → J7). **46 tests**, typecheck + build OK. Prochaine étape : **J4 — les 2 IA rule-based**.
>
> POSITIONNER (memo §9bis, v1.9) : 4 opérations — Ouvrir (1-2) · Renforcer (1-2) · **Clôture partielle (2)** · Fermer totale (1). En données : `src/data/actions.ts`.
>
> ⚠️ **À trancher avant J5** (memo §21) : écart de comptage carte — prose spec §4 = 16 hexes, liste d'adjacence = 13. Le code (`src/data/maps/mvp-16.ts`) suit l'adjacence (13 hexes : 8 marché · 3 nœuds · 2 frontière).

---

## Ressources d'archétype — aide-mémoire

| Archétype (réf. dev) | Ressource | Gagnée par | Dépensée pour |
| --- | --- | --- | --- |
| Buffett → Compounder | Conviction | Tenir une position longtemps | Résister aux pressions LP, doubler en baisse |
| Soros → Sismographe | Clarté de régime | Actions LIRE macro | Positions leveragées massives |
| Icahn → Prédateur | Pression | Accumulation silencieuse | Raid activiste, short squeeze |
| Simons → Architecte | Signal alpha | Investissement infra/data | Positions model-driven, LIRE moins cher |
| H. Marks → Vautour | Réserve sèche | Tours en RÉSERVER | Déploiement massif en crise |

---

## Design de la défaite — aide-mémoire

```
Stress (avertissement)
  → LPs inquiets, levier plus cher, encore récupérable

Crise (pression active)
  → LPs retirent, desks ferment, triage obligatoire

Effondrement (fin de run)
  ├── Absorption  → fond adverse gagne en puissance
  └── Wind-down   → clôture narrative, score réduit
```

La faillite est une dernière décision stratégique.
Les liquidations au stade 3 contribuent à la jauge systémique.

---

## Prototype minimal — cible MVP web

- Carte fixe ~15-20 hexes
- 1 archétype jouable + 2-3 IA simples (rule-based)
- Jauge de fragilité active (cachée)
- Boucle complète : LIRE → POSITIONNER → régime → crise éventuelle
- Jouable en 1h
