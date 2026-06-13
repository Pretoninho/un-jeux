# Spec — Crédit-coupons & Banque centrale (b+c)

> **Statut : PROPOSITION DE DESIGN, non implémentée. Phase 2** (le crédit-hexe actuel,
> bas β / haut carry, est calibré et suffit au MVP). À valider avant tout code.
> Origine : suggestion créateur 2026-06-13. Décisions actées : BC = **fonction de réaction
> lisible (b) + nœud influençable (c)** ; deux familles d'actifs (génériques vs définis).

---

## 0. Le principe non négociable

> **Un coupon doit porter un risque LISIBLE, sinon c'est un sous-jeu résolu.** Un coupon à
> taux connu tenu jusqu'à échéance sans risque = de l'argent gratuit qu'on prend à la
> calculette = l'inverse du cœur du jeu (lire un état caché via des signaux).

Deux risques le sauvent, tous deux branchés sur l'état caché `F` :
1. **Risque de défaut** — le coupon juteux peut faire défaut en crise (perte du principal).
2. **Risque de taux / réinvestissement** — au rollover, le taux du prochain coupon est
   incertain car piloté par la BC, qui réagit à `F`.

Tout le reste de la spec sert ces deux risques.

---

## 1. Deux familles d'actifs (cadrage validé)

| Famille | Cases | Schéma | Pourquoi |
| --- | --- | --- | --- |
| **Génériques** (porteurs de facteurs) | Actions (LC_*), Alternatifs (IMMO, PEVC, EXOT) | prix-`V` + `β/γ/carry` actuels | doivent rester **abstraits** : individualiser = mémorisable = anti-anti-script (§4.4) |
| **Définis** (mécanique propre) | **Crédit** (IG_EU/US/EM, HY_US) + **Nœuds** (FED, LIQ, INFO) | bespoke (ci-dessous) | portent une mécanique spécifique → méritent une fiche |

Les actifs crédit **quittent le monde des prix-`V`** : ils deviennent des **émetteurs de
coupons**. Les nœuds restent des nœuds, mais FED reçoit la mécanique BC.

---

## 2. L'actif crédit = un émetteur de coupons

Chaque hexe crédit n'a plus de prix `V` ; c'est une **fabrique de coupons** avec un petit
**carnet** (2 emplacements vivants) qui se rafraîchit.

### Le coupon (instance)

```
Coupon = {
  emetteur   : HexId       // IG_EU, IG_US, IG_EM, HY_US
  taux  r    : number      // rendement/tour, fixé à l'émission (§3)
  RCE        : number      // Rounds until Coupon Expires (maturité), tiré dans un menu (§5)
  notionnel U: number      // CHOISI une fois par le joueur à l'ouverture, puis VERROUILLÉ
  statut     : 'offert' | 'tenu_long' | 'tenu_short' | 'expiré' | 'défaut'
}
```

### Carnet par hexe

- **2 coupons vivants** à tout instant par hexe crédit : un **court** et un **long** (§5)
  → crée la décision de **courbe des taux / duration**.
- Quand un coupon est pris ou expire, un **nouveau** apparaît (taux + RCE recalculés au
  moment de l'émission, donc reflétant la BC et `F` **du moment**).
- « Combien de coupons = un hexe ? » → un hexe n'a pas un nombre fixe : c'est une fabrique
  à **2 emplacements roulants** qui émet en série sur toute la partie.

---

## 3. Formation du taux (le branchement BC + F)

À l'émission d'un coupon :

```
r = r_BC                 (taux directeur, posé par la BC — §4)
  + spread_qualité       (IG faible · HY élevé — la qualité de l'émetteur)
  + spread_F             (élargissement de crédit quand la fragilité monte)
```

- **`spread_qualité`** repart des `carry` actuels comme ancrage : IG ≈ +0.010-0.015,
  IG_EM ≈ +0.025, HY ≈ +0.045.
- **`spread_F = κ · max(0, F − 0.40)`** (0.40 = zone morte). Sous la zone morte, spread nul ;
  au-dessus, le crédit se **reprice** : les nouveaux coupons paient **plus**… mais sont aussi
  **plus près du défaut**. C'est le piège lisible : *le coupon le plus juteux est le plus
  dangereux*, et `F` te le dit si tu sais lire.

---

## 4. La Banque centrale (nœud FED) — b + c

La coquille **FED (`nodeType: 'reglementaire'`)** existe déjà sur le board (adjacente à
IG_US et au Prime broker). On la remplit.

### (b) Fonction de réaction LISIBLE

Le taux directeur `r_BC` n'est pas aléatoire : il **réagit à l'état caché**, lissé dans le
temps (comme une vraie BC → partiellement anticipable) :

```
cible = base + φ · surchauffe(F, valorisations)   − ψ · crise_active
r_BC  ← r_BC + θ · (cible − r_BC)                  (ajustement graduel)
```

- **Surchauffe** (F monte, valos s'étirent) → la BC **monte** les taux.
- **Crise** → la BC **coupe** en urgence (taux bas → soutien).

Effet de design majeur : **le ton de la BC trahit `F`**. Une BC qui monte = la fragilité
grimpe = danger. C'est presque un **4ᵉ signal** (bruité par le lissage θ et le délai).

### (c) Nœud influençable

Réutilise présence / S'installer / durée (système de nœuds existant) :
- **Phase 2a (info-edge)** : un joueur **installé sur FED** voit la `cible` de la BC **un
  tour à l'avance** (forward guidance) → avantage d'information sur le rollover.
- **Phase 2b (influence)** : la présence agrégée sur FED **infléchit** `r_BC` (lobbying :
  retarder une hausse). Plus fort, plus tard.

---

## 5. RCE — maturités variées (décision validée)

**Menu à 2 niveaux** (lisible, mais crée la courbe) :
- **Court** : RCE ≈ 2 tours, taux plus bas.
- **Long** : RCE ≈ 5 tours, taux plus haut.

La décision de duration = le cœur du fixed-income : verrouiller une **longue** maturité
avant une hausse BC = rester coincé bas (coût d'opportunité) ; verrouiller long **avant une
baisse** = tu gagnes. Anticiper la BC (§4) pilote ce choix.

---

## 6. Payoffs long / short (une seule position par coupon)

Borne validée : sur un coupon donné, un joueur est **LONG XOR SHORT, une seule fois**. La
taille `U` est **choisie une fois à l'ouverture puis VERROUILLÉE** (non redimensionnable). La
conviction s'exprime donc par **la taille (choisie une fois) ET le nombre de coupons** pris
dans le carnet.

| | Mise en place | Par tour | À l'échéance (survie) | Si DÉFAUT |
| --- | --- | --- | --- | --- |
| **LONG** | engage `U` | reçoit `r·U` | récupère `U` | perd `U` + coupons restants |
| **SHORT** | reçoit `U` | paie `r·U` | rend `U` | garde `U`, cesse de payer → **gain** |

Lecture : **LONG = parier qu'il n'y a pas défaut** (encaisser le portage). **SHORT = parier
sur le défaut** (payer le portage, gagner si ça explose) — l'équivalent d'**acheter de la
protection (CDS)**. Mappe directement sur la `direction` long/short existante (le short gagne
quand la valeur tombe à 0).

### Expiration → disparition → rollover

À RCE = 0 : le coupon **se règle** (principal rendu ou défaut), puis **disparaît**. Pour garder
de l'exposition crédit, le joueur **doit prendre un nouveau coupon** du carnet rafraîchi →
**taux différent + RCE différent** (risque de réinvestissement). C'est voulu.

---

## 7. Modèle de défaut (le branchement sur la cascade)

- Un coupon ne peut faire défaut **que pendant une crise active touchant le cluster crédit**.
- Proba de défaut/tour pendant la crise : croît avec **le taux du coupon** (juteux = risqué)
  et avec **`F` au déclenchement**. → IG fait rarement défaut, **HY souvent**.
- Le défaut tombe en **cascade** (plusieurs coupons d'un coup) → renforce le « tout corrélé
  en crise » et donne enfin au crédit son drame propre (aujourd'hui les crises sont
  pilotées par les actions).
- **TOUT-OU-RIEN** (décision actée) : pas de taux de recouvrement. Un coupon en défaut perd
  **tout** le principal `U` + les coupons restants. Plus punitif, plus lisible — le défaut
  doit faire mal pour que le portage HY soit un vrai pari, pas un péage.

---

## 8. Boucle avec la fragilité `F` (les deux sens)

Le crédit ne fait pas que **réagir** à `F` (via défaut/spread) — il doit aussi **l'alimenter** :

> **Reach-for-yield** : quand beaucoup de joueurs sont **LONG des coupons HY** (chasse au
> rendement), le notionnel agrégé en HY **nourrit `F`** (nouveau terme d'accumulation, ou
> via crowding crédit). Réaliste : les booms de crédit **précèdent** les krachs de crédit.

Ça **referme la boucle** : lire `F` pour jouer le crédit, et le crédit collectif fait monter
`F`. Le sous-jeu de taux devient un **moteur de fragilité** de plus, pas une annexe.

---

## 9. Intégration score & benchmark

- **P&L des coupons** (portage reçu/payé, principal, pertes de défaut) → cash → richesse →
  Track Record comme le reste. Les pertes de défaut creusent le **drawdown** → pénalisées
  par α (§27). Cohérent, rien à inventer côté score.
- **Benchmark = ALPHA PUR (décision actée)** : en sortant le crédit du monde `V`, le
  benchmark ne couvre **que les actions/alternatifs**. Le crédit devient de l'**alpha pur**
  — tes décisions de coupons sont jugées contre « ne rien faire » (0). Plus simple à coder
  et conceptuellement net : le coupon est un choix actif, pas une exposition passive.

---

## 10. Découpage en phases

**Phase 2a — cœur jouable**
1. Crédit sort du monde `V` ; carnet de 2 coupons (court/long) sur IG_EU/US/EM + HY_US.
2. Taux = r_BC + spreads (§3). BC = fonction de réaction lisible (§4b).
3. Long/short une fois, défaut en crise (§7), expiration → rollover.
4. Refonte benchmark (§9).

**Phase 2b — profondeur**
5. Reach-for-yield → `F` (§8).
6. FED node : info-edge → influence (§4c).
7. Calibrage individuel des spreads/maturités (instrument `calibrate.ts` étendu : neutralité
   long-coupon vs short-coupon vs actions, comme le duel levier/value de J7).

---

## 11. Décisions actées (2026-06-13) — spec close

- **Taille `U`** : ✅ **choisie une fois par le joueur** à l'ouverture, puis verrouillée
  (pas d'unité fixe). Conviction = taille + nombre de coupons.
- **Principal** : ✅ **vrai bond** — `U` rendu à l'échéance, perdu en défaut (le défaut a
  des dents).
- **Benchmark** : ✅ **alpha pur** — benchmark actions/alternatifs seul, crédit = alpha (§9).
- **Défaut** : ✅ **tout-ou-rien** (pas de recovery), plus punitif (§7).

**La spec est close. Implémentation : phase 2a (§10).**
