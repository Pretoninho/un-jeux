// Générateur de carte hexagonale procédurale (memo §11, phase 2 — version test).
// Point clé : les voisins sont calculés depuis les coordonnées AXIALES → l'adjacence
// de jeu est exactement la frontière géométrique. « Ce qui borde ton hexe = ce dans
// quoi tu peux chaîner. » Seedé : même seed ⇒ même carte (« toujours générée »).

import type { GameMap, Hex, Cluster, NodeType } from '../../engine/types';
import { makeRng } from '../../engine/rng';

const DIRS: Array<[number, number]> = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
];

const CLUSTERS: Cluster[] = ['credit', 'actions', 'alternatifs'];
const NODE_TYPES: NodeType[] = ['reglementaire', 'liquidite', 'information'];

// Charges structurelles par cluster (memo §25.1), points de départ.
const PROFILE: Record<Cluster, { beta: number; gamma: number; carry: number }> = {
  credit: { beta: 0.5, gamma: 0.8, carry: 0.04 },
  actions: { beta: 1.0, gamma: 0.9, carry: 0.015 },
  alternatifs: { beta: 0.8, gamma: 0.6, carry: 0.03 },
};

const key = (q: number, r: number) => `h_${q}_${r}`;
const dist = (q: number, r: number) => (Math.abs(q) + Math.abs(q + r) + Math.abs(r)) / 2;

/** Carte hexagonale de rayon `radius` (1+3R(R+1) hexes). R=3 → 37 hexes. */
export function generateHexMap(seed: number, radius = 3): GameMap {
  const rng = makeRng(seed * 101 + 7);
  const coords: Array<[number, number]> = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      coords.push([q, r]);
    }
  }
  const present = new Set(coords.map(([q, r]) => key(q, r)));

  // Type de chaque hexe : nœuds et frontières tirés au sort, le reste = marché.
  const nodeCount = Math.max(2, Math.floor(coords.length * 0.1));
  const frontierCount = Math.max(2, Math.floor(coords.length * 0.12));
  const kindOf = new Map<string, 'marche' | 'noeud' | 'frontiere'>();
  for (const [q, r] of coords) kindOf.set(key(q, r), 'marche');

  // Frontières : sur le pourtour (distance = radius).
  const rim = coords.filter(([q, r]) => dist(q, r) === radius);
  for (let i = 0; i < frontierCount && rim.length; i++) {
    const idx = rng.int(0, rim.length - 1);
    const [q, r] = rim.splice(idx, 1)[0]!;
    kindOf.set(key(q, r), 'frontiere');
  }
  // Nœuds : n'importe où sauf le centre (spawn) et hors frontières déjà posées.
  const inner = coords.filter(([q, r]) => dist(q, r) > 0 && kindOf.get(key(q, r)) === 'marche');
  for (let i = 0; i < nodeCount && inner.length; i++) {
    const idx = rng.int(0, inner.length - 1);
    const [q, r] = inner.splice(idx, 1)[0]!;
    kindOf.set(key(q, r), 'noeud');
  }

  // Cluster par secteur angulaire → clusters contigus (corrélation cohérente).
  const clusterOf = (q: number, r: number): Cluster => {
    const px = Math.sqrt(3) * (q + r / 2);
    const py = 1.5 * r;
    const a = Math.atan2(py, px) + Math.PI; // 0..2π
    return CLUSTERS[Math.floor(a / ((2 * Math.PI) / 3)) % 3]!;
  };

  let nodeI = 0;
  const hexes: Hex[] = coords.map(([q, r]) => {
    const id = key(q, r);
    const kind = kindOf.get(id)!;
    const neighbors = DIRS
      .map(([dq, dr]) => key(q + dq, r + dr))
      .filter((n) => present.has(n));
    if (kind === 'noeud') {
      const nt = NODE_TYPES[nodeI++ % NODE_TYPES.length]!;
      const labels: Record<NodeType, string> = { reglementaire: 'BC', liquidite: 'PB', information: 'Not' };
      return { id, label: labels[nt], kind, nodeType: nt, neighbors, coord: { q, r } };
    }
    const cluster = clusterOf(q, r);
    const p = PROFILE[cluster];
    const short: Record<Cluster, string> = { credit: 'Créd', actions: 'Act', alternatifs: 'Alt' };
    return {
      id,
      label: short[cluster],
      kind,
      cluster,
      beta: p.beta,
      gamma: p.gamma,
      carry: kind === 'frontiere' ? p.carry * 1.5 : p.carry,
      neighbors,
      coord: { q, r },
    };
  });

  return { id: `gen-${seed}-r${radius}`, hexes };
}
