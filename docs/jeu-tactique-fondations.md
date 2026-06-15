# Fondations du jeu tactique — par où commencer

> Note de conception — 2026-06-15. Trace d'une discussion de cadrage.
> **Rien n'est tranché ici.** Le but est de fixer le *raisonnement* et le *point de départ*,
> en gardant délibérément les grandes portes ouvertes.
>
> Cadre : on vise un jeu **tour par tour tactique** (inspiration du *gameplay* de Divinity:
> Original Sin — points d'action, positionnement — **sans le copier**), à **fusionner** plus
> tard avec l'économie territoriale existante. Les **éléments / surfaces sont mis de côté**
> pour l'instant. On ne s'occupe que des **règles de base**.

---

## 1. Déshabiller le jeu jusqu'à l'os

N'importe quel jeu tactique au tour par tour (Échecs, XCOM, Final Fantasy Tactics,
Into the Breach, Divinity) tient sur **4 atomes + 1** :

1. **Un plateau** — on l'a déjà (la grille hexagonale).
2. **Des pièces** qui appartiennent à un joueur et occupent une case.
3. **Un budget par tour** qui limite ce qu'on peut faire (se déplacer + agir).
4. **Un verbe qui change l'état** d'une autre pièce ou du plateau (sans conséquence, pas de jeu).
5. **Une condition de victoire** atteignable en quelques tours.

Tout le reste — héros, classes, compétences, éléments, économie, étiquette « MOBA » — est
du **contenu posé sur ces 5 atomes**. Si les 5 atomes ne sont pas amusants, aucun contenu
ne les sauvera.

---

## 2. Les trois questions de base (version minimale, non-engageante)

### Comment y jouer ?
Chacun son tour. À ton tour tu as un **budget** ; tu le dépenses pour **bouger** et pour
**agir** ; puis l'adversaire répond. Le sel vient de là : *bouger est un engagement qu'on
ne peut pas annuler, et l'autre joue après toi.*

### Qu'est-ce qu'il faut faire ?
Te placer pour **pouvoir frapper sans te faire frapper en retour**. C'est *le* cœur du genre :
dès qu'il y a une **portée finie** (déplacement limité + allonge limitée), il existe des
**zones de menace** — les cases d'où l'autre peut t'atteindre au prochain tour. Lire ces
zones et s'engager au bon moment = la **compétence irréductible**. On a déjà un jeu avec ça
seul : zéro compétence, zéro élément.

### Comment gagner ?
Trois familles, **non tranchées** :
- **Élimination** — réduire l'adversaire à 0 (le plus simple, le plus lisible).
- **Territoire / objectif** — contrôler des cases (là où pointe la fusion éco + MOBA).
- **Survie / horloge** — tenir N tours.

**Reco** : prendre **l'élimination comme échafaudage** au début. Elle ne ferme aucune porte —
on pourra basculer vers « territoire » plus tard sans rien jeter, car les deux reposent sur
les mêmes 4 atomes.

---

## 3. Par quoi commencer — de A à Z

Par **le plus petit truc jouable qui contient déjà une décision**, testé *avant* d'ajouter
quoi que ce soit. C'est la leçon que ce projet s'est déjà donnée
(`.claude/design-progress.md` : *« primitives d'abord, bac à sable neutre ; spécificités
par-dessus, une à la fois »* / *« il fallait tout de suite construire le jeu »*).

### Noyau — étape 0
1 pièce par camp sur la grille · tours alternés · chaque tour = se déplacer de **N** cases
**et/ou** une frappe à portée **P** · des **HP** · premier à 0 perd. **Rien d'autre.**

→ On y joue ~10 fois (humain vs IA bête, ou humain vs humain) et on pose **une seule
question** : *« y a-t-il une vraie décision à chaque tour, ou on se contente d'échanger
des coups ? »*
- Si la **portée/menace** crée de la tension (avancer ? tenir ? reculer ?) → graine tenue,
  on continue.
- Sinon → une heure perdue, pas un mois, et on sait que le problème est le **réglage**
  (portée / déplacement / dégâts), pas le contenu.

### Ensuite — une chose à la fois
Chaque ajout justifié par une question soulevée par la version précédente :
2. **2ᵉ pièce par camp** → focus-fire, formations, « qui je bouge en premier ».
3. **2ᵉ verbe** (un choix : frapper *ou* préparer/défendre) → l'arbitrage devient riche.
4. … seulement après : compétences, puis éléments/surfaces, puis l'accroche économie/
   territoire, puis l'habillage MOBA.

---

## 4. Ce qu'on garde délibérément OUVERT

À **ne pas trancher** maintenant — le noyau fonctionne quel que soit le choix :

| Fork | Options | Pourquoi attendre |
|---|---|---|
| **Condition de victoire** | élimination / territoire-éco / survie | bascule plus tard, gratuite (mêmes atomes) |
| **Nombre de pièces** | un seul **héros** (identité MOBA) / une **escouade** (tactique XCOM) | gros choix d'identité ; le noyau marche à 1 pièce |
| **Le budget** | pool unique de PA / déplacement séparé de l'action | réglage, pas structure |

---

## 5. Prochaine étape proposée

Construire **l'étape 0** (1v1 : bouger + frapper, HP, mort) **directement dans le jeu**
(pas une maquette jetable), greffée sur la grille qu'on vient de nettoyer, et **sentir** si
la décision « menace/portée » est là. Avant de coder : caler à l'oral les quelques nombres
du noyau (déplacement N, portée P, dégâts, HP, qui commence, que se passe-t-il quand deux
pièces se touchent).
