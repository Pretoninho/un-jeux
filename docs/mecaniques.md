# Mécaniques du jeu — référence (état du prototype)

> Inventaire de ce qui **tourne réellement** dans le prototype (moteur `src/engine` + UI).
> Sert de base au **tutoriel** et aux **showcases d'archétypes**. À tenir à jour avec le code.
> Renvois au design : `docs/game-design-memo.md` (§). Dernière mise à jour : 2026-06-12.
>
> Légende : ✅ actif · 🟡 partiel / UI seulement · ⛔ pas encore branché.

---

## A. La boucle de tour & les points d'action (PA)

- ✅ **4 PA par tour** (`PA_PAR_TOUR`, `src/data/actions.ts`). Les actions coûtent des PA.
- ✅ **Fin du tour** → le marché se résout, les IA jouent, la fragilité évolue, une crise peut se déclencher.
- ✅ **Ordre interne d'un tour** (`engine/turn.ts`) : actions des acteurs → résolution du marché → carry / coût du levier → appels de marge → mise à jour de `F` → test de crise → avance de cascade → comptabilité (richesse, benchmark, signaux).

## B. Les actions (primitives) — toutes actives ✅

| Action | Coût PA | Effet |
|---|---|---|
| **DÉPLACER** | 1 | se déplacer sur un hexe marché adjacent **sans investir** + révèle les voisins (traverser / scouter) |
| **OUVRIR (Long / Short / levier)** | 1 (puis **2 en CHAIN**) | nouvelle position ; en exploration : **déplace** le joueur + **révèle** les voisins. Levier joueur 0× / 2× / 3× |
| **RENFORCER** | 1 | exposition additionnelle sur un hexe détenu |
| **CLÔTURE PARTIELLE** | 2 | réduit de **−50 %** l'exposition sur l'hexe |
| **FERMER** | 1 | solde la position (réalise le P&L) |
| **LIRE** | 1 | 🟡 révèle un signal caché *pour ce tour* (UI seulement, voir §E) |
| **RÉSERVER** | 0 | rester en cash (le joueur ne se déplace pas) |
| **S'INSTALLER** | 1 (CHAIN) | se déplacer sur un nœud + **présence ~3 tours**. **PB** ✅ → débloque le **Financement** · **Notation** ✅ → **signaux plus nets** ; BC ⛔ à venir |

- **CHAIN** (memo §9bis, exploration) : la 1ʳᵉ ouverture du tour coûte 1 PA, les ouvertures **enchaînées** ensuite coûtent **2 PA** → frein à la course sur la carte.

## C. La carte & l'exploration (prototype)

- ✅ **Carte hexagonale GÉNÉRÉE** (`src/data/maps/generate.ts`), seedée (rayon 4 = 61 hexes). **Géométrie = adjacence** : ce qui borde un hexe est ce dans quoi on peut chaîner.
- ✅ **Brouillard** : on ne voit que l'hexe courant + ses adjacents ; investir révèle les nouveaux voisins. Connaissance **persistante**.
- ✅ **Adjacence = corrélation** (memo §11) : les hexes voisins (même cluster) bougent ensemble ; **en crise, `ρ→1`** (tout tombe ensemble).
- **Types d'hexes** : **marché** (investissable ✅) · **nœud** (BC / PB / Notation — présence, ⛔ bénéfice non câblé) · **frontière** (exotiques, ⛔ verrouillé, infranchissable).
- 🟡 **Footprint des IA** visible (points colorés) sur les hexes **révélés** seulement (memo §31).

## D. Les prix : `V` public, juste valeur `A` cachée ✅

- Chaque hexe marché a une **valorisation `V`** publique (part de 100) → flèches ▲▼.
- L'**ancre `A` (juste valeur) est CACHÉE** (memo §25.2). « Bradé » = pari que `V` est sous `A`.
- **Rendement** (`engine/market.ts`) = structure à facteurs (marché `M` + cluster `C` + idiosyncratique `ε`) − réversion vers `A` + flux (impact-prix) + carry. **Borné à ±50 %/tour** (évite l'effondrement « bloqué à 0 »).
- Hors crise, `A` suit la dérive fondamentale → une hausse calme n'« étire » pas la valorisation ; en crise `A` tient pendant que `V` chute (dislocation).

## E. Le cœur caché : fragilité `F` & signaux ✅ (signaux 🟡 côté coût)

- **Jauge `F` cachée** (0→1, `engine/fragility.ts`), alimentée par le **levier + le crowding + les valorisations tendues** agrégés de tous les acteurs (memo §23). `F(0)` tirée en plage cachée.
- **Déclencheur de crise** : zone morte `< 0.40` (sûr) · zone roulette quadratique · plafond `≥ 0.85` (krach garanti).
- **3 signaux** (`engine/signals.ts`, memo §23.6) = lectures **bruitées et retardées** de `F`, ne la révèlent jamais exactement :
  - **Volatilité** (retard 0, gratuite) · **Écart de crédit** (retard 1) · **Financement** (retard 2).
  - 🟡 **Coût de LIRE** : implémenté **dans l'UI** (Volatilité gratuite ; Écart/Financement masqués, révélés par LIRE 1 PA chacun). Le moteur calcule les signaux par ailleurs.
  - ✅ **Financement verrouillé sans le PB** : il n'est accessible (puis LIRE) que si tu as une **présence active à un nœud prime broker** (memo §11). Présence persistante ~3 tours (réglable ; futur bouton d'archétype).
  - ✅ **Notation → signaux plus nets** : présence active à un nœud Notation = bruit des 3 signaux **réduit** (× 0.5), borné par un **plancher irréductible** (§29.2 : l'infra améliore sans jamais rendre certain).

## F. La crise — cascade & bull trap ✅ (memo §24)

- **Cascade** : chute (leg1) → **rebond** → (vraie jambe leg3 **OU** vrai plancher ~30 %) → recovery → reset de `F`.
- **Le rebond fait MENTIR les signaux** (ils se détendent) ; comme ~30 % des rebonds sont de vrais planchers, on ne peut pas savoir si c'est un piège.
- **Forme tirée par crise** (durées, ampleur, piège-ou-plancher) → pas de script intra-partie.

## G. Long / short, levier, P&L ✅

- **Long** gagne si `V` monte · **Short** gagne si `V` chute (P&L miroir, `engine/portfolio.ts`). Le **bull trap punit les shorts** au rebond.
- **Levier** : amplifie tout ; **appel de marge** s'il vire contre soi (un short saute si `V` *monte*). La vente forcée nourrit la contagion (flux).
- **Carry** : les positions touchent un petit portage chaque tour ; la **réserve rapporte ~0** (coût d'opportunité de l'attente).
- **P&L latent** (non réalisé) affiché global + par hexe ; **Transactions** = P&L réalisé à chaque Fermer / Clôture partielle.

## H. Le score : Track Record ✅ (memo §27)

- **Track Record = rendement excédentaire vs le marché − α · pire drawdown** (mark-to-market). Métrique de victoire.
- Bandeau du haut : **Vous / Marché / Écart** (valeur absolue **et** %) + **pire séquence** (drawdown).

## I. Les régimes (émergents) ✅

**bull / tension (melt-up) / crise / recovery** — des **lectures** de `F` + de la tendance des prix (memo §15), **jamais un scénario**. Le nombre de crises par partie est émergent.

---

## ⛔ Ce qui n'est PAS encore branché (à savoir)

- **Bénéfices des nœuds** : **PB → Financement** ✅ et **Notation → signaux plus nets** ✅ câblés (UI) ; restent ⛔ **PB → levier moins cher** (avec le levier joueur / Sismographe) et **BC → taux anticipés** (dépend de la banque centrale active, memo §21, §30.4).
- **Frontières / exotiques** : infranchissables, **pas de déblocage** (memo §11, §21).
- **LIRE** : son coût n'est câblé **que dans l'UI**.
- **IA** : footprint visible mais **non spatiales** (pas de déplacement / chemin) — memo §31.
- **Archétypes** : on joue le **profil neutre** (toutes primitives, zéro spécificité) — memo §30.
- **Tempo non calibré** : presque toutes les parties crashent (réglage = jalon **J7**).
- **Architecture multijoueur « plan & TICKs »** : documentée, non implémentée (memo §31).
- **Post-mortem révélateur** (jalon **J6**) : prévu mais pas construit.

---

## Pourquoi ce doc

Cet inventaire **est quasiment le plan du tutoriel** (A→H = la courbe d'apprentissage naturelle) et la matière des **showcases d'archétypes**. Le **tutoriel est réservé pour plus tard** (décidé le 2026-06-12) ; ce document reste la référence vivante des mécaniques en attendant.
