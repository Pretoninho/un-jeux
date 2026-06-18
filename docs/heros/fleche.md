# Fiche de création — **Flèche** (héros)

> Exemple **complet** de création d'un héros, déroulé étape par étape selon `docs/personnages.md`
> (+ `docs/classes.md`, `docs/resonances.md`). Couvre : prénom → archétype → stats → verbe →
> Résonance → **Némésis** → enregistrement → déploiement → UI → tests. Rien d'omis.
>
> **Statut : SPEC (proposée).** Aucun code n'est encore écrit dans `pieces.ts` — cette fiche est le
> plan validable. Le câblage (CHARACTERS + tests) est l'étape finale, sur ton feu vert.

---

## 0. Identité

| Champ | Valeur |
|---|---|
| **Prénom (affiché)** | **Flèche** |
| **`id` (neutre, ASCII)** | `fleche` |
| **Archétype** | **Tireur** (`tireur`) |
| **Intention** | 3ᵉ Tireur du vivier — un **« sniper d'exécution »** : il *peint* une cible pour son prochain tir. Distinct de Mireille (soutien/silence) et d'Orso (contrôle slow/root). |

Convention respectée : `id` = nom neutre minuscule (comme `bastion`, `estoc`…), `name` = prénom propre.

---

## 1. Ancrage sur la droite de calibrage — **portée + robustesse = 5**

Flèche **hérite** du palier de son archétype Tireur : `rangeTier = 4` → `t = 5 − 4 = 1`.
`profileFor(4)` dérive **tout** :

| Stat | Formule | Valeur |
|---|---|---|
| Portée | `rangeTier` | **4** |
| PV (`maxHp`) | `4 + 3t` | **7** |
| Dégâts | `1 + t` | **2** |
| Coût d'attaque | constant | **2 PA** |

→ « distance-verre » : frappe loin, meurt au contact. Aucune pièce strictement meilleure.

## 2. Sur-la-droite ou hors-droite ?

**Sur la droite** — on n'écrit **aucun** `profile?`. Flèche prend les stats Tireur telles quelles
(pas de dette d'équilibrage). *(Un `character.profile` partiel resterait possible pour un Tireur
« sur-mesure », mais on s'en passe ici — c'est plus propre.)*

## 3. Verbe(s) actif(s) + mobilité

| Axe | Valeur | Source |
|---|---|---|
| **Verbe** | **Tir réservé** (`overwatch: { cost: 3 }`) | hérité de l'archétype Tireur |
| Garde / Riposte | absents | (non-Tireur) → indisponibles, voulu |
| **Mobilité** (`moveCap`) | **aucune** → 4 pas/tour | l'archétype Tireur n'est pas plafonné (seule la Lourde l'est) |

Conséquence : Flèche **émet le signal `tir_reserve`** quand son guet part → il peut servir de
*partenaire* (déclencheur) aux Résonances d'autres héros (ex. Bastion × Flèche se chargerait).

## 4. Résonance signature — **Flèche × Bastion** (« cible peinte »)

Thème de Flèche : **focus / exécution** (mise en place de burst). Premier duo (les 3 autres de sa
rangée = lots suivants, même procédé) :

> *Quand **Bastion** (en garde) encaisse un coup, Flèche **MARQUE** l'attaquant → le **prochain tir**
> de Flèche sur lui gagne **+1**, puis la marque tombe.*

```ts
// pieces.ts — à placer près des autres ReactionSpec
const MARQUAGE_FLECHE_BASTION: ReactionSpec = {
  id: 'marquage_fleche_bastion', on: 'garde_encaissee', fromCharacter: 'bastion',
  scope: { squad: true }, cooldown: 2, kind: 'marquage', amount: 1, duration: 2,
};
```

**Décomposition (rien d'inventé — signal ET effet existants → héros « né résonant ») :**

| Clé | Choix | Pourquoi |
|---|---|---|
| `id` | `marquage_fleche_bastion` | **unique** (clé de CD + de fusion) |
| `on` | `garde_encaissee` | signal **existant**, émis par Bastion qui encaisse en garde |
| `fromCharacter` | `bastion` | duo **gâté au partenaire** (ne réagit qu'au signal de Bastion) |
| `scope` | `{ squad: true }` | Flèche tire de **loin** → portée escouade (jamais collé au tank) |
| `kind` | `marquage` | effet **existant** : pose `Unit.mark` (`by = Flèche`), +`amount` au **1ᵉʳ coup de Flèche**, `duration` tours, puis tombe / se consomme |
| `amount` | `1` | +1 au tir marqué |
| `cooldown` | `2` | anti-spam (2 tours de Flèche) |
| `duration` | `2` | la marque tient 2 tours de Flèche si non consommée |

**Garde-fous (tenus par le moteur, à ne pas recoder)** : déterministe, prévisualisable
(`previewReactions`), portée par réaction, CD par passif, terminaison. Sémantique : la Résonance
réagit pour les **alliés** de la source (jamais l'ennemi/soi) ; ici l'effet **marque l'attaquant**
(la cible offensive `targetId`).

**Contrainte signal — vérifiée ✓** : le duo n'existe que si le partenaire émet un signal. Bastion
émet `garde_encaissee` (verbe Garde) → OK, déclenchable **sans** créer de signal moteur.

**Réciprocité de l'arête** : le sens *Bastion × Flèche* (Bastion réagit au `tir_reserve` de Flèche)
existe **déjà par construction** — la Résonance de Bastion `CHARGE_BASTION_*` est gâtée à *ses*
partenaires Tireurs. ⚠️ Aujourd'hui Bastion liste `CHARGE_BASTION_MIREILLE` et `CHARGE_BASTION_ORSO`
mais **pas** `…_FLECHE` → pour la réciprocité, ajouter `CHARGE_BASTION_FLECHE` (sur `tir_reserve`,
`fromCharacter: 'fleche'`). *(Suit le même patron ; à inclure si on veut l'arête réciproque dès la
création.)*

**Dormance** : tant que Flèche **et** Bastion ne sont pas dans la **même** escouade, le duo est
**dormant** (masqué dans l'UI). Naturel (le draft décide).

> **Reste de la rangée de Flèche (lots suivants, optionnels)** : × Rempart (`garde_encaissee`),
> × Estoc et × Fil (`riposte`). Même procédé, 1 duo = 1 cellule validée.

## 5. NÉMÉSIS — *ne pas l'oublier*

Némésis = système **frère** de la Résonance, mais il vise le **tueur** (un ennemi), pas les alliés.
**Automatique** aujourd'hui : `resolveNemesis` se déclenche si `killer.kind === dead.kind` et camps
opposés (deux **mêmes archétypes** sont toujours ennemis car une escouade = 1 de chaque).

**Pour Flèche (Tireur)** — **aucune donnée à écrire** (c'est émergent) :

| Aspect | Valeur pour Flèche |
|---|---|
| Ses Némésis | **les autres Tireurs ennemis** : **Mireille**, **Orso** (et tout futur Tireur) |
| Déclencheur | **tuer** son Némésis = avoir infligé les **derniers dégâts** (`Unit.lastHitBy`), peu importe la cause (tir, tir réservé, réaction) |
| Effet | l'**équipe du tueur** gagne `Unit.elan` = **bonus de PA au prochain tour** |
| **Magnitude** | `bonus = max(1, round(maxHp_du_mort / 8))`. Un Tireur mort a `maxHp = 7` → `round(7/8) = 1` → **+1 PA**, **1 tour** (anti-snowball), **CD 2** sur le tueur. |
| Statut actuel | **LIVE** dès qu'un Tireur ennemi est sur le plateau (Mireille/Orso existent) — contrairement à un archétype inédit dont la Némésis serait *dormante*. |
| UI | badge `⚡ Élan` (déjà câblé) — rien à faire. |

> **Découplage à venir (priorité #3, non construit)** : quand `isNemesis(killer, dead)` + couche de
> données arrivera, on pourra **déclarer** une rivalité **thématique** propre à Flèche (inter-archétype,
> ex. `Character.nemesis`). Pour l'instant : **règle archétype par défaut**, rien à coder.

## 6. Enregistrement dans `CHARACTERS` (`pieces.ts`)

```ts
fleche: { id: 'fleche', name: 'Flèche', archetype: 'tireur', reactions: [MARQUAGE_FLECHE_BASTION] },
```

*(Vivier plat : `id` neutre, découplé des camps. Assignable à n'importe quel camp au déploiement.)*

## 7. Déploiement & draft — **le point à ne pas oublier**

Avec l'**écran de setup**, Flèche **apparaît automatiquement** comme **3ᵉ choix** dans le slot
**Tireur** (`heroesOf('tireur')` = Mireille / Orso / **Flèche**). Aucun câblage de line-up à faire.

⚠️ **Impact sur `complementOf`** (`CombatView`) : la logique « l'adversaire prend le héros
complémentaire » suppose **2 héros par archétype**. Avec **3 Tireurs**, `complementOf` choisit
toujours *le premier ≠ ton pick* → **fonctionne** (chaque camp a bien 1 Tireur) mais le « complément
forcé » devient arbitraire (Bob n'aura jamais Flèche selon ton choix). **Non bloquant**, mais c'est le
1ᵉʳ cas qui **motive un vrai draft** (choix libre des deux camps) — à acter quand on construira le draft.

## 8. UI — libellés

**Rien à brancher.** Flèche n'introduit **ni nouveau `kind` ni nouveau `on`** : `marquage` et
`garde_encaissee` ont déjà leurs libellés (`RESON_LABEL`/`SIGNAL_LABEL`), glyphe et détail. `KIND_NAME`
/ `CHAR_NAME` sont auto-dérivés → le nom « Flèche » s'affiche tout seul.

## 9. Tests à ajouter (`engine/pieces.test.ts` + `engine/combat.test.ts`)

- **Fabrique** : `makeUnitFromCharacter('fleche', …)` pose `name: 'Flèche'`, `characterId: 'fleche'`,
  `kind: 'tireur'`, stats **portée 4 / PV 7 / dégâts 2 / coût 2**, `overwatch` présent, et la Résonance
  `marquage_fleche_bastion` dans `reactions`.
- **Résonance** : Bastion (en garde) encaisse + Flèche à portée escouade → l'attaquant reçoit
  `mark { by: 'fleche', bonus: 1 }` et le CD est posé ; **non**-déclenchement si la source n'est pas
  Bastion (`fromCharacter`).
- **Némésis** : Flèche achève un Tireur ennemi → l'**équipe de Flèche** gagne `elan` (+1) et
  `cooldowns.nemesis = 2` (réutilise le patron du test Némésis existant).

## 10. Gates (obligatoire)

```
npm test && npm run check && npm run build
```

---

## Checklist express — Flèche

- [x] Prénom + `id` : **Flèche** / `fleche`
- [x] Archétype : **Tireur**
- [x] Palier de portée `r = 4` (sur-droite) → PV 7 / dégâts 2 / portée 4 / coût 2
- [x] Pas de `profile?` (sur-droite, pas de dette)
- [x] Verbe : **Tir réservé** ; `moveCap` : aucun
- [x] Résonance signature : `marquage_fleche_bastion` (`id` unique, signal+effet **existants**, escouade, CD 2)
- [x] **Némésis** : automatique vs Tireurs ennemis (Mireille/Orso), élan **+1**, **LIVE**
- [ ] Entrée `CHARACTERS` (à câbler) + réciprocité `CHARGE_BASTION_FLECHE` (optionnel)
- [ ] Note draft `complementOf` (3 Tireurs)
- [ ] Tests du lot
- [ ] Gates verts
