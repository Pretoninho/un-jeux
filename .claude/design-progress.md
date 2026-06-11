# Suivi de conception — Jeu 4X Investissement

> Fichier de navigation rapide. Le détail complet est dans `docs/game-design-memo.md`.
> Dernière mise à jour : 2026-06-11

---

## Ce qui est tranché

| Sujet | Memo § | Statut |
| --- | --- | --- |
| Cadre atemporel | §1 | Validé v0.3 |
| Crises endogènes (modèle conditionnel) | §4 | Validé v0.3 |
| Jauge de fragilité cachée, signaux bruités | §4 | Validé v0.3 |
| 5 archétypes jouables + système de badges | §6, §7 | Validé v0.4 |
| 2 badges par défaut (draft partiel) | §7 | Validé v0.4 |
| Tour 1 = fondation (vue partielle + choix branche techno) | §8 | Validé v0.4 |
| 4 PA par tour, 1 point de compétence tous les 3 tours | §8 | Validé v0.4 |
| 5 verbes : LIRE / POSITIONNER / CONSTRUIRE / NÉGOCIER / RÉSERVER | §9 | Validé v0.4 |
| Ressources : Capital (3 états) + Réputation + ressource archétype | §10 | Validé v0.4 |
| Carte hexagonale : 3 types de hexes, adjacence = corrélation | §11 | Validé v0.4 |
| Paliers de présence dans un hex (x4) | §11 | Validé v0.4 |
| Prototype : carte fixe ~15-20 hexes, puis procédurale | §11 | Validé v0.4 |
| Vocabulaire : jargon conservé + tooltips 2 niveaux | §12 | Validé v0.4 |

---

## Ce qui reste à développer

Par ordre de priorité (feuille de route §14) :

1. **Solo vs multijoueur** — posé ("les deux") mais pas approfondi
2. **Échelle d'un tour et horizon de partie** — durée, nombre de tours, fin de partie
3. **Design de la défaite** — alternative à la banqueroute sèche
4. **IA concurrentes** — 5-6 archétypes avec fonctions de réaction simples
5. **Signaux concrets de la jauge** — lesquels, à quel coût, quel niveau de bruit
6. **Objectif du projet** — prototype perso / jeu de plateau / jeu vidéo indé / outil pédagogique
7. **Structure détaillée de l'arbre de compétences**
8. **Génération procédurale de la carte** (phase 2)
9. **2 archétypes manquants** à définir
10. **Noms in-game définitifs** des archétypes

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

## Prototype minimal — cible

- 4-5 actifs / hexes marchés actifs
- Jauge de fragilité (cachée)
- 2-3 IA archétypes simples
- Carte fixe ~15-20 hexes
- Jouable en 1h
- Tester la boucle : lire les signaux → se positionner → survivre au régime
