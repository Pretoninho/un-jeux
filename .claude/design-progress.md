# Suivi de conception — Jeu 4X Investissement

> Fichier de navigation rapide. Le détail complet est dans `docs/game-design-memo.md`.
> Dernière mise à jour : 2026-06-11 — v0.5

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
| **Défaite : 3 stades (Stress → Crise → Effondrement)** | §14 | v0.5 |
| **Parties indépendantes — aucun carry-over entre runs** | §14 | v0.5 |

---

## Ce qui reste à développer

Par ordre de priorité (feuille de route §16) :

1. **Définition du MVP web** — périmètre exact de la première version jouable
3. **Structure détaillée de l'arbre de compétences**
4. **Génération procédurale de la carte** (phase 2)
5. **2 archétypes manquants** à définir
6. **Noms in-game définitifs** des archétypes

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
