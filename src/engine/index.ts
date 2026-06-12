// Point d'entrée public du moteur. Le moteur est du TS pur, importable depuis un
// script Node sans toucher au navigateur (c'est le contrat de J1).

export * from './types';
export * from './rng';
export * from './params';
export * from './simulate';
export { mapNeighborProblems, isConnected } from './map-utils';
