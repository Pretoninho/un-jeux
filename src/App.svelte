<script lang="ts">
  // Vue principale — PROTOTYPE d'exploration (gameplay à l'essai).
  // Le moteur (src/engine) est INCHANGÉ : le brouillard, le déplacement et le CHAIN
  // sont une couche d'UI. Les actions du joueur sont IMMÉDIATES (pas de retour arrière).
  // Simplifications de prototype : IA non spatiales · le flux des ouvertures immédiates
  // n'alimente pas l'impact-prix du tour · carte fixe 13 hexes (la mécanique vise une
  // carte procédurale large, memo §11).
  import { buildInitialState } from './engine/init';
  import { runTurn } from './engine/turn';
  import { policyForProfile } from './engine/ai';
  import { computeSignals } from './engine/signals';
  import { actorWealth, positionValue, lockTurnsLeft } from './engine/portfolio';
  import { openCouponPosition, type CouponMaturity } from './engine/credit';
  import { trackRecord } from './engine/score';
  import { makeRng, type Rng } from './engine/rng';
  import type { GameState, SignalReading } from './engine/state';
  import type { Hex } from './engine/types';
  import type { Policy } from './engine/policy';
  import { PA_PAR_TOUR } from './data/actions';
  import { presetExplore, PLAYABLE_ARCHETYPES } from './data/config-explore';
  import { hexFill, axialToPixel, hexPointsPointy, genBounds } from './lib/layout';
  import {
    isInvestable, isCredit, openCost as chainCost, canOpenAt, canOccupyAt, canMoveToAt,
    canTradeCouponAt, couponBuyMoves, canActOnPositionAt, activateWindow, readyInFromDisplay, activeLeftFromDisplay,
  } from './lib/interaction';

  let gs: GameState;
  let rng: Rng;
  let ai: Policy[];
  let prevV: Record<string, number> = {};
  let prevBcRate = 0; // taux directeur du tour précédent (pour la flèche de tendance BC)

  let seed = $state(1);
  let archetypeId = $state('vautour'); // archétype joué (sélecteur de nouvelle partie)
  let selected = $state<string | null>(null);
  let hexes = $state<Hex[]>([]);
  let log = $state<string[]>([]);
  let view = $state<ReturnType<typeof buildView>>();
  let read = $state<Set<string>>(new Set());
  let showDetail = $state(false);
  let debug = $state(false); // 🐞 révèle l'état caché (F, ancres) pour les tests
  let transactions = $state<Array<{ turn: number; label: string; dir: 'long' | 'short'; pnl: number }>>([]);
  let profileLabel = $state(''); // libellé du profil joué (lu depuis la config, pas codé en dur)
  let aiList = $state<Array<{ id: string; label: string; color: string }>>([]);

  // Palette des IA (footprint visible sur la carte — premier pas vers les acteurs spatiaux, memo §31).
  const AI_PALETTE = ['#e07a3a', '#5ab0a0', '#9b7ad9', '#c7a23a'];

  function recordTx(turn: number, hexId: string, dir: 'long' | 'short', pnl: number) {
    transactions = [{ turn, label: hexById(hexId)?.label ?? hexId, dir, pnl }, ...transactions].slice(0, 15);
  }

  // Couche d'exploration
  let playerHex = $state<string>('');
  let revealed = $state<Set<string>>(new Set());
  let presenceUntil = $state<Record<string, number>>({}); // nœud -> tour jusqu'auquel la présence est active
  const PRESENCE_TURNS = 3; // persistance après s'être installé (réglable ; futur bouton d'archétype)
  const isPresent = (id: string) => (presenceUntil[id] ?? -1) >= gs.turn;
  const presenceLeft = (id: string) => Math.max(0, (presenceUntil[id] ?? gs.turn) - gs.turn);
  // Présence active à un nœud d'un type donné (PB = liquidité, Notation = information).
  const hasNode = (type: string) => hexes.some((h) => h.kind === 'noeud' && h.nodeType === type && isPresent(h.id));
  const PB_BORROW_DISCOUNT = 0.5; // présence PB → coût d'emprunt × 0.5 (réglable ; futur bouton d'archétype)
  let paUsed = $state(0);
  let opensThisTurn = $state(0);
  let openDir = $state<'long' | 'short'>('long'); // sens de la prochaine ouverture
  let openLev = $state(0); // levier de la prochaine ouverture (0 = sans levier)
  let positions = $state<Record<string, [number, number]>>({}); // centres pixel par hexe
  let viewBox = $state('0 0 100 100');

  // isInvestable / isCredit / canOpenAt / canMoveToAt / openCost… : règles d'interaction PURES
  // importées de ./lib/interaction (testées hors DOM). Les closures ci-dessous ne font que leur
  // passer l'état réactif (revealed, position du joueur).

  // Descriptions génériques (carte générée → pas d'entrée dans le lexique fixe).
  const CLUSTER_DESC: Record<string, [string, string]> = {
    credit: ['Crédit', 'Obligations : beta faible, carry régulier, défensif. Sensible aux taux et aux spreads.'],
    actions: ['Actions', 'Grandes capitalisations : beta élevé, moteur de rendement, exposé aux corrections.'],
    alternatifs: ['Alternatifs', 'Immobilier / private equity : carry variable, illiquide, impact-prix marqué en sortie.'],
  };
  const NODE_DESC: Record<string, string> = {
    reglementaire: 'Banque centrale : fixe les taux. Présence = lecture anticipée des taux.',
    liquidite: 'Prime broker : levier moins cher, débloque le signal Financement.',
    information: 'Agence de notation : signaux moins bruités.',
  };
  function descOf(h?: Hex): { court: string; long: string } {
    if (!h) return { court: '', long: '' };
    if (h.kind === 'noeud') return { court: `${h.label} · nœud`, long: NODE_DESC[h.nodeType ?? ''] ?? '' };
    const c = CLUSTER_DESC[h.cluster ?? ''] ?? ['Marché', ''];
    return { court: c[0] + (h.kind === 'frontiere' ? ' — frontière (verrouillé)' : ''), long: c[1] };
  }
  const paLeft = () => PA_PAR_TOUR - paUsed - read.size;
  const openCost = () => chainCost(opensThisTurn);
  const hexById = (id: string) => hexes.find((h) => h.id === id);
  const neighborsOfPlayer = () => hexById(playerHex)?.neighbors ?? [];
  const canOpen = (id: string) => canOpenAt(hexById(id), revealed, neighborsOfPlayer());
  // S'installer : se déplacer sur un nœud adjacent (présence, sans investir).
  const canOccupy = (id: string) => canOccupyAt(hexById(id), revealed, neighborsOfPlayer());
  // Crédit tradable dès qu'il est révélé (proto : « on appelle le desk obligataire »).
  const canTradeCoupon = (id: string) => canTradeCouponAt(hexById(id), revealed);
  // Étiquette de risque de défaut, lue sur le spread STRUCTUREL de l'émetteur (IG ≈ 0.03).
  const riskLabel = (qs: number) => (qs <= 0.035 ? 'faible' : qs <= 0.055 ? 'moyen' : 'élevé');
  // Se déplacer (sans investir) : marcher sur un hexe TRAVERSABLE adjacent (marché V ou crédit,
  // frontière verrouillée comprise) — on traverse le crédit pour atteindre les nœuds derrière.
  const canMoveTo = (id: string) => canMoveToAt(hexById(id), revealed, neighborsOfPlayer());
  // Périmètre de CLÔTURE (§9bis) : on ne ferme/clôture une position que si on est dessus,
  // adjacent, ou dans le même cluster — sauf compétence `ignoreClosePerimeter` (verrou sauté).
  const canActOn = (id: string) =>
    canActOnPositionAt(id, playerHex, neighborsOfPlayer(), (h) => hexById(h)?.cluster,
      gs?.actors[0]?.ignoreClosePerimeter);

  function buildView() {
    const player = gs.actors[0]!;
    const wealth = actorWealth(player, gs.market);
    const tr = trackRecord(player, gs.benchmarkHistory, gs.params.drawdownPenalty);
    // Présence active à un nœud Notation → signaux plus nets (memo §11, §29.2).
    const infoActive = hasNode('information');
    const sig: SignalReading = computeSignals(gs, makeRng(gs.rngSeed * 1000003 + gs.turn), infoActive ? 0.5 : 1);
    const market: Record<string, number> = {};
    const delta: Record<string, number> = {};
    const anchorByHex: Record<string, number> = {}; // ancre A cachée (debug)
    for (const [id, m] of Object.entries(gs.market)) {
      market[id] = m.V;
      delta[id] = m.V - (prevV[id] ?? m.V);
      anchorByHex[id] = m.A;
    }
    // P&L latent (non réalisé) : valeur courante des positions − capital engagé.
    let latentTotal = 0;
    const latentByHex: Record<string, number> = {};
    for (const p of player.positions) {
      const v = gs.market[p.hexId]?.V ?? p.entryV;
      const l = positionValue(p, v) - p.equity;
      latentTotal += l;
      latentByHex[p.hexId] = (latentByHex[p.hexId] ?? 0) + l;
    }
    // Levier max par hexe (pour l'affichage).
    const leverageByHex: Record<string, number> = {};
    for (const p of player.positions) {
      leverageByHex[p.hexId] = Math.max(leverageByHex[p.hexId] ?? 0, p.leverage);
    }
    // Verrou d'illiquidité : tours restants avant sortie, par hexe détenu (spec immo).
    const lockByHex: Record<string, number> = {};
    for (const hid of new Set(player.positions.map((p) => p.hexId))) {
      const left = lockTurnsLeft(hid, player, gs);
      if (left > 0) lockByHex[hid] = left;
    }
    // Footprint des IA : couleurs des adversaires présents par hexe (memo §31).
    const aiPresence: Record<string, string[]> = {};
    for (let i = 1; i < gs.actors.length; i++) {
      const color = AI_PALETTE[(i - 1) % AI_PALETTE.length]!;
      for (const hid of new Set(gs.actors[i]!.positions.map((p) => p.hexId))) {
        (aiPresence[hid] ??= []).push(color);
      }
    }
    return {
      turn: gs.turn,
      horizon: gs.params.horizonTurns,
      regime: gs.regime,
      cash: player.cash,
      wealth,
      held: new Set(player.positions.map((p) => p.hexId)),
      exposure: player.positions.reduce<Record<string, { long: number; short: number; total: number }>>((acc, p) => {
        const e = (acc[p.hexId] ??= { long: 0, short: 0, total: 0 });
        e[p.direction] += p.equity;
        e.total += p.equity;
        return acc;
      }, {}),
      market,
      delta,
      latentTotal,
      latentByHex,
      leverageByHex,
      lockByHex,
      lockupTurns: gs.params.lockupTurns,
      aiPresence,
      pbActive: hasNode('liquidite'), // débloque le Financement + levier moins cher (memo §11)
      bcActive: hasNode('reglementaire'), // présence Banque centrale → cible de taux anticipée (memo §11)
      infoActive,
      // État caché révélé en mode debug uniquement.
      fReal: gs.fragility,
      regimeReal: gs.regime,
      crisisPhase: gs.crisis.active ? gs.crisis.phase : gs.crisis.recoveryTurnsLeft > 0 ? 'recovery' : 'none',
      anchorByHex,
      signals: sig,
      marketWealth: 100 * (gs.benchmarkHistory.at(-1) ?? 1), // benchmark en valeur (capital départ = 100)
      track: { you: wealth / 100 - 1, market: (gs.benchmarkHistory.at(-1) ?? 1) - 1, drawdown: tr.maxDrawdown },
      over: gs.turn >= gs.params.horizonTurns,
      // Crédit-coupons : taux directeur (lit F en filigrane), carnet offert, coupons détenus.
      bcRate: gs.credit.bc.rate,
      bcDelta: gs.credit.bc.rate - prevBcRate,
      bcTarget: gs.credit.bc.target, // cible de la fonction de réaction (révélée par la présence BC)
      cashCarryFloor: gs.params.cashCarryFloor, // franchise : la réserve au-dessus encaisse r_BC
      // Vautour : contrainte (pas de levier) + ressource « Réserve sèche » (poudre → décote de krach).
      noLeverage: !!player.noLeverage,
      dryPowder: player.dryPowder ?? 0,
      dryPowderMax: player.dryPowderCfg?.max ?? 0,
      // Sismographe : jauge de fragilité F innée + thêta de couverture (fragile au calme).
      fragilityGauge: !!player.fragilityGauge,
      calmTheta: player.calmTheta ?? 0,
      inCrisis: gs.crisis.active,
      // Compétence « Récolte » (Vautour) : carry ×factor pendant duration tours, cooldown.
      // L'activation vise la PROCHAINE résolution (tour gs.turn+1) → décalage d'un tour.
      hasCarrySkill: !!player.carrySkill,
      skillFactor: player.carrySkill?.factor ?? 0,
      skillDuration: player.carrySkill?.duration ?? 0,
      skillPaCost: player.carrySkill?.paCost ?? 0,
      skillReadyIn: player.carrySkill ? readyInFromDisplay(gs.turn, player.carrySkillReadyAt ?? 0) : 0,
      skillActiveLeft: player.carrySkill ? activeLeftFromDisplay(gs.turn, player.carryBoostUntil ?? -1) : 0,
      // Compétence « Couverture » (Vautour) : armer (auto-tir) → anti-défaut des coupons N tours.
      hasCoverSkill: !!player.coverSkill,
      coverWindow: player.coverSkill?.window ?? 0,
      coverPaCost: player.coverSkill?.paCost ?? 0,
      coverReadyIn: player.coverSkill ? readyInFromDisplay(gs.turn, player.coverReadyAt ?? 0) : 0,
      coverArmedLeft: player.coverSkill ? activeLeftFromDisplay(gs.turn, player.coverArmedUntil ?? -1) : 0,
      bcMeetingEvery: gs.params.bcMeetingEvery, // cadence des réunions (taux figé entre deux)
      // Tours avant la prochaine réunion (0 = mode continu). Réunion = tour multiple de la cadence.
      bcNextMeetingIn: gs.params.bcMeetingEvery <= 1 ? 0 : (Math.floor(gs.turn / gs.params.bcMeetingEvery) + 1) * gs.params.bcMeetingEvery - gs.turn,
      couponBook: gs.credit.book.map((c) => ({ issuer: c.issuer, maturity: c.maturity, rate: c.rate, rce: c.rce, qualitySpread: c.qualitySpread })),
      couponPositions: player.couponPositions.map((cp) => ({ issuer: cp.issuer, side: cp.side, rate: cp.rate, notional: cp.notional, rceLeft: cp.rceLeft, qualitySpread: cp.qualitySpread })),
    };
  }

  function reveal(id: string) {
    const next = new Set(revealed);
    next.add(id);
    for (const n of hexById(id)?.neighbors ?? []) next.add(n);
    revealed = next;
  }

  function newGame(s: number) {
    const arch = PLAYABLE_ARCHETYPES.find((a) => a.id === archetypeId) ?? PLAYABLE_ARCHETYPES[0]!;
    const cfg = presetExplore(s, 4, arch);
    profileLabel = cfg.archetype.label;
    aiList = cfg.adversaires.map((a, i) => ({ id: a.id, label: a.label, color: AI_PALETTE[i % AI_PALETTE.length]! }));
    const init = buildInitialState(cfg);
    gs = init.state;
    rng = init.rng;
    ai = cfg.adversaires.map(policyForProfile);
    hexes = gs.map.hexes;
    prevV = Object.fromEntries(Object.entries(gs.market).map(([id, m]) => [id, m.V]));
    prevBcRate = gs.credit.bc.rate;
    // Centres pixel depuis les coordonnées axiales + viewBox englobante.
    const centers: Array<[number, number]> = [];
    positions = {};
    for (const h of hexes) {
      const c = h.coord ? axialToPixel(h.coord.q, h.coord.r) : [0, 0] as [number, number];
      positions[h.id] = c;
      centers.push(c);
    }
    const b = genBounds(centers);
    viewBox = `${b.minX.toFixed(1)} ${b.minY.toFixed(1)} ${b.w.toFixed(1)} ${b.h.toFixed(1)}`;
    // Spawn sur un hexe marché au hasard (reproductible par seed).
    const spawnable = hexes.filter(isInvestable).map((h) => h.id);
    const spw = makeRng(s * 7 + 1);
    playerHex = spawnable[spw.int(0, spawnable.length - 1)] ?? spawnable[0]!;
    revealed = new Set();
    presenceUntil = {};
    reveal(playerHex);
    paUsed = 0;
    opensThisTurn = 0;
    read = new Set();
    transactions = [];
    selected = playerHex;
    showDetail = false;
    log = [`Apparition en ${hexById(playerHex)?.label} — seed ${s}`];
    view = buildView();
  }

  // Actions IMMÉDIATES (mutent l'acteur joueur ; le moteur résout le marché à Fin du tour).
  function spend(cost: number) {
    paUsed += cost;
    view = buildView();
  }

  // Réserve sèche (Vautour) : déployer en HAUTE FRAGILITÉ décote l'entrée (achat au creux du
  // krach), à hauteur de la poudre accumulée — puis on la consomme. F reste cachée (effet silencieux).
  function vautourEntry(hexId: string): number {
    const player = gs.actors[0]!;
    const V = gs.market[hexId]!.V;
    const cfg = player.dryPowderCfg;
    const powder = player.dryPowder ?? 0;
    if (cfg && gs.fragility > cfg.fThreshold && powder > 0) {
      player.dryPowder = 0; // poudre dépensée
      return V * (1 - Math.min(cfg.maxDiscount, powder * cfg.discountPerPowder));
    }
    return V;
  }

  function open(hexId: string, frac: number, direction: 'long' | 'short') {
    const here = hexId === playerHex; // investir « ici » (hexe courant) = sans se déplacer
    const h = hexById(hexId);
    const valid = here ? !!h && isInvestable(h) : canOpen(hexId);
    const cost = here ? 1 : openCost(); // sur place = 1 PA fixe (pas de mouvement, pas de CHAIN)
    if (view?.over || !valid || paLeft() < cost) return;
    const player = gs.actors[0]!;
    const equity = player.cash * frac;
    if (equity <= 0) return;
    // Illiquidité (spec immo) : long-only + sans levier ; entryTurn arme le verrou.
    // Levier 0 si illiquide OU contrainte noLeverage (Vautour). Entrée décotée si Réserve sèche.
    const dir = h?.longOnly ? 'long' : direction;
    const lev = (h?.illiquid || player.noLeverage) ? 0 : openLev;
    player.cash -= equity;
    player.positions.push({ hexId, direction: dir, equity, leverage: lev, entryV: vautourEntry(hexId), entryTurn: gs.turn });
    if (!here) {
      playerHex = hexId; // déplacement
      reveal(hexId); // révèle les nouveaux voisins
      opensThisTurn += 1;
    }
    selected = hexId;
    log = [`${here ? 'Investit' : 'Ouvre'} ${dir === 'short' ? 'SHORT' : 'LONG'} ${h?.label} (${cost} PA)`, ...log].slice(0, 8);
    spend(cost);
  }

  // Ouvre une position sur un coupon offert (crédit hors-V) : long XOR short, taille
  // verrouillée. Calqué sur `open` : mute le joueur immédiatement, le cycle de vie
  // (portage/défaut/échéance) est résolu par runTurn à la fin du tour.
  function openCoupon(issuer: string, maturity: CouponMaturity, side: 'long' | 'short', frac: number) {
    if (view?.over || paLeft() < 1) return;
    const player = gs.actors[0]!;
    const offered = gs.credit.book.find((c) => c.issuer === issuer && c.maturity === maturity);
    if (!offered) return;
    const notional = player.cash * frac;
    if (notional <= 0) return;
    const res = openCouponPosition(gs.credit, offered.id, side, notional);
    if (!res) return;
    player.cash += res.entryCash; // long −U, short +U
    player.couponPositions.push(res.position);
    // Investir sur un crédit = aller sur la case : on s'y déplace si on y est adjacent (le crédit
    // est traversable). Émetteur lointain (desk à distance) = trade en place, sans téléportation.
    if (couponBuyMoves(issuer, playerHex, neighborsOfPlayer())) {
      playerHex = issuer;
      reveal(issuer); // révèle les nouveaux voisins
    }
    selected = issuer;
    log = [`Coupon ${side === 'long' ? 'LONG' : 'SHORT'} ${hexById(issuer)?.label} ${maturity} · ${notional.toFixed(0)} @ ${(offered.rate * 100).toFixed(1)}%/t`, ...log].slice(0, 8);
    opensThisTurn += 1; // le crédit est une ouverture de position → compte dans le CHAIN (la
    //                     prochaine position sur un AUTRE actif sera un enchaînement, 2 PA).
    spend(1); // coût du crédit lui-même : 1 PA fixe (appel du desk, pas de surcoût CHAIN)
  }

  function occupy(hexId: string) {
    const cost = openCost(); // un déplacement : même contrainte de CHAIN que les ouvertures
    if (view?.over || !canOccupy(hexId) || paLeft() < cost) return;
    playerHex = hexId; // déplacement, sans position ni capital engagé
    presenceUntil = { ...presenceUntil, [hexId]: gs.turn + PRESENCE_TURNS }; // présence pour ~3 tours
    reveal(hexId);
    opensThisTurn += 1;
    selected = hexId;
    log = [`S'installe sur ${hexById(hexId)?.label} (${cost} PA)`, ...log].slice(0, 8);
    spend(cost);
  }

  // DÉPLACER : se déplacer sur un hexe traversable adjacent (marché V ou crédit) SANS
  // investir (1 PA, primitive). Traverser le crédit = atteindre les nœuds derrière.
  function deplacer(hexId: string) {
    if (view?.over || !canMoveTo(hexId) || paLeft() < 1) return;
    playerHex = hexId;
    reveal(hexId);
    selected = hexId;
    log = [`Se déplace en ${hexById(hexId)?.label} (1 PA)`, ...log].slice(0, 8);
    spend(1);
  }

  function reinforce(hexId: string) {
    if (view?.over || !view?.held.has(hexId) || paLeft() < 1) return;
    const player = gs.actors[0]!;
    const equity = player.cash * 0.25;
    if (equity <= 0) return;
    const h = hexById(hexId);
    // Renforce dans le sens dominant déjà détenu sur l'hexe (forcé long si longOnly).
    const dir = h?.longOnly ? 'long' : ((view.exposure[hexId]?.short ?? 0) > (view.exposure[hexId]?.long ?? 0) ? 'short' : 'long');
    const lev = (h?.illiquid || player.noLeverage) ? 0 : openLev;
    player.cash -= equity;
    // entryTurn : renforcer un illiquide RE-VERROUILLE (la tranche la plus récente fait foi).
    player.positions.push({ hexId, direction: dir, equity, leverage: lev, entryV: vautourEntry(hexId), entryTurn: gs.turn });
    spend(1);
  }

  function partial(hexId: string) {
    if (view?.over || !view?.held.has(hexId) || paLeft() < 2) return;
    if (lockTurnsLeft(hexId, gs.actors[0]!, gs) > 0) return; // illiquide encore verrouillé
    if (!canActOn(hexId)) return; // hors périmètre de clôture (§9bis)
    const player = gs.actors[0]!;
    for (const p of player.positions) {
      if (p.hexId !== hexId) continue;
      const value = positionValue(p, gs.market[hexId]!.V);
      player.cash += 0.5 * Math.max(0, value);
      recordTx(gs.turn, hexId, p.direction, 0.5 * (value - p.equity)); // P&L réalisé sur la moitié
      p.equity *= 0.5;
    }
    spend(2);
  }

  function close(hexId: string) {
    if (view?.over || !view?.held.has(hexId) || paLeft() < 1) return;
    if (lockTurnsLeft(hexId, gs.actors[0]!, gs) > 0) return; // illiquide encore verrouillé
    if (!canActOn(hexId)) return; // hors périmètre de clôture (§9bis)
    const player = gs.actors[0]!;
    const kept = [];
    for (const p of player.positions) {
      if (p.hexId === hexId) {
        const value = positionValue(p, gs.market[hexId]!.V);
        player.cash += Math.max(0, value);
        recordTx(gs.turn, hexId, p.direction, value - p.equity); // P&L réalisé
      } else kept.push(p);
    }
    player.positions = kept;
    spend(1);
  }

  // Compétence « Récolte » (Vautour) : arme le boost de carry pour les prochains tours.
  // L'activation cible la PROCHAINE résolution (state.turn = gs.turn+1) → cohérent avec le moteur.
  function useSkill() {
    const player = gs.actors[0]!;
    const sk = player.carrySkill;
    if (!sk || view?.over || paLeft() < sk.paCost) return;
    const nextTurn = gs.turn + 1;
    if (nextTurn < (player.carrySkillReadyAt ?? 0)) return; // encore en cooldown
    const w = activateWindow(nextTurn, sk.duration, sk.cooldown);
    player.carryBoostUntil = w.activeUntil; // boosté pendant `duration` résolutions
    player.carrySkillReadyAt = w.readyAt; // réutilisable après le cooldown
    log = [`🦅 Récolte activée — carry ×${sk.factor} pendant ${sk.duration} tour(s) (${sk.paCost} PA)`, ...log].slice(0, 8);
    spend(sk.paCost);
  }

  // « Couverture » (Vautour) : arme l'anti-défaut pour les prochains tours (auto-tir en crise).
  function armCover() {
    const player = gs.actors[0]!;
    const sk = player.coverSkill;
    if (!sk || view?.over || paLeft() < sk.paCost) return;
    const nextTurn = gs.turn + 1;
    if (nextTurn < (player.coverReadyAt ?? 0)) return; // encore en cooldown
    const w = activateWindow(nextTurn, sk.window, sk.cooldown);
    player.coverArmedUntil = w.activeUntil; // protégé pendant `window` résolutions
    player.coverReadyAt = w.readyAt; // ré-armable après le cooldown
    log = [`🛡️ Couverture armée — coupons protégés du défaut ${sk.window} tour(s) (${sk.paCost} PA)`, ...log].slice(0, 8);
    spend(sk.paCost);
  }

  function readSignal(name: string) {
    if (view?.over || read.has(name) || paLeft() < 1) return;
    if (name === 'financement' && !view?.pbActive) return; // Financement nécessite la présence au PB
    read = new Set(read).add(name);
  }

  // 🐞 Test : force F juste sous le plafond → la prochaine Fin du tour déclenche une crise
  // quasi certaine (memo §23.4). Sert à tester le défaut des coupons en crise de façon
  // reproductible. Debug uniquement.
  function forceHighF() {
    if (!gs || view?.over) return;
    gs.fragility = 0.84; // plafond = 0.85 → proba de crise ≈ 1
    log = ['🐞 F forcée à 0.84 — finis le tour pour déclencher la cascade', ...log].slice(0, 8);
    view = buildView();
  }

  function endTurn() {
    if (!view || view.over) return;
    prevV = Object.fromEntries(Object.entries(gs.market).map(([id, m]) => [id, m.V]));
    prevBcRate = gs.credit.bc.rate; // capture avant résolution → flèche de tendance BC
    gs.actors[0]!.borrowMultiplier = hasNode('liquidite') ? PB_BORROW_DISCOUNT : 1; // présence PB → emprunt moins cher
    const human: Policy = { id: 'human', decide: () => [{ verb: 'RESERVER' }] };
    runTurn(gs, [human, ...ai], rng);
    paUsed = 0;
    opensThisTurn = 0;
    read = new Set();
    log = [`Tour ${gs.turn} · ${gs.regime}`, ...log].slice(0, 8);
    view = buildView();
  }

  const fmtPct = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;

  newGame(1);
</script>

<main>
  <header>
    <div class="brand">
      <div class="title">un-jeux <span class="sub">· {profileLabel} · exploration (proto)</span></div>
      <div class="tagline">Enrichis-toi tant que la fête dure — sors avant que tout s'effondre.</div>
    </div>
    {#if view}
      <div class="status">
        <span>Tour <b>{view.turn}/{view.horizon}</b></span>
        <span>Régime <b class:crise={view.regime === 'crise'}>{view.regime}</b></span>
        <span class="track">
          Vous <b class:neg={view.track.you < 0}>{view.wealth.toFixed(0)}</b> <span class="pct">({fmtPct(view.track.you)})</span>
          · Marché <b>{view.marketWealth.toFixed(0)}</b> <span class="pct">({fmtPct(view.track.market)})</span>
          · Écart <b class:neg={view.wealth < view.marketWealth}>{(view.wealth - view.marketWealth >= 0 ? '+' : '') + (view.wealth - view.marketWealth).toFixed(0)}</b>
          · Pire séquence <b class="neg">−{(view.track.drawdown * 100).toFixed(0)}%</b>
        </span>
      </div>
    {/if}
  </header>

  {#if view}
    <div class="board">
      <svg viewBox={viewBox} class="map">
        {#each hexes as h (h.id)}
          {@const pos = positions[h.id]}
          {#if pos}
            {@const shown = revealed.has(h.id)}
            {@const d = view.delta[h.id] ?? 0}
            <g
              class="hex"
              class:selected={selected === h.id}
              class:owned={view.held.has(h.id)}
              class:here={playerHex === h.id}
              class:openable={canMoveTo(h.id) || canOccupy(h.id)}
              class:presence={isPresent(h.id)}
              role="button"
              tabindex="0"
              onclick={() => shown && (selected = h.id)}
              onkeydown={(e) => e.key === 'Enter' && shown && (selected = h.id)}
            >
              <title>{shown ? descOf(h).court : 'Inexploré'}</title>
              {#if shown}
                <polygon points={hexPointsPointy(pos[0], pos[1])} fill={hexFill(h.kind, h.cluster)} class:frontier={h.kind === 'frontiere'} />
                {#if playerHex === h.id}<circle cx={pos[0]} cy={pos[1] - 17} r="4" class="token" />{/if}
                {#if view.aiPresence[h.id]}
                  {@const cols = view.aiPresence[h.id] ?? []}
                  {#each cols as col, i}
                    <circle cx={pos[0] - (cols.length - 1) * 4 + i * 8} cy={pos[1] - 24} r="3" fill={col} stroke="#0e1015" stroke-width="0.5" />
                  {/each}
                {/if}
                <text x={pos[0]} y={pos[1] - 5} class="label">{h.label}</text>
                {#if isInvestable(h)}
                  <text x={pos[0]} y={pos[1] + 9} class="vval" class:up={d > 0.05} class:down={d < -0.05}>
                    {view.market[h.id]?.toFixed(0)}{d > 0.05 ? ' ▲' : d < -0.05 ? ' ▼' : ''}
                  </text>
                {/if}
                {#if view.held.has(h.id)}
                  {@const e = view.exposure[h.id]}
                  {@const net = (e?.short ?? 0) > (e?.long ?? 0) ? 'S' : 'L'}
                  <text x={pos[0]} y={pos[1] + 21} class="expo" class:short={net === 'S'}>{net} {e?.total.toFixed(0)}</text>
                {/if}
                {#if isPresent(h.id)}<text x={pos[0]} y={pos[1] + 21} class="pres">★ {presenceLeft(h.id)}t</text>{/if}
              {:else}
                <polygon points={hexPointsPointy(pos[0], pos[1])} class="fog" />
                <text x={pos[0]} y={pos[1] + 4} class="fogq">?</text>
              {/if}
            </g>
          {/if}
        {/each}
      </svg>

      <aside>
        <section class="legend">
          <h3>Carte <span class="hint">qui est où</span></h3>
          <div class="leg-row"><span class="dot you"></span> Vous (token blanc)</div>
          {#each aiList as ai}
            <div class="leg-row"><span class="dot" style="background:{ai.color}"></span> {ai.label}</div>
          {/each}
          <div class="muted small">Présence IA visible seulement sur les hexes révélés.</div>
        </section>

        {#if debug}
          <section class="debug">
            <h3>🐞 Debug <span class="hint">état caché</span></h3>
            <div class="bar-row">
              <span>Fragilité F</span>
              <div class="bar"><div class="fill" style="width:{view.fReal * 100}%"></div></div>
            </div>
            <div class="small">F = <b>{view.fReal.toFixed(3)}</b> · {view.fReal < 0.4 ? 'zone morte (pas de crise possible)' : view.fReal >= 0.85 ? 'PLAFOND (krach imminent)' : 'zone roulette'}</div>
            <div class="small">Régime réel : <b>{view.regimeReal}</b>{#if view.crisisPhase !== 'none'} · phase <b>{view.crisisPhase}</b>{/if}</div>
            <div class="muted small">A = ancre cachée (juste valeur), visible par hexe sélectionné.</div>
            <button onclick={forceHighF} disabled={view.over}>💥 Forcer F haut → crise au prochain tour</button>
            <div class="muted small">Test du défaut des coupons : prends un LONG sur un crédit « risque élevé », clique ici, puis Fin du tour.</div>
          </section>
        {/if}

        <section class="signals">
          <h3>Signaux <span class="hint">{view.infoActive ? '✨ Notation : plus nets' : '~ bruités, F cachée'}</span></h3>
          <div class="bar-row">
            <span>Volatilité</span>
            <div class="bar"><div class="fill" style="width:{view.signals.volatilite * 100}%"></div></div>
          </div>
          <div class="bar-row">
            <span>Écart crédit</span>
            {#if read.has('ecartCredit')}
              <div class="bar"><div class="fill" style="width:{view.signals.ecartCredit * 100}%"></div></div>
            {:else}
              <button class="lire" onclick={() => readSignal('ecartCredit')} disabled={view.over || paLeft() < 1}>LIRE · 1 PA</button>
            {/if}
          </div>
          <!-- Financement : présence active au PB = flux CONTINU gratuit (desk posté, memo §17) ; sinon verrouillé -->
          <div class="bar-row">
            <span>Financement</span>
            {#if view.pbActive}
              <div class="bar"><div class="fill" style="width:{view.signals.financement * 100}%"></div></div>
            {:else}
              <span class="locked">🔒 présence PB requise</span>
            {/if}
          </div>
        </section>

        {#if view.fragilityGauge}
          <section class="sismo">
            <h3>🌋 Jauge sismique <span class="hint">fragilité cachée</span></h3>
            <div class="bar-row">
              <span>Fragilité F</span>
              <div class="bar"><div class="fill" style="width:{Math.min(100, view.fReal * 100)}%"></div></div>
            </div>
            <div class="small">F = <b>{view.fReal.toFixed(2)}</b> · {view.fReal < 0.4 ? 'zone morte — aucun krach possible' : view.fReal >= 0.85 ? '⚠️ PLAFOND — krach imminent' : 'zone roulette — ça peut sauter (proba ↑ avec F)'}</div>
            <div class="muted small">🎯 <b>Le Grand Pari</b> : zone rouge → <b>SHORT</b> le krach (pari directionnel) ou cash · creux → frappe <b>LONG</b> all-in. Tu vois la magnitude, pas la date (roulette).</div>
            <div class="muted small">{view.inCrisis ? '🔥 Crise : tes couvertures paient (pas de thêta).' : `🩸 Thêta de couverture : −${(view.calmTheta * 100).toFixed(1)}%/tour au calme (tu fonds tant que rien ne tremble).`}</div>
          </section>
        {/if}

        <section class="credit">
          <h3>Crédit · Banque centrale <span class="hint">taux directeur</span></h3>
          <div class="bar-row">
            <span>Taux BC</span>
            <span><b>{(view.bcRate * 100).toFixed(2)}%</b>
              {#if view.bcDelta > 0.0005}<span class="down"> ▲ a resserré (surchauffe)</span>
              {:else if view.bcDelta < -0.0005}<span class="up"> ▼ a soutenu (crise)</span>
              {:else if view.bcMeetingEvery > 1}<span class="muted"> — figé hors réunion</span>
              {:else}<span class="muted"> — stable</span>{/if}
            </span>
          </div>
          {#if view.bcMeetingEvery > 1}
            <div class="court" style="margin:.2rem 0">🏛️ Réunions <b>tous les {view.bcMeetingEvery} tours</b> · prochaine dans <b class:down={view.bcNextMeetingIn <= 1}>{view.bcNextMeetingIn} tour{view.bcNextMeetingIn > 1 ? 's' : ''}</b> — taux figé d'ici là.</div>
          {/if}
          {#if view.bcActive}
            <div class="bar-row">
              <span>{view.bcMeetingEvery > 1 ? 'Décision réunion ✨' : 'Cible BC ✨'}</span>
              <span><b>{(view.bcTarget * 100).toFixed(2)}%</b>
                {#if view.bcTarget - view.bcRate > 0.0005}<span class="down"> ▲ va resserrer</span>
                {:else if view.bcTarget - view.bcRate < -0.0005}<span class="up"> ▼ va soutenir</span>
                {:else}<span class="muted"> — inchangé</span>{/if}
              </span>
            </div>
            <div class="muted small">✨ Présence Banque centrale : {view.bcMeetingEvery > 1 ? 'la décision de la prochaine réunion, lue à l\'avance (forward guidance)' : 'cible de taux anticipée'} — où la BC pose le taux avant qu'il n'y arrive.</div>
          {:else}
            <div class="muted small">Monte en surchauffe, coupe en crise — son ton trahit la fragilité cachée{#if view.bcMeetingEvery > 1}, mais figé entre les réunions{/if}.</div>
          {/if}
          {#if view.couponPositions.length}
            <div class="court" style="margin-top:.4rem">Coupons détenus :</div>
            {#each view.couponPositions as cp}
              <div class="tx-row">
                <span><span class:long-tag={cp.side === 'long'} class:short-tag={cp.side === 'short'}>{cp.side === 'long' ? 'L' : 'S'}</span>
                  {hexById(cp.issuer)?.label} · {cp.notional.toFixed(0)} @ {(cp.rate * 100).toFixed(1)}%/t</span>
                <b>RCE {cp.rceLeft}t · risque {riskLabel(cp.qualitySpread)}</b>
              </div>
            {/each}
          {:else}
            <div class="muted small">Aucun coupon détenu.</div>
          {/if}
        </section>

        <section class="actions">
          <h3>Actions <span class="pa">{paLeft()} / {PA_PAR_TOUR} PA</span></h3>
          <div class="chain">Prochaine ouverture : <b>{openCost()} PA</b>{opensThisTurn > 0 ? ' (CHAIN)' : ''}</div>
          {#if selected}
            {@const h = hexById(selected)}
            {@const held = view.held.has(selected)}
            {@const here = playerHex === selected}
            {@const canInvest = canOpen(selected) || (here && !!h && isInvestable(h))}
            {@const credit = isCredit(h)}
            {@const illiquid = !!h?.illiquid}
            {@const longOnly = !!h?.longOnly}
            {@const locked = view.lockByHex[selected] ?? 0}
            {@const oCost = here ? 1 : openCost()}
            <div class="sel">
              <b>{descOf(h).court}</b>{#if playerHex === selected}<span class="muted small"> · vous êtes ici</span>{/if}
              <button class="qmark" onclick={() => (showDetail = !showDetail)} title="Explication">?</button>
            </div>
            {#if held}
              {@const e = view.exposure[selected]}
              {@const lat = view.latentByHex[selected] ?? 0}
              <div class="court">Exposition : <b>{e?.total.toFixed(0)}</b>
                {#if e?.long}<span class="long-tag">long {e.long.toFixed(0)}</span>{/if}
                {#if e?.short}<span class="short-tag">short {e.short.toFixed(0)}</span>{/if}
                · P&L latent <b class:up={lat > 0.5} class:down={lat < -0.5}>{lat >= 0 ? '+' : ''}{lat.toFixed(1)}</b>
                {#if view.leverageByHex[selected]}· levier <b>{view.leverageByHex[selected]}×</b>{/if}
              </div>
              {#if locked > 0}<div class="court lockwarn">🔒 Verrouillé — sortie impossible avant <b>{locked} tour{locked > 1 ? 's' : ''}</b> (illiquide).</div>{/if}
            {/if}
            {#if showDetail}<div class="long">{descOf(h).long}</div>{/if}
            {#if debug && h && (h.kind === 'marche' || h.kind === 'frontiere')}
              <div class="small" style="color:#9b7ad9">🐞 V {view.market[selected]?.toFixed(1)} · A {view.anchorByHex[selected]?.toFixed(1)} · écart {(((view.market[selected] ?? 0) / (view.anchorByHex[selected] ?? 1) - 1) * 100).toFixed(0)}%</div>
            {/if}

            {#if canInvest}
              {#if illiquid}
                <div class="muted small">🔒 <b>Illiquide</b> — long-only, sans levier · sortie bloquée <b>{view.lockupTurns} tours</b> après l'ouverture (carry élevé = prime d'illiquidité).</div>
              {/if}
              <div class="dir-row" class:longonly={longOnly}>
                <span>Sens</span>
                <button class:active={openDir === 'long'} onclick={() => (openDir = 'long')}>LONG</button>
                {#if !longOnly}
                  <button class:active={openDir === 'short'} onclick={() => (openDir = 'short')}>SHORT</button>
                {/if}
              </div>
              {#if illiquid}
                <!-- levier déjà interdit (illiquide) -->
              {:else if view.noLeverage}
                <div class="muted small">🚫 <b>Sans levier</b> — capital patient (contrainte du Vautour) : pas d'amplification.</div>
              {:else}
                <div class="lev-row">
                  <span>Levier</span>
                  <button class:active={openLev === 0} onclick={() => (openLev = 0)}>0×</button>
                  <button class:active={openLev === 2} onclick={() => (openLev = 2)}>2×</button>
                  <button class:active={openLev === 3} onclick={() => (openLev = 3)}>3×</button>
                </div>
                {#if openLev > 0}<div class="muted small">⚠️ amplifie gains ET pertes · intérêt d'emprunt chaque tour · risque d'appel de marge{#if view.pbActive} · <span style="color:#5ab0a0">PB actif : intérêt −50%</span>{/if}</div>{/if}
              {/if}
              <div class="open-row">
                <span>{here ? 'Ouvrir ici' : 'Ouvrir & aller'}</span>
                <button onclick={() => open(selected!, 0.25, openDir)} disabled={paLeft() < oCost}>25%</button>
                <button onclick={() => open(selected!, 0.5, openDir)} disabled={paLeft() < oCost}>50%</button>
                <button onclick={() => open(selected!, 1, openDir)} disabled={paLeft() < oCost}>100%</button>
              </div>
            {/if}
            {#if canOccupy(selected)}
              <button onclick={() => occupy(selected!)} disabled={paLeft() < openCost()}>S'installer (présence) · {openCost()} PA</button>
            {/if}

            {#if credit}
              <div class="court">Émetteur de crédit — <b>coupons</b> (hors marché V).</div>
              {#if canTradeCoupon(selected)}
                <div class="dir-row">
                  <span>Sens</span>
                  <button class:active={openDir === 'long'} onclick={() => (openDir = 'long')}>LONG · no-défaut</button>
                  <button class:active={openDir === 'short'} onclick={() => (openDir = 'short')}>SHORT · défaut</button>
                </div>
                {#each ['court', 'long'] as const as mat}
                  {@const c = view.couponBook.find((x) => x.issuer === selected && x.maturity === mat)}
                  {#if c}
                    <div class="coupon">
                      <div class="small"><b>{mat === 'court' ? 'Court' : 'Long'}</b> · <b>{(c.rate * 100).toFixed(1)}%</b>/tour · échéance <b>{c.rce}t</b> · risque de défaut <b>{riskLabel(c.qualitySpread)}</b></div>
                      <div class="open-row">
                        <span>Taille</span>
                        <button onclick={() => openCoupon(selected!, mat, openDir, 0.25)} disabled={paLeft() < 1}>25%</button>
                        <button onclick={() => openCoupon(selected!, mat, openDir, 0.5)} disabled={paLeft() < 1}>50%</button>
                        <button onclick={() => openCoupon(selected!, mat, openDir, 1)} disabled={paLeft() < 1}>100%</button>
                      </div>
                    </div>
                  {/if}
                {/each}
                <div class="muted small">Long : encaisse le portage, perd le principal si défaut. Short : paie le portage, gagne si défaut. Une fois par coupon, taille verrouillée · 1 PA.</div>
              {:else}
                <div class="muted small">Émetteur non révélé — explore pour y accéder.</div>
              {/if}
            {/if}
            {#if canMoveTo(selected)}<button onclick={() => deplacer(selected!)} disabled={paLeft() < 1}>Se déplacer (sans investir) · 1 PA{#if credit} · traverser le crédit{/if}</button>{/if}
            {#if isPresent(selected)}<div class="court">Présence active — <b>{presenceLeft(selected)}</b> tour(s) restant(s){#if hexById(selected)?.nodeType === 'liquidite'} · débloque le <b>Financement</b> + <b>levier −50%</b>{/if}{#if hexById(selected)?.nodeType === 'information'} · <b>signaux plus nets</b>{/if}{#if hexById(selected)?.nodeType === 'reglementaire'} · <b>cible de taux BC anticipée</b>{/if}</div>{/if}
            {#if held}
              {@const inPerimeter = canActOn(selected)}
              {@const outOfReach = locked === 0 && !inPerimeter}
              <button onclick={() => reinforce(selected!)} disabled={view.over || paLeft() < 1}>Renforcer (+25%) · 1 PA{#if illiquid} · re-verrouille{/if}</button>
              <button onclick={() => partial(selected!)} disabled={view.over || paLeft() < 2 || locked > 0 || !inPerimeter}>Clôture partielle (−50%) · 2 PA{#if outOfReach} · 🔒{/if}</button>
              <button onclick={() => close(selected!)} disabled={view.over || paLeft() < 1 || locked > 0 || !inPerimeter}>Fermer (totale) · 1 PA{#if locked > 0 || outOfReach} · 🔒{/if}</button>
              {#if outOfReach}<div class="muted small">🔒 Hors de portée — rapproche-toi (hexe, adjacent, ou même cluster) pour clôturer.</div>{/if}
            {/if}
            {#if !canInvest && !canOccupy(selected) && !held && !credit}
              <div class="muted small">{here ? 'Rien à faire sur cet hexe.' : 'Pas adjacent / non accessible.'}</div>
            {/if}
          {:else}
            <div class="sel muted">Clique un hexe révélé.</div>
          {/if}
          {#if view.hasCarrySkill || view.hasCoverSkill}
            <div class="skill">
              {#if view.hasCarrySkill}
                <div class="court" style="margin:0">🦅 <b>Récolte</b> <span class="muted small">offensive · carry ×{view.skillFactor} · {view.skillDuration}t · {view.skillPaCost} PA</span></div>
                {#if view.skillActiveLeft > 0}<div class="court up" style="margin:.2rem 0">● Active — carry boosté sur {view.skillActiveLeft} tour(s) à venir</div>{/if}
                <button onclick={useSkill} disabled={view.over || paLeft() < view.skillPaCost || view.skillReadyIn > 0}>
                  {view.skillReadyIn > 0 ? `🔒 prête dans ${view.skillReadyIn} tour(s)` : `Activer · carry ×${view.skillFactor} (${view.skillPaCost} PA)`}
                </button>
              {/if}
              {#if view.hasCoverSkill}
                <div class="court" style="margin:.45rem 0 0">🛡️ <b>Couverture</b> <span class="muted small">défensive · anti-défaut {view.coverWindow}t · {view.coverPaCost} PA</span></div>
                {#if view.coverArmedLeft > 0}<div class="court up" style="margin:.2rem 0">● Armée — coupons protégés du défaut {view.coverArmedLeft} tour(s) (auto-tir en crise)</div>{/if}
                <button onclick={armCover} disabled={view.over || paLeft() < view.coverPaCost || view.coverReadyIn > 0}>
                  {view.coverReadyIn > 0 ? `🔒 prête dans ${view.coverReadyIn} tour(s)` : `Armer · anti-défaut ${view.coverWindow}t (${view.coverPaCost} PA)`}
                </button>
              {/if}
            </div>
          {/if}
          {#if view.dryPowderMax > 0}
            <div class="skill">
              <div class="court" style="margin:0">🦅 <b>Réserve sèche</b> <b class="up">{view.dryPowder}/{view.dryPowderMax}</b> <span class="muted small">+1/tour patient</span></div>
              <div class="muted small">Déployer dans un krach (forte fragilité) achète <b>décoté</b> — la poudre fixe la ristourne, puis se vide.</div>
            </div>
          {/if}
          <div class="cash">
            Réserve : <b>{view.cash.toFixed(0)}</b> · Richesse : <b>{view.wealth.toFixed(0)}</b><br />
            {#if view.cash > view.cashCarryFloor}
              {@const carry = view.bcRate * (view.cash - view.cashCarryFloor)}
              💰 Poudre sèche : <b class="up">+{carry.toFixed(2)}/t</b> <span class="muted">(r_BC {(view.bcRate * 100).toFixed(2)}% sur la réserve au-dessus de {view.cashCarryFloor})</span><br />
            {:else}
              <span class="muted">💤 Réserve sous la franchise ({view.cashCarryFloor}) — pas de carry cash.</span><br />
            {/if}
            P&L latent global : <b class:up={view.latentTotal > 0.5} class:down={view.latentTotal < -0.5}>{view.latentTotal >= 0 ? '+' : ''}{view.latentTotal.toFixed(1)}</b>
          </div>
          <button class="end" onclick={endTurn} disabled={view.over}>Fin du tour</button>
          {#if view.over}<div class="over">Partie terminée — Track Record : <b>{fmtPct(view.track.you - view.track.market)}</b> vs marché</div>{/if}
        </section>

        <section class="tx">
          <h3>Transactions <span class="hint">P&L réalisé</span></h3>
          {#if transactions.length === 0}<div class="muted small">Aucune transaction fermée.</div>{/if}
          {#each transactions as t}
            <div class="tx-row">
              <span>T{t.turn} · <span class:short-tag={t.dir === 'short'} class:long-tag={t.dir === 'long'}>{t.dir === 'short' ? 'S' : 'L'}</span> {t.label}</span>
              <b class:up={t.pnl > 0.05} class:down={t.pnl < -0.05}>{t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(1)}</b>
            </div>
          {/each}
        </section>

        <section class="log">
          <h3>Journal</h3>
          {#each log as line}<div>{line}</div>{/each}
        </section>

        <section class="newgame">
          <select bind:value={archetypeId} title="Archétype joué">
            {#each PLAYABLE_ARCHETYPES as a}<option value={a.id}>{a.label}</option>{/each}
          </select>
          <input type="number" bind:value={seed} min="1" />
          <button onclick={() => newGame(seed)}>Nouvelle partie</button>
          <button class:active={debug} title="Révéler l'état caché (F, ancres)" onclick={() => (debug = !debug)}>🐞</button>
        </section>
      </aside>
    </div>
  {/if}
</main>

<style>
  :global(body) { margin: 0; background: #14161c; color: #cdd3df; font-family: system-ui, sans-serif; }
  main { max-width: 980px; margin: 0 auto; padding: 1rem; }
  header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #2a2f3a; padding-bottom: .5rem; }
  .title { font-size: 1.3rem; font-weight: 700; }
  .sub { color: #7a8294; font-weight: 400; font-size: .85rem; }
  .tagline { color: #9aa3b5; font-size: .8rem; font-style: italic; margin-top: .1rem; }
  .status { display: flex; gap: 1rem; font-size: .85rem; color: #9aa3b5; flex-wrap: wrap; }
  .status b { color: #e6ebf5; }
  b.crise, .neg { color: #e0564f; }
  .board { display: grid; grid-template-columns: 1fr 300px; gap: 1rem; margin-top: 1rem; }
  .map { width: 100%; background: #0e1015; border-radius: 8px; }
  .hex { cursor: pointer; }
  .hex polygon { stroke: #0e1015; stroke-width: 2; }
  .hex.owned polygon { stroke: #e8b54a; stroke-width: 3.5; }
  .hex.openable polygon { stroke: #6fae8f; stroke-width: 3; stroke-dasharray: 5 3; }
  .hex.selected polygon { stroke: #fff; stroke-width: 3.5; }
  .hex.here polygon { stroke: #f0f3f9; }
  polygon.frontier { opacity: .45; stroke-dasharray: 4 3; }
  polygon.fog { fill: #181b22; stroke: #23272f; stroke-width: 2; }
  .fogq { fill: #3c424e; font-size: 18px; text-anchor: middle; pointer-events: none; }
  .token { fill: #f0f3f9; stroke: #14161c; stroke-width: 1.5; }
  .label { fill: #eef1f7; font-size: 11px; text-anchor: middle; pointer-events: none; }
  .vval { fill: #aeb6c6; font-size: 11px; text-anchor: middle; pointer-events: none; }
  .vval.up { fill: #46b277; } .vval.down { fill: #e0564f; }
  b.up, .up { color: #46b277; } b.down, .down { color: #e0564f; }
  .legend { font-size: .78rem; }
  .leg-row { display: flex; align-items: center; gap: .4rem; padding: .12rem 0; }
  .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
  .dot.you { background: #f0f3f9; }
  .debug { border-color: #4a3f6b; }
  .newgame button.active { background: #4a3f6b; border-color: #6b5a9b; }
  .tx { font-size: .76rem; }
  .tx-row { display: flex; justify-content: space-between; padding: .12rem 0; border-bottom: 1px solid #22262f; }
  .expo { fill: #e8b54a; font-size: 9px; text-anchor: middle; pointer-events: none; }
  .expo.short { fill: #d98cff; }
  .dir-row { display: grid; grid-template-columns: auto 1fr 1fr; align-items: center; gap: .3rem; font-size: .78rem; }
  .dir-row.longonly { grid-template-columns: auto 1fr; }
  .lockwarn { color: #d99a4a; }
  .dir-row button { margin: .25rem 0; }
  .dir-row button.active { background: #2f5d8a; border-color: #3b6ea0; }
  .lev-row { display: grid; grid-template-columns: auto 1fr 1fr 1fr; align-items: center; gap: .3rem; font-size: .78rem; }
  .lev-row button { margin: .25rem 0; }
  .lev-row button.active { background: #8a5a2f; border-color: #a06b3b; }
  .long-tag { color: #46b277; font-size: .72rem; margin-left: .3rem; }
  .short-tag { color: #d98cff; font-size: .72rem; margin-left: .3rem; }
  .pres { fill: #6aa6e0; font-size: 8px; text-anchor: middle; pointer-events: none; }
  .hex.presence polygon { stroke: #6aa6e0; stroke-width: 3; }
  .pct { color: #7a8294; font-size: .78rem; }
  aside { display: flex; flex-direction: column; gap: .8rem; }
  section { background: #1a1d25; border: 1px solid #2a2f3a; border-radius: 8px; padding: .7rem; }
  h3 { margin: 0 0 .5rem; font-size: .9rem; display: flex; justify-content: space-between; align-items: baseline; }
  .hint, .pa { font-weight: 400; font-size: .72rem; color: #7a8294; }
  .chain { font-size: .76rem; color: #9aa3b5; margin-bottom: .4rem; }
  .bar-row { display: grid; grid-template-columns: 90px 1fr; align-items: center; gap: .5rem; font-size: .78rem; margin: .25rem 0; }
  .bar { background: #0e1015; border-radius: 3px; height: 10px; overflow: hidden; }
  .fill { background: linear-gradient(90deg, #3a7d5a, #d9a23a, #d9543a); height: 100%; }
  button { width: 100%; margin: .25rem 0; padding: .45rem; background: #2a3140; color: #e6ebf5; border: 1px solid #39414f; border-radius: 5px; cursor: pointer; font-size: .82rem; }
  button:hover:not(:disabled) { background: #333c4d; }
  button:disabled { opacity: .4; cursor: not-allowed; }
  button.end { background: #2f5d8a; border-color: #3b6ea0; margin-top: .5rem; }
  .sel { font-size: .82rem; margin-bottom: .3rem; display: flex; justify-content: space-between; align-items: center; }
  .qmark { width: auto; margin: 0; padding: 0 .45rem; border-radius: 50%; background: #2a3140; line-height: 1.4; }
  .court { font-size: .76rem; color: #aeb6c6; margin-bottom: .3rem; }
  .long { font-size: .76rem; color: #cdd3df; background: #0e1015; border-radius: 5px; padding: .45rem; margin-bottom: .4rem; line-height: 1.35; }
  .open-row { display: grid; grid-template-columns: auto 1fr 1fr 1fr; align-items: center; gap: .3rem; font-size: .78rem; }
  .open-row button { margin: .25rem 0; }
  .coupon { background: #0e1015; border-radius: 5px; padding: .4rem; margin: .3rem 0; }
  .coupon .small { margin-bottom: .2rem; }
  .lire { width: auto; margin: 0; padding: .15rem .4rem; font-size: .72rem; }
  .locked { font-size: .72rem; color: #c79a4a; }
  .small { font-size: .72rem; } .muted { color: #7a8294; }
  .sismo { border-color: #6b4a3f; }
  .skill { background: #1d2230; border: 1px solid #3a4459; border-radius: 6px; padding: .45rem; margin: .4rem 0; }
  .skill button { margin: .3rem 0 0; }
  .cash { font-size: .78rem; color: #9aa3b5; margin: .4rem 0; }
  .over { font-size: .8rem; color: #e8b54a; margin-top: .5rem; }
  .log { font-size: .76rem; color: #9aa3b5; }
  .log div { padding: .1rem 0; border-bottom: 1px solid #22262f; }
  .newgame { display: flex; gap: .4rem; flex-wrap: wrap; }
  .newgame input { width: 70px; background: #0e1015; color: #cdd3df; border: 1px solid #39414f; border-radius: 5px; padding: .3rem; }
  .newgame select { background: #0e1015; color: #cdd3df; border: 1px solid #39414f; border-radius: 5px; padding: .3rem; flex: 1; min-width: 120px; }
  .newgame button { margin: 0; }
</style>
