# Suivi de conception — Jeu 4X Investissement

> Fichier de navigation rapide. Le détail complet est dans `docs/game-design-memo.md`.
> Dernière mise à jour : 2026-06-13 — v1.17
>
> 🎯 **Calibrage J7 — COMPLET (2026-06-13)** : tempo + neutralité réglés via les paramètres
> générateurs (`src/engine/params.ts`), aucun timing/résultat forcé. **2 causes racines
> trouvées** : (1) le terme de valorisation (`×100`) noyait le levier ; (2) **`fluxImpact`
> ~100× trop fort** (flux absolu O(100), réglé pour O(1)) → l'achat normal des IA saturait
> le prix au plafond +50 %/tour, marché auto-pompé, **levier god-tier** (+2930 % de score,
> 99 % de victoires). Corrigés : `fluxImpact` 0.0002-0.0006, levier **carry-neutre**
> (`leverageBorrowRate` ≈ carry), drifts quasi nuls (marché ≈ martingale + krachs), **α=0.35**.
> **Résultats** : agrégat tempo **28/59/13** (sans/1/2+ crise) ✓ · **neutralité §28.8** : duel
> levier/value **46 %** (égalité, aucun ne domine) ✓ · drawdowns qui mordent (lev4 94 %) ✓ ·
> le **hoarder gagne 11 %** des parties (krachs) ✓ · signaux>horloge §28.7 ✓. La fragilité est
> désormais pilotée par le **COMPORTEMENT** (levier+crowding), pas par un pump global → un monde
> calme reste calme. Instrument `scripts/calibrate.ts`, 8 assertions `calibration.test.ts`.
> ⚠️ **Décisions design J7** : (a) reset relevé (`resetFactor` 0.32-0.48) → §23.5 **assoupli**
> (plus « quasi-total ») pour le rallumage pyromane ; (b) α **fixe** à 0.35 (score transparent
> §27.3) ; (c) marché à dérive ~nulle (le levier amplifie un pari, pas un gain garanti, §29.3).
>
> 🖼️ **Portabilité / rendu (note 2026-06-13, memo §13)** : moteur (TS pur) / UI séparés → rendu interchangeable. Meilleurs graphismes = **rendu web enrichi** (PixiJS/Phaser/WebGL, réutilise le moteur tel quel). **Unity** possible mais = portage C# (cadré par les tests), surtout pour builds natifs. Choix du rendu différé ; ne jamais mélanger logique et affichage.
>
> 🧩 **Nouveaux nœuds (piste 2026-06-13)** : provisionner des **hexes à effets via le système de nœuds** (réutilise présence/S'installer/durée). **D'abord des nœuds VIDES, mécanique ensuite** (un à la fois). Menu : Chambre de compensation (marge), Réseau d'initiés (4ᵉ signal), Bourse (impact-prix), Desk recherche (délai signaux), Banque d'investissement (frontières), Média (réputation). Détail memo §22/§21.
>
> 🧭 **Spawn (décision 2026-06-13)** : clusters gardés contigus (adjacence = corrélation) ; remplacer le spawn aléatoire (proto) par un spawn **choisi / par affinité d'archétype** + **draft de zones** en multi (memo §22, §21, conforme §11). À implémenter avec les archétypes / le setup §31.
>
> 📄 **Référence des mécaniques jouables : `docs/mecaniques.md`** (état réel du prototype).
> 🧠 **Le « pourquoi » du système : `docs/systeme-pourquoi.md`** (modèle mental du créateur — pourquoi chaque pièce est ainsi + guide « comment lire une partie »).
> 💳 **Spec crédit-coupons + BC : `docs/spec-credit-coupons.md`** (proposition design, phase 2 — crédit = émetteur de coupons, BC = fonction de réaction lisible **+** nœud FED influençable).
> 🎓 **Tuto réservé pour plus tard** — approche hybride pressentie (memo §22, agenda en 6 points).
> 🌐 **Archi multijoueur « plan & TICKs »** documentée (memo §31), non implémentée ; IA déjà visibles (footprint).

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
| **Restructuration profils : primitives d'abord (profil NEUTRE = bac à sable), archétypes = spécificités par-dessus (un à la fois). Short = primitive, modulée par archétype** | §30 | v1.10 |
| **Défaite : 3 stades (Stress → Crise → Effondrement)** | §14 | v0.5 |
| **Parties indépendantes — aucun carry-over entre runs** | §14 | v0.5 |

---

## Ce qui reste à développer

État réel (post-J7). Le design MVP est clos ; le moteur tourne et est calibré
(tempo §28.2 + critère §28.7). Reste, par ordre de priorité :

### A. Chantiers code immédiats (MVP)

1. ~~**Fin de J7 — vérifs numériques**~~ ✅ **FAIT (2026-06-13)** : α calibré à **0.35** (fixe,
   §27.3) ; levier **viable et non dominant** (carry-neutre + `fluxImpact` corrigé → duel
   levier/value 46 %, drawdowns qui mordent) ; **assertion de neutralité §28.8** en place
   (`calibration.test.ts`). **J7 entièrement clos.**
2. **Coutures UI (dette J5)** :
   - **Câbler le coût LIRE** — les signaux sont gratuits aujourd'hui (le budget épistémique §28.5 ne mord pas).
   - **Clôture partielle + levier joueur dans l'UI** (existent au moteur, pas exposés proprement).
   - **Écart carte 13 vs 16 hexes** à trancher/refermer (prose spec §4 = 16, adjacence = 13).
3. **Nouveaux nœuds à effets** (§11, piste tranchée) : placer des **nœuds VIDES d'abord**, câbler la mécanique ensuite, **un à la fois** (Chambre de compensation, Réseau d'initiés → 4ᵉ signal, Bourse → impact-prix, Desk recherche, Banque d'investissement → frontières, Média → réputation).
4. **Archétypes par-dessus le profil NEUTRE** — **un à la fois** (définir → tester → équilibrer → valider → suivant, §30). Le neutre + primitive SHORT sont livrés ; les spécificités sont la couche suivante.
5. **Spawn par affinité / draft de zones** (§22, §11) : remplacer le spawn **aléatoire** du proto par un placement choisi par affinité d'archétype (clusters gardés contigus).

### B. Phase 2

6. **Génération procédurale de la carte** (géométrie = adjacence ; le proto d'exploration la fait déjà côté UI).
7. **Multijoueur « plan & TICKs »** (§31, WebSockets) : phase de choix simultanée + observation en TICKs (déplacements révélés, investissements cachés).
8. **Crédit-coupons + Banque centrale** (spec `docs/spec-credit-coupons.md` **close**, b+c). Sous-système entier = phase 2, pas MVP-critique.
   - ✅ **Phase 2a étape 1 (2026-06-13)** : moteur autonome `src/engine/credit.ts` + 18 tests — formation du taux (r_BC + spread_qualité + spread_F + prime de terme), réaction BC lisible, carnet court/long, portage long/short, défaut tout-ou-rien en crise, échéance vrai-bond. **Pas encore branché** dans la boucle de tour.
   - 🔧 **Décision archi (même jour)** : le flux RNG du **monde** est découplé de celui des **params** (`init.ts`) → ajouter des paramètres ne décale plus le comportement seedé (tests/calibrage stables). La phase 2a en ajoutera beaucoup. Re-vérifié : agrégat tempo 28/59/13 ✓, duel levier/value 40 % (bande 40-60) ✓.
   - ⏭️ **Étape 2 (à faire)** : intégration — sortir le crédit du monde `V`, benchmark alpha-pur, comptabilité richesse des coupons, IA qui jouent les coupons, UI.

### C. Backlog design (hors MVP)

8. **Arbre de compétences détaillé** (§8).
9. **2 archétypes manquants** à définir + **noms in-game définitifs** des 5 archétypes.
10. **Tutoriel** — approche hybride pressentie (agenda en 6 points), **réservé pour plus tard**.

> Prochaine étape concrète recommandée : soit **finir J7** (α + levier + neutralité §28.8, l'outillage est prêt), soit attaquer les **nœuds vides** (3) / le **1ᵉʳ archétype** (4). Les coutures UI (2) sont à refermer avant tout test joueur réel.

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
> **Code : J3 ✅** — cascade complète (§24) : machine à phases leg1→rebond→(leg3 ou vrai plancher)→recovery, **forme tirée par crise** (anti-script intra-partie), bull trap en P&L, reset `F∝amplitude`. **Signaux observables** (`signals.ts`, §23.6) : bruités/retardés, plancher en plages, **mensonge du rebond** ambigu (§24.2). Instrument horloge-vs-signaux (§28.7) posé (assertion stricte → J7). **46 tests**, typecheck + build OK.
>
> **Code : J4 ✅** — les 2 IA rule-based via **fonction de réaction paramétrée** (`engine/ai.ts`, memo §16) ; comportements en données sur le profil. Fonds leveragé (momentum+levier, volatilité perçue bruitée) · Value patient (décote via estimation bruitée de `A`, sans levier, ne panique pas). Les IA ne voient jamais `F`/`A` → derrière la courbe, émergent. **51 tests**, typecheck + build OK. **⚠️ J7** : taux de crise sature (~100 %) au tempo par défaut → cibles §28.2 (20-25 % sans crise) à régler.
>
> **Code : J5 ✅** — UI vue principale (`App.svelte`, `lib/layout.ts`). Carte SVG 13 hexes, signaux (3 barres, F cachée), actions (Ouvrir/Fermer/Réserver + PA), bandeau Track Record, journal, seed. Joueur humain = `Policy` UI → moteur inchangé. Build OK, 51 tests. **Coutures** : signaux gratuits (coût LIRE pas câblé) · clôture partielle/levier hors UI · 13 hexes (écart 13/16 ouvert). Prochaine étape : **J6 — détail d'hexe + post-mortem** (courbe `F` révélée).
>
> **Proto exploration (UI, hors moteur)** : carte hexagonale **générée** (géométrie = adjacence), brouillard, déplacement par investissement, CHAIN (1 PA puis 2), S'installer sur nœuds (présence), exposition par hexe, Track Record en valeur absolue + %.
>
> **Restructuration archétypes (en cours)** : on bâtit d'abord un **profil NEUTRE** (`src/data/archetypes/neutre.ts`) = toutes les primitives, aucune spécificité → bac à sable de mécanique. **Primitive SHORT livrée** : `Position.direction` long/short, P&L miroir, appel de marge et flux sensibles au sens (moteur) + sélecteur Long/Short et affichage du sens (UI). 62 tests. Les archétypes (spécificités par-dessus le neutre) seront développés **un à la fois** ensuite.
>
> **Bénéfices des nœuds câblés (prototype)** : **PB → Financement** (flux continu gratuit sur présence) · **PB → levier −50 %** (`borrowMultiplier`, moteur) · **Notation → signaux plus nets** (plancher de bruit irréductible §29.2). **BC → taux anticipés** reste ⛔ (dépend du chantier « réveiller la BC »). **Présence à durée ~3 tours** (`presenceUntil`) = futur bouton d'archétype. **Levier joueur** 0/2/3× exposé (UI). Primitive **DÉPLACER** (bouger sans investir, 1 PA) + **« Ouvrir ici »** (investir sur l'hexe courant). **Mode debug 🐞** (révèle F / régime / phase / ancres A). Réf : `docs/mecaniques.md`.
>
> ✅ **Calibrage J7 — LIVRÉ**. Diagnostic d'origine confirmé puis corrigé. **Cause racine** :
> `accValuation × stretch × 100` dominait (~0.10-0.19/tour) → F pilotée par les IA, levier noyé,
> crise quasi certaine dès le tour 4. **Réglages** (tous en plages, `params.ts`) : valorisation
> ramenée au niveau levier/crowding, levier relevé (`accLeverage` 0.08-0.16 = moteur), purge
> élargie (0.020-0.058 = variance de pente → parties calmes), `crisisK` adouci (0.7-1.1),
> `f0` élargi (0.08-0.36), drifts bull/tension abaissés, cascades raccourcies, horizon 13-16,
> reset relevé 0.32-0.48 (§23.5 assoupli, décision design). **Résultats** (800 parties/profil) :
> sans-crise 24 % ✓ · crise<t5 <1 % ✓ · F(t6)~0.50 (plus de plafond précoce) ✓ · drawdown
> 23-58 % ✓ · signaux>horloge ✓ · doubles lev4 ~11 % ✓ · 1-crise ~72-83 % (canonique). Le
> **comportement façonne la distribution** : hoarder 38 % calme / 1 % double, pyromane 6 % / 11 %.
> Outils : `scripts/calibrate.ts` (instrument), `calibration.test.ts` (6 assertions anti-régression).
>
> POSITIONNER (memo §9bis, v1.9) : Ouvrir (Long/Short) · Renforcer · **Clôture partielle (2)** · Fermer. En données : `src/data/actions.ts`.
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
