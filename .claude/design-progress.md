# Suivi de conception — Jeu 4X Investissement

> Fichier de navigation rapide. Le détail complet est dans `docs/game-design-memo.md`.
> Dernière mise à jour : 2026-06-12 — v1.5

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

## Chantier ouvert — défauts de script stratégique (état v1.4)

**Moteur de prix (§25) — VERROUILLÉ v1.4** avec 4 fixes anti-script intégrés (A : taux cash jamais indexé sur `F` ; B : plancher de bruit sur l'estimation de `A` ; C : dead recoveries ; D : `λ` faible en normal).

**Défauts de script stratégique (§26.3) — état après verrouillage du moteur :**

| # | Défaut | État | Priorité |
| --- | --- | --- | --- |
| 1 | Score Sharpe gameable | **résolu — Track Record (§27)** | — |
| 2 | RÉSERVER : volet « gratuité » résolu (carry §25.5) ; reste la dilution de l'effet individuel sur `F` | partiel | moyenne |
| 3 | Clarté achetable : principe étendu au micro (`A`) ; reste à chiffrer les planchers macro | partiel | moyenne |
| 4 | Levier : principe « parfois correct » acquis ; **point d'équilibre = α du Track Record** à calibrer (J7) | partiel | basse |
| 5 | Bonus phase-3 du Vautour | **résolu — retiré de la spec** | — |

Principe directeur : **chaque levier doit porter un coût symétrique** (règle des badges §7 : friction, pas synergie). Détail en §26.5 du memo.

> Backlog : T1 ✅ · T2 ✅ · T6 ✅ · A2 absorbée ✅ · T3/T4 partiels (calibrage). **Prochaine tâche : T8 — valider le périmètre MVP** (`mvp-spec.md` §13), ou T9 (tempo/courbe d'accumulation).

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
