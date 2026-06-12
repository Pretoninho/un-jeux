// Point d'entrée public du moteur. TS pur, importable depuis Node sans navigateur.

export * from './types';
export * from './rng';
export * from './params';
export * from './state';
export * from './regime';
export * from './market';
export * from './portfolio';
export * from './fragility';
export * from './signals';
export * from './score';
export * from './policy';
export * from './ai';
export * from './init';
export * from './turn';
export * from './simulate';
export { mapNeighborProblems, isConnected } from './map-utils';
