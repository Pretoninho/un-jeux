# Le système, et son pourquoi

> Référence du créateur. Pas un journal de décisions (ça, c'est `game-design-memo.md`),
> pas l'inventaire du proto (`mecaniques.md`) : ici on explique **pourquoi** le moteur
> est construit comme il l'est, en plain français, avec les vrais noms de variables.
> À lire quand « je ne comprends plus ce qui se passe ».

---

## 0. L'idée en une phrase

> **Un état caché (la fragilité) monte avec l'avidité collective et lâche d'un coup ;
> le joueur ne le voit jamais directement, il doit le deviner à travers des signaux
> imparfaits — et la bonne lecture vaut mieux que la bonne info.**

Tout le reste découle de ça. Si une mécanique ne sert pas cette phrase, elle est de trop.

---

## 1. La boucle d'un tour (le squelette)

Un tour, c'est `runTurn()` (`src/engine/turn.ts`). L'ordre **n'est pas arbitraire** —
chaque étape produit ce que la suivante consomme :

| # | Étape | Ce qui se passe | Pourquoi à cette place |
| --- | --- | --- | --- |
| 1 | **Actions** | chaque acteur décide et exécute (budget de PA), ce qui crée un **flux** d'ordres par hexe | les décisions doivent précéder le marché : c'est l'achat/vente qui pousse les prix |
| 2 | **Régime** | `deriveRegime()` lit l'état (F + crise) → bull / tension / crise / recovery | le régime est une **lecture**, pas une décision ; il faut donc l'état déjà à jour |
| 3 | **Marché** | `resolveMarket()` tire les facteurs et met à jour chaque `V` | dépend du régime (drift/vol) et du flux (impact-prix) |
| 4 | **Carry & coût du levier** | revenu de portage encaissé, intérêt d'emprunt payé | après le marché, sur les positions du tour |
| 5 | **Appels de marge** | les positions leveragées trop perdantes sont liquidées de force → **re-injecte du flux** | la vente forcée doit pouvoir nourrir la contagion **dans le même tour** |
| 6 | **Fragilité** | `updateFragility()` (accumulation − purge), puis test de crise, puis avance de cascade | F se met à jour **après** qu'on connaît le levier/crowding du tour |
| 7 | **Signaux** | `computeSignals()` : lecture bruitée/retardée de F | observationnel, en fin de tour |
| 8 | **Comptabilité** | benchmark et richesse de chaque acteur enregistrés | pour le score et les courbes |

**Le point clé** : la contagion (étape 5 → flux → impact-prix) est **endogène**. Personne
ne « déclenche un krach ». Un liquidé vend, sa vente fait baisser le prix, ce qui liquide
le suivant. Le drame est une conséquence, pas un événement scénarisé.

---

## 2. Les deux états cachés : `F` et `A`

Le joueur voit les prix `V`. Il ne voit **jamais** deux choses :

- **`F` — la fragilité** (`state.fragility`) : le stock de risque systémique. Monte lentement,
  lâche brutalement. C'est *le* nombre que toute la partie tourne autour, et il est caché.
- **`A` — l'ancre** (`market[hex].A`) : la « juste valeur » cachée de chaque hexe. Le prix `V`
  tourne autour de `A` sans qu'on sache où est `A`.

**Pourquoi deux états cachés et pas un ?** Parce qu'ils répondent à deux questions différentes :
`F` = « le système va-t-il casser ? » (timing), `A` = « ce prix est-il cher ou décoté ? »
(valeur). Un joueur macro lit surtout `F` ; un joueur value lit surtout `A`. Deux lentilles
sur le même monde neutre (memo §26).

---

## 3. La fragilité `F` — le cœur du jeu

### Comment elle bouge (`src/engine/fragility.ts`)

À chaque tour : `F ← F + accumulation − purge`, où

```
accumulation = accLeverage · (levier agrégé)
             + accCrowding · (concentration)
             + accValuation · (étirement des valos) · 100
purge        = purgeMeanReversion
```

- **levier agrégé** = capital emprunté / richesse totale (tout le monde confondu).
- **concentration (crowding)** = à quel point le notionnel est entassé sur les mêmes clusters.
- **étirement (stretch)** = de combien les prix `V` ont décollé de leur ancre `A`.

### Quand elle casse

`crisisProbability()` :

```
F < 0.40 (zone morte)     → proba 0     : pas assez de combustible
0.40 ≤ F < 0.85 (roulette) → k·(F−0.40)² : ça PEUT lâcher, plus c'est haut plus c'est probable
F ≥ 0.85 (plafond)        → proba 1     : ça lâche, certain
```

À la crise, F se vide presque (`resetFactor · amplitude`) puis remonte.

### Pourquoi cette forme ?

- **Pourquoi cachée ?** Si `F` était une barre à l'écran, il n'y aurait plus de jeu : tu
  attends qu'elle soit rouge et tu sors. Tout le skill est dans l'**inférence** (§28.5).
- **Pourquoi une zone morte (0.40) ?** Pour que le début de partie soit **statistiquement** sûr
  sans le décréter. Pas de règle « pas de crise avant le tour N » (ce serait un script *et* un
  exploit : levier à fond pendant la grâce). La sécurité **émerge** d'un `F(0)` bas + la zone morte.
- **Pourquoi une zone roulette (le carré) et pas un seuil net ?** Un seuil net deviendrait
  apprenable (« à 0.60 ça pète »). La proba qui monte continûment maintient le **doute** :
  même haut, tu n'es jamais sûr que c'est *ce* tour-ci.
- **Pourquoi accumulation − purge, sans dépendance à F ?** Volontaire : `F` est une **rampe**
  qui ne s'auto-limite pas. C'est ce qui rend possible une partie qui ne casse jamais (la rampe
  n'atteint pas la zone chaude avant la fin) — la branche « le hoarder peut perdre/gagner sans
  drame » doit être *vécue* (memo §26.2, cible 20-25 %).

> ⚠️ C'est le piège où je suis tombé au calibrage J7 : le terme valorisation (`× 100`) était si
> gros qu'il écrasait le levier — `F` montait toujours pareil quoi que fasse le joueur. La leçon :
> les **trois termes doivent peser comparablement**, sinon le comportement du joueur ne compte plus.

---

## 4. Le moteur de prix — pourquoi un modèle à facteurs

`resolveMarket()` (`src/engine/market.ts`). Chaque prix bouge ainsi :

```
rendement = drift·β  +  bruit partagé (marché zM, cluster zC, idiosyncratique zε)  +  rappel vers A  +  impact du flux
```

- **β (beta)** : sensibilité de l'hexe au facteur marché commun.
- **zM** est tiré **une fois par tour** et touche tout le monde → c'est lui qui crée la corrélation.

### Pourquoi des facteurs partagés plutôt que des prix indépendants ?

Parce que **la corrélation doit émerger, pas être codée**. En temps normal, le facteur commun
pèse modérément → les hexes bougent un peu ensemble. **En crise**, on fait dominer le facteur
marché (`crisisVarianceMarket`) → tout devient corrélé, ρ→1. C'est *exactement* ce qui se passe
dans un vrai krach (« en crise, toutes les corrélations vont à 1 ») — et ici ça **sort du modèle**,
on ne l'a pas scénarisé.

### Pourquoi le rappel vers l'ancre `A` ?

Pour que les prix ne dérivent pas à l'infini : `V` est tiré doucement vers `A` (`lambda`). En temps
normal `A` suit la dérive fondamentale (donc une hausse calme **n'étire pas** la valo — la fragilité
doit venir des *comportements*, pas d'un marché qui monte tout seul). **En crise, `A` tient pendant
que `V` s'effondre** → la dislocation `V ≪ A` est ce qu'un value-investor peut acheter, et ce que la
recovery peut réverser (memo §25.6).

---

## 5. La cascade — pourquoi cette forme précise

Quand une crise se déclenche, sa **forme** est tirée *à ce moment-là* (`maybeTriggerCrisis`),
et elle se joue en phases (`advanceCrisis`) :

```
leg1 (chute)  →  bounce (REBOND, drift positif = le piège)  →  leg3 (la vraie jambe)   ... OU vrai plancher
                                                              →  recovery
```

- Le **rebond** a un drift **positif** : ça remonte, les signaux se détendent un peu. C'est le
  **bull trap**.
- Avec une certaine proba (`realFloorProbability`, ~30 %), le rebond **EST** le vrai plancher : pas
  de leg3, c'était fini.

### Pourquoi le mensonge du rebond ?

C'est le cœur émotionnel du jeu. Si une chute était toujours suivie d'une vraie reprise, « acheter le
creux » serait gratuit. Si elle était toujours suivie d'une deuxième jambe, « tout vendre au rebond »
serait gratuit. Comme c'est **parfois l'un, parfois l'autre, et que les signaux mentent pendant le
rebond**, le joueur doit **parier** — et c'est là que se gagne ou se perd une partie. La forme est
tirée par crise → deux krachs d'une même partie ne se ressemblent pas (anti-script intra-partie).

---

## 6. Les signaux — pourquoi bruités et retardés

`computeSignals()` (`src/engine/signals.ts`). Trois signaux observables, chacun = une lecture
**imparfaite** de `F` :

| Signal | Retard | Bruit | Idée réelle |
| --- | --- | --- | --- |
| Volatilité | 0 | fort | réagit vite, mais crie au loup |
| Écart de crédit | 1 tour | moyen | |
| Financement | 2 tours | faible | fiable, mais tu le sais **en retard** |

### Pourquoi ne pas donner un seul signal propre ?

Parce que la **tension de lecture** *est* le jeu. Trois capteurs imparfaits qui ne sont pas d'accord
te forcent à **trianguler** — et le budget de PA fait que voir coûte (tu ne peux pas tout rafraîchir
*et* agir, §28.5). Un plancher de bruit **irréductible** (§29.2) garantit qu'on ne peut **jamais**
acheter une certitude parfaite : même en payant, il reste un doute. C'est la friction qui empêche le
jeu de se résoudre en calcul.

> Le **critère d'or** (§28.7) qu'on a verrouillé en test J7 : le signal doit prédire la crise
> **mieux que le numéro de tour**. Sinon le joueur apprendrait « ça pète vers le tour 9 » sans
> rien lire — le tempo serait devenu un script. C'est *ça* que `calibration.test.ts` protège.

---

## 7. Le score — pourquoi Track Record et pas autre chose

`trackRecord()` (`src/engine/score.ts`) :

```
score = (rendement − rendement du marché)  −  α · (pire drawdown)
        \___________ excédent ___________/      \___ ce que ça a fait mal ___/
```

### Pourquoi pas le rendement brut ? Pourquoi pas le Sharpe ?

- **Pas le rendement brut** : dans un marché qui monte, être long suffit. On veut mesurer le
  **talent**, pas le beta → on soustrait le marché (benchmark).
- **Pas le Sharpe** (l'idée qu'on a tuée en §27) : le Sharpe pénalise la volatilité *des gains*
  aussi, donc il **punit** le profil du Vautour (plat, plat, +60 % d'un coup) et **récompense** le
  skew négatif (gains réguliers, perte cachée) — pile le comportement que le jeu dénonce.
- **Le drawdown mark-to-market** pénalise d'avoir *traversé* l'enfer même si tu finis bien : il
  capture la **douleur du chemin**, pas seulement le point d'arrivée. `α` règle à quel point ça pique.

---

## 8. Le principe anti-script — pourquoi tout est en « plages »

Dans `params.ts`, **aucune constante de gameplay n'est gravée** : chaque paramètre est une plage
`{min, max}`, et la partie en tire une valeur via le RNG seedé.

### Pourquoi cette discipline ?

C'est la traduction technique de « **grammaire connue, instance imprévisible** » (§4.4). Le joueur
peut apprendre *les règles* (comment marche la fragilité, à quoi ressemble une cascade) — c'est sain,
ça récompense l'expérience. Mais il ne peut pas mémoriser *les nombres* d'une partie, parce qu'ils
changent à chaque seed. Le type `Range` **force** cette discipline : câbler une valeur fixe
demanderait `min === max`, ce qui se voit immédiatement à la relecture.

C'est aussi pour ça que le calibrage se fait **en mesurant des distributions** (l'instrument
`scripts/calibrate.ts`), jamais en forçant un résultat : on règle les *générateurs* jusqu'à ce que
la **distribution** sur 1000 parties tombe dans les cibles, et on laisse chaque partie individuelle
être ce qu'elle est.

---

## 9. Comment lire une partie quand tu es perdu

Le réflexe pratique, dans l'ordre :

1. **Active le mode debug 🐞** (UI) : il révèle `F`, le régime, la phase de cascade et les ancres `A`.
   90 % des « je comprends pas » disparaissent quand tu vois `F` monter en parallèle des prix.
2. **Demande-toi : où est `F` par rapport à 0.40 et 0.85 ?** Sous 0.40 = rien ne peut casser
   (calme trompeur). Entre les deux = roulette (la tension *doit* être là). Au-dessus de 0.85 =
   c'est joué.
3. **Regarde le régime, pas seulement le prix.** Un prix qui remonte en phase `bounce` n'est pas une
   reprise — c'est peut-être le piège. Le régime te dit *dans quelle histoire* tu es.
4. **Pour un comportement de masse** (« pourquoi 70 % des parties cassent ?? »), ne fixe pas une
   partie : lance `npx vite-node scripts/calibrate.ts`. Une intuition sur une partie ment ; la
   distribution sur 1000 dit la vérité. C'est *exactement* comme ça qu'on a trouvé que la valo
   écrasait le levier en J7.
5. **Si une partie te surprend, rejoue le seed.** Tout est déterministe (même seed ⇒ même partie).
   Tu peux donc dérouler tour par tour et voir *précisément* où ça a bifurqué.

> Règle d'or de débogage : **une partie raconte une anecdote, la distribution raconte le système.**
> Quand tu doutes du *design*, mesure mille parties. Quand tu doutes d'un *bug*, rejoue un seed.
