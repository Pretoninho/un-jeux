# Refonte — Chaises musicales × Démineur

> Document vivant. Capture le **virage de thème et de gameplay** décidé en session
> 2026-06-14. Le **moteur** (grille d'hexes, ticks, fragilité `F`, cascade, crowding,
> impact-prix, périmètre, compétences d'archétype) est **conservé** : on rhabille et
> on simplifie, on ne reconstruit pas. Le détail de l'ancien cadre finance reste dans
> `docs/game-design-memo.md` (référence historique).

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

---

## 6. L'information (la couche démineur)

L'opacité de la finance était *non-résoluble* (signaux bruités → pari). L'opacité du
**démineur** est **déductible** : on **raisonne** un indice. C'est le bon virage —
de « devine la jauge » à « **déduis le plateau** ».

- L'**adjacence = corrélation** existe déjà dans la grille → un **chiffre de démineur**
  (« N hexes adjacents dangereux ») tombe pile sur cette structure. On **rhabille
  l'adjacence**, on n'invente pas de mécanique.
- Les **pièces achètent l'enquête** : révéler une case **pour soi seul**, acheter un
  **indice** (à éviter / refuge) **avant** l'arrêt de la musique.
- **Pression croisée** = le sel du mariage : **temps limité** (la musique) + **budget
  limité** (les pièces) pour résoudre *assez* du plateau avant de devoir **s'engager
  avec une déduction incomplète** (plan secret → ticks).

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

---

## 10. Forks encore ouverts (à trancher en continuant)

1. **Indices exacts ou bruités ?** Le démineur veut de l'**exact** (déduction pure) ;
   les **fausses pistes** réintroduisent le mensonge, mais *joueur*. Tronc = exact,
   corruption = adversaires → à confirmer.
2. **Que représente précisément une « mine » ?** Un hexe qui blesse à l'arrêt ; lien
   exact avec la **cascade** (morphologie chute→rebond→jambe) à définir.
3. **Combien de PV de base ? de PA de base ? de pièces de départ ?** Valeurs à régler.
4. **Granularité du refuge** : une **case** précise, ou une **zone/cluster** ? (la
   chaise musicale pure = rareté : moins de refuges que de joueurs/menaces).
5. **Source des pièges en solo** : système vs IA — qui « ment » quand il n'y a pas
   d'adversaire humain ?

---

## 11. Table de traduction (ancien → nouveau)

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
