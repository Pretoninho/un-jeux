# Suivi de conception — Jeu 4X Investissement

> Fichier de navigation rapide. Le détail complet est dans `docs/game-design-memo.md`.
> Dernière mise à jour : 2026-06-15 — v1.36
>
> 🧱 **CHANTIER NOUVEAU JEU — briques moteur + UI (2026-06-15, en cours)**. Cycle : *construction → test →
> validation → doc → au suivant*. Chaque brique = module PUR autonome (`src/engine/`) + tests + démo UI
> isolée (`*Demo.svelte`).
>
> 🖥️ **UI PROPRE — `NewGameView.svelte` est la vue PAR DÉFAUT (2026-06-15)** : aucune interférence de l'ancien
> jeu. Sélecteur de briques (une à la fois : ⏩ Tick / 🏕️ Camp / 🏞️ Revenu / 📒 Carnet), header minimal. L'ancien
> jeu reste accessible via le lien discret *« ancien jeu (référence) → »* (`App.svelte` garde un `mode`
> 'new'/'legacy', default 'new'). On n'affiche que ce qu'on teste. svelte-check 0 erreur, 195 tests verts.
>
> | # | Brique | Moteur | Tests | Démo UI | État |
> | --- | --- | --- | --- | --- | --- |
> | 1 | **Carnet d'ordres** (éviction = rachat de parts) | `orderbook.ts` | 19 | 📒 `OrderBookDemo` | ✅ |
> | 2 | **Revenu + agglomération** (income) | `revenue.ts` | 12 | 🏞️ `RevenueDemo` | ✅ |
> | 3 | **Camp / emprunt** (Tronc A permanent / Tronc B soldable) | `camp.ts` | 20 | 🏕️ `CampDemo` | ✅ |
> | 4 | **Tick économique** (income − charges → net, faillite + `GameStateV2`) | `tick.ts` + `state2.ts` | 17 | ⏩ `TickDemo` | ✅ |
> | 5 | **Possession** (un occupant/hex, lie carnet↔revenu) | à venir | — | — | ⏳ suivant |
>
> 🔗 **BRIQUE 4 = PREMIER CÂBLAGE (2026-06-15)** — fin des modules orphelins. `state2.ts` introduit **`GameStateV2`**
> (le state PROPRE promis : `turn`, `map`, `revenueCfg`, `actors` {cash, bankrupt}, `ownership`, `camps` — rien
> de l'ancien moteur). `tick.ts` fait la **première boucle** : *income (brique 2) − charges (brique 3) → cash ;
> SI cash < 0 → 💀 faillite* (hexes libérés, camps purgés = la dette meurt avec le failli). `checkEnd` :
> last_standing (1 survivant) OU time (horizon → le plus riche). **Immuable** (rend un nouveau state, ne mute
> pas l'entrée → testé). 17 tests. Démo ⏩ `TickDemo` = carte 7 hexes cliquable + emprunts + Tour +1 : on VOIT
> la boucle complète (income − charges = net/tour, et on peut se faire couler en empruntant trop sans hexes).
>
> **Carnet (`orderbook.ts`)** : 2 piles visibles bids/asks ; *SI achat ≥ meilleure vente → échange au prix de
> l'ordre qui attendait ; SINON → entre au carnet ; prix affiché = dernier échange*. Transfert atomique
> cash↔parts, long-only, parts/prix entiers, reliquat partiel, annulation. **Conservation de richesse testée =
> zéro-sum.** Éviction = l'occupant peut résister (siège visible, pas transaction mécanique) ; l'assaillant
> surpaie = son coût d'attaque + son risque.
> **Revenu (`revenue.ts`)** : *possédé → +base ; voisin du même proprio → +bonus/voisin (agglomération) ;
> libre → 0*. `actorIncome` = somme. Cluster contigu > hexes dispersés (testé). svelte-check 0 erreur.
> **Camp (`camp.ts`)** : *Tronc A = dette permanente (charge fixe = rate × loanAmount, jamais soldable) ;
> Tronc B = dette soldable (charge ∝ reliquat, éteinte quand reliquat = 0)*. `campCharge`, `actorCharges`,
> `repayDebt`, `canRepay`. 20 tests. Démo : alice (Tronc A) / bob (Tronc B), bouton ⏩ Tour +1 déduit les
> charges, bob peut rembourser et voir sa charge baisser en temps réel.
> ⚠️ Ces briques sont **autonomes** — pas encore câblées dans une boucle de jeu unifiée (brique 4/5).
>
> ✂️ **DÉBRANCHEMENT DE L'ANCIEN MOTEUR — COUPE NETTE À LA BRIQUE 5 (décision 2026-06-15)** : on **ne supprime
> rien en pièces détachées**. L'ancien jeu reste **runnable comme référence** (+ ses ~200 tests) jusqu'à ce que
> la nouvelle boucle le remplace dans `App.svelte` (brique 5) → **une seule coupe franche, jamais d'état cassé
> intermédiaire**. **Règle dure d'ici là** : le nouveau jeu se construit sur un **state PROPRE** (`GameStateV2`
> dédié, à créer brique 3) — **jamais** réutiliser l'ancien `GameState` (fragility/crisis/regime/credit) pour ne
> pas entremêler neuf et mort. **🗑️ Condamnés** (partent à la brique 5) : `market` `fragility` `signals` `regime`
> `credit` `score` `ai` `policy` `turn` `init` `simulate` `portfolio` + l'ancien `GameState`/`params`. **♻️ Gardés**
> (infra saine) : `rng` `map-utils` les types carte de `types.ts`. **🆕 Neuf** : `orderbook` `revenue` (+ à venir).
>
> 🏗️ **STRUCTURE FONDAMENTALE TRANCHÉE (2026-06-15, session matin)** — boucle centrale posée, simple et complète :
>
> **Hexes = revenus.** Chaque hex possédé crache un revenu fixe par tour. Un seul occupant par hex (pas de
> partage). Hexes adjacents sous le même propriétaire se bonifient mutuellement (prime d'agglomération spatiale).
>
> **Camps = emprunts à la banque (PNJ).** Le camp de base n'est pas une ville à construire — c'est une **dette
> volontairement assumée**. Emprunter = avoir les moyens de conquérir + une charge fixe par tour à couvrir.
> Camp 1 → emprunt 50 → charge 5/tour. Camp 2 → emprunt 100 → charge 10/tour supplémentaire. Avoir 2 camps =
> porter 2 emprunts simultanément. Le camp peut évoluer (investissement choisi → bonus stratégique : réseau,
> avant-poste, forteresse, comptoir…). La banque est une **règle, pas un personnage jouable** (PNJ simple).
>
> **Éviction = carnet d'ordres.** Un hex occupé change de main uniquement par rachat des parts via le carnet.
> L'occupant peut résister (ne pas vendre) → l'éviction est un **siège visible**, pas une transaction mécanique.
> L'assaillant surpaie → c'est son coût d'attaque → il parie que le contrôle + le revenu futur couvrent la prime.
> Zéro-sum respecté : pur transfert cash ↔ parts.
>
> **Boucle complète :**
> ```
> Hexes → revenus
> Revenus → couvrent les charges des camps
> Camps → donnent les outils/bonus pour conquérir plus
> Conquête → plus de revenus → finance des emprunts plus grands
> Éviction → adversaire perd son revenu → doit réagir ou couler
> ```
>
> **Moteur de guerre :** pas l'envie d'attaquer — la **nécessité économique**. Si quelqu'un t'évince d'un hex
> pendant que tu portes deux emprunts → tu passes déficitaire → tu dois contre-attaquer ou réduire le camp.
>
> **Ce qui n'est PAS dans ce jeu :** Civ (trop militaire, mauvaise métaphore). Partage de hex (trop complexe,
> supprimé). Charges cachées ou aléatoires (tout est calculable). Rôle de prêteur donné à un joueur (PNJ, simple).
>
> ⚖️ **AXE D'ÉQUILIBRE income / outcome (2026-06-15)** — le sujet de calibrage central, à tenir :
> **Income (1 tour)** = revenu liquide, immédiat, sûr (les hexes crachent X/tour). **Outcome (étendu dans le
> temps)** = paris longs qui coûtent maintenant et paient plus tard (2ᵉ camp, évolution de camp, agglomération).
> L'équilibre visé : *le rentier qui maximise l'income ne doit pas écraser le conquérant qui investit dans
> l'outcome, ni l'inverse*. Si l'income gagne toujours → personne n'emprunte, jeu plat. Si l'outcome gagne
> toujours → course au tapis. → Fait coexister **deux stratégies valides**, qui correspondent pile aux deux
> conditions de victoire (rentier = être le plus riche ; conquérant = faire couler les autres).
>
> 🌳 **DEUX TRONCS D'ARCHÉTYPES (2026-06-15)** — la dette (soldable/permanente) est un **tronc**, pas le
> squelette complet. Chaque tronc contient plusieurs archétypes qui partagent le profil de dette mais se
> différencient par leur ressource, compétence, bonus d'amélioration.
>
> ```
> TRONC A — Dette Permanente
> (gros capital, charge non soldable, style offensif → doit conquérir)
>     ├── Archétype A1 : à définir
>     ├── Archétype A2 : à définir
>     └── …
>
> TRONC B — Dette Soldable
> (capital modeste, charge libérable, style patient → peut se libérer)
>     ├── Archétype B1 : à définir
>     ├── Archétype B2 : à définir
>     └── …
> ```
>
> **Lecture plateau** : le tronc d'un joueur est **visible** (info publique) → *« il est sur le Tronc A, il
> doit conquérir ou mourir »* — la surprise vient des **améliorations choisies en partie**, pas du profil de
> base. Deux joueurs du même tronc = styles différents, concurrence interne. Troncs différents = courses
> parallèles, affrontement sur le plateau. ⚠️ Archétypes non nommés ni définis encore — à développer un à
> la fois.
>
> 🎭 **EMPRUNT PORTÉ PAR LES ARCHÉTYPES (2026-06-15)** — résout le point « rembourser ou loyer permanent ? »
> sans trancher en général : **les deux modèles coexistent, incarnés par des archétypes**. Chaque archétype = un
> profil de dette de départ → impose un style de jeu et penche vers une condition de victoire.
>
> | | **A — Le Conquérant** | **B — Le Rentier** |
> |---|---|---|
> | Capital de départ | élevé (frappe fort tôt) | modeste (départ lent) |
> | Charge | lourde, **non soldable** (permanente) | douce, **soldable** (libérable) |
> | Contrainte de style | *obligé* de conquérir pour survivre (s'il s'arrête, il saigne) | peut devenir **sans dette** → income = richesse pure |
> | Vise | **la faillite des autres** (seule sortie) | **être le plus riche** (s'enrichit tranquille) |
>
> **Pourquoi l'équilibre tient** : les deux ne jouent pas le même jeu mais **sur le même plateau** → course à
> deux vitesses. Le Conquérant doit éliminer *avant* que le Rentier ne devienne trop riche ; le Rentier doit
> solder sa dette *avant* que le Conquérant ne l'étouffe. Les archétypes **incarnent les deux pôles de l'axe
> income/outcome**. L'affinage se fera ensuite via les **améliorations** propres à chaque archétype (bonus qui
> renforcent le style sans le rendre dominant — règle des pouvoirs §7 : friction, pas synergie).
>
> 🏁 **FIN & VICTOIRE TRANCHÉES (2026-06-15)** :
> - ⏱️ **Fin par le TEMPS** — horloge fixe de tours, pas un volume atteint (colle au `horizonTurns` du moteur).
> - 🏆 **Victoire** : le **plus riche à la fin** OU la **faillite de tous les autres** avant la fin.
> - 💀 **Faillite** = ne plus pouvoir couvrir ses charges (l'emprunt coule le joueur) = condition d'élimination.
>
> ⚠️ **En suspens :** mécanisme de remboursement de l'emprunt (la charge tombe quand remboursé, ou loyer
> permanent ? — fait partie de l'arbitrage income/outcome). Nombre de camps max par joueur (plus tard).
> Calibrage des nombres (revenus, charges, prix d'emprunt) pour atteindre l'équilibre income/outcome.
>
> 📒 **PISTE COURANTE — CARNET D'ORDRES + MOTIVATION (2026-06-15)** : reprise d'une direction **4X + zéro-sum**
> (camp de base donnant un revenu ; victoire par **domination du capital** ; acquérir des cases → immo → fait
> croître le revenu). **Décision validée** : le **prix de TOUTES les cases-marché** passe par un **carnet d'ordres
> visible** (remplace la formule de prix abstraite à terme). Le **zéro-sum** est posé comme **règle** (pas tout à
> fait un primitif).
>
> ✅ **LIVRÉ — `src/engine/orderbook.ts` (module pur + 19 tests) + démo UI** : carnet par hexe, deux piles visibles
> (bids/asks). **SI→ALORS** : *SI offre d'achat ≥ meilleure vente → échange au prix de l'ordre qui ATTENDAIT ;
> SINON → l'ordre entre dans le carnet, visible de tous ; prix affiché = dernier échange.* Transfert atomique
> cash↔parts, **long-only** (refus si vendeur sans parts / acheteur sans cash), parts/prix **entiers**, reliquat
> partiel, tri (asks↑/bids↓), annulation. **Conservation de la richesse totale testée = zéro-sum prouvé.** Démo
> jouable : bouton **📒 Carnet** (bas du panneau de contrôle) → `OrderBookDemo.svelte`, sandbox 2 acteurs/1 hexe,
> sans toucher la boucle de jeu. Build OK, 19 tests verts. ⏭️ Câblage moteur (remplacer `resolveMarket`) = ensuite.
>
> 🍎 **MOTIVATION — l'analogie de la pomme (2026-06-15, EN COURS, non tranché)** : le concepteur pointe que le
> carnet seul = **chaises musicales pures** (seule motivation d'achat = revendre au pigeon suivant / greater fool).
> Pour une vraie motivation, deux ancres tirées d'un marché réel : **(1) coût de production = un PLANCHER sous le
> prix** (la pomme coûte 5 → on ne vend pas durablement sous 5 ; mappe sur l'**ancre `A`** déjà dans le moteur,
> à rendre visible/concrète) ; **(2) la demande = quelqu'un doit VOULOIR le bien** (point dur : en finance
> l'acheteur **revend** au lieu de **consommer** → la seule demande native est l'espoir de revente). **Reco
> posée** : empiler **socle PRODUCTIF** (posséder des cases qui crachent un **revenu**/tour → richesse ; prix
> ancré sur le revenu, *A = revenu × multiple*) + **surcouche SPÉCULATIVE** (le prix s'envole au-dessus de la
> juste valeur puis s'effondre dessus = la fête + le krach). Décision devient un fait calculable : *« produit
> 8/t → juste valeur ≈ 80 ; coté 140 → je paie 60 d'air → krach me ramène à 80 → je vends. »* **EN SUSPENS** :
> d'où vient le revenu (« qui mange les pommes ») — (a) injection contrôlée PNJ/marché [défaut raisonnable
> proposé], (b) transfert entre joueurs = zéro-sum strict, (c) hybride prod injecte / krach détruit. Concepteur
> a fermé la question sans trancher → **on continue à réfléchir**. ⚠️ Conflit revenu↔zéro-sum toujours ouvert.
>
> 🔒 **CLÔTURE — verrou de périmètre (2026-06-14, §9bis)** : FERMER (1 PA) + clôture partielle exigent d'être
> SUR l'hexe / ADJACENT / MÊME CLUSTER pour agir (sinon 🔒 hors de portée). Asymétrie voulue vs ouverture
> (adjacence stricte). Hook de compétence : trait `ignoreClosePerimeter` (Archetype→Actor, mirroir `ignoreLockup`)
> **fait sauter le verrou** — latent (aucun archétype ne l'a encore). Couche UI (`interaction.ts canActOnPositionAt`
> pur+testé, `App.svelte`). 127 tests (+6), moteur INCHANGÉ. À muer ENSUITE en compétence active (PA+fenêtre+cd).
>
> 🎮 **FOCUS COURANT = JEU DE BASE (2026-06-14, soir)** : on **reprend le développement du jeu de base** (cadre
> finance, ce memo). L'esthétique reste **parquée** (DA = chantier séparé) ; le moteur de rendu est tranché (SVG).
> Toute l'énergie va sur les **mécaniques du jeu de base**.
>
> 🎯 **CAP ALIGNÉ — DÉCISIONS = FAITS CALCULABLES (2026-06-14, soir, point d'alignement fort)** : raffinage de
> l'étoile polaire. Le concepteur a tranché : le vrai problème n'était **PAS le nombre de mécaniques**, mais (1) **le
> jargon finance** et (2) **le manque de NETTETÉ du moment de décision**. Exigence montée d'un cran : pas seulement
> *net* (visible) mais **LOGIQUE** = la décision se **DÉDUIT** de faits, réponse prouvable (« danger 0.58 + 0.12/tour
> = 0.70 → krach au prochain tour → je sors »). **Geste moteur, sans une ligne neuve** : rapprocher les deux seuils
> existants `crisisDeadZone` = `crisisCeiling` (params.ts) → `crisisProbability` devient une **marche d'escalier**
> (sous le seuil = jamais ; au-dessus = toujours) → **le dé du déclenchement disparaît**. Plus : **révéler la jauge**
> (déjà calculée, le debug la montre) ; la jauge **monte déjà de façon déterministe** (`fragilityDelta` = entassement +
> mises à crédit − calme). Hasard résiduel (forme du krach, bruit de prix) **fermable** par min=max sur les plages.
> **Seul inconnu qui survit = les autres joueurs** (bonne incertitude : on déjoue des gens, jamais un dé). C'est
> cohérent avec « se découpler de la réalité ». **Ajouter des mécaniques reste permis** (le monstre = jargon+flou, pas
> la quantité) MAIS base d'abord, nette/logique, puis 1 ajout à la fois. ⚠️ Renverse l'anti-script (RNG/plages) — assumé.
>
> ⭐ **ÉTOILE POLAIRE — SIMPLICITÉ / PEAU LUDIQUE (2026-06-14, détail `docs/refonte-chaises-demineur.md` en tête)** :
> diagnostic franc du concepteur — **le moteur est 100 % validé**, mais **« la peau » est trop complexe** et **le fun
> ne se sent pas**. Cause : le jeu de base est bâti sur la **prise de décision en info cachée/latente** (façon quant),
> ce qui **mure** les deux ingrédients du fun (conséquence lisible + lire les autres). **Décision de direction** :
> *se découpler de la réalité (c'est un jeu)*. **Règle d'or** : *tout ce qui est caché devient VISIBLE ou SUPPRIMÉ ;
> une règle valide est un SI→ALORS énonçable à voix haute*. Le moteur (machine à états déterministe) est gardé ; on
> remplace la peau **réaliste/incertaine** par une peau **visible/déterministe/logique** (`F`→charge visible ; signaux
> bruités/ancre `A`/régimes/mensonge du rebond → supprimés ; crowding→danger = règle énonçable ; contagion = chaîne
> visible). **Convergence** : « jeu de base » et piste « chaises × démineur » visent désormais la **même** réponse.
> Skill central candidat = **B « ne pas être le dernier debout »** (crowding = seule grandeur honnêtement observable) ;
> A (anticiper `F`) et C (poudre sèche) deviennent des **lentilles d'archétype**. À reprendre après la nuit du concepteur.
>
> ⏸️ **PISTE PARKÉE — « Chaises musicales × Démineur » (`docs/refonte-chaises-demineur.md`)** : exploration d'un
> **virage de thème** (abandon du registre finance) → chaise musicale + démineur + économie d'information (pièces =
> enquête, PV = survie). Le concepteur **réfléchit une nuit**. Acquis notés dans le doc (mine = faille×charge, enquête
> réflexive, détonation forçable = fire-sale→marge). **Décision en suspens** : effacer le `bounce` + détonation chaque
> tour avec `F` = sévérité croissante (a) vs déclencheur occasionnel (b). À reprendre si/quand le concepteur revient dessus.
>
> 👥 **MULTIJOUEUR = BOARD PARTAGÉ (confirmé explicitement 2026-06-14, §10/§31)** : un **seul plateau commun**,
> une **seule fragilité `F` commune** + sentiment partagé (états systémiques que tous influencent ET subissent,
> §10) ; **paris privés** révélés par bribes (plan & TICKs §31 : déplacements visibles, investissements cachés).
> PAS de boards individuels — c'est *parce que* le plateau est commun que le jeu de fragilité fonctionne à
> plusieurs. Statut : tranché solo-first / multi phase 2 ; §31 reste une proposition non implémentée.
>
> 🎯 **SISMOGRAPHE rendu ACTIF — « Le Grand Pari » (2026-06-14)** : il était trop passif (jauge + thêta
> = info/coût subis, aucun geste). Mesuré : **levier + jauge = GAME-BREAKING** (top1 88-99 %, robuste au
> bruit — leviérer la reprise fiable est sans risque quand on time). Le levier est le coupable, pas la
> jauge. → Geste actif = **SHORTER le krach** (pari DIRECTIONNEL, déjà dispo dans l'UI ; la jauge dit
> *quand*). Build : `noLeverage: true` (le levier+jauge serait OP + empièterait sur le fonds leveragé) +
> `calmTheta` 0.005→**0.007** → short balançable, top1 **38.8 %**, excédent +2 % (§28.8 ✓). Pas de
> mécanique séparée. UI : panneau jauge enrichi (Grand Pari : zone rouge→SHORT/cash, creux→frappe LONG).
> 121 tests, svelte-check 0. Leçon : info parfaite + amplification = dégénéré → l'edge du Sismo est
> INFO+DIRECTION, jamais l'amplification.
>
> 🌋 **SISMOGRAPHE — 2ᵉ archétype (2026-06-14)** : trader macro (réf. Soros). **POUVOIR** : jauge de
> fragilité `F` INNÉE (voit le séisme caché — exclusif ; les autres n'ont que les signaux bruités) →
> débloque le timing + la frappe all-in au creux. **CONTRAINTE** : `calmTheta` 0.5 %/tour, « fragile au
> calme » (ponction de richesse hors crise — couvertures qui décaient dans le boom ; clouée sur la crise
> OBSERVABLE → pas de fuite de F). Mesuré : jauge seule = survie (top1 26 %, drawdown 14.7→2.8 %), FRAPPE
> = win-con (50 % à θ=0), thêta = dial → **θ=0.5 % → top1 38 %, duel 50 % (neutre §28.8)**. La frappe
> ÉMERGE du jeu agressif que la jauge autorise (pas de mécanique séparée). Au sélecteur d'archétype UI.
> 121 tests, svelte-check 0. ⚠️ Découverte annexe : le forward guidance BC était MORT (target==rate en
> mode réunions) → réparé (la cible suit F en continu, mène le taux) ; mais la BC reste un mauvais signal
> macro (elle coupe en crise) → le Sismographe lit F directement, pas la BC.
>
> ✅ **VAUTOUR COMPLET — fiche §6 bouclée (2026-06-14)** : victoire (Score) + 2 compétences (Récolte/
> Couverture) + **ressource** + **contrainte**. **Contrainte** `noLeverage` (capital patient, levier→0,
> moteur+UI). **Ressource** « Réserve sèche » (`dryPowder`) : +1/tour patient (plafond 8) ; déployer en
> haute fragilité (F>0.55) DÉCOTE l'entrée (≤10 %) puis consomme — « déploiement décoté dans le krach ».
> Mesuré (`scripts/vautour-resource.ts`) : ligne contrarian FAIBLE (top1 ~16 % à 10 % décote) → ressource
> sans risque ; noLeverage protège même le déployeur (leviérer un krach = suicide), mord sur le bull ;
> inerte pour Vautour-coupons (42 %) et réserve (9 %). Sondes de physique (calibration/calibrate) passent
> par l'archétype **NEUTRE** (sinon le pyromane steadyLong(4) ne peut pas leviérer). 120 tests, §28.8 OK.
>
> 🧪 **UI : 2 fixes crédit + logique extraite/testée (2026-06-14)** : (1) acheter un crédit DÉPLACE le
> joueur sur la case si adjacent (cohérence ; le crédit est traversable) ; (2) l'achat de crédit COMPTE
> dans le CHAIN (une position sur un autre actif ensuite = enchaînement 2 PA). Puis **option 2** : logique
> UI tricky extraite en fonctions PURES (`src/lib/interaction.ts` : traversée, CHAIN, déplacement crédit,
> timing compétences avec décalage écran→résolution) — App.svelte délègue (source unique). 12 tests
> (`interaction.test.ts`) verrouillent ces comportements hors DOM. 116 tests, svelte-check 0, build OK.
> Note : « 1 crédit/tour » observé = émergent (géographie), PAS une règle dure — à formaliser si voulu.
>
> 🛡️ **VAUTOUR — PAIRE de compétences off/def (2026-06-14)** : 2ᵉ compétence **Couverture** (défensive,
> armer + auto-tir) : ARMER (2 PA) → anti-défaut des coupons **W=2 tours** → cooldown 10 ; auto-tir en crise
> (pas d'auto-seuil → la décision « sentir le danger » reste au joueur). Data-driven (`coverSkill`, gate dans
> `runCreditLifecycle`). **Finding** : 2 pouvoirs partagent le budget de neutralité → **co-doser** (Récolte
> seule déjà 43 %). Choix : Récolte ×2 mais **cd 12→18** (rareté, punch gardé) + Couverture W=2 → top1 **~42 %**,
> duel ~50 % (§28.8 ✓). UI 2 boutons. 104 tests (+cover), svelte-check 0. Leçon : garder la magnitude, payer
> la 2ᵉ compétence par la fréquence. Reste fiche Vautour §6 : ressource « Réserve sèche » + contrainte de cadre.
>
> 🦅 **VAUTOUR — 1ᵉʳ pouvoir d'archétype « Récolte » (2026-06-14)** : compétence active (3 PA) →
> carry ×2 pendant 2 tours, cooldown 12. Data-driven (`Archetype.carrySkill`) → ajouter un pouvoir =
> une ligne. Moteur : `COMPETENCE` (action, coût PA) arme `carryBoostUntil` + pose `carrySkillReadyAt` ;
> `carryBoostMult` booste le carry V + coupons. **Inerte si non activé** → calibration intacte.
> Contre-poids : 3 PA + cooldown 12 + défaut crédit en krach (exagéré ×2, neutre en espérance).
> Validé moteur (`scripts/vautour-skill.ts`) : top1 **31 %→40 %**, duel 51 % (§28.8 ✓). UI « 🦅 Récolte ».
> **102 tests** (+3 `archetype.test`), svelte-check 0, build OK. **Pipeline archétype prouvé bout-en-bout.**
> Reste fiche Vautour §6 : câbler la ressource « Réserve sèche » + une contrainte permanente de cadre.
>
> 🎭 **Archétypes — réflexion ouverte + RÈGLE DES POUVOIRS (2026-06-13)** : on est prêt à concevoir
> (physique calibrée + archi data-driven + pouvoir prouvé `ignoreLockup`). **Règle clé** : un pouvoir
> peut être EXAGÉRÉ en magnitude mais doit être NEUTRE EN ESPÉRANCE (asymétrie ≠ dominance). Formes
> sûres : conditionnelle / contrainte appariée / coût d'opportunité. Anti-pattern fatal : **buff plat
> sur une grandeur qui COMPOSE**. Méthode **un à la fois** (§30) ; commencer par victoire « Score »
> (Vautour) car victoires différenciées (AUM/domination/science) non implémentées.
>
> 🔧 **Fix crédit A — baseline coupon assaini (2026-06-13)** : le coupon-long pur gagnait ~48 % (4 causes :
> compounding sans risque, esquive de F, **suppression de crises via le dénominateur du levier**, non-concurrence
> IA). **Fix A** = exclure la richesse-coupon du dénominateur (`fixLeverageDenom` défaut 1) → baseline **48 %→31 %**
> (neutre), suppression de crises tuée, **calibration intouchée**. Suffisant seul ; B/C en flags off. Méthode :
> faits mesurés (`scripts/credit-baseline.ts`) → fixes 1 à 1 (`scripts/credit-fixes.ts`) jusqu'à neutralité.
> 🧪 **Pile de mesure (hors moteur sauf fixes)** : `bc-cadence`, `horizon`, `cash-carry`, `asset-ideas`,
> `leverage-caps`, `archetype-carry-skill` (cooldown), `credit-baseline`, `credit-fixes`. Tous reproductibles.
>
> 🏦 **Session 2026-06-13 (suite) — BC vivante, campagne, hoarder réhabilité** :
> 1. **Crédit traversable + nœud BC utile** : « se déplacer (sans investir) » étendu au crédit
>    (`canMoveTo`, frontière crédit HY_US comprise — on traverse, l'ouverture reste bloquée) →
>    la FED redevient atteignable ; **info-edge** branché (présence FED révèle `bc.target` 1 tour
>    à l'avance, forward guidance, spec §4c).
> 2. **BC par réunions planifiées** (`bcMeetingEvery` 4-5, décisive) : `r_BC` figé entre réunions,
>    posé à la cible aux réunions. **Mesuré neutre** (distribution de crises identique → la BC lit F,
>    ne la pilote pas) ; dégrade le 4ᵉ signal de façon contrôlée → le forward guidance prend de la valeur.
> 3. **PATH B — campagne multi-cycles** : `horizonTurns` **28-40** (au lieu de 13-16). Distribution
>    re-ciblée (**sans ~8 / 1 crise ~46 / 2+ ~45**, ~1.4 crise/partie) ; bandes `calibration.test.ts`
>    mises à jour ; la **branche sans-crise s'efface** (pilier 1-cycle abandonné, assumé).
> 4. **Carry du cash en réserve** (`cashCarryFloor` r(40,60), cash gagne **r_BC** au-dessus) :
>    réhabilite le hoarder en campagne (top1 3.5 %→**9.2 %**) **sans casser le garde-fou** (score moyen
>    −62 %, perd au calme/gagne aux krachs) ni cannibaliser le carry (value 38 %, duel 55 %).
>    Cannibalisation = **seuil de taux** (cash effectif < bande carry LC ~1.5-2 %) ; franchise = levier
>    de protection orthogonal. **Couche richesse pure → F/crises inchangées, calibration-safe.**
> 5. **Infra** : `ConfigPartie.paramsOverride` (surcharge de params post-tirage, n'altère pas le flux
>    du monde) ; **outils de mesure** `scripts/bc-cadence.ts`, `scripts/horizon.ts`, `scripts/cash-carry.ts`.
> **99 tests verts · svelte-check 0 · build OK.**
>
> 🎯 **Calibrage J7 — COMPLET (2026-06-13)** : tempo + neutralité réglés via les paramètres
> générateurs (`src/engine/params.ts`), aucun timing/résultat forcé. **2 causes racines
> trouvées** : (1) le terme de valorisation (`×100`) noyait le levier ; (2) **`fluxImpact`
> ~100× trop fort** (flux absolu O(100), réglé pour O(1)) → l'achat normal des IA saturait
> le prix au plafond +50 %/tour, marché auto-pompé, **levier god-tier** (+2930 % de score,
> 99 % de victoires). Corrigés : `fluxImpact` 0.0002-0.0006, levier **carry-neutre**
> (`leverageBorrowRate` ≈ carry), drifts quasi nuls (marché ≈ martingale + krachs), **α=0.35**.
> **Résultats** : agrégat tempo **28/59/13** (sans/1/2+ crise) ✓ · **neutralité §28.8** : duel
> levier/value **46 %** (égalité, aucun ne domine) ✓ · drawdowns qui mordent (lev4 94 %) ✓ ·
> le **hoarder gagne 11 %** des parties (krachs) ✓ · signaux>horloge §28.7 ✓. La fragilité est
> désormais pilotée par le **COMPORTEMENT** (levier+crowding), pas par un pump global → un monde
> calme reste calme. Instrument `scripts/calibrate.ts`, 8 assertions `calibration.test.ts`.
> ⚠️ **Décisions design J7** : (a) reset relevé (`resetFactor` 0.32-0.48) → §23.5 **assoupli**
> (plus « quasi-total ») pour le rallumage pyromane ; (b) α **fixe** à 0.35 (score transparent
> §27.3) ; (c) marché à dérive ~nulle (le levier amplifie un pari, pas un gain garanti, §29.3).
> 🔄 **Re-calibré 2026-06-13 (intégration crédit-coupons, voir tâche B.8)** : le crédit a
> quitté le monde `V` → retirer les hexes crédit défensifs a fait chuter le duel à 28 %,
> rétabli à **~50 %** via `leverageBorrowRate`↓ (0.015-0.03) + `marginCallThreshold`↑
> (0.35-0.55) ; tempo **26/62/12**. Chiffres ci-dessus (28/59/13, duel 46 %) = état pré-crédit.
>
> 🖼️ **MOTEUR DE RENDU — TRANCHÉ : SVG (2026-06-14, memo §13)** : décision prise (plus différée). Le jeu
> rend ~13-16 hexes statiques + jauges + barres + data-viz + texte : profil **tour par tour, UI-lourd**, PAS
> d'action temps réel ni de milliers d'entités → un moteur « jeu » serait un contre-emploi. **Choix : garder
> SVG** (actuel, `App.svelte` : `<polygon>`/`<circle>` liés à la réactivité Svelte, 0 boucle de rendu). Le
> « juice » passe par **CSS + transitions/motion Svelte** (remplissage de jauge, pulsation rouge de F, glow
> d'hexe, fondus de révélation) — suffisant et gratuit en archi. **Escape hatch** : le SEUL gain réel de
> PixiJS/Phaser ici = les **particules de krach** → si un jour ce moment les mérite, **overlay PixiJS sur ce
> seul effet**, jamais un framework qui avale l'UI (une couche, pas une migration). **Unity** = réservé à un
> éventuel virage build natif (portage C# cadré par les 60+ tests). Discipline maintenue : logique/affichage
> jamais mélangés. **Direction artistique (palette/icônes/mood)** reste indépendante du moteur → chantier à part.
>
> 🧩 **Nouveaux nœuds (piste 2026-06-13)** : provisionner des **hexes à effets via le système de nœuds** (réutilise présence/S'installer/durée). **D'abord des nœuds VIDES, mécanique ensuite** (un à la fois). Menu : Chambre de compensation (marge), Réseau d'initiés (4ᵉ signal), Bourse (impact-prix), Desk recherche (délai signaux), Banque d'investissement (frontières), Média (réputation). Détail memo §22/§21.
>
> 🧭 **Spawn (décision 2026-06-13)** : clusters gardés contigus (adjacence = corrélation) ; remplacer le spawn aléatoire (proto) par un spawn **choisi / par affinité d'archétype** + **draft de zones** en multi (memo §22, §21, conforme §11). À implémenter avec les archétypes / le setup §31.
>
> 🗣️ **Comment expliquer le jeu (pitch + table de traduction trader→gamer) : `docs/pitch.md`** — genre *press-your-luck*, métaphore chaises musicales, 2 niveaux de discours (memo §12). Tagline posée dans l'en-tête de l'UI.
> 📄 **Référence des mécaniques jouables : `docs/mecaniques.md`** (état réel du prototype).
> 🧠 **Le « pourquoi » du système : `docs/systeme-pourquoi.md`** (modèle mental du créateur — pourquoi chaque pièce est ainsi + guide « comment lire une partie »).
> 💳 **Spec crédit-coupons + BC : `docs/spec-credit-coupons.md`** (proposition design, phase 2 — crédit = émetteur de coupons, BC = fonction de réaction lisible **+** nœud FED influençable).
> 🎓 **Tuto réservé pour plus tard** — approche hybride pressentie (memo §22, agenda en 6 points).
> 🌐 **Archi multijoueur « plan & TICKs »** documentée (memo §31), non implémentée ; IA déjà visibles (footprint).

---

## Ce qui est tranché

| Sujet | Memo § | Version |
| --- | --- | --- |
| Cadre atemporel | §1 | v0.3 |
| Crises endogènes (modèle conditionnel) | §4 | v0.3 |
| Jauge de fragilité cachée, signaux bruités | §4 | v0.3 |
| 5 archétypes jouables + système de badges | §6, §7 | v0.4 |
| 2 badges par défaut (draft partiel) | §7 | v0.4 |
| Tour 1 = fondation (vue partielle + choix branche techno) | §8 | v0.4 |
| 4 PA par tour, 1 point de compétence tous les 3 tours | §8 | v0.4 |
| 5 verbes : LIRE / POSITIONNER / CONSTRUIRE / NÉGOCIER / RÉSERVER | §9 | v0.4 |
| Ressources : Capital (3 états) + Réputation + ressource archétype | §10 | v0.4 |
| Carte hexagonale : 3 types de hexes, adjacence = corrélation | §11 | v0.4 |
| Paliers de présence dans un hex (x4) | §11 | v0.4 |
| Prototype : carte fixe ~15-20 hexes, puis procédurale | §11 | v0.4 |
| Vocabulaire : jargon conservé + tooltips 2 niveaux | §12 | v0.4 |
| **Objectif : jeu web, solo-first, multi WebSockets phase 2** | §13 | v0.5 |
| **Tours abstraits numérotés, fin par victoire ou 3 cycles, score tiebreaker** | §15 | v0.6 |
| **IA : pool unifié 9 profils + Banque centrale, choix des adversaires, max 3** | §16 | v0.7 |
| **Signaux : 4 signaux (Volatilité/Écart crédit/Financement/Initiés), option A prototype** | §17 | v0.8 |
| **Wireframes : 4 écrans (configuration / vue principale / détail hex / post-mortem)** | §18 | v0.9 |
| **Modèle numérique de la jauge : déclencheur hybride, reset quasi-total, signaux chiffrés** | §23 | v1.0 |
| **Cascade de crise : morphologie (chute → rebond → vraie jambe), signaux qui mentent** | §24 | v1.1 |
| **Anti-script : régimes émergents (pas de séquence garantie), cascade à paramètres stochastiques** | §15, §24 | v1.2 |
| **Neutralité archétypale : marché = physique neutre, archétypes = lentilles ; « le hoarder peut perdre »** | §26 | v1.3 |
| **Moteur de prix : facteurs (40/30/30), ancre `A` cachée (2ᵉ état caché), flux = impact-prix, carry, melt-up stochastique, dead recoveries — 4 fixes anti-script A→D** | §25 | v1.4 |
| **Score = Track Record (excédent vs marché − α·drawdown) ; benchmark fixe, drawdown mark-to-market ; remplace le Sharpe** | §27 | v1.5 |
| **Tempo : calibrage statistique (cibles de distribution, pas de durée), `F(0)` en plage cachée, critère « signaux battent l'horloge » (test J7)** | §28 | v1.6 |
| **Périmètre MVP validé (T8) : architecture N-archétypes/profils/cartes = données, harness paramétrable, calibrage multi-profils + assertion de neutralité (J7)** | spec §11bis, §28.8 | v1.7 |
| **Défauts #2/#3/#4 résolus : purge symétrique agrégée, planchers de bruit irréductibles, mécanique du levier (appel de marge = transmission des cascades) — chantier script stratégique CLOS** | §23.3, §29 | v1.8 |
| **Restructuration profils : primitives d'abord (profil NEUTRE = bac à sable), archétypes = spécificités par-dessus (un à la fois). Short = primitive, modulée par archétype** | §30 | v1.10 |
| **Défaite : 3 stades (Stress → Crise → Effondrement)** | §14 | v0.5 |
| **Parties indépendantes — aucun carry-over entre runs** | §14 | v0.5 |
| **Moteur de rendu = SVG (juice par CSS/transitions Svelte ; Pixi en overlay ciblé pour les particules de krach seulement ; Unity = build natif futur)** | §13 | v1.26 |

---

## Ce qui reste à développer

État réel (post-J7). Le design MVP est clos ; le moteur tourne et est calibré
(tempo §28.2 + critère §28.7). Reste, par ordre de priorité :

### A. Chantiers code immédiats (MVP)

1. ~~**Fin de J7 — vérifs numériques**~~ ✅ **FAIT (2026-06-13)** : α calibré à **0.35** (fixe,
   §27.3) ; levier **viable et non dominant** (carry-neutre + `fluxImpact` corrigé → duel
   levier/value 46 %, drawdowns qui mordent) ; **assertion de neutralité §28.8** en place
   (`calibration.test.ts`). **J7 entièrement clos.**
2. **Coutures UI (dette J5)** :
   - **Câbler le coût LIRE** — les signaux sont gratuits aujourd'hui (le budget épistémique §28.5 ne mord pas).
   - **Clôture partielle + levier joueur dans l'UI** (existent au moteur, pas exposés proprement).
   - **Écart carte 13 vs 16 hexes** à trancher/refermer (prose spec §4 = 16, adjacence = 13).
3. **Nouveaux nœuds à effets** (§11, piste tranchée) : placer des **nœuds VIDES d'abord**, câbler la mécanique ensuite, **un à la fois** (Chambre de compensation, Réseau d'initiés → 4ᵉ signal, Bourse → impact-prix, Desk recherche, Banque d'investissement → frontières, Média → réputation).
4. **Archétypes par-dessus le profil NEUTRE** — **un à la fois** (définir → tester → équilibrer → valider → suivant, §30). Le neutre + primitive SHORT sont livrés ; les spécificités sont la couche suivante.
5. **Spawn par affinité / draft de zones** (§22, §11) : remplacer le spawn **aléatoire** du proto par un placement choisi par affinité d'archétype (clusters gardés contigus).

### B. Phase 2

6. **Génération procédurale de la carte** (géométrie = adjacence ; le proto d'exploration la fait déjà côté UI).
7. **Multijoueur « plan & TICKs »** (§31, WebSockets) : phase de choix simultanée + observation en TICKs (déplacements révélés, investissements cachés).
8. **Crédit-coupons + Banque centrale** (spec `docs/spec-credit-coupons.md` **close**, b+c). Sous-système entier = phase 2, pas MVP-critique.
   - ✅ **Phase 2a étape 1** : moteur autonome `src/engine/credit.ts` + 18 tests — taux (r_BC + spread_qualité + spread_F + prime de terme), réaction BC lisible, carnet court/long, portage long/short, défaut tout-ou-rien, échéance vrai-bond.
   - 🔧 **Décision archi** : flux RNG du **monde** découplé de celui des **params** (`init.ts`) → ajouter des params ne décale plus le comportement seedé (indispensable, la phase 2a en ajoute beaucoup).
   - ✅ **Phase 2a étape 2 — INTÉGRATION MOTEUR (2026-06-13)** : le crédit a quitté le monde `V` (init exclut le cluster crédit du `market`), coupons branchés dans `runTurn` (cycle BC→défaut→portage→échéance→rollover), richesse + crowding comptent les coupons, benchmark **alpha-pur**, IA tradent actions/alt. Action `ouvrir_coupon` (long XOR short, taille verrouillée). **93 tests verts** (+5 intégration). **Re-calibré** : retirer les hexes crédit (défensifs) a fait tomber le duel levier/value à 28 % → réglé par la **dynamique** (`leverageBorrowRate`↓ 0.015-0.03, `marginCallThreshold`↑ 0.35-0.55, α **fixe** 0.35) → duel **50 %**, tempo **26/62/12** ✓.
   - ✅ **Phase 2a étape 3 — INCRÉMENT B (2026-06-13)** : (a) **IA reach-for-yield** — `AIBehavior.couponAppetite` (fonds leveragé = 0.2) : en période calme l'IA chasse le coupon le plus juteux (HY long) → crowd crédit → nourrit `F`, et le HY défaut le plus en crise (boucle de fragilité fermée). Re-calibré : duel **58 %** (cible 40-60 ✓), tempo 27/62/11. (b) **UI coupons** (`App.svelte`) — section « Crédit · Banque centrale » (taux BC + flèche de tendance = lit F en filigrane ; coupons détenus avec RCE + risque) ; panneau de trade sur hexe crédit (carnet court/long, taux, échéance, risque ; LONG/SHORT + taille 25/50/100 %). 93 tests + svelte-check 0 erreur.
   - ✅ **BC = nœud vivant (2026-06-13)** : (a) **crédit traversable** — `canMoveTo` autorise « se déplacer (sans investir) » sur le crédit (frontière verrouillée HY_US comprise : on traverse, l'ouverture reste bloquée) → la **FED**, enfouie derrière IG_US, redevient atteignable ; (b) **info-edge (spec §4c)** — sous présence FED, l'UI révèle `bc.target` un tour à l'avance (« Cible BC / Décision réunion ✨ », forward guidance) ; (c) **réunions planifiées** — `bcMeetingEvery` (4-5) : `r_BC` figé entre réunions, **décisif** à la réunion (`bcReact` θ optionnel, `bcMeets`). **Mesuré neutre** (`scripts/bc-cadence.ts`) : crises/neutralité inchangées (la BC lit F, ne la pilote pas) ; le 4ᵉ signal se dégrade de façon contrôlée → la staleness + le forward guidance créent l'intérêt.
   - 🎯 **Sous-système crédit-coupons COMPLET** (moteur + IA + UI + BC vivante). Reste optionnel : early-close des coupons, recovery rate, **BC influençable phase 2b (lobbying)**, maturités variées par émetteur.

10. **Campagne multi-cycles (PATH B, décision créateur 2026-06-13)** — la partie devient une SUITE de booms-busts, plus un cycle unique.
    - ✅ **Livré** : `horizonTurns` **r(13,16) → r(28,40)**. Distribution re-ciblée (mesurée `scripts/horizon.ts`) : **sans ~8 % · 1 crise ~46 % · 2+ ~45 %**, ~1.4 crise/partie, date très étalée (σ ~8t → §28.7 OK). Neutralité §28.8 tient à tout horizon. **Bandes `calibration.test.ts` mises à jour** : quota calme 0.06-0.40 ; « pyromane brûle 2× » → ordre + seuil multi-cycles ; plancher top1 réserve 0.05→0.02.
    - ⚠️ **Conséquence assumée** : la **branche sans-crise s'efface** (le pilier 1-cycle « le hoarder évite le krach et gagne » se raréfie) → motive l'item 11.

11. **Carry du cash en réserve (réhabilite le hoarder, 2026-06-13)** — la poudre sèche au-dessus d'une franchise gagne le taux directeur `r_BC`.
    - ✅ **Livré** : `cashCarryFloor` r(40,60) entier (~0.5× capital, transparent) ; `turn.ts` (4ter) `accrueCashCarry` après la réaction BC → `cash += r_BC · max(0, cash − franchise)` pour **tous les acteurs** (neutre), **sans toucher F**. UI : « 💰 Poudre sèche +x/t » / « 💤 sous la franchise ». Recette **conservatrice (k=1·r_BC, R_min~50)** choisie après panel large (`scripts/cash-carry.ts`).
    - 📊 **Mesuré** : hoarder top1 **3.5 %→9.2 %** (re-win-con) mais score moyen **−62 %** (garde-fou « le hoarder peut perdre » intact : gagne les krachs, coule au calme) · value 47 %→**38 %** (cannibalisation bornée par la franchise) · duel **55 %** (§28.8 ✓) · **crises inchangées** (couche richesse). **Cannibalisation = seuil de taux** (cash effectif < bande carry LC ~1.5-2 %) ; `r_BC` ~1.4 % la respecte. Synergie BC : la patience est mieux payée quand la BC resserre (avant le krach).

9. **Illiquidité immobilier** (spec immo, créateur 2026-06-13) — l'illiquidité attaque le skill central (sortir avant le krach) : l'immo devient l'asset qu'on **ne peut pas fuir**, son carry devient une vraie prime d'illiquidité.
   - ✅ **Livré** : flags de données `Hex.longOnly` + `Hex.illiquid` ; **long-only + SANS levier** (option a, décision créateur → pas de contradiction avec l'appel de marge) ; **verrou de sortie** `lockupTurns` (param tiré 2-3, transparent/affiché) ; `Position.entryTurn` arme le verrou, renforcer **re-verrouille** (tranche la + récente fait foi) ; pouvoir d'archétype `ignoreLockup` (sur `Archetype` + `ActorState`) qui contourne. Posé sur IMMO (MVP) et les **alternatifs marché** (générateur, carry 0.03 le justifie ; PEVC carry 0 exclu en MVP). UI : panneau adapté (pas de SHORT/levier, notice illiquidité, compte à rebours du verrou, sortie désactivée). 5 tests `illiquid.test.ts`.
   - 🔧 **Re-calibré** : l'immo sans-levier a refroidi le système (sans-crise 31 %) → `accLeverage` relevé (0.09-0.18) → tempo **26/65**, duel **54 %** (✓). 98 tests verts.
   - ⏭️ **Optionnel plus tard** : spirale de marge sur immo leveragé (options b/c), sensibilité de l'immo au taux directeur BC, un archétype « spécialiste immo » porteur d'`ignoreLockup`.

### C. Backlog design (hors MVP)

8. **Arbre de compétences détaillé** (§8).
9. **2 archétypes manquants** à définir + **noms in-game définitifs** des 5 archétypes.
10. **Tutoriel** — approche hybride pressentie (agenda en 6 points), **réservé pour plus tard**.

> Prochaine étape concrète recommandée : soit **finir J7** (α + levier + neutralité §28.8, l'outillage est prêt), soit attaquer les **nœuds vides** (3) / le **1ᵉʳ archétype** (4). Les coutures UI (2) sont à refermer avant tout test joueur réel.

---

## Chantier script stratégique — CLOS (v1.8)

**Moteur de prix (§25) — VERROUILLÉ v1.4** avec 4 fixes anti-script intégrés (A : taux cash jamais indexé sur `F` ; B : plancher de bruit sur l'estimation de `A` ; C : dead recoveries ; D : `λ` faible en normal).

**Les 5 défauts de §26.3 sont résolus (détail en memo §29.4) :**

| # | Défaut | Résolution |
| --- | --- | --- |
| 1 | Score Sharpe gameable | Track Record (§27) |
| 2 | RÉSERVER / purge individuelle | purge symétrique agrégée, proportionnelle à la part de capital (§23.3, §29.1) |
| 3 | Clarté achetable | planchers de bruit + délais irréductibles, en plages (§29.2) |
| 4 | Levier option morte | mécanique complète (coût, appel de marge) + test de viabilité en J7 (§29.3) |
| 5 | Bonus phase-3 du Vautour | supprimé (v1.4) |

Principe directeur : **chaque levier doit porter un coût symétrique** (règle des badges §7 : friction, pas synergie).

Restent en J7 (vérifications **numériques**, pas de design) : α, coût du levier, planchers, cibles de tempo (§28.2), critère signaux>horloge (§28.7), neutralité multi-profils (§28.8).

> Backlog design : T1 ✅ · T2 ✅ · T3 ✅ · T4 ✅ · T5 ✅ · T6 ✅ · T8 ✅ · T9 ✅ · A2 absorbée ✅. **Design MVP complet, audité, chantier clos.**
>
> **Code : J1 ✅** — squelette Svelte/Vite/TS. Moteur découplé (`src/engine/`, TS pur sans DOM), tout en données (`src/data/` : carte 16 hexes, Vautour, 2 profils IA, preset MVP). Anti-script porté par le code : RNG seedé (`rng.ts`) + paramètres en plages tirées par instance (`params.ts`, aligné v1.8 dont levier §29.3). 17 tests verts (intégrité/symétrie/connexité carte, reproductibilité RNG, plages des paramètres + `F(0)` < zone morte). Build OK.
>
> **Code : J2 ✅** — moteur sans UI exécutable. `engine/` : state, regime (émergent), market (facteurs §25, ρ→1 en crise), portfolio (mark-to-market, levier/crowding, appels de marge), fragility (§23.4), score (Track Record §27), turn (boucle), policy (interface + politiques triviales), simulate (harness §28). **Tests d'émergence verts** : levier→crises, réserve→sûr, nb de crises variable (non scripté). **37 tests**, typecheck + build OK.
>
> **Code : J3 ✅** — cascade complète (§24) : machine à phases leg1→rebond→(leg3 ou vrai plancher)→recovery, **forme tirée par crise** (anti-script intra-partie), bull trap en P&L, reset `F∝amplitude`. **Signaux observables** (`signals.ts`, §23.6) : bruités/retardés, plancher en plages, **mensonge du rebond** ambigu (§24.2). Instrument horloge-vs-signaux (§28.7) posé (assertion stricte → J7). **46 tests**, typecheck + build OK.
>
> **Code : J4 ✅** — les 2 IA rule-based via **fonction de réaction paramétrée** (`engine/ai.ts`, memo §16) ; comportements en données sur le profil. Fonds leveragé (momentum+levier, volatilité perçue bruitée) · Value patient (décote via estimation bruitée de `A`, sans levier, ne panique pas). Les IA ne voient jamais `F`/`A` → derrière la courbe, émergent. **51 tests**, typecheck + build OK. **⚠️ J7** : taux de crise sature (~100 %) au tempo par défaut → cibles §28.2 (20-25 % sans crise) à régler.
>
> **Code : J5 ✅** — UI vue principale (`App.svelte`, `lib/layout.ts`). Carte SVG 13 hexes, signaux (3 barres, F cachée), actions (Ouvrir/Fermer/Réserver + PA), bandeau Track Record, journal, seed. Joueur humain = `Policy` UI → moteur inchangé. Build OK, 51 tests. **Coutures** : signaux gratuits (coût LIRE pas câblé) · clôture partielle/levier hors UI · 13 hexes (écart 13/16 ouvert). Prochaine étape : **J6 — détail d'hexe + post-mortem** (courbe `F` révélée).
>
> **Proto exploration (UI, hors moteur)** : carte hexagonale **générée** (géométrie = adjacence), brouillard, déplacement par investissement, CHAIN (1 PA puis 2), S'installer sur nœuds (présence), exposition par hexe, Track Record en valeur absolue + %.
>
> **Restructuration archétypes (en cours)** : on bâtit d'abord un **profil NEUTRE** (`src/data/archetypes/neutre.ts`) = toutes les primitives, aucune spécificité → bac à sable de mécanique. **Primitive SHORT livrée** : `Position.direction` long/short, P&L miroir, appel de marge et flux sensibles au sens (moteur) + sélecteur Long/Short et affichage du sens (UI). 62 tests. Les archétypes (spécificités par-dessus le neutre) seront développés **un à la fois** ensuite.
>
> **Bénéfices des nœuds câblés (prototype)** : **PB → Financement** (flux continu gratuit sur présence) · **PB → levier −50 %** (`borrowMultiplier`, moteur) · **Notation → signaux plus nets** (plancher de bruit irréductible §29.2). **BC → taux anticipés** reste ⛔ (dépend du chantier « réveiller la BC »). **Présence à durée ~3 tours** (`presenceUntil`) = futur bouton d'archétype. **Levier joueur** 0/2/3× exposé (UI). Primitive **DÉPLACER** (bouger sans investir, 1 PA) + **« Ouvrir ici »** (investir sur l'hexe courant). **Mode debug 🐞** (révèle F / régime / phase / ancres A). Réf : `docs/mecaniques.md`.
>
> ✅ **Calibrage J7 — LIVRÉ**. Diagnostic d'origine confirmé puis corrigé. **Cause racine** :
> `accValuation × stretch × 100` dominait (~0.10-0.19/tour) → F pilotée par les IA, levier noyé,
> crise quasi certaine dès le tour 4. **Réglages** (tous en plages, `params.ts`) : valorisation
> ramenée au niveau levier/crowding, levier relevé (`accLeverage` 0.08-0.16 = moteur), purge
> élargie (0.020-0.058 = variance de pente → parties calmes), `crisisK` adouci (0.7-1.1),
> `f0` élargi (0.08-0.36), drifts bull/tension abaissés, cascades raccourcies, horizon 13-16,
> reset relevé 0.32-0.48 (§23.5 assoupli, décision design). **Résultats** (800 parties/profil) :
> sans-crise 24 % ✓ · crise<t5 <1 % ✓ · F(t6)~0.50 (plus de plafond précoce) ✓ · drawdown
> 23-58 % ✓ · signaux>horloge ✓ · doubles lev4 ~11 % ✓ · 1-crise ~72-83 % (canonique). Le
> **comportement façonne la distribution** : hoarder 38 % calme / 1 % double, pyromane 6 % / 11 %.
> Outils : `scripts/calibrate.ts` (instrument), `calibration.test.ts` (6 assertions anti-régression).
>
> POSITIONNER (memo §9bis, v1.9) : Ouvrir (Long/Short) · Renforcer · **Clôture partielle (2)** · Fermer. En données : `src/data/actions.ts`.
>
> ⚠️ **À trancher avant J5** (memo §21) : écart de comptage carte — prose spec §4 = 16 hexes, liste d'adjacence = 13. Le code (`src/data/maps/mvp-16.ts`) suit l'adjacence (13 hexes : 8 marché · 3 nœuds · 2 frontière).

---

## Ressources d'archétype — aide-mémoire

| Archétype (réf. dev) | Ressource | Gagnée par | Dépensée pour |
| --- | --- | --- | --- |
| Buffett → Compounder | Conviction | Tenir une position longtemps | Résister aux pressions LP, doubler en baisse |
| Soros → Sismographe | Clarté de régime | Actions LIRE macro | Positions leveragées massives |
| Icahn → Prédateur | Pression | Accumulation silencieuse | Raid activiste, short squeeze |
| Simons → Architecte | Signal alpha | Investissement infra/data | Positions model-driven, LIRE moins cher |
| H. Marks → Vautour | Réserve sèche | Tours en RÉSERVER | Déploiement massif en crise |

---

## Design de la défaite — aide-mémoire

```
Stress (avertissement)
  → LPs inquiets, levier plus cher, encore récupérable

Crise (pression active)
  → LPs retirent, desks ferment, triage obligatoire

Effondrement (fin de run)
  ├── Absorption  → fond adverse gagne en puissance
  └── Wind-down   → clôture narrative, score réduit
```

La faillite est une dernière décision stratégique.
Les liquidations au stade 3 contribuent à la jauge systémique.

---

## Prototype minimal — cible MVP web

- Carte fixe ~15-20 hexes
- 1 archétype jouable + 2-3 IA simples (rule-based)
- Jauge de fragilité active (cachée)
- Boucle complète : LIRE → POSITIONNER → régime → crise éventuelle
- Jouable en 1h
