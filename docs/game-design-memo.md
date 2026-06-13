# Mémoire de Game Design — Jeu 4X Investissement

> Document de référence vivant. Version 1.15 — 13 juin 2026.
> Synthèse des sessions de brainstorming. À amender au fil des décisions.

---

## 1. Le concept

Un jeu de stratégie au tour par tour de type 4X (eXplore, eXpand, eXploit, eXterminate), inspiré de Civilization, où le joueur incarne un **allocateur de capital** (fonds, family office, empire financier).

**Cadre atemporel (DÉCISION)** : aucune référence à une époque, pas de traversée de l'histoire. Le monde financier est complet dès le tour 1 (tous les instruments et marchés existent) ; c'est la firme du joueur qui progresse, pas l'humanité. En cours de partie, tout évolue — les prix bougent, les opportunités apparaissent et disparaissent, les régimes se succèdent — mais le temps est interne à la partie. Les « ères » sont les régimes de marché traversés ; l'histoire racontée est celle de la partie (« j'ai survécu au deuxième krach »), pas celle du monde. Conséquences : zéro coût de contenu historique, zéro métagame de mémoire, univers stylisable librement, identité propre (un 4X économique atemporel, pas « Civ avec de la finance »).

**Constat de marché** : ce créneau précis n'existe pas. Les briques existent séparément — manipulation actionnariale (1830/18xx), marché comme champ de bataille (Offworld Trading Company), profondeur systémique (Victoria 3), échelle temporelle (Civilization) — mais personne ne les a assemblées. Les communautés 18xx et Offworld prouvent qu'un public existe : petit mais fanatiquement loyal, profil quantitatif.

---

## 2. Transposition des 4X

| Mécanique Civ | Équivalent investissement |
|---|---|
| Carte + brouillard de guerre | Paysage économique (secteurs, géographies, classes d'actifs) + asymétrie d'information |
| Éclaireurs | Analystes envoyés couvrir des marchés ; l'information a un coût et se périme |
| Villes | Desks / positions (equities, crédit, immobilier, VC) |
| Aménagements & bâtiments | Infrastructure data, modèles quant, équipes de recherche, prime brokerage |
| Guerre | Guerres de capital : raids activistes, short squeezes, guerres de fees, débauchage |
| Arbre technologique | **Arbre de capacités de la firme** (pas l'histoire du monde) — branches identitaires : Analyse (fondamentale → quant → ML), Instruments (cash → dérivés → exotiques), Infrastructure (exécution → data → latence), Distribution (LPs, véhicules). Asymétrie des builds : deux fonds spécialisés différemment sont des espèces différentes |
| Merveilles | **Innovations à monopole temporaire** : le premier à atteindre un nœud frontière obtient un edge surdimensionné qui s'érode quand les autres l'atteignent ou copient — l'alpha decay comme mécanique centrale |
| Religion | Philosophies d'investissement (value, growth, momentum, passif, macro) à fonder et propager |
| Diplomatie / cités-États | Régulateurs, banques centrales, LPs ; fonds souverains et fonds de pension à courtiser |
| Bonheur / amenités (frein à l'expansion) | **Le levier** : croître vite = se leverager = fragilité (trade-off vitesse vs survie) |

---

## 3. Conditions de victoire

- **Domination** : absorber ou faire faillir les fonds concurrents
- **Science** : atteindre une frontière technologique
- **Culture** : sa philosophie d'investissement domine les flux mondiaux
- **Économique** : seuil d'AUM ou % des actifs mondiaux détenus
- **Score** : meilleur **Track Record** en fin de partie — rendement excédentaire vs le marché, pénalisé par le pire drawdown (§27)

---

## 4. La mécanique centrale : régimes et crises endogènes

### 4.1 Leçon de Civilization
Civ découple totalement la **structure historique** (arbre causal des technologies) du **déroulé historique** (événements datés). Il n'y a pas de 1929 dans Civ — seulement les conditions de possibilité d'un 1929. Les dates sont cosmétiques ; rien n'est attaché au calendrier.

### 4.2 Trois modèles envisagés pour les crises
1. **Rail strict** (2008 arrive en 2008) — rejeté : incohérent, exploitable, rejouabilité nulle.
2. **Rail conditionnel / endogène** (la crise arrive si ses causes existent) — **modèle retenu**.
3. **Élastique historique** (la crise arrive, timing et ampleur stochastiques) — fallback acceptable.

### 4.3 La jauge de fragilité (DÉCISION CLÉ)
Le crash n'est **pas indexé sur l'horloge mais sur l'état du système**. Une variable systémique de fragilité, alimentée par les comportements agrégés (joueurs + IA) :

- Levier total ↑ → fragilité ↑
- Valorisations tendues → fragilité ↑
- Crowding → fragilité ↑
- Désendettement, régulation, diversification → fragilité ↓

Jauge basse = pas de crash possible. Jauge haute = probabilité de déclenchement croissante à chaque tour ; n'importe quelle étincelle peut faire cascader. Dynamique « feux de forêt » : un système régulièrement purgé par de petites corrections n'accumule jamais assez de fragilité pour un krach majeur.

Inspiration directe : le mécanisme climat de Civ VI Gathering Storm (CO₂ cumulé de tous les joueurs → tragédie des communs). Chaque joueur a intérêt individuellement à gonfler la bulle ; collectivement, ça rapproche la catastrophe.

### 4.4 Visibilité de la jauge (DÉCISION CLÉ)
Civ affiche son système climat en transparence totale — et ça fonctionne parce que les joueurs **subissent** le climat (pas de sortie, pas de short, incitations individuelles intactes).

Chez nous, les joueurs **tradent** le système : une jauge visible = timing parfait = crash front-run = plus de bulles = plus de jeu.

**Réglage retenu** : signaux **bruités et retardés** qui corrèlent avec la fragilité sans la révéler. Le skill du jeu = inférence d'un état caché à partir de signaux imparfaits (la condition épistémique réelle de l'investisseur macro).

**Option hybride à explorer** : historique des crises passées totalement visible (écran post-mortem, pédagogie de la dynamique) mais état courant jamais révélé. Connaissance structurelle parfaite, connaissance conjoncturelle bruitée.

### 4.5 Le coût du contrarian
Mécanique en or massif identifiée : tenir une position contrarian coûte chaque tour (primes, marges, LPs qui menacent de partir) sans savoir combien de tours il faut survivre. « Être en avance, c'est être dans le tort » (cf. Burry/Paulson 2005-2008).

---

## 5. Pièges de design identifiés

- **« Number go up » sans tension** : le capital doit être réellement contraint ; la liquidité est une ressource (sortir d'une grosse position a un impact prix).
- **L'edge éternel** : l'information doit se déprécier — un edge découvert se fait arbitrer au fil des tours, forçant la recherche du prochain.
- **Le métagame de la mémoire** : aucun événement ne doit être prédictible par mémorisation entre parties (d'où le rejet du rail strict).

---

## 6. Archétypes jouables — le système de fantasmes

Les fantasmes du joueur sont des **traits choisis en début de partie**, non des classes rigides. Chaque archétype définit :
- Une condition de victoire naturelle
- 1-2 mécaniques exclusives actives dès le tour 1
- Une ressource d'archétype unique (voir §10)
- Une contrainte permanente de cadre

> **Note de développement** : les références internes utilisent des noms d'investisseurs réels (Buffett, Soros, etc.) comme raccourcis. Ces noms n'apparaîtront jamais dans le jeu — les archétypes auront des noms fictifs propres à l'univers.

| Réf. dev | Nom in-game (piste) | Fantasme | Condition de victoire naturelle |
|---|---|---|---|
| Buffett | Le Compounder / L'Horloger | Patience, compounding | Économique (seuil AUM) |
| Soros | Le Sismographe | Coup macro, timing de régime | Score (meilleur Track Record) |
| Icahn | Le Prédateur / Le Catalyseur | Raids, domination directe | Domination |
| Simons | L'Architecte / L'Alchimiste | Modèles, edge systématique | Science (frontière techno) |
| H. Marks | Le Vautour / Le Résilient | Survie aux crises, achat en détresse | Score (régularité) |

*Deux archétypes supplémentaires à définir.*

---

## 7. Système de badges

Les badges sont des **paramètres situationnels** choisis en début de partie qui créent des tensions avec l'archétype — jamais des synergies directes.

**Règle de design** : un badge ne doit pas amplifier l'archétype, il doit créer une friction avec lui. C'est cette friction qui génère le gameplay.

### Quatre catégories

| Catégorie | Exemples |
|---|---|
| **Capital & structure** | Boutique contrainte / Mega fund / Family office / Fonds de pension |
| **Mandat LP** | LPs patients / LPs activistes / Contrainte ESG / Mandaté secteur unique |
| **Réseau de départ** | Connexions régulatrices / Deal flow VC / Accès prime brokerage / Insider sectoriel |
| **Réputation** | Inconnu / Réputé value / Controversial / Revenant |

### Paramètres de prototype

- **2 badges par défaut** — sélectionnés par draft (pool aléatoire, choix parmi la sélection)
- **+1 ou +2 badges** accordés à certains archétypes si déséquilibre observé aux tests
- Le nombre de badges peut devenir une caractéristique identitaire de l'archétype si l'asymétrie se révèle structurelle

---

## 8. Structure de début de partie

### Tour 1 — Phase de fondation (unique)
Le joueur voit une **vue partielle du paysage économique** (hexes visibles déterminés par archétype + badges), puis :
1. Reçoit **1 point de compétence**
2. Choisit le **grand axe de branche techno** à développer en premier

Ce choix engage la direction stratégique de la partie avant toute compétition.

### Tour 2 et suivants — Boucle standard
- **4 points d'action** par défaut (hors bonus archétype/badges)
- Accès aux cinq verbes (voir §9)
- Points de compétence : **1 tous les 3 tours** par défaut (hors bonus)

### Arbre de compétences — branches principales
*(Structure détaillée à développer — question ouverte)*
- Analyse (fondamentale → quant → ML)
- Instruments (cash → dérivés → exotiques)
- Infrastructure (exécution → data → latence)
- Distribution (LPs, véhicules)

---

## 9. Boucle de tour — les cinq verbes

Chaque action coûte des points d'action (PA). Valeurs de prototype.

| Verbe | Coût | Description | Dimension 4X |
|---|---|---|---|
| **LIRE** | 1 PA | Envoyer des analystes, acheter des données, interpréter les signaux de fragilité. L'information se périme. | eXplore |
| **POSITIONNER** | 1–2 PA | Ouvrir / renforcer / clôturer (partiellement ou totalement) des positions. Les positions de taille ont un impact prix. Détail des coûts en §9bis. | eXploit |
| **CONSTRUIRE** | 2 PA | Avancer dans l'arbre de compétences, recruter des équipes, ouvrir des desks. | eXpand |
| **NÉGOCIER** | 1 PA | Gérer les LPs, courtiser les régulateurs, lancer des raids activistes, débaucher des équipes. | eXterminate / Diplomatie |
| **RÉSERVER** | 0 PA | Ne rien déployer. Garder des liquidités sèches. **C'est une action explicite**, pas une absence d'action. | — |

**Double effet de chaque action** : effet personnel (position, firme) ET effet systémique (jauge de fragilité). Cette double comptabilité est permanente et en partie cachée.

### 9bis. Opérations de POSITIONNER et coûts (amendé v1.9)

L'ancien « redimensionner (augmenter ou réduire) » est scindé pour éviter une option morte (voir audit ci-dessous) :

| Opération | Coût | Rôle |
|---|---|---|
| **Ouvrir** | 1–2 PA (selon impact-prix) | nouvelle position |
| **Renforcer** | 1–2 PA (selon impact-prix) | augmenter une position existante |
| **Clôture partielle** | **2 PA** | alléger / scale-out — le seul moyen de réduire sans solder |
| **Fermer (totale)** | 1 PA | sortie nette, réalise tout le P&L |

**Pourquoi la clôture partielle coûte plus cher que la sortie totale** :
- C'est le **geste de la décision sous incertitude** — quand on ne sait pas si le rebond est un piège ou un vrai plancher (§24.2), en retirer une part et garder le reste *est* le « je ne sais pas » rendu jouable. La décisivité (sortir net, 1 PA) est bon marché ; l'hésitation gérée (rester à moitié exposé, 2 PA) se paie.
- **Garde-fou anti-gaming du score** (§27) : une réduction d'exposition précise et bon marché serait un cadran à raboter le MaxDrawdown à vil prix. À 2 PA (la moitié du tour) **et** exposition résiduelle conservée, la précision a un coût — pas d'effaceur de drawdown gratuit.
- Le joueur paniqué garde toujours une **sortie d'urgence à 1 PA** (Fermer totale).

*Audit anti-script* : pas de timeline (option du joueur) ✓ · non dominée (l'overlap « redimensionner à la baisse » est supprimé) ✓ · neutre entre archétypes (§26) ✓ · sert le cœur épistémique au lieu de le contourner ✓. **Tests comportementaux (l'exposition baisse vraiment, effet sur drawdown/`flux`) au jalon J2** ; au J1, seul le catalogue d'actions et ses coûts sont testés (`src/data/actions.ts`).

---

## 10. Ressources

### Ressources universelles

**Capital** — ressource primaire, trois états :

| État | Caractéristique |
|---|---|
| Déployé (positions ouvertes) | Exposé aux gains/pertes, contribue à la fragilité si leveragé |
| Réservé (dry powder) | Inactif, disponible, coût d'opportunité |
| Leveragé (capital emprunté) | Amplifie tout, forte contribution à la jauge de fragilité |

**Réputation** — ressource relationnelle. Débloque ou ferme des options dans NÉGOCIER. Se gagne par la performance, se perd par les scandales ou les faillites.

### Ressources d'archétype

Chaque archétype possède une ressource unique, gagnée en jouant naturellement son style :

| Archétype | Ressource | Se gagne par | Se dépense pour |
|---|---|---|---|
| Compounder | **Conviction** | Tours de position tenue × taille | Résister aux pressions LP, doubler en baisse |
| Sismographe | **Clarté de régime** | Actions LIRE sur signaux macro | Positions leveragées massives, pari de retournement |
| Prédateur | **Pression** | Accumulation silencieuse dans une cible | Raid activiste, short squeeze, événement corporate |
| Architecte | **Signal alpha** | Investissement en infrastructure/data | Positions model-driven, réduction coût LIRE |
| Vautour | **Réserve sèche** | Tours passés en RÉSERVER | Déploiement massif en période de haute fragilité |

### Ressources systémiques (non-possédées)

États partagés que tous les joueurs influencent et subissent :
- **Jauge de fragilité** — alimentée par le levier agrégé, les valorisations tendues, le crowding
- **Sentiment de marché** — état émotionnel agrégé (euphorie → neutralité → panique)

---

## 11. Carte hexagonale

### Trois types de hexes

**Hexes marché** *(investissables — majorité de la carte)*
Chaque hex = un marché spécifique, défini par classe d'actifs × géographie.

**Hexes nœud** *(stratégiques, non-investissables)*

| Type | Exemple | Effet sur les hexes adjacents |
|---|---|---|
| Réglementaire | Banque centrale, régulateur | Présence → lecture anticipée des règles (taux, levier autorisé) |
| Information | Agence de notation, data provider | Présence → signaux moins bruités, moins retardés |
| Liquidité | Prime broker, chambre de compensation | Présence → levier moins coûteux, mais contribution à la fragilité |

**Hexes frontière** *(verrouillés, déblocables)*
Marchés trop complexes ou illiquides pour y entrer sans prérequis. Débloqués via l'arbre de compétences ou un événement de marché.

### L'adjacence = corrélation

Hexes adjacents ont des rendements corrélés. En temps normal : corrélation modérée. En crise (jauge fragilité haute) : corrélations convergent vers 1, contagion se propage hex par hex depuis les zones les plus crowdées.

**Implication stratégique** : la position sur la carte est une déclaration de risque.
- Concentré dans un cluster → rendements élevés, exposition totale à la contagion
- Dispersé → diversifié, mais coûteux en infrastructure analytique

### Paliers de présence dans un hex

| Palier | Nom | Ce que ça permet |
|---|---|---|
| 0 | Inexploré | Rien |
| 1 | Analyste | Lecture de signaux (LIRE), pas d'investissement |
| 2 | Position | Capital déployé, rendements |
| 3 | Desk | Instruments avancés, meilleur signal |
| 4 | Dominance | Influence sur les prix, visibilité du crowding adverse |

### Brouillard de guerre

| État | Visibilité |
|---|---|
| Inexploré | Hex visible, état inconnu |
| Couvert (analyste) | État approximatif, signal bruité |
| Développé (infrastructure) | Signal net, retard réduit |
| Dominant | Mouvement des fonds adverses visible |

Un analyste couvre son hex ET donne une vue partielle des hexes adjacents.

### Position de départ

Déterminée par archétype + badges. Le joueur voit son hex de départ + hexes adjacents partiellement au tour 1.

### Paramètres de prototype

- **~15–20 hexes** : ~12 hexes marché, ~3 nœuds, ~3 frontière
- **Phase 1** : carte fixe
- **Phase 2** : génération procédurale

---

## 12. Accessibilité et vocabulaire

**Décision** : le jargon financier est conservé — il fait partie de l'identité du jeu et du signal envoyé au public cible.

**Système de tooltips à deux niveaux** :

| Niveau | Déclencheur | Contenu |
|---|---|---|
| Tooltip court | Survol / icône `?` | Définition en une phrase, dans le contexte du jeu |
| Tooltip long | Clic sur le `?` | Mécanique complète + impact sur la partie |

**Règle** : le tooltip long explique la *mécanique*, pas seulement le mot.

**Compléments** :
- Lexique global accessible depuis n'importe quel écran
- Onboarding contextuel — les termes sont introduits *en situation*, au moment où le joueur peut les utiliser pour la première fois

---

## 13. Objectif du projet

**Décision : jeu web.**

Avantages directs :
- Le prototype est le jeu lui-même, construit incrémentalement — pas de rupture entre "tester l'idée" et "construire le jeu"
- La jauge de fragilité cachée et tout l'état caché sont natifs en code, aucun compromis de règle nécessaire
- L'IA concurrente = fonctions JavaScript, pas de règles à simuler manuellement
- Les tooltips et le lexique s'intègrent nativement dans l'UI
- Pas de barrière d'installation — accessible directement au public cible

**Solo-first. Multijoueur (WebSockets) en phase 2.**

> **Portabilité / rendu (note 2026-06-13)** : grâce à la **séparation moteur (TS pur, sans DOM) / UI (couche mince)**, le **rendu** est interchangeable et toutes les options restent ouvertes :
> - **Rendu web enrichi** (PixiJS / Phaser / Canvas-WebGL) → de plus beaux graphismes 2D **en réutilisant le moteur tel quel** (aucun portage), déploiement web conservé. *Chemin le moins cher pour un meilleur rendu.*
> - **Moteur graphique type Unity** → possible, mais nécessite de **porter le moteur en C#** (module bien délimité + 60+ tests = portage cadré). Pertinent surtout pour des **builds natifs** (desktop/mobile/console) ou une présentation très riche/3D — ce dont ce jeu (carte + jauges + data-viz) n'a *pas* spécialement besoin.
> - **Discipline à tenir** : ne **jamais mélanger logique et affichage** ; c'est ce qui garde toutes les portes ouvertes. Choix du rendu **différé** (quand le jeu sera amusant et calibré).

| Impact sur | Implication |
|---|---|
| Solo vs multi | Solo-first, multi via WebSockets en phase 2 |
| Prototype minimal | = le jeu lui-même à l'état MVP, pas un objet séparé |
| IA concurrentes | Rule-based JS pour commencer, affinable sans refonte |
| Signaux de la jauge | État caché géré nativement |
| Carte hexagonale | SVG ou Canvas, bibliothèques existantes |

---

## 14. Design de la défaite

**Principe** : la défaite est narrative et progressive — jamais arbitraire, jamais brutale. Le joueur doit pouvoir relire sa défaite et comprendre où il a dévié.

**Les parties sont indépendantes** : aucun carry-over entre runs. Pas de méta-progression. La rejouabilité vient uniquement de la combinaison archétype × badges × carte.

### Système à trois stades

**Stade 1 — Stress** *(avertissement)*
Performance dégradée plusieurs tours → LPs inquiets → coût du levier augmente. Signaux visuels discrets. Encore récupérable — c'est l'heure de désendetter et de négocier.

**Stade 2 — Crise** *(pression active)*
LPs retirent du capital → desks ferment faute de capital → levier restreint réglementairement → réputation abîmée. Phase de triage : le joueur choisit ce qu'il sacrifie pour survivre. Souvent le moment le plus dense tactiquement.

**Stade 3 — Effondrement** *(fin de run, choix du joueur)*

| Issue | Description | Conséquence |
|---|---|---|
| **Absorption** | Un fond adverse rachète à prix cassé | Le joueur disparaît, le fond adverse gagne en puissance |
| **Wind-down** | Le joueur choisit de fermer proprement | Score réduit, clôture narrative — aucun transfert de puissance |

### La faillite stratégique
Si l'effondrement est inévitable, le joueur peut choisir *comment* tomber :
- Se faire absorber par un rival affaibli pour lui transférer des actifs toxiques
- Liquider massivement dans un marché où un adversaire est très exposé — la cascade peut l'emporter
- Wind-down pour préserver la Réputation (score final)

### Lien avec la jauge de fragilité
Les liquidations forcées au stade 3 contribuent à la jauge systémique. Un effondrement individuel peut déclencher un krach qui emporte d'autres fonds — ou créer l'opportunité que le Vautour attendait.

---

## 15. Échelle d'un tour et horizon de partie

**Tours abstraits (DÉCISION)** : les tours sont numérotés sans référence temporelle — "Tour 12", pas "Q3 de l'an 4". Cohérent avec le cadre atemporel.

**Horizon de partie — modèle hybride (DÉCISION)** : la partie se termine dès qu'une condition de victoire est atteinte **ou** au terme du dernier cycle. Le score départage si personne n'a gagné.

**Cycles** : **budget de tours** et marqueurs de progression — *pas* une séquence d'événements garantie. Le joueur voit "Cycle 2 sur 3" comme une barre d'avancement, rien de plus. Un cycle ne « contient » pas une crise programmée.

**Régimes émergents (DÉCISION — anti-script)** : les régimes (bull / tension / crise / recovery) ne sont **pas un scénario fixe que chaque cycle déroule**. Ce sont des **lectures de l'état endogène** — dérivées de `F` (§23) et de la tendance des prix :
- *bull* = `F` basse + prix en hausse · *tension* = `F` qui grimpe · *crise* = déclencheur franchi (§23.4) · *recovery* = post-reset.

L'arc « bull → tension → crise → recovery » est l'évolution **typique** d'un système qu'on laisse chauffer, pas une garantie. Conséquences :
- Une partie prudente (peu de levier agrégé) peut traverser un cycle entier **sans aucune crise** — `F` ne monte jamais assez.
- Une table imprudente peut crasher **deux fois** dans le même budget de tours.
- Le nombre de crises dans une partie est **émergent**, jamais fixé d'avance. C'est ce qui interdit le métagame de mémoire (§5) et reste cohérent avec le rail conditionnel (§4.2).

**Prototype : 3 cycles.** Nombre définitif pour le MVP à déterminer ultérieurement.

---

## 16. IA concurrentes et choix des adversaires

### Système de profils unifié

Un seul pool de profils utilisables par les humains ou par l'IA — pas deux systèmes séparés.

**Profils jouables** *(humain ou IA — les 5 archétypes de §6)*
L'IA en joue une version rule-based ; le joueur humain apporte la profondeur stratégique. Le comportement IA suit la logique naturelle de l'archétype.

**Profils IA exclusifs** *(pure market actor, sans condition de victoire)*

| Profil | Comportement | Rôle systémique |
| --- | --- | --- |
| Suiveur de momentum | Achète ce qui monte, vend ce qui baisse | Crée le crowding, amplifie les bulles |
| Fonds leveragé | Maximise le rendement via levier agressif | Principal contributeur à la fragilité |
| Value patient | Achète les actifs décotés, ignore le bruit | Stabilise le marché, absorbe les chocs |
| Passif géant | AUM énorme, mouvements rares mais massifs | Déplace les prix, prévisible à anticiper |

**IA de contrainte** *(toujours présente, non sélectionnable)*

- **Banque centrale** : réagit à l'état agrégé — hausse des taux si fragilité haute, assouplissement en récession, injection en crise. Météo régulatoire, pas un compétiteur.

### Choix des adversaires en début de partie

Le joueur configure sa table avant le lancement :

```
Archétype joueur  → [choix libre]
Badges            → [draft partiel]
Adversaires (2-3) → [sélection dans le pool de 9 profils]
Banque centrale   → [toujours présente]
```

**Configurations prédéfinies (optionnel)** : présélections suggérées pour les joueurs qui ne veulent pas composer — "Marché euphorique" (Suiveur × 2 + Fonds leveragé), "Table de prédateurs" (3 archétypes joueurs en IA), "Marché défensif" (Value patient + Passif géant), etc.

### Fonction de réaction IA (3 paramètres)

1. **Signal d'entrée** : ce qui déclenche une action (prix, rendement, fragilité, comportement visible du joueur)
2. **Seuil de tolérance au risque** : jusqu'où l'IA s'expose avant de réduire
3. **Réaction au joueur** : copie, concurrence directe, ou ignore

### Prototype

- Pool complet : **9 profils sélectionnables + Banque centrale**
- Maximum **3 adversaires** par partie
- IA rule-based pour le prototype, affinable sans refonte de l'architecture

---

## 17. Signaux de la jauge de fragilité

La jauge de fragilité est toujours cachée. Le joueur l'infère à partir de **signaux bruités et retardés**.

**Prototype : Option A** — signaux universels, identiques pour tous les joueurs.
**Évolution prévue : Option B** — signaux différenciés par archétype (le Sismographe lit mieux les signaux macro, l'Architecte lit mieux les comportements d'initiés).

### Les 4 signaux du prototype

| Signal | Précision | Délai | Coût d'accès |
| --- | --- | --- | --- |
| **Volatilité du marché** | Faible | 0 tour | Gratuit — toujours visible |
| **Écart de crédit** | Moyenne | 1 tour | 1 PA LIRE ou analyste permanent en hex crédit |
| **Conditions de financement** | Haute | 2 tours | Desk au nœud liquidité |
| **Comportement des initiés** | Haute | 1 tour | Investissement branche Analyse (arbre techno) |

### Acquisition et dégradation

- **Ponctuel** : action LIRE (1 PA) → lecture valable 1 tour
- **Permanent** : analyste dans le bon hex → signal continu tant que l'analyste est présent
- **Structurel** : investissement arbre techno → qualité améliorée, permanent

Un signal non rafraîchi perd en précision chaque tour.

### La triangulation comme skill central

Plusieurs signaux simultanés permettent d'inférer l'état de la jauge. Volatilité haute + écart de crédit large + financement tendu → jauge probablement en zone rouge depuis 1-2 tours → action : réduire le levier, commencer à réserver.

### Post-mortem

Après une crise, l'historique réel de la jauge est révélé, superposé aux signaux vus par le joueur. Apprentissage par l'observation, pas par tutoriel.

---

## 18. Wireframes — architecture des écrans

### Écran 1 — Configuration de partie

```
┌─────────────────────────────────────────────────────────────────────┐
│                        NOUVELLE PARTIE                              │
├──────────────────────────┬──────────────────────────────────────────┤
│  ARCHÉTYPE               │  Description                             │
│                          │                                          │
│  ○ Compounder            │  ┌──────────────────────────────────┐   │
│  ○ Sismographe           │  │ Patience et compounding.         │   │
│  ● Vautour          ←    │  │ Ressource : Réserve sèche.       │   │
│  ○ Prédateur             │  │ Victoire naturelle : Score.      │   │
│  ○ Architecte            │  │                                  │   │
│                          │  │ Badge friction : LPs activistes  │   │
│                          │  │ veulent du résultat — vous        │   │
│                          │  │ attendez le bon moment.          │   │
│                          │  └──────────────────────────────────┘   │
├──────────────────────────┴──────────────────────────────────────────┤
│  BADGES  (2 parmi 4 proposés)                                       │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐                        │
│  │ ✓ Boutique        │  │ ✓ LPs activistes  │   ← sélectionnés     │
│  └──────────────────┘  └──────────────────┘                        │
│  ┌──────────────────┐  ┌──────────────────┐                        │
│  │   Deal flow VC   │  │   Insider sect.  │   ← non sélectionnés   │
│  └──────────────────┘  └──────────────────┘                        │
├─────────────────────────────────────────────────────────────────────┤
│  ADVERSAIRES  (2–3 parmi 9)          Banque centrale : toujours ✓  │
│                                                                     │
│  ● Fonds leveragé   ● Suiveur momentum   ○ Prédateur               │
│  ○ Compounder       ○ Value patient      ○ Passif géant             │
│  ○ Sismographe      ○ Architecte         ○ Vautour                  │
│                                                                     │
│  Préconfigurations :  [Marché euphorique]  [Table de prédateurs]   │
├─────────────────────────────────────────────────────────────────────┤
│                      [ LANCER LA PARTIE ]                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Écran 2 — Vue principale (en jeu)

```
┌─────────────────────────────────────────────────────────────────────┐
│  CYCLE 1/3  ·  TOUR 8  ·  Régime : BULL            [?] Lexique     │
│  VAUTOUR  ·  Capital: 180M déployé / 60M réservé / 0 leveragé      │
│  Réserve sèche : ████████░░░░   Réputation : ███░░   STRESS : ░░░  │
├──────────────────────────────────┬──────────────────────────────────┤
│                                  │  ACTIONS   [ 3 PA restants ]    │
│         CARTE ÉCONOMIQUE         │  ┌────────────────────────────┐ │
│                                  │  │ LIRE           1 PA  [?]   │ │
│  ⬡ IG EU    ⬡ IG US   ⬡ IG EM  │  │ POSITIONNER  1-2 PA  [?]   │ │
│                                  │  │ CONSTRUIRE     2 PA  [?]   │ │
│  ⬡ LC EU  ●⬡ LC US   ⬡ LC EM  │  │ NÉGOCIER       1 PA  [?]   │ │
│            ↑ analyste            │  │ RÉSERVER       0 PA  [?] ← │ │
│  ⬡ Immo   ⬡ PE/VC   ░⬡ [?]    │  └────────────────────────────┘ │
│                    ↑ brouillard  │                                  │
│  ◆ FED     ⬡ Cdt   ░⬡ [?]     │  SIGNAUX                        │
│  ↑ nœud réglementaire            │  ┌────────────────────────────┐ │
│                                  │  │ Volatilité   ▓▓▓░░░░  ~    │ │
│  ⬡ = hex disponible              │  │ Écart crédit ▓▓░░░░░  ~    │ │
│  ●⬡ = analyste présent           │  │ Financement  — non acquis  │ │
│  ░⬡ = brouillard de guerre       │  │ Initiés      — non acquis  │ │
│  ◆  = nœud                       │  └────────────────────────────┘ │
│                                  │  ~ = signal bruité / incertain  │
├──────────────────────────────────┴──────────────────────────────────┤
│  Tour 8 — Fonds leveragé ouvre position en LC US  ·  2 hex crowdés │
└─────────────────────────────────────────────────────────────────────┘
```

### Écran 3 — Détail d'un hex (clic)

```
┌────────────────────────────────────────┐
│  Large Cap US                     [×]  │
│  Classe : Equities · Zone : US         │
├────────────────────────────────────────┤
│  Rendement estimé  ████████░░  ~+6%   │
│  Volatilité locale ████░░░░░░  modérée │
│  Crowding          ██░░░░░░░░  2 fonds │
├────────────────────────────────────────┤
│  Votre présence : ANALYSTE (palier 1)  │
│  ○ Inexploré  ● Analyste               │
│  ○ Position   ○ Desk   ○ Dominance     │
├────────────────────────────────────────┤
│  Actions disponibles                   │
│  [ Ouvrir une position   — 1 PA ]      │
│  [ Retirer l'analyste    — 0 PA ]      │
└────────────────────────────────────────┘
```

### Écran 4 — Post-mortem après crise

```
┌─────────────────────────────────────────────────────────────────────┐
│  CRISE — Cycle 1, Tour 14          Stade atteint : EFFONDREMENT    │
├─────────────────────────────────────────────────────────────────────┤
│  JAUGE DE FRAGILITÉ RÉELLE (révélée)                                │
│                                                                     │
│  Tour  1  2  3  4  5  6  7  8  9  10  11  12  13  14              │
│        ░  ░  ▒  ▒  ▒  ▓  ▓  ▓  ▓  ██  ██  ██  ██  ██  ← réel    │
│                                                                     │
│  Ce que vous avez vu :                                              │
│  Volatilité  ░  ░  ░  ▒  ░  ▒  ▓  ▓  ▓  ██  ██                   │
│  Écart cdt   —  —  —  —  ░  ░  ▒  ▒  ▓  ██  ██  ← signal utile   │
│                                                                     │
│  ✓ L'écart de crédit vous a alerté 2 tours avant la crise.         │
│  ✗ Vous n'aviez pas accès au signal Financement — il était rouge    │
│    depuis le tour 9.                                                │
├─────────────────────────────────────────────────────────────────────┤
│  Votre fonds : Stade CRISE — vous avez survécu.                     │
│  Fonds leveragé : EFFONDREMENT au tour 13 (absorption).             │
├─────────────────────────────────────────────────────────────────────┤
│  [ Continuer — Cycle 2 ]                                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 19. Références à étudier

### 1830: Railways & Robber Barons (Francis Tresham, 1986) — référence n°1
- Joueur = investisseur, pas la compagnie. Directeur = actionnaire majoritaire → conflit d'intérêts principal-agent institutionnalisé.
- Alternance Stock Rounds / Operating Rounds.
- Cours déterministes (dividende ↑, vente ↓, rétention ↓).
- **Train rush** : obsolescence brutale des trains par génération = transition de phase déclenchée par les joueurs eux-mêmes (crise endogène à timing stratégique). Compagnie sans train = passif ; le directeur paie de sa poche → **le dump** (passation de l'actif toxique).
- Compagnies privées rachetables à 2x la valeur → tunneling de manuel.
- Zéro hasard : toute l'incertitude est stratégique.
- Limite à dépasser : marché mécanique, pas de bulles émergentes ni de régimes.
- À tester sur 18xx.games (gratuit, asynchrone).

### Autres références
- **Offworld Trading Company** (Soren Johnson) : RTS 100% économique, prix dynamiques, shorts, rachats hostiles. Preuve qu'un jeu de stratégie sans militaire fonctionne.
- **Acquire** (Sid Sackson, 1964) : M&A, majorités actionnariales, timing.
- **Capitalism II / Lab** : profondeur de simulation d'entreprise.
- **Victoria 3** : économie mondiale simulée (mais joueur = État).
- **Railroad Tycoon 2/3** : marge, ventes à découvert, délit d'initié.
- **Civ VI Gathering Storm** : le mécanisme climat comme modèle de crise systémique endogène.
- Contre-exemple : **Monopoly** = jeu de rente aléatoire, quasi aucune décision (conçu en 1904 comme critique de la rente foncière).

---

## 20. Points à éclaircir — feuille de route

### Niveau 1 — La vision
1. ~~**Le fantasme du joueur**~~ — **TRANCHÉ (v0.4)** : 5 archétypes définis + 2 à venir (§6)
2. ~~**Solo vs multijoueur**~~ — **TRANCHÉ (v0.7)** : solo-first, 3 adversaires IA max, multi WebSockets en phase 2 (§16)
3. ~~**Historique vs procédural**~~ — **TRANCHÉ (v0.3)** : cadre atemporel.

### Niveau 2 — Le cœur mécanique
4. ~~**La boucle de tour**~~ — **TRANCHÉ (v0.4)** : 5 verbes, 4 PA, points de compétence (§8, §9)
5. ~~**Représentation du terrain**~~ — **TRANCHÉ (v0.4)** : carte hexagonale, 3 types de hexes (§11)
6. ~~**Échelle d'un tour et horizon de partie**~~ — **TRANCHÉ (v0.6)** : tours abstraits numérotés, fin par condition de victoire ou 3 cycles épuisés, score tiebreaker (§15)
7. ~~**Design de la défaite**~~ — **TRANCHÉ (v0.5)** : 3 stades (Stress → Crise → Effondrement), absorption ou wind-down, parties indépendantes (§14)

### Niveau 3 — Les systèmes
8. ~~**IA concurrentes**~~ — **TRANCHÉ (v0.7)** : pool unifié 9 profils + Banque centrale, choix des adversaires en début de partie (§16)
9. ~~**Banque centrale / régulateur**~~ — **TRANCHÉ (v0.7)** : IA de contrainte permanente, règle de Taylor gamifiée (§16)
10. ~~**Signaux concrets de la jauge**~~ — **TRANCHÉ (v0.8)** : 4 signaux (Volatilité / Écart crédit / Financement / Initiés), option A universelle pour prototype, option B par archétype prévue (§17)

### Niveau 4 — La réalité du projet
11. ~~**Objectif du projet**~~ — **TRANCHÉ (v0.5)** : jeu web, solo-first, multijoueur en phase 2 (§13)
12. **Le test minimal** : MVP web — carte fixe, 1 archétype jouable, 2–3 IA simples, jauge de fragilité active.

**Ordre d'attaque restant : 12 (MVP)**

---

## 21. Questions ouvertes

- [ ] Signaux bruités de la jauge : lesquels, à quel coût, quel niveau de bruit/retard
- [ ] Structure détaillée de l'arbre de compétences
- [ ] Génération procédurale de la carte (phase 2)
- [ ] Deux archétypes jouables restants à définir
- [ ] Noms in-game définitifs des archétypes
- [ ] Définition du MVP web (périmètre exact de la première version jouable)
- [x] ~~**Moteur de prix**~~ — **TRANCHÉ (v1.4)** : facteurs + ancre cachée + flux/impact-prix + carry, 4 fixes anti-script intégrés (§25)
- [x] ~~**Score**~~ — **TRANCHÉ (v1.5)** : Track Record (excédent vs marché − α·drawdown), remplace le Sharpe (§27)
- [x] ~~**Tempo / courbe d'accumulation**~~ — **TRANCHÉ (v1.6)** : calibrage statistique + `F(0)` en plage + critère horloge-vs-signaux (§28)
- [x] ~~**RÉSERVER, volet restant** (#2)~~ — **TRANCHÉ (v1.8)** : purge symétrique agrégée, proportionnelle à la part du capital (§23.3, §29.1)
- [x] ~~**Planchers de bruit** (#3)~~ — **TRANCHÉ (v1.8)** : σ réductible/irréductible + délais planchers, tirés en plages (§29.2)
- [x] ~~**Levier** (#4)~~ — **TRANCHÉ (v1.8)** : mécanique complète (coût croissant, appel de marge) ; viabilité = assertion J7 (§29.3)
- [x] ~~**Short au MVP ?**~~ — **TRANCHÉ (§30)** : le short devient une **primitive du profil neutre** ; les archétypes la modulent (Sismographe excelle, Vautour dissuadé par sa ressource). Implémenté (`Position.direction`).
- [~] **Carte — écart 13/16** : sans objet pour le prototype d'exploration, qui utilise une **carte hexagonale générée** (géométrie = adjacence, §30). La carte fixe `MVP_MAP` (13 hexes) reste pour les tests. À retrancher si on revient à une carte fixe pour le MVP.
- [ ] **Spécificités des archétypes à définir** — un à la fois, par-dessus le profil neutre (§30) : ressource, contraintes, mécaniques exclusives, modulation des primitives (dont le short).
- [~] **Bénéfices des nœuds** : **PB → Financement** ✅, **PB → levier −50 %** ✅, **Notation → signaux plus nets** ✅ (prototype, v1.12) ; reste ⛔ **BC → taux anticipés** (dépend de la banque centrale active).
- [ ] **Spawn de départ** : remplacer l'**aléatoire** (raccourci proto) par un spawn **choisi / par affinité d'archétype** + **draft de zones** en multijoueur (décision journal 2026-06-13, conforme §11). Clusters gardés contigus.
- [ ] **Nouveaux nœuds (hexes à effets)** : provisionner d'abord des **nœuds vides** (sans bénéfice), câbler la mécanique ensuite, un à la fois. Menu en journal (2026-06-13) : Chambre de compensation, Réseau d'initiés (4ᵉ signal), Bourse, Desk recherche, Banque d'investissement, Média.
- [ ] **Déblocage des hexes frontière** (marchés verrouillés) : mécanisme à définir (arbre de compétences §8 ou événement de marché).

---

## 22. Journal des décisions

| Date | Décision |
|---|---|
| 2026-06-10 | Crises endogènes (modèle conditionnel), pas de rail calendaire |
| 2026-06-10 | Jauge de fragilité cachée, signaux bruités et retardés |
| 2026-06-10 | 1830 et Offworld Trading Company comme références principales |
| 2026-06-10 | Ajout feuille de route 12 points — ordre d'attaque : fantasme, boucle de tour, prototype minimal |
| 2026-06-10 | **Cadre atemporel** : monde financier complet dès le tour 1, arbre de capacités de la firme |
| 2026-06-11 | **Archétypes** : 5 définis (Compounder, Sismographe, Prédateur, Architecte, Vautour) + 2 à venir |
| 2026-06-11 | **Badges** : 2 par défaut, 4 catégories, draft partiel |
| 2026-06-11 | **Structure des tours** : tour 1 fondation, 4 PA, 1 point de compétence tous les 3 tours |
| 2026-06-11 | **5 verbes** : LIRE / POSITIONNER / CONSTRUIRE / NÉGOCIER / RÉSERVER |
| 2026-06-11 | **Ressources** : Capital (3 états) + Réputation + ressource archétype + systémiques |
| 2026-06-11 | **Carte hexagonale** : 3 types, adjacence = corrélation, 4 paliers, carte fixe puis procédurale |
| 2026-06-11 | **Vocabulaire** : jargon conservé, tooltips 2 niveaux, lexique global |
| 2026-06-11 | **Objectif** : jeu web, solo-first, multijoueur WebSockets en phase 2 |
| 2026-06-11 | **Design de la défaite** : 3 stades (Stress → Crise → Effondrement), absorption ou wind-down, parties indépendantes |
| 2026-06-11 | **Échelle et horizon** : tours abstraits numérotés, fin par condition de victoire ou 3 cycles épuisés, score tiebreaker |
| 2026-06-11 | **IA concurrentes** : pool unifié 9 profils (5 archétypes jouables + 4 exclusifs IA) + Banque centrale permanente, choix des adversaires en début de partie, max 3 adversaires |
| 2026-06-11 | **Signaux** : 4 signaux (Volatilité gratuit / Écart crédit LIRE / Financement nœud / Initiés techno), option A universelle pour prototype, B par archétype prévu |
| 2026-06-11 | **Wireframes** : 4 écrans définis — configuration, vue principale, détail hex, post-mortem (§18) |
| 2026-06-11 | **Modèle numérique de la jauge (MVP)** : jauge cachée `F∈[0,1]`, accumulation à 3 termes, déclencheur hybride (zone morte / roulette quadratique / plafond déterministe), reset post-crise quasi-total, signaux bruités-retardés, corrélation `ρ→1` en crise (§23) |
| 2026-06-11 | **Cascade de crise** : la crise n'est pas un choc unique mais une séquence chute → rebond (bull trap) → vraie jambe baissière. Le rebond fait mentir les signaux (piège épistémique côté short). Reset reporté en fin de phase 3. Manipulation émergente (short-covering) + active (Prédateur, hors MVP) (§24) |
| 2026-06-11 | **Principe anti-script (audit v1.2)** : rien n'est temporellement scripté. (a) Régimes émergents, dérivés de `F` + tendance des prix, pas une séquence garantie par cycle ; cycle = budget de tours, nb de crises émergent (§15). (b) Cascade = morphologie à paramètres stochastiques par instance ; le rebond n'est pas toujours un piège (~30 % de vrais planchers) ; jamais de durées/ampleurs constantes (§24). Grammaire connue, instance imprévisible (§4.4) |
| 2026-06-11 | **Neutralité archétypale (v1.3)** : le marché est une physique neutre, les archétypes sont des lentilles dessus — pas la cible du design. Le même moteur offre un edge distinct à chaque archétype. Garde-fou « le hoarder peut perdre » : pas de crise = la réserve à 0 sous-performe (§26.1, §26.2) |
| 2026-06-11 | **Moteur de prix — PROPOSITION (v1.3, non verrouillé)** : structure à facteurs (corrélation émergente, `ρ→1` par domination du facteur marché), niveau de prix réversif autour d'une ancre (contrarian réel), facteur marché piloté par `F` avec melt-up en tension et bull trap en P&L. En attente des points du concepteur (§25) |
| 2026-06-11 | **Audit script stratégique (v1.3) — 5 défauts à corriger** : (1) Sharpe gameable [priorité], (2) RÉSERVER gratuit triple-récompense + levier individuel sur `F`, (3) clarté des signaux achetable, (4) levier = option morte sous Sharpe, (5) bonus phase-3 du Vautour redondant. Motif commun : appliquer aux mécaniques la règle « friction, pas synergie » (§7). NON ENCORE CORRIGÉS — chantier ouvert (§26.3, §26.5) |
| 2026-06-12 | **Moteur de prix VERROUILLÉ (v1.4, §25)** : (a) niveau `V` public / ancre `A` **cachée** = deuxième état caché du jeu, estimation de `A` à plancher de bruit irréductible [fix B] ; (b) melt-up **stochastique**, plage tension chevauchant le bull [anti-fuite] ; (c) variance `M/C/ε` ≈ 40/30/30 en plages, bascule 80-90 % systématique en crise → `ρ→1` émergent ; (d) `flux` = impact-prix intégré au moteur, « valorisations tendues » formalisées (`Σ log(V/A)+`) ; (e) carry séparé = coût physique de RÉSERVER, taux cash **jamais indexé sur `F`** [fix A] ; (f) `λ` faible en normal [fix D], recovery stochastique avec **dead recoveries** [fix C] — le creux n'est pas toujours une aubaine. Conséquences : défaut #5 résolu (bonus Vautour supprimé), #2 résolu au volet gratuité, #4 principe acquis, impact-prix absorbé, T2 (score) débloqué |
| 2026-06-12 | **Score VERROUILLÉ — Track Record (v1.5, §27)** : le Sharpe (3 vices : optimum dégénéré, punit le profil lumpy/récompense le skew négatif, illisible) est remplacé par `Rendement excédentaire vs marché − α·MaxDrawdown − pénalités de détresse`. Benchmark = **indice fixe de la carte** (anti-exploit « reste petit ») ; drawdown en **mark-to-market** (anti-exploit « diamond hands ») ; α=0.5 = point d'équilibre du défaut #4 à calibrer en J7. Affichage continu marché/joueur = pression FOMO. **Exception anti-script assumée** : le score est transparent et stable, pas bruité — l'anti-gaming vient de la structure, pas de l'obscurité. Défaut #1 résolu |
| 2026-06-12 | **Tempo VERROUILLÉ (v1.6, §28)** : on calibre une **distribution d'expériences**, pas une durée. Cibles statistiques (~60 % 1 crise / 10-15 % 2 crises / **20-25 % sans crise** / crise <t.5 rare mais possible) = diagnostics à atteindre via les paramètres générateurs, **jamais** en forçant le timing. `F(0)` tirée en plage cachée ~0.10-0.35 (§23.1 — monde avec un passé, pas de départ mémorisable). Pas de fenêtre de grâce décrétée. Arc en 3 actes = conséquence statistique, pas structure. Budget épistémique ~50-60 PA (voir ou agir). Asymétrie montée/chute ≥ 2:1. **Critère d'or = « les signaux battent l'horloge », assertion de test automatisé au jalon J7** (le moteur peut prouver qu'il n'est pas scripté) |
| 2026-06-12 | **Périmètre MVP VERROUILLÉ — T8 (v1.7)** : les 4 questions de la spec §13 validées (Vautour seul archétype *livré*, carte 16 hexes, stack Svelte/TS/SVG, ~30-45 min). **Exigence d'extensibilité élevée en principe** : archétypes / profils IA / cartes = données interchangeables, moteur N-profils dès J1, harness `simulate(config, n)` paramétrable (spec §11bis). **Calibrage multi-profils (§28.8)** : catch d'audit — tuner contre un seul bot re-scripterait la physique autour du Vautour ; parade = cibles de tempo multi-bots + assertion de neutralité en J7 (aucun profil ne domine strictement les Track Records). Design MVP complet : prochaine étape = code (J1) |
| 2026-06-12 | **Défauts résiduels #2/#3/#4 RÉSOLUS (v1.8, §29) — chantier script stratégique CLOS** : (#2) purge de `F` symétrique agrégée, proportionnelle à la part de capital — fin du forfait −0.05, tragédie des communs restaurée (§23.3) ; (#3) bruit en deux composantes, planchers irréductibles en plages (Vol 0.20→0.10, Crédit 0.10→0.06, Financement base relevée 0.08→0.04), délais irréductibles — l'infrastructure achète de la netteté, jamais de la certitude (§23.6, §29.2) ; (#4) mécanique du levier complète : coût croissant avec L et la détresse, **appel de marge** = mécanisme de transmission des cascades (vente forcée → flux → contagion endogène), test de viabilité du bot leveragé en assertion J7 (§29.3). Les 5 défauts de §26.3 sont résolus |
| 2026-06-12 | **J2 LIVRÉ (code)** : moteur sans UI exécutable. Modules `engine/` : `state` (positions, acteurs, F caché), `regime` (émergent §15), `market` (facteurs §25, ρ→1 en crise, ancre `A` suit la dérive fondamentale hors crise / tient en crise), `portfolio` (richesse mark-to-market, levier/crowding agrégés, appels de marge §29.3), `fragility` (accumulation/purge/déclencheur §23.4), `score` (Track Record §27), `turn` (boucle), `policy` (interface + politiques triviales — vraies IA = J4), `simulate` (harness §28). **Tests d'émergence** : levier agressif → plus de crises ; tout-réserve → quasi aucune crise ; nb de crises varie par instance (non scripté). 37 tests verts, typecheck + build OK. Coutures : cascade complète (§24) = J3 ; vraies IA = J4 ; signaux observables = J3 |
| 2026-06-12 | **POSITIONNER affiné (v1.9, §9bis)** : ajout de la **clôture partielle à 2 PA** (scale-out). L'ancien « redimensionner (augmenter ou réduire) » est scindé en `renforcer` (1-2 PA) et `clôture partielle` (2 PA) pour éviter une option morte. Coûts : Ouvrir 1-2 · Renforcer 1-2 · Clôture partielle 2 · Fermer totale 1. Rationale : la clôture partielle est le geste de la décision sous incertitude (§24.2) ; décisivité bon marché (sortie nette 1 PA) vs hésitation gérée (2 PA) ; garde-fou anti-gaming du drawdown (§27). Encodé en catalogue de données (`src/data/actions.ts`), 8 tests. Tests comportementaux en J2 |
| 2026-06-12 | **J1 LIVRÉ (code, commit `3345179`)** : squelette Svelte/Vite/TS. Moteur découplé (`src/engine/`, TS pur sans DOM), tout en données (`src/data/` : carte, Vautour, 2 profils IA, preset). Anti-script porté par la structure : RNG seedé + paramètres en plages tirées par instance (`params.ts`, aligné v1.8). 17 tests verts, build OK. **Question ouverte ajoutée (§21)** : écart de comptage carte — prose §4 = 16 hexes, adjacence = 13 ; le code suit l'adjacence ; à trancher avant J5 |
| 2026-06-12 | **J2 LIVRÉ (code)** : moteur sans UI. Jauge `F` (accumulation levier/crowding/valorisations, purge, déclencheur hybride §23.4), moteur de prix à facteurs (§25, `ρ→1` émergent), carry + coût du levier + appels de marge (§29.3), score Track Record (§27), harness `simulate(config, n)` paramétrable. **Précision de modèle (consignée §25.2)** : l'ancre `A` suit la dérive fondamentale hors crise → la fragilité ne monte que sous l'effet des comportements, pas de la dérive autonome (corrige un défaut détecté par test : tout-réserve donnait 82 % de crises). **Tests d'émergence** : levier agressif → plus de crises ; tout-réserve → quasi aucune ; nb de crises varie par partie. 37 tests |
| 2026-06-12 | **J3 LIVRÉ (code)** : cascade complète (§24) — machine à phases leg1 → rebond → (leg3 OU vrai plancher ~30%) → recovery, **forme tirée PAR CRISE** (anti-script intra-partie), bull trap matérialisé en P&L (drift positif du rebond) ; reset `F ∝ amplitude` à la résolution. **Signaux observables** (§23.6) : lectures bruitées-retardées de `F`, plancher de bruit en plages, **mensonge du rebond** (détente ambiguë car parfois vrai plancher). Instrument **horloge-vs-signaux** (§28.7) posé (assertion stricte → J7). 46 tests, build OK |
| 2026-06-12 | **J4 LIVRÉ (code)** : les 2 IA rule-based via une **fonction de réaction PARAMÉTRÉE** (memo §16) — `engine/ai.ts` interprète des paramètres de comportement portés en données sur le profil (ajouter une IA = des données). Fonds leveragé (momentum + levier, lit la **volatilité perçue bruitée**, réduit « trop tard ») et Value patient (achète la décote via **estimation bruitée de `A`** à plancher irréductible, jamais de levier, ne panique pas). Les IA ne voient JAMAIS `F`/`A` directs → derrière la courbe, contribution à `F` émergente. `runGame` câble les politiques depuis les profils. 51 tests, build OK. **Observation calibrage J7** : au tempo par défaut le taux de crise sature (~100 %) — les cibles §28.2 (20-25 % sans crise) ne sont PAS atteintes, à régler en J7 (l'émergence reste discriminée via le pic de `F`) |
| 2026-06-12 | **J5 LIVRÉ (code)** : UI vue principale (`App.svelte` + `lib/layout.ts`). Carte SVG des 13 hexes, panneau signaux (3 barres, `F` cachée), panneau actions (Ouvrir/Fermer/Réserver, budget PA), bandeau Track Record (Vous/Marché/pire séquence), journal, sélecteur de seed. **Le joueur humain = une `Policy` alimentée par l'UI → moteur inchangé.** Build OK (UI 59 kB), 51 tests. **Coutures honnêtes** : signaux révélés gratuitement (coût LIRE/nœuds pas encore câblé) · clôture partielle et levier absents de l'UI · 13 hexes rendus (écart 13/16 toujours ouvert §21). Vérifié par compilation + tests, pas par rendu live |
| 2026-06-12 | **Prototype d'exploration (UI, à l'essai — §30)** : nouvelle boucle proposée par le concepteur. Spawn aléatoire, **brouillard** (voir seulement les adjacents), **investir = se déplacer + révéler** (immédiat, sans retour), **CHAIN** (1ʳᵉ ouverture 1 PA, enchaînées 2 PA), **S'installer** sur les nœuds (présence sans investir). **Carte hexagonale GÉNÉRÉE** (`generate.ts`) où voisins = coords axiales → géométrie = adjacence (corrige la grille carrée). LIRE câblé en UI (signaux Écart/Financement payants). Moteur économique **inchangé**. Carte fixe `MVP_MAP` conservée pour les tests |
| 2026-06-12 | **Restructuration des profils (DÉCISION — §30)** : on inverse l'ordre — **primitives d'abord (profil NEUTRE), spécificités ensuite (archétypes)**. Le profil neutre = toutes les primitives, zéro pouvoir → bac à sable de mécanique. Les archétypes deviennent une **couche de modificateurs** développée **un à la fois** (définir → tester → équilibrer → valider → suivant). **Conséquence sur le short** : devient une **primitive du neutre** (réoriente §21), les archétypes la **modulent** (Sismographe excelle, Vautour en est dissuadé par sa ressource — pas par une interdiction codée). **Primitive SHORT livrée** (`Position.direction`, P&L miroir, marge/flux sensibles au sens). Inventaire des primitives complet : OUVRIR(L/S)/RÉSERVER/LIRE/RENFORCER/FERMER/PARTIAL. 62 tests |
| 2026-06-12 | **Architecture multijoueur « plan & TICKs » (PROPOSITION, §31)** : système WeGo — phase de choix simultanée (chaque joueur trace son chemin + planifie), puis phase d'observation en TICKs qui révèlent **les déplacements seuls (investissements cachés)** → inférence sur les rivaux ; point d'insertion des effets archétype/tech/retardement. **Prix figés entre TICKs en v1** (sinon l'impact-prix trahit les investissements ; fuite par la taille = option avancée). Phase 2, non implémenté. Premier pas fait : **IA spatiales et visibles sur la carte** (footprint sur hexes révélés) |
| 2026-06-12 | **Doc mécaniques + tuto réservé** : création de `docs/mecaniques.md` (inventaire de ce qui tourne réellement dans le prototype A→H + section « pas encore branché ») comme référence vivante. **Tutoriel réservé pour plus tard** : approche pressentie = hybride (court premier-contact guidé + jeu libre sur seed curé + post-mortem comme professeur), s'appuyant sur §12 (onboarding contextuel) et §17 (apprentissage par observation). À reprendre via l'agenda en 6 points (approche / curriculum / seed / ton / contenu / implémentation) |
| 2026-06-12 | **Bénéfices des nœuds câblés + levier joueur + DÉPLACER + debug (prototype)** : **PB → Financement** (flux continu gratuit sur présence) ; **PB → levier −50 %** (`ActorState.borrowMultiplier`, moteur) ; **Notation → signaux plus nets** (`computeSignals(noiseScale)` + plancher irréductible §29.2) ; **BC → taux anticipés** reste ⛔ (chantier « réveiller la BC »). **Présence à durée ~3 tours** (`presenceUntil`) = futur bouton d'archétype. **Levier joueur** 0/2/3× exposé en UI. Primitive **DÉPLACER** (bouger sans investir, 1 PA) + **« Ouvrir ici »** (corrige : on pouvait pas investir sur l'hexe courant). **Mode debug 🐞** (révèle F / régime / phase / ancres A). Réf `docs/mecaniques.md` |
| 2026-06-12 | **Diagnostic calibrage → J7 = prochain chantier (autre session)** : partie testée (seed 3) + rejeu moteur — la mécanique tourne (bulle → krach tour 6 → rebond/bull trap → reset → recovery, 1 crise émergente) MAIS **tempo trop rapide** (F franchit le plafond 0.85 dès le tour ~6) et **amplitudes trop fortes** (marché ×2 en 12 tours, joueur +434 %, drawdown ~0 % → trop facile). J7 : régler poids d'accumulation + purge + drifts/vols vers les cibles §28.2 et un drawdown qui mord. Outils prêts : harness, critère §28.7, mode debug |
| 2026-06-13 | **Spawn & clusters (DÉCISION / piste)** : **garder les clusters CONTIGUS** — adjacence = corrélation (§11) ; un éparpillement aléatoire viderait la carte de son sens (le voisin serait décorrélé, plus de logique de contagion ni d'arbitrage concentration/dispersion). **Remplacer le spawn ALÉATOIRE** (raccourci de prototype) par un spawn **choisi / par affinité d'archétype** — conforme à §11 (« position de départ déterminée par archétype + badges »). Motif : l'aléatoire pénalise par la chance, surtout en **multijoueur** (l'un naît près d'un PB, l'autre dans un coin). **Multi** : phase de setup avec **draft de zones** ou **spawns symétriques équilibrés**. Chaque archétype = une **affinité de zone** (Sismographe ~ macro/BC · Architecte ~ Notation/exotiques · Vautour souple). Garde-fou : aucun cluster objectivement meilleur (neutralité §26) → le choix est un arbitrage. À implémenter avec la couche archétypes / le setup §31 |
| 2026-06-13 | **Nouveaux nœuds = hexes à effets spéciaux (PISTE, §11)** : pour provisionner des « hexes à effets », on **étend le système de nœuds** plutôt que d'inventer un type d'hexe « vide » générique — les nœuds ont déjà toute la machinerie (présence / S'installer / durée ~3 tours / bénéfice câblé). Un nouveau `nodeType` = un hexe à effet, ajouté en **donnée** ; bénéfice câblé **un à la fois**. **Approche décidée : d'abord placer des nœuds VIDES (sans bénéfice), réfléchir à la mécanique ensuite.** Menu de candidats (infra réelle → levier mécanique) : **Chambre de compensation** → seuil de marge (§29.3) · **Réseau d'initiés** → débloque le **4ᵉ signal « Initiés »** (coupé au MVP, §17/§23.6) · **Place de marché/Bourse** → impact-prix `flux` (§25.4) · **Desk de recherche/data** → délai des signaux (complète Notation qui réduit le bruit) · **Banque d'investissement** → déblocage des **frontières** (§21) · **Média** → Réputation (§10). Trivial à ajouter (données) ; le travail réel = câbler chaque bénéfice |
| 2026-06-13 | **Portabilité / rendu (note, §13)** : la séparation moteur (TS pur) / UI (mince) rend le **rendu interchangeable**. Pour de plus beaux graphismes → **rendu web enrichi** (PixiJS/Phaser/WebGL) en réutilisant le moteur tel quel (le moins cher). **Unity** = possible mais nécessite un **portage du moteur en C#** (cadré par les 60+ tests), pertinent surtout pour des **builds natifs**/3D — pas indispensable pour ce jeu (carte + jauges + data-viz). Règle : ne jamais mélanger logique et affichage ; choix du rendu **différé** |

---

## 23. Modèle numérique de la jauge de fragilité (MVP) — VERROUILLÉ

> Spécification chiffrée de la mécanique centrale (§4). Valeurs de prototype, à calibrer aux tests.
> Cadre MVP : 1 archétype (Vautour) + 2 IA (Fonds leveragé, Value patient). Tout l'état est caché.

### 23.1 La jauge `F`

État systémique caché, `F ∈ [0, 1]`, non affiché en jeu (révélé seulement au post-mortem, §17).

```
F(t+1) = clamp01( F(t) + accumulation(t) − purge(t) )
```

**Fragilité initiale `F(0)` (DÉCISION, v1.6)** : tirée dans une **plage cachée ~0.10–0.35** (max < zone morte 0.40 → aucune crise possible au tour 1). Le monde naît avec un passé : on n'arrive pas dans un marché vierge mais dans un marché déjà plus ou moins chaud. Conséquence : pas de départ mémorisable (sinon « le tour 1 est toujours froid » → levier d'ouverture sans risque), et un skill dès le premier tour — LIRE au tour 1 peut révéler qu'on est né dans un marché tendu. Voir le tempo en §28.

### 23.2 Accumulation (ce qui gonfle la bulle)

Somme de 3 termes agrégés sur **tous les acteurs** (joueur + IA) :

| Terme | Définition | Contribution |
| --- | --- | --- |
| Levier | `ratio_levier` = capital leveragé total / capital total | `0.06 × ratio_levier` |
| Crowding | `indice_crowding` = concentration des positions dans des hexes adjacents | `0.04 × indice_crowding` |
| Valorisation | `tours_bull` = nb de tours consécutifs de régime bull | `0.01 × tours_bull` |

Dérive à vide ≈ +0.01/tour. Fonds leveragé à plein régime ≈ +0.08/tour → zone rouge en 6–8 tours. Dynamique « feux de forêt » : un système jamais purgé accumule jusqu'au krach (§4.3).

### 23.3 Purge (ce qui désamorce) — amendé v1.8

**Symétrie agrégée (DÉCISION, v1.8)** : la purge n'est plus un forfait individuel (l'ancien `−0.05`/acteur donnait à chacun un levier personnel sur un état censé systémique — défaut #2, §26.3). `F` répond aux **mêmes grandeurs agrégées à la baisse qu'à la hausse** :

| Terme | Effet |
| --- | --- |
| Désendettement | la **baisse du ratio de levier agrégé** purge `F` (poids miroir de l'accumulation §23.2) — l'effet d'un acteur est mécaniquement proportionnel à sa part du capital total |
| Mean-reversion naturelle | `−0.02` par tour (petites corrections, systémique) |

Un petit acteur qui réserve ne déplace presque rien ; une baleine qui désendette déplace beaucoup — et son impact-prix (§25.4) le lui facture. La tragédie des communs (§4.3) est restaurée : personne ne possède la purge. Exploit « spam RÉSERVER pour piloter `F` » : mort par dilution.

### 23.4 Déclencheur de crise — **hybride (DÉCISION)**

```
F < 0.40           →  p_crise = 0                    (zone morte : pas assez de combustible)
0.40 ≤ F < 0.85    →  p_crise = k × (F − 0.40)²      (zone roulette : surprise, k ≈ 1.5)
F ≥ 0.85           →  crise garantie dans 1–2 tours  (plafond déterministe : la bulle finit toujours par éclater)
```

Repères (`k=1.5`) : F=0.7 → ~13 %/tour · F=0.9 → crise imminente garantie.

**Rationale** : la tension ne vient pas du RNG mais de l'**état caché à inférer**. Le quadratique rend la fin de bulle brutalement dangereuse ; la zone morte garantit qu'un système purgé est sûr ; le plafond déterministe interdit qu'une bulle euphorique soit tenue gratuitement ; le grain de stochastique en zone médiane tue le métagame de mémoire (§5). La jauge cachée transforme le déterminisme en suspense.

### 23.5 Amplitude et reset post-crise

- **Amplitude** = valeur de `F` au tour du déclenchement. Krach à F=0.95 → dévastation ; à F=0.45 → simple correction.
- **Reset** : `F → 0.15 × amplitude` (purge quasi-totale — cycles nets, lisibles, façon 1830). **Le reset n'intervient qu'à la fin de la phase 3 de la cascade** (§24), pas au déclenchement : pendant le rebond (phase 2) `F` ne fait que *sembler* refluer via les signaux, sans purge réelle.
- Les positions leveragées sont rasées proportionnellement à l'amplitude → le Fonds leveragé peut s'effondrer ici, au moment précis où le Vautour déploie sa réserve sèche. La boucle archétype ↔ crise est bouclée.

> Le déclenchement n'est pas un choc instantané mais l'entrée dans une **cascade multi-phases** : voir §24.

### 23.6 Signaux (lecture bruitée-retardée de `F`)

Option A universelle (§17). Signal affiché = `F` retardée + bruit, quantifié en barres.

```
signal_i(t) = quantize( F(t − retard_i) + N(0, σ_i) )
```

| Signal | Retard (base → plancher) | Bruit σ (base → plancher) | Accès MVP |
| --- | --- | --- | --- |
| Volatilité | 0 → 0 | 0.20 → **0.10** | gratuit, toujours visible |
| Écart de crédit | 1 → **1** (irréductible) | 0.10 → **0.06** | 1 PA (LIRE) |
| Financement | 2 → **1** (jamais 0) | **0.08** (relevé, v1.8) → **0.04** | présence au nœud liquidité |

Planchers irréductibles : voir §29.2 (défaut #3 résolu). Le signal « Initiés » (§17) dépend de l'arbre techno, **coupé au MVP** → écarté pour l'instant. Skill central = **triangulation** : croiser plusieurs signaux concordants pour inférer la zone de `F`.

### 23.7 Rendements et corrélation

- Chaque hex a un rendement de base par régime ; une position rapporte `base ± volatilité_locale`.
- Hexes adjacents corrélés par `ρ`. **Normal : `ρ ≈ 0.3`. Quand `F` monte : `ρ → 1`** → en crise tout tombe ensemble, contagion depuis les hexes les plus crowdés. La concentration est punie exactement quand `F` est haute.

### 23.8 Paramètres à calibrer aux tests

`0.06 / 0.04 / 0.01` (poids accumulation) · `0.05 / 0.02` (purge) · `k=1.5` · seuils `0.40 / 0.85` · `σ` des signaux · `ρ` normal/crise. Aucun n'est définitif — ce sont des points de départ cohérents, pas des constantes gravées.

---

## 24. Cascade de crise — le bull trap (MVP)

> Amende §23.5. La crise n'est pas un choc instantané mais une **morphologie multi-phases**.
> Inspiration : le bear-market rally / dead-cat bounce qui sort les late shorts avant la vraie jambe baissière.
> **Principe directeur (§4) : structurel, jamais scripté.** La *grammaire* est connue, l'*instance* est imprévisible.

### 24.1 La morphologie (grammaire connue, instance imprévisible)

Une fois le déclencheur franchi (§23.4), la crise se déroule selon une morphologie typique — **mais aucune de ses caractéristiques n'est fixe ni mémorisable** :

| Phase | Nom | Marché | `F` réelle | Ce que voient les signaux |
| --- | --- | --- | --- | --- |
| 0 | Déclenchement | — | au seuil | rouge (volatilité explose) |
| 1 | Première jambe | chute | élevée | rouge net |
| 2 | **Rebond** (peut être un bull trap) | hausse rapide | **inchangée si trap** | **se détendent — paraissent verts** |
| 3 | Vraie jambe *(pas toujours)* | chute profonde, `ρ→1`, contagion | maximale | rouge extrême (trop tard) |

Le **reset** de `F` (§23.5) n'a lieu qu'**à la résolution finale** de la cascade, jamais avant.

### 24.2 Ce qui rend l'instance imprévisible (anti-script)

Le joueur sait que les crises *peuvent* faire un faux rebond (connaissance structurelle, autorisée §4.4). Il ne peut jamais savoir, pour *cette* crise :

1. **Durées de phase** — tirées dans des plages, pas constantes (jamais « toujours 2 tours »).
2. **Ampleur du rebond** — distribution, pas une valeur fixe.
3. **CRITIQUE — le rebond n'est pas toujours un piège.** Une fraction des crises **creuse au rebond** : la première jambe *était* tout le mouvement, le rebond est un vrai plancher, il n'y a pas de phase 3. Si tout rebond était un piège, le joueur apprendrait « ne jamais racheter le rebond » et la phase 2 serait résolue. Il faut qu'**on ne puisse pas distinguer un vrai plancher d'un faux trap pendant qu'on y est**.

Conséquence : le skill n'est **jamais** « compter les tours après le trigger ». C'est toujours « inférer un état caché à partir de signaux bruités » (§4.4, §5). Aucune partie ne reproduit la précédente.

### 24.3 Le piège épistémique (cœur de la mécanique)

Quand le rebond *est* un trap, `F` reste haute mais les **signaux bruités-retardés** (§23.6) se détendent : la volatilité retombe, l'écart de crédit se resserre. Le joueur lit *« c'est fini »* — alors que le combustible est intact. Mais comme parfois le rebond est un vrai plancher (§24.2.3), se couvrir n'est pas toujours une erreur : c'est un **pari sous incertitude**, pas une règle à apprendre.

- Transpose « être en avance, c'est être dans le tort » (§4.5) côté **short** : le late short qui se couvre se fait parfois sortir juste avant la vraie chute — parfois il a raison.
- Le rebond est le moment où les signaux *mentent le plus légitimement* — pas un bug, la dynamique réelle d'un marché en détresse.

### 24.4 Manipulation du rebond

- **Émergente (gratuite, réaliste)** : tout acteur qui **couvre son short** en phase 2 alimente le rebond. Le bull trap se creuse de lui-même via le short-covering agrégé — aucune règle spéciale, ça émerge des positions. Cette boucle de rétroaction est aussi ce qui rend l'instance imprévisible : la suite dépend des réactions réelles des acteurs, pas d'un script.
- **Active (hors MVP)** : un acteur au palier **Dominance** (§11) ou le **Prédateur** (§6) peut acheter délibérément dans la panique pour forcer le squeeze, sortir les shorts, puis dumper. Le **short squeeze** (déjà au kit du Prédateur, §10) devient une manœuvre de timing sur la cascade, pas un bouton isolé.

### 24.5 Garde-fou contre l'exploit

`F` reste **agrégée et non-possédée** (§4.3) : aucun joueur seul ne contrôle le dégonflement. On peut *pousser* `F` vers le bas en se désendettant, ou *fabriquer* un rebond local en phase 2, mais le combustible systémique appartient à tous les acteurs — pas d'exploit « bulle saine infinie ».

### 24.6 Périmètre MVP

- **Activé au MVP** : la morphologie (phases à paramètres stochastiques) + le rebond parfois-piège-parfois-plancher + le mensonge des signaux + la manipulation **émergente** (short-covering).
- **Reporté (post-MVP)** : la manipulation **active** du rebond (arrive avec le Prédateur et le palier Dominance).

### 24.7 Paramètres à calibrer (des plages, jamais des constantes)

- Durée de chaque phase : tirée dans une plage (proto : jambe 1 ∈ 1–2 tours, rebond ∈ 1–3, jambe 3 ∈ 1–3).
- Ampleur du rebond : distribution (proto : récupère 25–55 % de la jambe 1).
- **Probabilité que le rebond soit un vrai plancher** (pas de phase 3) : proto ≈ 30 %.
- Détente des signaux en phase 2 : retour en zone « ambre » alors que `F` est rouge.

Tout est tiré par instance. **Aucune de ces valeurs ne doit être observable ou constante d'une partie à l'autre.**

---

## 25. Moteur de prix et de rendements — VERROUILLÉ (v1.4)

> Statut : **DÉCISION**. Intègre les 4 arbitrages de T1 et les 4 corrections de l'audit anti-script du moteur (findings A→D, §25.8).
> Contraintes héritées : **physique neutre** (§26), **rien de scripté** (§4, §15, §24) — tous les paramètres sont des plages tirées par instance.

### 25.1 Équation centrale et structure à facteurs

```
r_i(t) = β_i·M(t) + γ_i·C_cluster(t) − λ·log(V_i/A_i) + flux_i(t) + ε_i(t)
V_i(t+1) = V_i(t) · (1 + r_i(t))
```

- `M(t)` = facteur marché commun · `C_cluster(t)` = facteur de cluster (Actions / Crédit / Alternatifs) · `ε_i(t)` = idiosyncratique local · `λ` = force de réversion vers l'ancre · `flux_i(t)` = impact-prix des ordres (§25.4).
- **Décomposition de variance en régime normal** (plages par instance) : `M` ~40 % (30–50), `C` ~30 % (20–35), `ε` ~30 % (20–40). Aucune composante négligeable : chaque archétype vit sur l'une d'elles (Sismographe → `M`, jeu de carte → `C`, Architecte/LIRE → `ε`).
- **En crise** : `Var(M)` gonfle, `ε` s'écrase → part systématique ~80–90 % → **`ρ→1` émerge** sans être forcé. La sélection ne protège plus, seul le positionnement macro compte — punition naturelle de la concentration.
- Les **charges** `β_i, γ_i` sont connues du joueur (connaissance structurelle, §4.4) ; les **réalisations** `M`, `C` ne le sont pas.

### 25.2 Ancre cachée — le deuxième état caché (DÉCISION CLÉ)

- **`V` est public** (c'est le prix). **`A` est caché** (la juste valeur n'est jamais observable). Si `A` était visible, « `V<A` → achète » serait une recette — script stratégique de manuel.
- Le jeu a donc **deux états cachés** : `F` (macro — quand le système casse) et `A_i` (micro — ce que vaut vraiment cet hexe). **LIRE a deux usages** : signaux de `F`, ou estimation de l'écart `V/A` d'un hexe.
- `A_i` suit une **marche lente bruitée** → toute estimation se périme et doit être rafraîchie (§5 : l'information se déprécie).
- **Précision implémentation (J2)** : hors crise, `A` suit la **dérive fondamentale** (le drift du régime) — ainsi une hausse calme n'étire *pas* la valorisation, et la fragilité (§23.2) ne monte que sous l'effet des **comportements** (levier, crowding, flux), jamais de la dérive autonome du marché. **En crise, `A` tient** pendant que `V` chute → c'est la dislocation `V≪A` que la recovery peut réverser (§25.6). C'est ce qui garantit qu'une table prudente reste sûre (§26.2, vérifié par test d'émergence).
- **Fix B (anti-script)** : l'estimation de `A` porte un **plancher de bruit irréductible** — même principe que le défaut #3 côté macro. L'Architecte **resserre l'intervalle, ne le ferme jamais**. La juste valeur reste un pari, même bien informé.

### 25.3 Facteur marché piloté par `F` — melt-up stochastique

`M(t) = μ(régime) + σ(régime)·z`. Régimes **émergents** (§15), paramètres = distributions :

| Régime | drift `μ` | vol `σ` | Rôle |
| --- | --- | --- | --- |
| Bull (F basse) | léger + | bas | gains réguliers → coût d'opportunité de la réserve |
| Tension (F monte) | + à ++ **(plage chevauchant le bull)** | moyen | melt-up *parfois* spectaculaire, *parfois* indistinguable d'un bull sain |
| Crise jambe 1 | fort − | haut | la chute |
| Crise rebond | + | haut | le bull trap en P&L (§24) |
| Crise vraie jambe | très fort − | très haut | contagion, `ρ→1` |
| Recovery | **stochastique** (§25.6) | moyen | la réversion *peut* payer l'acheteur du creux |

**Anti-script (melt-up)** : si le melt-up était systématique, « rendements anormalement bons = sommet » deviendrait une lecture propre et gratuite de `F`. La plage de tension **chevauche** celle du bull : l'euphorie est un indice, jamais une preuve.

### 25.4 Le flux = l'impact-prix (absorbe le chantier liquidité)

- `flux_i(t)` = pression nette des achats/ventes de **tous** les acteurs sur l'hexe. Sortir d'une grosse position fait baisser `V` contre soi ; le crowding gonfle `V` au-dessus de `A`.
- Réalise le §5 (« la liquidité est une ressource, sortir a un impact prix ») **dans** le moteur — pas de système séparé.
- **« Valorisations tendues » (§23.2) a maintenant une définition formelle** : la contribution à `F` est une somme pondérée des étirements `log(V_i/A_i)` positifs.
- Auto-limitant par construction : plus on pèse, plus bouger coûte — pas d'exploit solo.

### 25.5 Carry et taux cash

- Chaque position touche un **carry** `c_i` par tour. Profils par classe : crédit/immobilier = carry haut, appréciation faible ; actions/PE = l'inverse.
- La réserve touche le **taux cash**, quasi nul.
- **Le coût de RÉSERVER est désormais physique et symétrique** : carry abandonné + drift raté, chiffré chaque tour à l'écran. La friction exigée par §26.4 est dans le moteur, pas dans une taxe → résout le volet « gratuité » du défaut #2 (§26.3).
- **Fix A (anti-fuite épistémique)** : le taux cash n'est **JAMAIS indexé directement sur `F`**. Un taux `= f(F)` serait une lecture propre, gratuite et non bruitée de l'état caché — trappe identifiée et tuée à l'audit. **MVP : taux quasi constant.** Post-MVP optionnel : un taux réagissant à une lecture *grossière et retardée* de `F`, traité comme **un signal de plus avec son bruit** (§17), jamais comme un télégraphe.

### 25.6 Réversion et recovery — le creux n'est pas toujours une aubaine

- **Fix D (anti-grind)** : `λ` est **faible en régime normal** et ne mord **qu'aux extrêmes** de `log(V/A)`. Sinon « fade les extrêmes + encaisse le carry » devient un revenu régulier à faible vol — exactement le vecteur de Sharpe-gaming du défaut #1. Le trend (`M`) domine en bull ; la réversion n'est jamais une imprimante.
- **Fix C (anti-free-money)** : la force de la recovery est **stochastique** — parfois vigoureuse, parfois molle, parfois **nulle** : des **dead recoveries** où `A` lui-même a chuté (la valeur a réellement été détruite), `V` se ré-ancre bas et ne remonte pas. Pendant exact du « rebond pas toujours un piège » (§24.2) : **le creux n'est pas toujours une aubaine**. Acheter la dislocation reste un pari, jamais une certitude.

### 25.7 La boucle macro (neutre)

```
flux (levier + crowding) → V_i s'étire au-dessus de A_i
   → « valorisation tendue » alimente F (§23.2 / §25.4)
      → crise plus probable
         → V_i s'effondre sous A_i
            → dislocation exploitable par PLUSIEURS profils (§26)
               → recovery stochastique : la réversion V→A peut payer — ou pas (§25.6)
```

Moteur de prix et jauge sont **un seul système**. La dislocation post-crise n'est la récompense de personne en particulier (§26.1).

### 25.8 Audit anti-script du moteur — les 4 corrections intégrées

| Finding | Risque identifié | Correction intégrée |
| --- | --- | --- |
| **A** | taux cash indexé sur `F` = canal qui **révèle l'état caché** gratuitement | indexation directe interdite ; MVP taux quasi constant ; post-MVP éventuel = signal bruité de plus (§25.5) |
| **B** | estimation **fiable** de `A` → « `V` sous mon estimation → achète » = recette (défaut #3 resurgi au micro) | plancher de bruit irréductible sur `A` ; l'Architecte resserre, ne ferme jamais (§25.2) |
| **C** | réversion **garantie** en recovery → acheter tout krach = free money → puzzle résolu | recovery stochastique, dead recoveries possibles — `A` peut avoir chuté (§25.6) |
| **D** | `λ` fort en régime normal → grind « fade + carry » à faible vol (vecteur du défaut #1) | `λ` faible en normal, ne mord qu'aux extrêmes (§25.6) |

### 25.9 Ce que le moteur résout ailleurs (mise à jour du chantier §26)

- **Défaut #2 (RÉSERVER)** — volet « gratuité » **résolu** par le carry (§25.5). **Reste ouvert** : diluer l'effet individuel sur `F` (piste : purge proportionnelle à la part du capital total de l'acteur, pas un forfait `−0.05`).
- **Défaut #3 (clarté achetable)** — principe du plancher de bruit **étendu au micro** (`A`, §25.2). Reste à chiffrer les planchers côté signaux macro.
- **Défaut #4 (levier option morte)** — le levier devient *parfois correct* par nature : amplifier une conviction de régime sur `M` (le métier du Sismographe). À vérifier au calibrage MVP.
- **Défaut #5 (bonus phase-3 Vautour)** — **supprimé** : la physique neutre paie le creux (réversion), quand elle le paie (§25.6). Retiré de la spec MVP.
- **Impact-prix / liquidité** — absorbé dans `flux` (§25.4) ; ce n'est plus un chantier séparé.
- **T2 (score)** — débloqué : la distribution des rendements est connue, la pénalité de queue peut être conçue.

### 25.10 Paramètres à calibrer (plages, jamais des constantes)

Parts de variance `M/C/ε` par régime · drifts et vols par régime (avec chevauchement bull/tension) · `λ` normal / extrêmes / recovery · probabilité et profondeur des dead recoveries · carries par classe · taux cash · planchers de bruit (estimation `A`, signaux macro) · poids des étirements `log(V/A)` dans `F`. **Aucune de ces valeurs ne doit être observable ou constante d'une partie à l'autre.**

---

## 26. Neutralité archétypale et défauts de script stratégique à corriger

> Deuxième sens de « script » identifié à l'audit : non plus un script *temporel* (§15, §24) mais un script *stratégique* — une physique réglée pour qu'**une seule stratégie prédéterminée gagne**, transformant le jeu en puzzle résolu.

### 26.1 Principe de neutralité archétypale (DÉCISION)

**Le marché est une physique neutre. Les archétypes sont des lentilles posées dessus, jamais la cible de son design.** Le même moteur (§25) doit offrir un edge *distinct* à chacun :

| Archétype | Exploite la **même** physique par… |
| --- | --- |
| Vautour | acheter les dislocations (`V≪A`) après le krach |
| Compounder | ignorer le cycle, détenir sans levier, composer carry+drift sur l'horizon long |
| Sismographe | lire `M`, parier *leveragé* sur le retournement de régime — il shorte le sommet, gagne *grâce* à la crise |
| Architecte | réduire l'idiosyncratique `ε` (meilleurs signaux) → alpha de sélection, pas de timing |
| Prédateur | manipuler `V` localement (crowding, squeeze) → dislocations provoquées |

Le Vautour est un **locataire** du monde, pas son architecte. Le creux post-crise est une dislocation que plusieurs profils exploitent différemment.

### 26.2 Garde-fou « le hoarder peut perdre » (DÉCISION, vital au MVP)

Si **aucune crise n'arrive** (table prudente, §15), le Vautour qui a thésaurisé sa réserve à 0 **sous-performe et peut perdre** au score contre quelqu'un d'investi. Sans cette branche, le MVP (Vautour seul) serait un puzzle résolu (« réserve, attends le krach, déploie »). **La patience doit être un pari, pas une recette.**

### 26.3 Défauts de script stratégique à corriger

| # | Mécanique | Stratégie résolue / option morte | Piste de correction |
| --- | --- | --- | --- |
| 1 | **Score Sharpe** (unique victoire MVP, §9 spec) | optimum dégénéré : récolter le carry de l'hexe le moins volatil et ne plus bouger → Sharpe énorme, risque de queue caché (« ramasser des pièces devant le rouleau compresseur ») | pénaliser le risque de queue dans le score, **ou** combiner Sharpe avec un seuil de rendement absolu |
| 2 | **RÉSERVER** (§23.3, spec §5) | action **gratuite (0 PA) à triple récompense** : baisse `F`, accumule la ressource, sans coût réel ; de plus `−0.05` individuel = levier personnel fort sur un `F` censé systémique (grignote la tragédie des communs §4.3) | donner un coût/contrepartie à RÉSERVER ; **plafonner ou diluer** l'effet individuel sur `F` |
| 3 | **Clarté des signaux achetable** (nœuds INFO/LIQ, §11) | camper les nœuds → signaux quasi-nets permanents → l'inférence sous bruit, *qui est le jeu*, s'évapore | les nœuds *améliorent* sans *fiabiliser* : garder un **plancher de bruit irréductible**, surtout près du déclenchement |
| 4 | **Levier** (§10, §23.2) | sous victoire au Sharpe, le levier gonfle la vol et se fait raser → *toujours* mauvais pour le joueur solo → **option morte** (design gaspillé) | garantir qu'il soit *parfois correct* (le pari leveragé du Sismographe sur un retournement) ; surveiller au MVP Vautour-only |
| 5 | **Bonus « achat phase 3 » du Vautour** (spec §6) | (a) redondant : la réversion `V→A` (§25.2) paie déjà le creux ; (b) branché sur un **état caché** (la phase) → invisible donc invisible, ou révélé donc re-scripté | **supprimer le bonus explicite** ; laisser la physique neutre payer le creux |

### 26.4 Le motif commun

Quatre de ces cinq défauts viennent de la même erreur : **une métrique ou une ressource qui récompense un comportement de façon trop propre et unilatérale.** Règle à appliquer désormais à *nos propres* mécaniques, comme on l'a fait pour les badges (§7 : « friction, pas synergie ») : **chaque levier doit porter un coût symétrique qui crée un dilemme.**

### 26.5 Actions de modification — état au verrouillage du moteur (v1.4)

- [x] Réécrire la boucle macro **partout sans clause Vautour** (§25.7).
- [x] Corriger le score (#1) — **TRANCHÉ (v1.5)** : remplacé par le Track Record (§27).
- [~] Re-tarifer RÉSERVER (#2) — volet « gratuité » **résolu** par le carry (§25.5) ; **reste** : diluer l'effet individuel sur `F` (piste : purge proportionnelle à la part du capital total).
- [~] Plancher de bruit irréductible (#3) — principe **étendu au micro** (`A`, §25.2) ; **reste** : chiffrer les planchers des signaux macro.
- [~] Levier (#4) — principe acquis : « parfois correct » via conviction de régime sur `M` (§25.9) ; **reste** : calibrer **α** du Track Record (§27.4), qui est le point d'équilibre de #4.
- [x] Retirer le bonus phase-3 du Vautour de la spec (#5) — la physique paie le creux, quand elle le paie (§25.6).
- [x] Inscrire la neutralité archétypale + « le hoarder peut perdre » comme contraintes du moteur de prix (§25 : recovery stochastique + carry rendent le hoarding arithmétiquement perdant sans crise).

---

## 27. Le score — Track Record (VERROUILLÉ, v1.5)

> Remplace le Sharpe (défaut #1, §26.3). La fonction-objectif oriente tout le comportement du joueur : elle doit être anti-gaming **par structure**, lisible, et neutre entre archétypes.

### 27.1 Pourquoi le Sharpe saute (trois vices)

1. **Optimum dégénéré** : carry de l'hexe le moins volatil + immobilité → Sharpe énorme, jeu mort.
2. **Il punit le bon profil** : le Sharpe pénalise la volatilité *des gains aussi*. Le profil du Vautour (plat, plat, +60 % d'un coup) voit son pic de gain exploser sa vol mesurée → Sharpe effondré. Pire, il **récompense le skew négatif** (gains réguliers, perte cachée) — le comportement même que le jeu dénonce.
3. **Illisible en jeu** : « rendement moyen / écart-type » ne se voit pas pendant la partie.

### 27.2 Formule

```
Track Record = Rendement excédentaire − α · MaxDrawdown − pénalités de détresse
```

**Terme 1 — Rendement excédentaire vs le marché.**
- Benchmark = le **portefeuille passif de l'indice de marché** : évolution pondérée des `V` de **tous les hexes investissables non-frontière de la carte**, carry inclus (ce que ferait le Passif géant).
- **Le benchmark est un indice FIXE de la carte, jamais relatif au joueur** (anti-exploit, §27.3). Ton score de base = ce que tu as fait *au-dessus* du marché.
- Tue le penny-picking : carry lisse mais **sous** le marché → excédent négatif → tu perds. Le marché *est* le seuil, et il est endogène (pas de seuil absolu artificiel).
- Implémente §26.2 mécaniquement : sans crise, le hoarder fait `taux cash − marché en bull` = très négatif. « Le hoarder peut perdre » devient arithmétique.

**Terme 2 — MaxDrawdown, pondéré α** (remplace le dénominateur du Sharpe).
- **Mesuré sur la richesse mark-to-market** (positions ouvertes incluses, via les `V` publics) — les **pertes papier comptent** (anti-exploit « diamond hands », §27.3).
- **Asymétrique** : un pic de gain n'est pas un drawdown → le profil lumpy du Vautour n'est plus puni ; seules les pertes pèsent → le levier qui saute est écrasé.
- **Lisible** (« ta pire séquence : −38 % ») et **diégétique** : le drawdown est ce qui fait fuir les LPs — c'est déjà le déclencheur des stades de défaite (§14). Score et survie mesurent la même chose.

**Terme 3 — Pénalités de détresse.** Passer par Stress/Crise (§14) coûte des points ; wind-down = score réduit (déjà §14). Le risque caché qui *se réalise* est facturé deux fois (drawdown + détresse).

### 27.3 Audit anti-script du score

| Vecteur testé | Verdict |
| --- | --- |
| Coller au benchmark (indexer) | excédent ~0, on porte le drawdown du marché → score ≤ 0. Indexer ne gagne jamais : il faut un risque *différencié*. ✓ |
| « Toujours cash » | excédent très négatif en bull ; ne gagne que si la crise vient → pari sur l'état caché, pas une recette. ✓ |
| **« Reste petit » pour adoucir sa barre** | **neutralisé** : le benchmark est un indice fixe de la carte, pas relatif au joueur (§27.2). ✓ |
| **« Diamond hands » (ne jamais réaliser une perte)** | **neutralisé** : drawdown en mark-to-market, les pertes papier comptent (§27.2). ✓ |
| Levier chanceux non puni sur une run | résidu borné : le levier *fabrique* `F`, et le plafond `F≥0.85` garantit que la table leveragée finit par cramer. On *veut* le levier parfois correct (#4). ✓ |
| Fuite d'état caché par l'affichage | le benchmark est dérivé des `V` **publics** → ne révèle rien que le joueur ne puisse déjà calculer. ✓ |
| Skew négatif récompensé (vice n°2 du Sharpe) | inversé : skew positif non puni, skew négatif facturé. ✓ |

**Exception explicite à la règle anti-script** : contrairement à la physique du monde (§24.7, §25.10), **le score n'est ni bruité ni en plages** — la fonction-objectif doit être parfaitement transparente et stable, le joueur doit savoir ce qu'il optimise. L'anti-gaming vient de la **structure** (benchmark endogène + drawdown mark-to-market), jamais de l'obscurité. À ne pas confondre avec l'anti-script de la physique.

### 27.4 Paramètres et habillage

- **α = 0.5** (un point de drawdown coûte un demi-point d'excédent) — point de départ. **C'est le point d'équilibre du défaut #4** : trop haut, les archétypes leveragés meurent ; trop bas, le levier imprudent n'est plus puni. À calibrer en priorité (J7).
- **Habillage** : le score s'appelle **Track Record**, présenté comme un rapport aux LPs — « Vous : +34 % · Marché : +21 % · Excédent : +13 % · Pire séquence : −18 % ».
- **Affichage continu en cours de partie** : « Marché : +21 % / Vous : +3 % » → la pression FOMO du hoarder devient visible et chiffrée (la friction §26.4, à l'écran).

### 27.5 Neutralité archétypale (§26.1) — chacun bat le marché par son edge

Vautour (cash → dislocation, faible drawdown propre) · Compounder (compounding non-leveragé, drawdown peu profond) · Sismographe (pari leveragé sur `M`, excédent ≫ drawdown *s'il lit juste*) · Architecte (alpha idiosyncratique, quasi market-neutral) · Prédateur (dislocations provoquées). La métrique ne connaît aucun profil.

---

## 28. Tempo et calibrage statistique (VERROUILLÉ, v1.6)

> Le tempo d'un monde émergent ne se règle pas en durée (« la crise arrive vers le tour 9 » = script à retard) mais en **distribution d'expériences** vérifiée sur des milliers de parties simulées. On règle le *générateur*, jamais l'*issue*.

### 28.1 Règle d'or du calibrage (anti-script)

**Les cibles ci-dessous sont des diagnostics à vérifier en simulation, JAMAIS des contraintes injectées dans le moteur.** On les atteint en réglant les paramètres générateurs (plage de `F(0)`, poids d'accumulation §23.2, agressivité des IA). Si le moteur ne les atteint pas émergentiellement, on retouche le générateur — on **ne force jamais** le timing d'une crise pour « faire le quota ».

### 28.2 Cibles statistiques (sur ~1 000 parties, IA standard + joueur moyen)

| Cible | Valeur visée | Raison |
| --- | --- | --- |
| Parties à exactement 1 crise | ~60 % | l'expérience canonique |
| Parties à 2 crises | ~10–15 % | les tables pyromanes doivent pouvoir brûler deux fois |
| **Parties sans aucune crise** | **~20–25 %** | la branche « le hoarder perd » (§26.2) doit être *vécue*, pas théorique |
| Crise avant le tour 5 | rare (<5 %) mais **jamais impossible** | protection du débutant **statistique**, pas décrétée |
| Écart-type de la date de déclenchement | large (~3 tours) | empêche le méta-script statistique |

Le bouton sensible est le **taux de parties sans crise** : trop bas (5 %) → le joueur *sait* que la crise vient (certitude apprise = script) ; trop haut (40 %) → trop de parties plates. **20–25 %** maintient le doute réel — réserver reste un pari, pas une préparation.

### 28.3 Pas de fenêtre de grâce garantie

Aucune règle « pas de crise avant le tour N » : ce serait un script *et* un exploit (levier à fond pendant la grâce). La sécurité du début **émerge** de `F(0)` médian-bas (§23.1) + zone morte (§23.4). Une crise au tour 3 est très improbable, jamais impossible — et si `F(0)` a été tiré haut, les signaux du tour 1 le laissent deviner.

### 28.4 L'arc en trois actes — conséquence, pas structure

Une partie médiane (12–15 tours) *produit* statistiquement : installation (~t.1–4, zone morte probable) → bulle (~t.5–9, le dilemme investi-vs-réserve) → résolution (~t.10–15, cascade ou atterrissage à vide). **C'est un fait statistique documenté, jamais une contrainte du moteur** : l'acte III peut tomber au tour 6 ou ne jamais venir.

### 28.5 Le budget épistémique (tempo des PA)

~12–15 tours × 4 PA ≈ **50–60 PA/partie** = le métronome côté joueur. La triangulation complète (3 signaux rafraîchis) coûte ~2–3 PA/tour, soit ~la moitié du budget : **voir ou agir, jamais tout à fait les deux**. Le prix de l'information est un paramètre de tempo : trop bas → l'état caché devient quasi public ; trop haut → jeu à l'aveugle, le skill central meurt.

### 28.6 « Lentement, puis d'un coup »

Asymétrie à graver : l'accumulation s'étale (typiquement plusieurs tours), la cascade libère vite (§24). **Ratio montée/chute ≥ 2:1** — propriété émergente à vérifier en simulation, pas une paire de constantes. La fragilité est un stock qui se construit lentement et se libère brutalement (le poids dramatique du krach).

### 28.7 Le critère d'or — « les signaux battent l'horloge » (assertion de test J7)

Danger résiduel : si 80 % des crises tombent tours 8–11, le joueur apprend *la fenêtre* sans lire un seul signal (méta-script statistique). D'où le critère **formalisé en test automatisé** :

> **Le pouvoir prédictif du numéro de tour sur la crise doit être FAIBLE devant celui des signaux.** Mesurable en simulation (information mutuelle, ou précision d'un prédicteur « horloge seule » vs « signaux seuls »). Si l'horloge prédit presque aussi bien que les signaux → le tempo est devenu un script → recalibrer (élargir les plages de `F(0)`, la variance d'accumulation).

Ce critère transforme le principe « grammaire connue, instance imprévisible » (§4.4) en **assertion vérifiable au jalon J7** : le moteur peut *prouver* qu'il n'est pas scripté.

### 28.8 Calibrage multi-profils (v1.7 — anti-script du tuning)

**Catch d'audit T8** : calibrer le monde contre un seul bot-joueur (le Vautour du MVP) re-sculpterait la physique *autour* de ce profil — le script stratégique (§26) reviendrait par la porte du calibrage, sans que personne ne l'ait écrit.

Parade, rendue possible par le harness paramétrable (spec §11bis : archétypes, profils IA et cartes = données, `simulate(config, n)`) :
1. Les cibles de tempo (§28.2) doivent tenir face à **plusieurs bots-joueurs** de profils différents.
2. **Assertion de neutralité (J7)** : sur N parties simulées, **aucun profil ne domine strictement** la distribution des Track Records. La neutralité archétypale (§26.1) devient une propriété testée, qui casse si on la viole.

---

## 29. Résolution des défauts résiduels #2 / #3 / #4 (VERROUILLÉ, v1.8)

> Clôt le chantier §26.3. Chaque fix a passé l'audit anti-script avant verrouillage.

### 29.1 Défaut #2 — purge symétrique agrégée (résolu)

Voir §23.3 amendé : la purge de `F` n'est plus un forfait individuel mais le **miroir agrégé de l'accumulation**. L'effet d'un acteur est proportionnel à sa part du capital total → dilution mécanique, tragédie des communs restaurée.

*Audit* : « spam RÉSERVER pour piloter `F` » mort par dilution ; la baleine qui peut bouger `F` paie son impact-prix (§25.4). ✓

### 29.2 Défaut #3 — planchers de bruit irréductibles (résolu)

**Bruit en deux composantes** : `σ² = σ²_réductible + σ²_irréductible`. Les nœuds (INFO, LIQ) et l'infrastructure ne compriment **que** la part réductible — ils achètent de la *netteté*, jamais de la *certitude*.

- Valeurs base → plancher : voir le tableau §23.6. La base du signal Financement est **relevée** (0.04 → 0.08) : c'était le vecteur du défaut (camper LIQ = signal quasi net).
- **Délais irréductibles** : Écart de crédit jamais sous 1 tour ; Financement réductible 2 → 1, jamais 0. La Volatilité reste instantanée mais bruyante.
- **Les planchers sont tirés en plages par instance** — sinon le joueur mesure son bruit résiduel et en déduit son plancher (méta-fuite).
- Aucune combinaison d'investissements ne révèle jamais `F`. L'inférence reste le jeu.

*Piste reportée (post-MVP)* : « le bruit irréductible grossit près du déclenchement » — séduisant (les instruments déraillent près de la criticité) mais la variance mesurée deviendrait un canal d'information sur `F`. À explorer avec ce caveat explicite.

*Audit* : camper les nœuds = avantage légitime, plus un contournement du skill central. ✓

### 29.3 Défaut #4 — mécanique complète du levier (résolu au design, viabilité testée en J7)

Le principe « parfois correct » était acquis (§25.9) ; voici la mécanique :

| Composant | Règle | Statut épistémique |
| --- | --- | --- |
| Exposition | P&L × (1+L) | transparent (règle de jeu, exception §27.3) |
| Coût | taux d'emprunt par tour, croissant avec L **et** avec le stade de détresse (§14) | transparent — le levier devient cher exactement quand on en dépend |
| **Appel de marge** | drawdown mark-to-market d'une position leveragée au-delà d'un seuil → **liquidation forcée partielle** | seuil transparent (ton propre état, pas le monde caché) |
| Contribution à `F` | via le ratio de levier agrégé (§23.2) | caché (systémique) |

**L'appel de marge est le mécanisme de transmission des cascades** : la vente forcée alimente `flux` (§25.4) → baisse de `V` chez les voisins → autres appels de marge → contagion endogène, jamais scriptée. (C'est aussi ce qui « rase » les leveragés en crise, §23.5 — désormais mécanisé plutôt que décrété.)

**Test de viabilité (assertion J7, clôt le défaut)** : dans le harness multi-profils (§28.8), un **bot leveragé-discipliné doit gagner une part non-négligeable des parties**. S'il perd toujours → α du Track Record trop haut ou coût du levier trop cher → recalibrer. L'« option morte » devient détectable automatiquement.

*Audit* : seuil de marge fixe et connu = règle transparente sur l'état **du joueur**, conforme à l'exception §27.3 (les règles sont claires, le monde est caché). La liquidation forcée est endogène — créée par le choix de levier du joueur, déclenchée par les prix publics. ✓

### 29.4 État du chantier §26.3 après v1.8

| # | Défaut | État |
| --- | --- | --- |
| 1 | Sharpe gameable | ✅ résolu (Track Record, §27) |
| 2 | RÉSERVER / purge individuelle | ✅ résolu (§23.3, §29.1) |
| 3 | Clarté achetable | ✅ résolu (§29.2) |
| 4 | Levier option morte | ✅ résolu au design (§29.3) — viabilité vérifiée par assertion J7 |
| 5 | Bonus phase-3 Vautour | ✅ résolu (supprimé, v1.4) |

**Le chantier « script stratégique » est clos.** Restent les vérifications *numériques* en J7 : α, coût du levier, planchers, cibles de tempo, neutralité multi-profils.

---

## 30. Restructuration des profils et prototype d'exploration (EN COURS)

> Direction de travail ouverte avec le concepteur après les premiers tests jouables.
> Statut : **profil neutre + primitives = livrés** ; **archétypes = à développer un à la fois** ;
> **boucle d'exploration = prototype UI à l'essai** (pas encore une décision verrouillée).

### 30.1 Primitives d'abord, spécificités ensuite (DÉCISION)

On inverse l'ordre de construction :
- **Profil neutre** = la boîte à outils complète des primitives, **aucun pouvoir spécial**. C'est le *bac à sable de mécanique* : tester les briques isolément, sans le bruit des spécificités.
- **Archétypes** = une **couche de modificateurs** par-dessus le neutre (ressource §10, restrictions, mécaniques exclusives, modulation des primitives). Développés **un à la fois** : définir → tester → équilibrer → valider → suivant.

**Primitives (toutes livrées)** : OUVRIR (long/short) · RÉSERVER · LIRE · RENFORCER · FERMER · CLÔTURE PARTIELLE. Toutes coûtent des PA (sauf RÉSERVER = 0).

### 30.2 Le short est une primitive (réoriente §21)

Conclusion révisée : le short n'est plus « réservé au Sismographe ». C'est une **primitive du neutre** (`Position.direction` long/short, P&L miroir, appel de marge et flux sensibles au sens). Les **archétypes la modulent** : le Sismographe en fait son edge (shorter le sommet), le Vautour en est dissuadé par sa ressource/identité — **pas par une interdiction codée en dur**. Le bull trap (§24.2) punit naturellement les shorts au rebond.

### 30.3 Prototype d'exploration (UI, à l'essai)

Boucle proposée, implémentée comme **couche UI** (moteur économique inchangé) :
- **Spawn** aléatoire sur un hexe marché vide ; **brouillard** : on ne voit que les adjacents.
- **Investir = se déplacer + révéler** les nouveaux voisins. Action **immédiate, sans retour arrière**.
- **CHAIN** : 1ʳᵉ ouverture du tour = 1 PA, ouvertures enchaînées ensuite = 2 PA (frein à la course).
- **S'installer** : se déplacer sur un nœud adjacent (présence, sans investir) → rend la carte traversable.
- **Carte hexagonale GÉNÉRÉE** (`src/data/maps/generate.ts`) : voisins calculés depuis les coordonnées axiales → **géométrie = adjacence** (« ce qui borde ton hexe = ce dans quoi tu peux chaîner »). Seedée. Corrige la grille carrée hardcodée.

**Simplifications de prototype assumées** : IA non spatiales · le flux des ouvertures immédiates n'alimente pas l'impact-prix du tour · bénéfices des nœuds pas encore branchés · frontières infranchissables (déblocage non câblé).

### 30.4 À décider / câbler ensuite

- Valider (ou non) la boucle d'exploration comme mécanique retenue, puis l'intégrer au moteur (IA spatiales, flux des ouvertures, carte procédurale comme standard).
- Définir le **premier archétype** à spécialiser et ses traits.
- Brancher les **bénéfices des nœuds** et le **déblocage des frontières** (§21).

---

## 31. Architecture de tour multijoueur — plan & TICKs (PROPOSITION, phase 2)

> Proposée par le concepteur pour le **multijoueur** (§13, phase 2). Le solo actuel garde
> sa résolution simple ; ceci est l'architecture-cible, à construire plus tard. Premier pas
> compatible déjà fait : **IA visibles sur la carte** (footprint).

### 31.1 Le principe : planifier en secret, résoudre en TICKs

Système « WeGo » (résolution simultanée, façon Diplomacy / Frozen Synapse) :

1. **Phase de choix** (simultanée, secrète) : chaque joueur trace son **chemin** sur le board et planifie ses actions du tour (mécaniques actuelles : OUVRIR long/short, etc.). Rien n'est résolu tant que tous n'ont pas validé.
2. **Phase d'observation** (en TICKs synchronisés) une fois tous les choix verrouillés :
   - **TICK 1** : révèle la **1ʳᵉ action de chaque joueur — uniquement les déplacements** (pas les investissements). Point d'insertion des **effets spéciaux** (archétypes, arbre tech, effets à retardement).
   - **TICK 2** : nouveaux résultats selon les actions planifiées.
   - **TICKs suivants** tant qu'un joueur a planifié d'autres actions ; sinon fin de l'observation → tour suivant.

### 31.2 Pourquoi ça colle à notre cœur

- **Révéler les déplacements / cacher les investissements = inférence sur les rivaux.** On lit *où* va l'adversaire (son attention), pas *ce qu'il parie* → extension de l'inférence d'état caché aux autres joueurs. Thématiquement parfait.
- **Natif multijoueur** : plan simultané = pas d'avantage d'ordre de tour, équitable et tendu.
- **Émergence préservée** : structure de résolution, pas un script ; l'issue émerge des choix simultanés.
- **Crochet pour les spécificités** : les TICKs sont le point d'ancrage des effets d'archétype / tech / retardement (cohérent §30).
- **Crowding visible** : voir des joueurs converger vers une zone *avant* que les paris atterrissent (anticipation, front-running).

### 31.3 Prix entre deux TICKs — DÉCISION v1 : NON

Le marché se résout **une seule fois, en fin de phase d'observation**. Raison : si le prix bougeait tick-par-tick sous l'effet d'un investissement caché, l'**impact-prix le trahirait** (fuite). Garder les prix figés pendant les TICKs préserve le secret des investissements et simplifie. *Couche avancée optionnelle (plus tard)* : laisser les **grosses positions fuiter par l'impact-prix** (« on ne cache pas la taille »).

### 31.4 Prérequis et questions ouvertes

- **Acteurs spatiaux** (positions + chemins) — prérequis ; premier pas fait (IA visibles).
- Gestion des **conflits simultanés** (deux joueurs sur le même hexe au même TICK).
- Longueur de chemin par tour (bornée par le budget PA ?).
- Granularité de révélation : déplacement seul, ou « il a agi ici » sans le détail (sens/taille) ?
- **Bluff de chemin** voulu ou non (planifier un déplacement pour tromper) → profondeur vs complexité.

### 31.5 Statut

Architecture-cible **documentée**, **non implémentée**. Prochain pas réalisé : rendre les IA spatiales et **visibles sur la carte** (footprint des positions, sur les hexes révélés seulement — fog respecté).
