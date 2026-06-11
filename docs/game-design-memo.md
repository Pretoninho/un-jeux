# Mémoire de Game Design — Jeu 4X Investissement

> Document de référence vivant. Version 1.3 — 11 juin 2026.
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
- [ ] **Moteur de prix** : arbitrer la proposition §25 (niveau vs rendements, melt-up, ratio systématique/idiosyncratique, carry) + recevoir les points du concepteur
- [ ] **Score Sharpe gameable** (#1, §26.3) — corriger l'optimum dégénéré : la fonction-objectif du MVP
- [ ] **RÉSERVER** triple-récompense gratuite + levier individuel sur `F` (#2, §26.3)
- [ ] **Clarté des signaux achetable** via nœuds (#3, §26.3) — plancher de bruit irréductible
- [ ] **Levier** = option morte sous Sharpe (#4, §26.3)
- [ ] **Bonus phase-3 du Vautour** redondant/fragile à retirer (#5, §26.3)

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

---

## 23. Modèle numérique de la jauge de fragilité (MVP) — VERROUILLÉ

> Spécification chiffrée de la mécanique centrale (§4). Valeurs de prototype, à calibrer aux tests.
> Cadre MVP : 1 archétype (Vautour) + 2 IA (Fonds leveragé, Value patient). Tout l'état est caché.

### 23.1 La jauge `F`

État systémique caché, `F ∈ [0, 1]`, non affiché en jeu (révélé seulement au post-mortem, §17).

```
F(t+1) = clamp01( F(t) + accumulation(t) − purge(t) )
```

### 23.2 Accumulation (ce qui gonfle la bulle)

Somme de 3 termes agrégés sur **tous les acteurs** (joueur + IA) :

| Terme | Définition | Contribution |
| --- | --- | --- |
| Levier | `ratio_levier` = capital leveragé total / capital total | `0.06 × ratio_levier` |
| Crowding | `indice_crowding` = concentration des positions dans des hexes adjacents | `0.04 × indice_crowding` |
| Valorisation | `tours_bull` = nb de tours consécutifs de régime bull | `0.01 × tours_bull` |

Dérive à vide ≈ +0.01/tour. Fonds leveragé à plein régime ≈ +0.08/tour → zone rouge en 6–8 tours. Dynamique « feux de forêt » : un système jamais purgé accumule jusqu'au krach (§4.3).

### 23.3 Purge (ce qui désamorce)

| Terme | Effet |
| --- | --- |
| Désendettement / RÉSERVER | `−0.05` par acteur réduisant son levier ce tour |
| Mean-reversion naturelle | `−0.02` par tour (petites corrections) |

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

| Signal | Retard | Bruit σ | Accès MVP |
| --- | --- | --- | --- |
| Volatilité | 0 | 0.20 (fort) | gratuit, toujours visible |
| Écart de crédit | 1 | 0.10 | 1 PA (LIRE) |
| Financement | 2 | 0.04 (net) | présence au nœud liquidité |

Le signal « Initiés » (§17) dépend de l'arbre techno, **coupé au MVP** → écarté pour l'instant. Skill central = **triangulation** : croiser plusieurs signaux concordants pour inférer la zone de `F`.

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

## 25. Moteur de prix et de rendements — PROPOSITION (non verrouillé)

> Statut : proposition de design, **pas encore tranchée**. En attente des points complémentaires du concepteur.
> Comble le trou identifié à l'audit : la jauge (§23) régule un marché dont la physique n'était pas spécifiée.
> Contrainte impérative : **physique neutre** (§26), **rien de scripté** (§4, §15, §24) — paramètres stochastiques par instance.

### 25.1 Structure à facteurs (corrélation émergente)

```
r_i(t) = β_i · M(t)  +  γ_i · C_cluster(t)  +  ε_i(t)
```

- `M(t)` = facteur marché commun à tous les hexes · `C_cluster(t)` = facteur de cluster (Actions / Crédit / Alternatifs) · `ε_i(t)` = idiosyncratique propre à l'hexe.
- La corrélation **émerge** du partage des facteurs : même cluster → partagent `M` et `C` (forte corrélation) ; clusters différents → ne partagent que `M`. Réalise §11 sans coder de matrice `ρ`.
- **`ρ→1` en crise tombe tout seul** : on gonfle la variance de `M` et on écrase l'idiosyncratique → le facteur commun domine → tout bouge ensemble (mécanique réelle des corrélations en crise). Plus besoin de « forcer » `ρ`.

### 25.2 Niveau de prix avec ancre (le contrarian devient réel)

Chaque hexe a :
- une **ancre fondamentale** `A_i` — lente, stable (la « juste valeur ») ;
- une **valorisation** `V_i` qui oscille autour de `A_i`, poussée vers le haut par les flux (levier, crowding, momentum), rappelée par la **réversion à la moyenne**.

Rendement d'une position ≈ variation de `V_i` + un **carry** (portage/dividende). Conséquences :
- **« Acheter bas » paie structurellement** : après un krach `V_i < A_i` → la réversion le fait remonter. Cette récompense est **neutre** — ouverte à tout profil, pas une faveur au Vautour (§26).
- **Le carry pressure la réserve** : une réserve sèche rapporte ~0 pendant que les positions ouvertes touchent leur carry → le coût d'opportunité de l'attente est chiffré.

### 25.3 Facteur marché piloté par `F` (et le bull trap en P&L)

`M(t) = μ(régime) + σ(régime)·z`, `z` aléatoire. Régimes **émergents** (§15), valeurs = distributions, jamais des constantes :

| Régime | drift `μ` | vol `σ` | Rôle |
| --- | --- | --- | --- |
| Bull (F basse) | léger + | bas | gains réguliers → coût d'opportunité de la réserve |
| Tension (F monte) | **+ accentué (melt-up)** | moyen | euphorie : les meilleurs rendements *juste avant* la chute → le piège d'être en avance |
| Crise jambe 1 | fort − | haut | la chute |
| Crise rebond | + | haut | **le bull trap matérialisé en P&L** (§24) |
| Crise vraie jambe | très fort − | très haut | contagion, `ρ→1` |
| Recovery | léger + | moyen | réversion qui paie l'acheteur du creux |

Le **melt-up de la phase tension** est central : le moment le plus fragile vient d'offrir les *meilleurs* rendements récents → c'est ce qui rend la réserve si dure à tenir et le redéploiement au rebond si tentant. La tension est dans les chiffres, pas dans un texte.

### 25.4 La boucle macro (neutre — réécrite sans clause archétype)

```
flux (levier + crowding) → V_i s'étire au-dessus de A_i
   → « valorisation tendue » alimente F (§23.2)
      → crise plus probable
         → V_i s'effondre sous A_i
            → dislocation exploitable par PLUSIEURS profils (§26)
               → recovery : réversion V→A
```

Moteur de prix et jauge ne sont qu'**un seul système**. La dislocation post-crise n'est la récompense de personne en particulier — voir neutralité archétypale (§26).

### 25.5 Boutons ouverts (en attente d'arbitrage)

- **Niveau `V` (avec ancre) vs rendements purs** : le niveau est nécessaire pour un vrai contrarian, mais plus lourd. *Penche pour le niveau.*
- **Melt-up en tension** : drift qui accélère avant le krach (le piège) vs drift constant (plus lisible).
- **Part systématique vs idiosyncratique** : beaucoup de `M`/cluster = jeu de timing macro ; beaucoup d'`ε` = jeu de sélection d'hexes (récompense LIRE). Le ratio **définit l'identité du jeu**.
- **Carry comme revenu séparé** : récompense la détention, punit la réserve à 0.

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

### 26.5 Actions de modification en attente

- [ ] Réécrire la boucle macro **partout sans clause Vautour** (fait en §25.4 ; vérifier toute formulation centrée Vautour ailleurs).
- [ ] Corriger le score (#1) — **priorité, c'est la fonction-objectif du MVP**.
- [ ] Re-tarifer RÉSERVER et borner son effet sur `F` (#2).
- [ ] Définir le plancher de bruit irréductible des signaux (#3).
- [ ] Statuer sur le levier au MVP (#4).
- [ ] Retirer le bonus phase-3 du Vautour de la spec (#5).
- [ ] Inscrire la neutralité archétypale + « le hoarder peut perdre » comme contraintes du moteur de prix (§25).
