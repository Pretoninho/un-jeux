# Refonte — Chaises musicales × Démineur

> ⭐ **ÉTOILE POLAIRE (2026-06-14) — le principe qui prime sur tout le reste de ce doc.**
>
> **Le moteur est une machine à états déterministe ; on lui a mis une peau *réaliste*
> (caché, incertain, latent, façon quant). On la remplace par une peau *ludique*
> (visible, déterministe, logique). Même moteur, philosophie d'information OPPOSÉE.**
>
> **Règle d'or :** *tout ce qui est caché devient soit **VISIBLE**, soit **SUPPRIMÉ**.
> Une règle valide est un **SI→ALORS** qu'un joueur peut énoncer à voix haute.*
>
> Pourquoi : le fun tactique a besoin de **(1) conséquence lisible** et **(3) lire les
> autres**. La peau quant **mure** précisément ces deux choses (on ne lit pas un RNG
> caché, on ne déjoue pas du bruit) → le jeu ne s'allume pas. Le moteur (la part chère,
> réussie) **reste** ; la peau incertaine (la part qui bloque le fun) est aussi la **moins
> chère à changer**. Application concrète : `F` cachée → **charge visible** (chiffre sur
> l'hexe) ; signaux bruités/retardés/menteurs, ancre `A`, régimes, mensonge du rebond →
> **supprimés** ; crowding→danger → **règle énonçable** (« trop de monde charge cet hexe
> → il explose au prochain tick ») ; contagion → **chaîne visible à la Bomberman**.
>
> **Convergence :** sous cette étoile, le « jeu de base » et la piste ci-dessous visent
> la **même** réponse — *des règles simples et logiques sur un excellent moteur*. Il n'y a
> peut-être jamais eu deux jeux, juste un moteur qui attendait la bonne peau. Décision
> concepteur en cours (« se découpler de la réalité, c'est un jeu » ; moteur = 100 %
> validé, c'est **la peau** qui est trop complexe).

---

> ⏸️ **STATUT (2026-06-14) : EXPLORATION EN RÉFLEXION.** Le concepteur prend une nuit
> avant de trancher. Piste d'abord envisagée comme **jeu séparé réutilisant le moteur** ;
> l'étoile polaire ci-dessus suggère qu'elle pourrait **converger avec le jeu de base**.
> Document conservé intact comme point de reprise.
>
> Document vivant. Capture le **virage de thème et de gameplay** exploré en session
> 2026-06-14. Le **moteur** (grille d'hexes, ticks, fragilité `F`, cascade, crowding,
> impact-prix, périmètre, compétences d'archétype) serait **réutilisé** : on rhabille et
> on simplifie, on ne reconstruit pas. Le détail de l'ancien cadre finance reste dans
> `docs/game-design-memo.md` (référence du jeu de base).

---

## 1. Pourquoi ce virage

Le **thème finance** (marché, portefeuille, couverture, gains) filtre les testeurs
avant qu'ils touchent au jeu : vocabulaire rigide, registre sérieux, peu de prise
émotionnelle. Le **moteur**, lui, est souple et agnostique au thème (positions,
fenêtres temporelles, déclenchements). On **garde le moteur**, on **change la peau et
le registre**, et on **simplifie réellement** au passage.

Direction retenue : **chaise musicale prise au pied de la lettre**, croisée avec un
**démineur**, le tout porté par une **économie d'information** (les pièces achètent du
savoir, pas de la richesse).

---

## 2. Le pitch en une phrase

> Sois sur la **bonne case au bon moment** — quand la musique s'arrête — dans un
> plateau dont le **danger est caché mais déductible**, où tu **dépenses des pièces
> pour enquêter** et où **se presser sur une case la rend explosive**.

---

## 3. Boucle de jeu (socle)

1. La **musique joue** (fond continu ; accélère = tension monte ; calée sur les tours).
2. Pendant qu'elle joue, chaque joueur **planifie en secret** ses déplacements/actions
   (budget = **PA**), et peut **dépenser des pièces** pour acheter de l'information.
3. La musique **s'arrête** (= un **tick décisif**, cadencé par `F`). Les plans se
   **révèlent tick par tick**.
4. **Vérification** : es-tu sur un **refuge** (bonne case/zone) ?
   - **Oui** → tu survis, et tu **encaisses** la valeur de la chaise (→ pièces).
   - **Non** (case minée / hors refuge) → **−1 PV**.
5. On recommence, la tension (et le nombre de chaises piégées) **monte avec `F`**.

**Condition de victoire/défaite :** survie en **PV** (jauge de vie ; éliminé à 0).
Le score-richesse de l'ancien jeu disparaît comme *but* — il survit comme *valeur de
chaise* (cf. §5).

---

## 4. Les trois ressources

| Ressource | Rôle | Origine moteur |
| --- | --- | --- |
| **PV** (points de vie) | Survie. −1 si pas au refuge à l'arrêt. Éliminé à 0. | **Nouveau** (remplace le Score comme condition de fin). |
| **PA** (points d'action) | Budget de déplacement/action par tour, dans le plan secret. | **Existe déjà** (4 PA/tour). |
| **Pièces** | **Budget d'enquête** : révéler des cases (pour soi), acheter des indices. | Réemploi de la monnaie, **but inversé** : info, pas richesse. |

---

## 5. Le prix des hexes = la valeur de la chaise

Le **prix par case est conservé** (on met de côté les hexes **Crédit** pour l'instant),
mais il **change de fonction** : ce n'est plus ta richesse, c'est la **valeur de la
chaise**.

- Finir la musique sur une **chaise de valeur** = **encaisser des pièces** (→ on
  rachète de l'info au tour suivant). C'est le **faucet** de l'économie.
- **Press-your-luck** : une chaise chère est **plus convoitée** → plus de monde s'y
  presse → **plus volatile** → **plus susceptible d'exploser**. Le risque suit la
  récompense.

### Le crowding charge la mine (boucle moteur, pas métaphore)

C'est déjà câblé dans le moteur :

- `crowdingIndex` (entassement) **nourrit `F`** (`fragility.ts`).
- `fluxImpact` (flux → **impact-prix**) fait **bouger le prix** quand on prend position.

Donc : **se presser sur une case → volatilité ↑ → `F` ↑ → précipite la crise sur cette
case.** Le joueur **charge physiquement la mine** en s'y entassant. Conséquence de
gameplay majeure : le **mislead a un coût réel** (cf. §7).

### Forcer la détonation en 1 tour (boucle moteur, vérifiée)

Un joueur **peut** déclencher la crise dans la résolution d'**un seul tour** — mais
**uniquement sur une mine déjà armée** (encombrée + à levier). Deux leviers, dans le
moteur actuel :

1. **La fire-sale → cascade d'appels de marge** (le vrai détonateur).
   `applyMarginCalls` + `fluxImpact` : (a) tu **largues une grosse position** sur un
   hexe encombré → (b) **flux net négatif** → le prix chute → (c) les voisins **à
   levier** franchissent `marginCallThreshold` → (d) ils sont **liquidés de force**,
   leur vente **rajoute du flux négatif** → le prix rechute → liquide les suivants.
   **Chaîne, en un tour.** C'est « le gros capital sort en premier et déclenche l'appel
   de marge des suivants » — déjà câblé. Le joueur est la **whale qui fait du stop
   hunting** ; la magnitude dépend du **levier + crowding** alentour.
2. **Charger la dernière dose** (`F` déjà ≈0.80) : un tour de levier max sur le cluster
   encombré franchit `crisisCeiling` (0.85) → **crise déterministe**.

**Garde-fou de design (émergent, gratuit) :** sur un plateau **vide**, le largage ne
fait **rien** (`F` ne se force pas en 1 tour depuis le bas). On ne détonne donc qu'une
mine **fabriquée par l'avidité collective** — pas une case au hasard. La compétence
« sortir avant le tick » (`ignoreClosePerimeter`) = le **bouton de détonation maîtrisé**
du gros joueur.

---

## 6. L'information (la couche démineur)

L'opacité de la finance était *non-résoluble* (signaux bruités → pari). L'opacité du
**démineur** est **déductible** : on **raisonne** un indice. C'est le bon virage —
de « devine la jauge » à « **déduis le plateau** ».

- L'**adjacence = corrélation** existe déjà dans la grille → un **chiffre de démineur**
  tombe pile sur cette structure. On **rhabille l'adjacence**, on n'invente pas de
  mécanique.
- Les **pièces achètent l'enquête** : révéler une case **pour soi seul**, acheter un
  **indice** (à éviter / refuge) **avant** l'arrêt de la musique.
- **Pression croisée** = le sel du mariage : **temps limité** (la musique) + **budget
  limité** (les pièces) pour résoudre *assez* du plateau avant de devoir **s'engager
  avec une déduction incomplète** (plan secret → ticks).

### Ce que compte le chiffre (tranché)

- Le chiffre = **nombre de dangers adjacents** (démineur classique, familier,
  déductible). Le **refuge** = *« la case que la déduction laisse propre »*. Révéler une
  case proche donne **un autre chiffre** → on **triangule par réflexion**.
- **Géométrie variable :** la carte n'a pas 6 voisins partout (13 hexes en clusters,
  adjacence variable) → le chiffre est *« N sur (voisins réels) »*. Les **hexes de
  bordure** (peu de voisins) donnent des indices **plus tranchants** → une **géographie
  de l'information** émerge gratuitement.

### L'enquête est réflexive : payer l'info fait monter le prix (tranché)

L'idée-clé qui **boucle le système** : **acheter un indice sur une case = manifester de
l'intérêt = demande = prix ↑** (`fluxImpact`). Conséquences :

- **L'enquête n'est pas gratuite de conséquence** — *regarder une case la déplace*.
  C'est la **réflexivité** des marchés, gamifiée (effet d'observateur).
- **Auto-sabotage salvateur :** enquêter sur le **bon** hexe le rend **plus cher, plus
  convoité, donc plus minable** → trouver la chaise sûre **la rend moins sûre**. L'info
  parfaite est **auto-équilibrée sans bruit artificiel** : la chercher l'abîme.
- **Vecteur de mislead :** payer de l'info sur un **leurre** monte *son* prix → les
  autres croient que tu sais → s'y entassent → tu **charges la mine du leurre** sans
  avoir misé. Le mislead a donc **deux vecteurs** : la mise *et* l'achat d'info ostensible.
- **Privé vs public (tranché) :** le **chiffre** révélé reste **privé** (pour toi seul),
  mais la **trace de prix** est **publique** → acheter de l'info devient un **tell** que
  les autres lisent sur le marché. Feature, pas bug : on lit l'enquête adverse au prix.

### La boucle de mise (tranché)

Miser des pièces sur l'hexe qu'on **pense** être le bon → à la détonation : **bon hexe →
récompense** (encaisse la valeur de chaise), **sinon → −1 PV**.

---

## 7. Couche PvP — guerre d'information

> Statut : **multijoueur** (board partagé, déjà tranché ; multi = phase 2). En solo,
> l'adversaire-démineur est **le plateau / l'IA**.

- **Fausses pistes** : laisser croire qu'une case est sûre/dangereuse.
- **Hexes piégés** (à la Bomberman) : poser un danger pour les autres.
- **Mislead à coût réel** (exemple de gameplay confirmé) : **miser ostensiblement sur
  X** alors qu'on a l'info sur **Y** → on attire les autres sur X **et** on précipite
  une crise sur X via le crowding (§5). Le bluff n'est pas que social : il **déclenche
  le danger** là où l'on pointe.

L'info **de base reste fiable** (déduction saine, façon démineur) ; ce sont **les
adversaires** qui la corrompent. Le mensonge est **joueur et intentionnel**, pas
systémique.

---

## 8. Le caché devient un pouvoir, pas la règle

`F` reste le **chef d'orchestre** (cadence l'arrêt de la musique, combien de chaises
deviennent piégées) mais **n'est plus l'énigme du tronc commun**.

- La **règle de base est lisible** : chaises visibles/semi-visibles, danger déductible.
- **Voir `F` directement** devient une **compétence d'archétype** : le **Sismographe**
  (qui lit déjà `F` de naissance) = *« celui qui entend la musique ralentir avant les
  autres »*. L'opacité passe du tronc commun à un **pouvoir optionnel**.

---

## 9. Ce qui est tranché / confirmé (session 2026-06-14)

- ✅ Abandon du **registre finance** comme thème (vocabulaire/sérieux). Moteur conservé.
- ✅ **Chaise musicale × démineur** + **économie d'information** (pièces = enquête).
- ✅ **PV** = survie (remplace le Score comme but) ; **PA** = budget d'action (existe) ;
  **pièces** = info.
- ✅ **Plan secret → révélation tick par tick** (déjà prévu §31 ancien memo).
- ✅ **Prix d'hexe = valeur de chaise** ; **cash-out en pièces** sur une bonne chaise ;
  **gain de pièces par tour** (faucet).
- ✅ **Crowding → volatilité → `F`** : la prise de position **précipite** le danger
  (boucle moteur existante). Le **mislead** l'exploite.
- ✅ **Danger émergent mais déductible** : structure posée + `F` décide *combien/quand*
  (le danger **s'intensifie**, ne se téléporte pas).
- ✅ Le **caché (`F`) → pouvoir d'archétype** (Sismographe), pas la règle de base.
- ✅ **Solo** = démineur contre le plateau ; **fausses pistes/pièges = couche multi**.
- ✅ **Musique** = esthétique/tempo (accélère avec la tension) — polish, pas structurel.
- ✅ **Détonation forçable en 1 tour** = **fire-sale → cascade d'appels de marge**
  (`applyMarginCalls` + `fluxImpact`), ou « dernière dose » quand `F` est déjà chargée.
  **Garde-fou** : on ne détonne qu'une **mine déjà armée** (un plateau vide ne pète pas).
- ✅ **Chiffre de démineur = nb de dangers adjacents** ; refuge = la case que la
  déduction laisse propre ; géométrie variable → bordures = indices plus tranchants.
- ✅ **Enquête réflexive** : payer l'info **monte le prix** de la case (auto-sabotage de
  l'info parfaite + 2ᵉ vecteur de mislead). **Chiffre privé, trace de prix publique**
  (l'achat d'info est un *tell*).
- ✅ **Boucle de mise** : miser sur l'hexe présumé bon → récompense si bon, **−1 PV** sinon.
- ✅ **Indices de base EXACTS** (déduction pure) ; seule la **corruption adverse** ment.

---

## 10. Fork #1 — « qu'est-ce qu'une mine » (développé, en attente de validation)

Modèle proposé en séance (ancré dans `cascade.ts`), **non encore validé** :

- **Une mine = faille (cachée) × charge (empilée).**
  1. **Faille** (cachée, structurelle) : prédisposition de fragilité d'un hexe — *« cette
     chaise a un pied fragile »*. **C'est ce que le démineur révèle** (les chiffres
     comptent les failles adjacentes). Posée par carte/round → déductible.
  2. **Charge** (émergente, semi-visible) : crowding + levier empilés (`crowdingIndex`),
     lisibles en filigrane par le prix. **C'est la charge qui arme la faille.**
  3. **Déclencheur** (global) : `F` / l'arrêt de la musique → décide *quand* et avec
     quelle violence (`amplitude`) les failles armées détonnent.
- **Granularité : danger PAR HEXE, déclencheur GLOBAL.** Un séisme commun qui ne casse
  que ce qui était **fragile + surchargé** ; le **refuge** = la chaise que personne n'a
  chargée et qui n'a pas de faille (souvent une chaise pas chère).
- **Skill = combiner le caché déduit (faille) et le visible lu (charge/prix).**

**Sous-choix (leans, non figés) :** (1) faille **figée par round**, dérive lente réservée
à la campagne ; (2) dégâts **∝ exposition/levier** (pas forfaitaires) ; (3) on **peut
agir pendant** la fenêtre de détonation (réaction entre ticks).

## 11. ⏸️ En réflexion — décision majeure à trancher après la nuit

**Effacer le système de `bounce` (rebond) et passer à une boucle atomique.** Le
concepteur veut la boucle : **dépenser → se positionner → détonation → outcome →
recommencer**, *sans* le faux-redémarrage.

- ✅ Faisable : `cascade.ts` est modifiable ; supprimer le bounce retire la machine à
  phases (leg1/bounce/leg3), `isRealFloor`, `bounceDetune`, le « mensonge du rebond ».
  **Vraie simplification.** Coût : on **perd le piège press-your-luck** du faux-redémarrage
  → la tension se **déplace en amont** (déduction sous double contrainte + plan secret) ;
  la détonation devient **le clic du démineur** (ai-je bien déduit ?).
- ❓ **Question ouverte qui en découle — rôle de `F`** (à trancher) :
  - **(a)** détonation **à chaque tour**, `F` = **sévérité croissante** (« la musique
    accélère » devient la courbe de difficulté ; simplifie aussi `fragility.ts` : plus de
    zone morte / plafond / `crisisProbability`, juste un cadran qui monte). *Lean proposé.*
  - **(b)** détonation **occasionnelle**, `F` reste un **déclencheur** (statu quo moteur).

## 12. Forks encore ouverts (à trancher en reprenant)

1. **Combien de PV de base ? de PA de base ? de pièces de départ ?** Valeurs à régler.
2. **Granularité du refuge** : une **case** précise, ou une **zone/cluster** ? (la
   chaise musicale pure = rareté : moins de refuges que de joueurs/menaces).
3. **Source des pièges en solo** : système vs IA — qui « ment » quand il n'y a pas
   d'adversaire humain ?

---

## 13. Table de traduction (ancien → nouveau)

| Ancien (finance) | Nouveau (chaises × démineur) |
| --- | --- |
| Jauge de fragilité `F` (cachée) | **Tempo de la musique** / intensité du danger (chef d'orchestre) |
| Crise / cascade | La **musique s'arrête** ; des chaises **explosent** |
| Prix d'un hexe | **Valeur de la chaise** (cash-out en pièces) |
| Gains / richesse / Score | **Pièces** (budget d'enquête) + **PV** (survie) |
| Signaux bruités | **Indices de démineur** (déductibles) + info achetée |
| Crowding (entassement) | Se **presser** sur une chaise → la rend **explosive** |
| Position / exposition | **Être sur une case** quand la musique s'arrête |
| Sismographe (voit `F`) | **« Entend la musique ralentir »** (pouvoir) |
| Short / couverture | (à retraduire — hors de cet exemple, avec le Crédit) |
