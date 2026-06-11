# Mémoire de Game Design — Jeu 4X Investissement

> Document de référence vivant. Version 0.5 — 11 juin 2026.
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
- **Score** : meilleur Sharpe cumulé sur la partie (récompense la régularité, pas la taille brute)

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
| Soros | Le Sismographe | Coup macro, timing de régime | Score (meilleur Sharpe) |
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
| **POSITIONNER** | 1–2 PA | Ouvrir, redimensionner, fermer des positions. Les positions de taille ont un impact prix. | eXploit |
| **CONSTRUIRE** | 2 PA | Avancer dans l'arbre de compétences, recruter des équipes, ouvrir des desks. | eXpand |
| **NÉGOCIER** | 1 PA | Gérer les LPs, courtiser les régulateurs, lancer des raids activistes, débaucher des équipes. | eXterminate / Diplomatie |
| **RÉSERVER** | 0 PA | Ne rien déployer. Garder des liquidités sèches. **C'est une action explicite**, pas une absence d'action. | — |

**Double effet de chaque action** : effet personnel (position, firme) ET effet systémique (jauge de fragilité). Cette double comptabilité est permanente et en partie cachée.

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

## 15. Références à étudier

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

## 16. Points à éclaircir — feuille de route

### Niveau 1 — La vision
1. ~~**Le fantasme du joueur**~~ — **TRANCHÉ (v0.4)** : 5 archétypes définis + 2 à venir (§6)
2. **Solo vs multijoueur** — posé : solo-first, multi WebSockets en phase 2. À approfondir pour les implications IA.
3. ~~**Historique vs procédural**~~ — **TRANCHÉ (v0.3)** : cadre atemporel.

### Niveau 2 — Le cœur mécanique
4. ~~**La boucle de tour**~~ — **TRANCHÉ (v0.4)** : 5 verbes, 4 PA, points de compétence (§8, §9)
5. ~~**Représentation du terrain**~~ — **TRANCHÉ (v0.4)** : carte hexagonale, 3 types de hexes (§11)
6. **Échelle d'un tour et horizon de partie** — durée d'un tour, nombre de tours, fin de partie. Piste : tours à durée variable, le temps ralentit en crise.
7. ~~**Design de la défaite**~~ — **TRANCHÉ (v0.5)** : 3 stades (Stress → Crise → Effondrement), absorption ou wind-down, parties indépendantes (§14)

### Niveau 3 — Les systèmes
8. **IA concurrentes (priorité haute)** : 5–6 archétypes avec fonctions de réaction simples.
9. **Banque centrale / régulateur** : posé comme nœud réglementaire (§11). Comportement IA à définir.
10. **Signaux concrets de la jauge** : combien, lesquels, à quel coût, quel niveau de bruit.

### Niveau 4 — La réalité du projet
11. ~~**Objectif du projet**~~ — **TRANCHÉ (v0.5)** : jeu web, solo-first, multijoueur en phase 2 (§13)
12. **Le test minimal** : MVP web — carte fixe, 1 archétype jouable, 2–3 IA simples, jauge de fragilité active.

**Ordre d'attaque restant : 6, 2 (implications IA), 8, 10, 12**

---

## 17. Questions ouvertes

- [ ] Échelle d'un tour et horizon de partie (durée, nombre de tours, condition de fin)
- [ ] IA concurrentes : archétypes et fonctions de réaction
- [ ] Signaux bruités de la jauge : lesquels, à quel coût, quel niveau de bruit/retard
- [ ] Structure détaillée de l'arbre de compétences
- [ ] Génération procédurale de la carte (phase 2)
- [ ] Deux archétypes jouables restants à définir
- [ ] Noms in-game définitifs des archétypes
- [ ] Définition du MVP web (périmètre exact de la première version jouable)

---

## 18. Journal des décisions

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
