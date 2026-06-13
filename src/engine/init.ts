// Construction de l'état initial à partir d'une ConfigPartie.

import type { ConfigPartie } from './types';
import type { GameState, ActorState } from './state';
import { makeRng, type Rng } from './rng';
import { drawInstanceParams } from './params';

const START_CAPITAL = 100;
const START_V = 100;

export interface InitResult {
  state: GameState;
  rng: Rng;
}

export function buildInitialState(config: ConfigPartie): InitResult {
  // Deux flux RNG INDÉPENDANTS, tous deux dérivés du seed (reproductibilité intacte) :
  //  - `rng` (monde) : ne dépend QUE du seed → ajouter des paramètres ne décale jamais
  //    le comportement seedé (tests, calibrage). Crucial : la phase 2a ajoute des params.
  //  - flux params (salé) : tire les InstanceParams sans toucher au flux du monde.
  const rng = makeRng(config.seed);
  const params = drawInstanceParams(makeRng((config.seed ^ 0x9e3779b9) >>> 0));

  const market: GameState['market'] = {};
  for (const hex of config.carte.hexes) {
    if (hex.kind === 'marche' || hex.kind === 'frontiere') {
      market[hex.id] = { V: START_V, A: START_V };
    }
  }

  const mkActor = (id: string): ActorState => ({
    id,
    cash: START_CAPITAL,
    positions: [],
    wealthHistory: [START_CAPITAL],
  });

  const actors: ActorState[] = [
    mkActor(config.archetype.id),
    ...config.adversaires.map((a) => mkActor(a.id)),
  ];

  const state: GameState = {
    turn: 0,
    rngSeed: config.seed,
    params,
    map: config.carte,
    fragility: params.f0, // F(0) tiré en plage cachée (memo §23.1)
    regime: 'bull',
    bullStreak: 0,
    crisis: {
      active: false,
      phase: 'none',
      triggeredTurn: -1,
      amplitude: 0,
      phaseTurnsLeft: 0,
      durations: { leg1: 0, bounce: 0, leg3: 0 },
      bounceRecovery: 0,
      isRealFloor: false,
      recoveryTurnsLeft: 0,
    },
    market,
    actors,
    fragilityHistory: [params.f0],
    crisisTurns: [],
    benchmarkHistory: [1],
    signalsHistory: [],
  };

  return { state, rng };
}
