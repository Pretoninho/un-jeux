# Créer une Résonance (duo) — procédé

Recette pas-à-pas pour ajouter une **Résonance** (synergie d'escouade). Source de vérité du code :
`src/engine/combat.ts` (moteur de réactions) et `src/engine/pieces.ts` (specs portées par les héros).
Voir aussi `docs/personnages.md` (créer un héros) et `CLAUDE.md` (décisions en vigueur).

## 0. Le modèle mental

Une **Résonance** = une **réaction en chaîne** : un événement de combat émet un **signal typé** ;
les **alliés** dont un passif (`ReactionSpec`) écoute ce type **réagissent**. La spécificité du duo
vit dans la donnée (`fromCharacter`/`fromKind` + l'effet `kind`). On ne câble que les **cellules
utiles** d'une matrice **possesseur × déclencheur** qui *émerge*.

Garde-fous tenus par le moteur (à respecter, pas à recoder) : **déterministe**, **prévisualisable**
(`previewReactions`), **portée** par réaction, **cooldown** par passif, **terminaison** (file FIFO
bornée + un passif au plus une fois par cascade), et **ciblage allié** (un passif réagit pour les
alliés de la source, jamais l'ennemi, jamais soi).

> **Un duo = une arête DIRIGÉE** : le *possesseur* réagit au *signal du partenaire*. La réciprocité
> émerge en remplissant les deux sens de la matrice.

## 1. Choisir le DUO (possesseur × partenaire)

- **Possesseur** : le héros qui porte la Résonance et réagit.
- **Partenaire / source** : l'allié dont l'**action émet le signal** qui déclenche.
- **Contrainte structurelle** : une escouade = **1 de chaque archétype** → deux héros du **même
  archétype** ne sont jamais coéquipiers → **tous les duos sont inter-archétypes** (Lourde↔Tireur,
  Lourde↔Duelliste, Tireur↔Duelliste).
- Le duo n'est **vivant** que si les deux héros sont **fieldés ensemble** (même camp) ; sinon il est
  *dormant* (défini en donnée, masqué en jeu). Le panneau **✦ Matrice de Résonance** montre la densité.

## 2. Le SIGNAL (le déclencheur)

Un duo n'existe que si le partenaire **émet un signal**. C'est le **vrai facteur limitant**.

### Signaux disponibles (`SignalType`, `combat.ts`)
| Signal | Émis quand | Émis par (archétype) | Porte |
|---|---|---|---|
| `garde_encaissee` | un allié **en garde** encaisse | Lourde | `sourceId` = l'encaisseur · `attackerId` = l'attaquant |
| `tir_reserve` | le **Tir Réservé** part (`resolveOverwatch`) | Tireur | `sourceId` = le guetteur · `attackerId` = la cible touchée |
| `riposte` | la **Riposte** part (`strike`) | Duelliste | `sourceId` = le riposteur · `attackerId` = l'attaquant |
| `rale` | une pièce **meurt** (`reap`) | n'importe qui | `sourceUnit` = **snapshot** du défunt (il est déjà retiré) |

### Créer un nouveau signal
Si l'action visée n'émet rien encore, c'est un **lot moteur séparé** (pas gratuit) :
1. ajouter le type à `SignalType` ;
2. l'**émettre** au bon endroit (ex. dans `strike`/`resolveOverwatch`/`reap`), avec `sourceId` et
   `attackerId` (et `sourceUnit` si la source disparaît) ;
3. ajouter son libellé UI (`SIGNAL_LABEL`) et **tester**.

> Exclusivité : un même coup émet **au plus un** de `garde_encaissee`/`riposte` (Garde = Lourde,
> Riposte = Duelliste — jamais sur la même pièce).

## 3. L'EFFET (`kind`)

L'effet est une **primitive** que le moteur exécute (`switch` dans `applyReaction`). **Réutilise une
primitive existante** par défaut ; n'en crée une **que pour une mécanique absente** (lot moteur).

### Effets disponibles (`kind`)
| `kind` | Effet | Cible | Persistant ? |
|---|---|---|---|
| `epines` | dégâts relayés (réduits si la cible est en garde) | attaquant | non |
| `marquage` | +bonus au 1ᵉʳ coup du possesseur sur la cible | attaquant (`Unit.mark`) | oui |
| `estropier` | −déplacement (attaques intactes) | attaquant (`Unit.cripple`) | oui |
| `provocation` | tire la cible d'1 case **vers** le possesseur | attaquant | non |
| `ruee` | le possesseur avance d'1 case **vers** la cible | possesseur | non |
| `vendetta` | +dégâts à la prochaine attaque de l'allié | **source** (`Unit.vendetta`) | oui (sans expiration) |
| `ralliement` | téléport sur le défunt + immunité totale | **possesseur** (`Unit.block`) | oui |
| `etourdir` | charge → la prochaine attaque **étourdit** | source puis cible (`stunCharge`/`stun`) | oui |
| `silence` | la cible ne peut **que se déplacer** | attaquant (`Unit.silence`) | oui |

### Choisir la CIBLE de l'effet
`PendingReaction` porte tout ce qu'il faut — choisis selon l'effet :
- **offensif** → `targetId` (l'ennemi). *Ajoute le `kind` à `NEEDS_TARGET`* (ne part pas sans cible).
- **soutien** → `sourceId` (l'allié émetteur ; ex. `vendetta`).
- **soi** → `listenerId` (le possesseur ; ex. `ralliement`).
- **déplacement vers la source** → `sourceHex` (ex. téléport).

### Créer un nouvel effet
Case `switch` dans `applyReaction`. Si **persistant** : ajouter un champ statut sur `Unit`, le
**décompter** dans `endTurn` (helper `tickStatus` pour les `{owner, expiresIn}`), et le **lire** à
l'endroit concerné (`damageTaken`, `strike`, `canAttack`, `moveBudget`…). Penser à le **silencer**
(stun/silence l'ignorent déjà dans `pendingReactions`).

## 4. Écrire la `ReactionSpec`

```ts
const MON_DUO: ReactionSpec = {
  id: 'effet_possesseur_partenaire', // UNIQUE (clé de cooldown ET de fusion)
  on: 'garde_encaissee',             // §2
  fromCharacter: 'bastion',          // gâté au PARTENAIRE précis (ou fromKind: 'lourde')
  scope: { squad: true },            // ou { radius: n }
  cooldown: 3,                       // §5
  kind: 'silence',                   // §3
  amount: 1,                         // magnitude (selon l'effet)
  duration: 2,                       // si effet persistant
};
```

> ⚠️ **Piège `id`** : la fusion socle+signature dédoublonne par `id`. Deux Résonances qui doivent
> **coexister** sur un héros = `id` **distincts**.

## 5. Conventions de nombres

- **Portée** : `radius` (les deux héros doivent être proches — ex. Estoc au contact du tank) **ou**
  `squad` (toute l'escouade — ex. un Tireur qui tire de loin ne sera jamais collé à son partenaire).
- **Cooldown — la convention « tours pleins »** : le CD se décompte au **début du tour du possesseur**.
  Comme la plupart des déclencheurs partent **au tour adverse**, **`cooldown = N+1` pour « N tours
  pleins »** (ex. « 2 tours pleins » → `cooldown: 3`). `cooldown: 1` ≈ aucun temps mort réel.
- **Durée d'un effet persistant** : même piège. Posée **pendant le tour de la cible** (ex. `estropier`,
  `silence`), `duration = N+1` pour « N tours pleins ». Posée **au tour adverse** (ex. `block`), `duration`
  ≈ N tours pleins. → on **affine au playtest**, on ne sur-théorise pas.

## 6. Brancher sur le héros

Dans `CHARACTERS` (`pieces.ts`) :
```ts
mireille: { id: 'mireille', name: 'Mireille', archetype: 'tireur', reactions: [SILENCE_MIREILLE_BASTION, REPLIQUE_MIREILLE_ESTOC] },
```

## 7. Brancher l'UI (`CombatView.svelte`)

- `RESON_LABEL[kind]` — libellé de l'effet (si nouveau `kind`).
- `EFFECT_ICON[kind]` — icône pour la **matrice** (si nouveau `kind`).
- `SIGNAL_LABEL[on]` — libellé du déclencheur (si nouveau signal).
- **Ligne de détail** dans le panneau `?` (un `{:else if rx.kind === '…'}` décrivant l'effet).
- **Badge d'état** sur les panneaux **et** `pieceStates` (icône sur la pièce) si l'effet pose un statut.
- **Texte de preview de chaîne** (`chainPreview`) si l'effet part sur `garde_encaissee` (il apparaît
  quand tu attaques un tank adverse en garde).

## 8. Tester

Au minimum : **déclenchement** (l'effet part), **gating** (`fromCharacter` : un autre partenaire ne
déclenche pas), **portée** (hors `radius` = rien), **cooldown**, et — si persistant — **application +
expiration**. Pour un statut : vérifier ce qu'il **bloque/modifie** (attaque, déplacement, réactions…).

## 9. Gates (obligatoire)

```
npm test && npm run check && npm run build
```

## 10. NÉMÉSIS — le système frère (pour mémoire)

La **Némésis** est l'inverse antagoniste de la Résonance : même bus d'événement (`rale`), mais la
réaction vise le **tueur** (un ennemi du mort), pas les alliés. Automatique entre **mêmes archétypes**.
Voir `CLAUDE.md` → section *Némésis* (déclencheur `resolveNemesis`, attribution du kill `lastHitBy`).

## Checklist express

- [ ] Duo choisi (possesseur × partenaire, inter-archétypes)
- [ ] Signal : réutilisé, ou **créé** (lot moteur : type + émission + libellé + tests)
- [ ] Effet : `kind` réutilisé, ou **créé** (case `switch`, + statut/tick/lecture si persistant, + `NEEDS_TARGET` si offensif)
- [ ] Cible de l'effet décidée (`targetId` / `sourceId` / `listenerId` / `sourceHex`)
- [ ] `ReactionSpec` écrite (`id` unique, `fromCharacter`/`fromKind`, scope, cooldown, magnitude/durée)
- [ ] Branchée sur le héros (`CHARACTERS`)
- [ ] UI : libellés / icône matrice / détail / badge+`pieceStates` / preview de chaîne
- [ ] Tests (déclenchement, gating, portée, CD, persistance)
- [ ] `npm test` + `npm run check` + `npm run build` verts

---

# Annexe — référence des clés

## A. Les clés d'une `ReactionSpec`

| Clé | Type | Rôle | Obligatoire |
|---|---|---|:--:|
| `id` | `string` | Identifiant **unique** du passif. Sert de **clé de cooldown** (`Unit.cooldowns[id]`) ET de **clé de fusion** (dédoublonnage socle/signature par `id`). | ✅ |
| `on` | `SignalType` | Le **signal écouté** (`garde_encaissee` · `tir_reserve` · `riposte` · `rale`). | ✅ |
| `scope` | `{ radius: n }` \| `{ squad: true }` | **Portée** : la source et le possesseur doivent être à `radius` cases (`inScope`), ou aucune contrainte (`squad`). | ✅ |
| `cooldown` | `number` | **CD** en tours du possesseur (décompté à `endTurn`). `0` = sans CD. Convention « tours pleins » : voir §5. | ✅ |
| `kind` | union | L'**effet** exécuté (le moteur dispatch dessus dans `applyReaction`). | ✅ |
| `amount` | `number?` | **Magnitude** de l'effet (sens selon le `kind` — voir B). Défaut `1` via `reactionAmount`. | selon kind |
| `duration` | `number?` | **Durée** d'un effet persistant, en tours (sens selon le `kind`). | selon kind |
| `fromCharacter` | `string?` | **Gâte au HÉROS source** : ne réagit que si `source.characterId === fromCharacter` (« un duo = sa Résonance »). | — |
| `fromKind` | `string?` | **Gâte à l'ARCHÉTYPE source** : ne réagit que si `source.kind === fromKind`. | — |
| `amountBySource` | `Record<kind, number>?` | Override de `amount` **selon l'archétype** de la source (matrice possesseur × classe-déclencheur). | — |
| `amountByCharacter` | `Record<characterId, number>?` | Override de `amount` **selon le héros** de la source (plus spécifique). | — |

**Priorité de `reactionAmount`** : `amountByCharacter[source.characterId]` → `amountBySource[source.kind]` → `amount` → `1`.

## B. Les clés utilisées par effet (`kind`)

Pour chaque effet : ce que `amount`/`duration` signifient, et **quelle pièce** l'effet vise.

| `kind` | `amount` = | `duration` = | Cible | Persistant |
|---|---|---|---|:--:|
| `epines` | dégâts relayés (réduits si garde) | — | attaquant (`targetId`) | non |
| `marquage` | bonus au 1ᵉʳ coup du possesseur | tours de la marque | attaquant (`Unit.mark`) | oui |
| `estropier` | pas de déplacement en moins | tours de l'estropie | attaquant (`Unit.cripple`) | oui |
| `provocation` | cases tirées (= 1) | — | attaquant (déplacé vers le possesseur) | non |
| `ruee` | cases avancées (= 1) | — | possesseur (avance vers la cible) | non |
| `vendetta` | bonus à la prochaine attaque | — *(sans expiration)* | **source** (`Unit.vendetta`) | oui |
| `ralliement` | — | tours d'immunité (`Unit.block`) | **possesseur** (téléport + immunité) | oui |
| `etourdir` | **durée du stun** posé (tours) | persistance de la **charge** | source (`Unit.stunCharge`) → attaquant (`Unit.stun`) | oui |
| `silence` | — | tours du silence | attaquant (`Unit.silence`) | oui |

> **Clé de ciblage** (depuis `PendingReaction`) : `targetId` (ennemi/offensif) · `sourceId` (allié
> émetteur/soutien) · `listenerId` (le possesseur lui-même) · `sourceHex` (case de la source, pour un
> déplacement vers elle). On choisit selon l'effet — c'est ce qui distingue *offensif* / *soutien* / *soi*.

## C. Les statuts persistants (sur `Unit`)

Posés par les effets ci-dessus, **lus** à l'endroit concerné et **décomptés** à `endTurn` (via
`tickStatus` pour les `{ owner, expiresIn }`) :

| Champ `Unit` | Effet en jeu | Lu par |
|---|---|---|
| `mark` | +bonus au 1ᵉʳ coup du marqueur | `strike` (consommé) |
| `cripple` | −déplacement (attaques intactes) | `moveBudget` |
| `block` | immunité TOTALE aux dégâts | `damageTaken` → 0 |
| `vendetta` | +dégâts à la prochaine attaque | `strike` (consommé) |
| `stunCharge` | « prochaine attaque étourdissante » | `strike` (consommé → pose `stun`) |
| `stun` | PA forcés à 0 + Résonances silencées | `endTurn` (PA=0), `pendingReactions` |
| `silence` | ne peut QUE se déplacer | `isSilenced` (canAttack/verbes/réactions/Némésis) |
| `elan` | +PA au prochain tour (récompense Némésis) | `endTurn` (rechargement) |
| `lastHitBy` | dernier attaquant (attribution du kill) | `resolveNemesis` |
