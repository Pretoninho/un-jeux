# Processus de création d'un personnage (héros)

Recette ancrée sur le moteur réel (`src/engine/pieces.ts`, `src/engine/combat.ts`,
`src/CombatView.svelte`). Voir aussi `docs/classes.md` (archétypes, calibrage, Résonance).

## 0. Le modèle mental — deux couches

Un personnage déployé = **socle de classe** (archétype) **+** calque **perso** (héros).

| Couche | Porte quoi | Où |
|---|---|---|
| **Archétype** (`Archetype`) | calibrage de portée, verbe(s), Résonances *de classe* | `pieces.ts` → `ARCHETYPES` |
| **Personnage** (`Character`) | `id`, `name`, override de stats `profile?`, Résonances *signature* | `pieces.ts` → `CHARACTERS` |

La fusion se fait dans `makeUnitFromCharacter` → `makeUnit` : stats =
`profileFor(rangeTier)` → `archetype.profile` → `character.profile` ; Résonances =
`mergeReactions(archetype, character)` **par `id`**. Le `character.id` est recopié dans
`Unit.characterId` (identité stable, sert aussi la matrice « × personnage » et le futur draft).

## 1. Choisir l'ancrage sur la droite de calibrage

**Règle d'or : portée + robustesse = 5.** Un personnage est d'abord défini par son **palier
de portée** `r ∈ {1,2,3,4}`, et `profileFor(r)` en dérive tout (`t = 5−r`) :

| `r` (portée) | `t` | maxHp `4+3t` | dégâts `1+t` | coût att. |
|:--:|:--:|:--:|:--:|:--:|
| 1 (mêlée) | 4 | 16 | 5 | 2 |
| 2 | 3 | 13 | 4 | 2 |
| 3 | 2 | 10 | 3 | 2 |
| 4 (lointain) | 1 | 7 | 2 | 2 |

→ **Aucune pièce strictement meilleure** : tout est positionnel. Pars de là.

## 2. Décider : sur-la-droite ou hors-droite ?

- **Sur la droite** (cas normal) : tu n'écris **que** `rangeTier`, le reste est dérivé.
- **Hors-droite** (exceptionnel, ex. Duelliste) : tu poses un `profile?` partiel qui **override**
  les stats dérivées (PV 9, dégâts 2, attaque 1 PA). À utiliser avec parcimonie — c'est une dette
  d'équilibrage. **La portée, elle, reste sur la droite.**

Le `profile?` existe à **deux niveaux** : `archetype.profile` (toute la classe) ou
`character.profile` (ce héros précis, autorisé par la cible « héros uniques »).

## 3. Choisir le(s) verbe(s) actif(s)

Les verbes vivent sur l'**archétype** (leurs **nombres** sont personnalisables). Trois existent :

| Verbe | Clé | Pour qui | Effet |
|---|---|---|---|
| **Garde** | `guard: { cost, damageTakenMul }` | CAC (Lourde) | ×0.5 dégâts subis jusqu'au prochain tour |
| **Tir réservé** | `overwatch: { cost }` | distance (Tireur) | réflexe quand un ennemi s'arrête à portée |
| **Riposte** | `riposte: { cost }` | atypique (Duelliste) | contre un attaquant adjacent qui survit au coup |

Un héros **sans** le verbe ne peut pas l'utiliser (absence = capacité indisponible, c'est voulu).

## 4. Concevoir la/les Résonance(s) signature

Une Résonance = un `ReactionSpec` (donnée **pure**, sérialisable) :

```ts
{
  id: 'ma_resonance',        // UNIQUE — clé de cooldown ET de fusion (cf. piège ci-dessous)
  on: 'garde_encaissee',     // SignalType écouté (signaux dispo : §4.1)
  scope: { radius: 2 },      // ou { squad: true } (toute l'escouade)
  cooldown: 2,               // en tours du possesseur (0 = sans CD)
  kind: 'epines',            // EFFET (le moteur dispatch dessus ; effets dispo : §4.2)
  amount: 1,                 // valeur par défaut
  amountBySource?: { lourde: 2 },        // override selon la CLASSE du déclencheur (Unit.kind)
  amountByCharacter?: { a_lourde: 3 },   // override selon le HÉROS du déclencheur (Unit.characterId)
}
```

**Garde-fous tenus par le moteur** (à respecter, pas à recoder) : déterministe,
**prévisualisable** (`previewReactions`), portée par réaction, cooldown par passif,
terminaison (un passif au plus une fois par cascade).

**Sémantique du ciblage** : une Résonance réagit pour les **alliés** de la source (jamais
l'ennemi, jamais la source elle-même). L'effet vise l'attaquant.

**Lookup de la valeur** (priorité, du plus spécifique au plus général) :
`amountByCharacter[characterId]` → `amountBySource[kind]` → `amount` → `1`.

### 4.0 Modèle PAR-DUO — « un duo de héros = sa propre Résonance »

C'est l'intention de fond : chaque **binôme** (possesseur × déclencheur) a **sa** Résonance,
potentiellement un **effet distinct** — pas un effet partagé dont seul le nombre change.

Pour ça, `ReactionSpec` a un **filtre de source** :

```ts
fromKind?: string;       // ne réagit QU'À une source de cet archétype
fromCharacter?: string;  // ne réagit QU'À une source = ce héros précis
```

→ un héros porte alors **une `ReactionSpec` par duo** (chacune son `id`, son `kind`/effet, sa
portée, son CD), gâtée à son partenaire. `amountBySource`/`amountByCharacter` restent l'option
**légère** (même effet, magnitude variable).

> **Contrainte forte** : un duo n'existe que s'il a un **signal que le partenaire émet**.
> Aujourd'hui seul `garde_encaissee` existe (émis par la Garde) → seuls les duos **avec un tank**
> sont déclenchables sans créer de nouveau signal (lot moteur).

**Exemple livré — *Estoc × Bastion*** :
```ts
const EPINES_ESTOC_BASTION: ReactionSpec = {
  id: 'epines_estoc_bastion', on: 'garde_encaissee', fromCharacter: 'a_lourde',
  scope: { radius: 2 }, cooldown: 2, kind: 'epines', amount: 2,
};
```

> ⚠️ **Piège `id`** : la fusion socle+signature dédoublonne **par `id`**. Pour **cumuler** deux
> Résonances → `id` **distincts**. Réutiliser un `id` = **remplacer** (override, voulu).

### 4.1 Signaux disponibles (`SignalType`, `combat.ts`)

- `garde_encaissee` (seul existant). Ajouter un signal = un **lot moteur séparé** (émission +
  type + tests), pas une simple donnée de perso.

### 4.2 Effets disponibles (`kind`, `applyReaction`)

- `epines` (seul existant). Ajouter un `kind` = case `switch` dans `applyReaction` + **lot moteur**.

> Un personnage **« né résonant »** réutilise un signal et un effet **existants** ; inventer un
> nouveau signal/effet est un chantier moteur amont (sous-lot B de la matrice : faire varier
> l'*effet* par héros — **ajourné**).

## 5. Enregistrer le personnage

Dans `CHARACTERS` (`pieces.ts`) :

```ts
mon_heros: {
  id: 'mon_heros',
  name: 'Nom Propre',
  archetype: 'lourde',          // clé d'ARCHETYPES
  // profile?: { ... },         // seulement si hors-droite
  reactions: [MA_RESONANCE],    // signatures (optionnel)
},
```

> **Note vivier (cible « héros uniques »)** : les `id` actuels sont préfixés `a_/b_` (couplage
> camp = legacy miroir). La direction visée est un **vivier plat** (un héros = une entrée, choisi
> par n'importe quel camp). Tant que le découplage n'est pas fait, garde la convention existante.

## 6. Déployer (line-up jouable)

Dans `src/CombatView.svelte` (~l.80-85), via
`makeUnitFromCharacter(pieceId, owner, hex, CHARACTERS.mon_heros!, AP_PER_TURN)`. Le line-up par
défaut reste jouable pour tester.

## 7. Brancher l'affichage (si nouveau libellé)

Dans `src/CombatView.svelte`, si tu introduis un nouveau `kind`/`on` :

- `RESON_LABEL` : libellé de l'effet.
- `SIGNAL_LABEL` : libellé du déclencheur.
- `KIND_NAME` / `CHAR_NAME` : déjà auto-dérivés d'`ARCHETYPES`/`CHARACTERS` → rien à faire pour
  un nouveau perso.

## 8. Tester (un héros = un lot validé)

Couvre au minimum :

- `makeUnitFromCharacter` pose **nom + `characterId` + stats + signature**.
- Fusion des Résonances **par `id`** (extension vs override).
- Si Résonance : déclenchement allié, **non**-déclenchement ennemi/soi, portée, cooldown, et
  la/les cellule(s) de la matrice (`amountBySource` / `amountByCharacter` + priorité/repli).

## 9. Gates (obligatoire avant livraison)

```
npm test && npm run check && npm run build
```

## 10. Équité — ce qu'on ne tranche PAS maintenant

Héros uniques + fieldés une fois ⇒ escouades **asymétriques par nature**. L'équité devient un
**sujet de design au draft**, décidé **seulement** à la construction de l'écran de sélection.
Pendant la construction : sans gravité.

---

## Méthode globale

**Un héros = une cellule de matrice = un petit lot validé.** On façonne **un personnage à la
fois**, gates verts, line-up par défaut conservé. On n'invente un nouveau **signal/effet** moteur
que quand un héros le justifie (lot amont séparé).

## Checklist express

- [ ] Palier de portée `r` choisi (portée + robustesse = 5)
- [ ] Sur-droite, ou `profile?` justifié si hors-droite
- [ ] Verbe(s) actif(s) décidé(s) (ou aucun, assumé)
- [ ] Résonance(s) : `id` unique, signal/effet **existants**, portée, CD, matrice
- [ ] Entrée dans `CHARACTERS`
- [ ] Déployé dans le line-up (`CombatView`)
- [ ] Libellés UI si nouveau `kind`/`on`
- [ ] Tests du lot
- [ ] `npm test` + `npm run check` + `npm run build` verts
